import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, actions, act, view } from '../work/tests/game/engine.js';
import { rankActions, chooseAI, modelPayload } from '../work/tests/game/ai.js';
import { changeRoom, roomView } from '../work/tests/rooms.js';
const human = { id: 'human', name: '你', shaman: 0, tokenHash: 'private-hash' };
function room() {
  let r = { members: [human], game: null, createdAt: 0 };
  r = changeRoom(r, 'human', { type: 'addBot' }, 1);
  return changeRoom(r, 'human', { type: 'addBot' }, 1);
}
test('房主添加两位AI即可开局；角色互斥；非房主不可设置', () => {
  let r = room();
  assert.equal(r.members.length, 3);
  assert.equal(new Set(r.members.map((m) => m.shaman)).size, 3);
  assert.ok(r.members[1].bot);
  assert.throws(() => changeRoom(r, r.members[1].id, { type: 'addBot' }, 1));
  r = changeRoom(r, 'human', { type: 'start' }, 5);
  assert.ok(r.game);
  assert.throws(() => changeRoom(r, 'human', { type: 'addBot' }, 1));
  assert.ok(
    !JSON.stringify(roomView('ABC234', 0, r, 'human')).includes('private-hash'),
  );
});
test('本地AI能完成三至六人整局，包含合诵与严寒', async () => {
  for (let n = 3; n <= 6; n++)
    for (let seed = 1; seed <= 5; seed++) {
      const members = Array.from({ length: n }, (_, i) => ({
        id: String(i),
        name: `AI${i}`,
        shaman: i,
      }));
      let g = createGame(members, seed);
      let steps = 0;
      while (g.phase !== 'ended' && steps++ < 2000) {
        const p = g.players.findIndex((_, i) => actions(g, i).length);
        assert.ok(p >= 0);
        const chosen = await chooseAI(view(g, p), p, {});
        g = act(g, p, chosen.action);
      }
      assert.equal(g.phase, 'ended');
    }
});
test('API载荷不含其他手牌、原始状态和凭证；非法回复、错误、超时走本地', async () => {
  const g = createGame(room().members, 23);
  const p = g.turn;
  const v = view(g, p);
  const payload = modelPayload(v, p);
  assert.equal(payload.state.players[(p + 1) % 3].hand.length, 0);
  assert.ok(!('rng' in payload.state));
  assert.ok(!('deck' in payload.state));
  const config = {
    baseUrl: 'https://example.test/v1',
    model: 'test-model',
    key: 'test-secret',
  };
  const fallback = rankActions(v, p)[0].id;
  for (const request of [
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"action":"999999"}' } }],
        }),
      ),
    async () => new Response('bad', { status: 503 }),
    async () => {
      throw new DOMException('timeout', 'TimeoutError');
    },
  ]) {
    const result = await chooseAI(v, p, config, request);
    assert.equal(result.action, fallback);
    assert.equal(result.mode, 'fallback');
  }
  let called = false;
  const result = await chooseAI(v, p, config, async (url, opts) => {
    called = true;
    assert.equal(url, 'https://example.test/v1/chat/completions');
    assert.equal(opts.headers.Authorization, 'Bearer test-secret');
    const body = JSON.parse(opts.body);
    assert.equal(body.model, 'test-model');
    assert.ok(!JSON.stringify(body).includes('test-secret'));
    return new Response(
      JSON.stringify({
        choices: [
          { message: { content: JSON.stringify({ action: fallback }) } },
        ],
      }),
    );
  });
  assert.ok(called);
  assert.equal(result.mode, 'api');
});
