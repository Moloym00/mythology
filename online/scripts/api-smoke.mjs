import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
async function post(body, token) {
  const r = await fetch(`${origin}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function get(code, token) {
  const r = await fetch(`${origin}/api/rooms?code=${code}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: r.status, data: await r.json() };
}
const created = await post({ type: 'create', name: '接口检查甲' });
assert.equal(created.status, 200, JSON.stringify(created.data));
const { code } = created.data;
const tokens = [created.data.token];
assert.equal((await get(code, 'invalid')).status, 400, '不能无凭证看房间');
for (const name of ['接口检查乙', '接口检查丙']) {
  const joined = await post({ type: 'join', code, name });
  assert.equal(joined.status, 200);
  tokens.push(joined.data.token);
}
let state = (await get(code, tokens[0])).data;
assert.equal(
  (await post({ type: 'start', code, revision: state.revision }, tokens[1]))
    .status,
  400,
  '只有房主能开局',
);
const started = await post(
  { type: 'start', code, revision: state.revision },
  tokens[0],
);
assert.equal(started.status, 200, JSON.stringify(started.data));
const repeated = await post(
  { type: 'start', code, revision: state.revision },
  tokens[0],
);
assert.equal(repeated.status, 409, '过期revision拒绝');
state = started.data;
assert.equal(state.game.players[1].hand.length, 0);
assert.equal(state.game.players[2].hand.length, 0);
assert.ok(!JSON.stringify(state).includes('tokenHash'));
assert.ok(!('deck' in state.game));
assert.ok(!('rng' in state.game));
const acting = state.game.acting;
const a = (await get(code, tokens[acting])).data;
const command = {
  type: 'act',
  code,
  revision: a.revision,
  action: a.game.actions[0].id,
};
const raced = await Promise.all([
  post(command, tokens[acting]),
  post(command, tokens[acting]),
]);
assert.deepEqual(
  raced.map((r) => r.status).sort((a, b) => a - b),
  [200, 409],
  '同时重复行动只能生效一次',
);
const restored = await get(code, tokens[acting]);
assert.equal(restored.status, 200);
assert.equal(restored.data.revision, a.revision + 1, '新请求携旧凭证恢复座位');
console.log(
  'API smoke passed: create, join, host-only start, private hand projection, stale revision, atomic duplicate rejection, reconnect.',
);
console.log(`Local test room: ${code}`);
