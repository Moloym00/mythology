import test from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  actions,
  createGame,
  view,
  score,
  ELEMENTS,
} from '../work/tests/game/engine.js';
import { roomView, changeRoom } from '../work/tests/rooms.js';

const members = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `萨满${i}`,
    shaman: i,
    tokenHash: `secret${i}`,
  }));
const card = (element, n = 0) => ({
  element,
  id: ELEMENTS.indexOf(element) * 12 + n,
});
function base() {
  const g = createGame(members(4), 17);
  g.turn = 0;
  g.starter = 0;
  g.phase = 'turn';
  g.step = 'main';
  g.seats.forEach((s) => {
    s.weather = 0;
    s.taboo = false;
    s.offerings = [];
  });
  return g;
}
function play(g, match, p = 0) {
  const a = actions(g, p).find(match);
  assert.ok(
    a,
    `missing action: ${match}; options: ${actions(g, p).map((a) => a.label)}`,
  );
  return act(g, p, a.id);
}
const label = (text) => (a) => a.label.includes(text);
function invariants(g) {
  const cards = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...g.seats.flatMap((s) => s.offerings.map((o) => o.card)),
    ...(g.pending?.pool ?? []),
  ];
  assert.equal(cards.length, 60, '记忆牌总量守恒');
  assert.equal(new Set(cards.map((c) => c.id)).size, 60, '记忆牌不能复制');
  assert.equal(
    g.gods.length +
      g.seats.filter((s) => s.god !== null || s.ruins).length +
      g.players.reduce((n, p) => n + p.awake.length + p.rested.length, 0) +
      g.communal.length,
    g.players.length === 3 ? 9 : 12,
    '神牌守恒',
  );
  g.players.forEach((p, i) => {
    assert.ok(p.mind >= 2 && p.mind <= 5);
    assert.ok(
      g.seats.flatMap((s) => s.offerings).filter((o) => o.player === i)
        .length <= 4,
    );
  });
  g.seats.forEach((s) => {
    assert.ok(s.weather >= 0 && s.weather <= 2);
    assert.equal(
      new Set(s.offerings.map((o) => o.element)).size,
      s.offerings.length,
    );
  });
}

test('人数配置与初次神座符合规则；相同种子可复现', () => {
  for (const [n, rounds] of [
    [3, 9],
    [4, 11],
    [5, 10],
    [6, 10],
  ]) {
    const g = createGame(members(n), 8);
    assert.equal(g.maxRounds, rounds);
    assert.deepEqual(
      g.seats.map((s) => s.god),
      [0, 2, 4, 9],
    );
    invariants(g);
    assert.deepEqual(g, createGame(members(n), 8));
  }
  assert.throws(() => createGame(members(2), 1));
});
test('心智二只能主动烧炎；严寒仍可烧其他牌', () => {
  const g = base();
  g.step = 'aux';
  g.players[0].mind = 2;
  g.players[0].hand = [card('骨'), card('炎')];
  assert.deepEqual(
    actions(g, 0)
      .filter((a) => a.group === '燃忆')
      .map((a) => a.label),
    ['燃忆「炎」'],
  );
  g.phase = 'cold';
  g.currentStorm = 8;
  g.coldIndex = 0;
  assert.equal(actions(g, 0).length, 2);
});
test('两枚供奉者得神；其他供奉者得余音；补神延后', () => {
  let g = base();
  g.seats[0].offerings = [
    { player: 1, card: card('骨'), element: '骨' },
    { player: 1, card: card('潮'), element: '潮' },
  ];
  g.players[0].hand = [card('风')];
  g = play(g, (a) => a.group === '供奉' && a.target === 0);
  assert.deepEqual(g.players[1].awake, [0]);
  assert.equal(g.players[0].echo, 1);
  assert.equal(g.seats[0].god, null);
  g = play(g, label('结束回合'));
  assert.notEqual(g.seats[0].god, null);
});
test('众声觉醒不归玩家；织名者额外一点', () => {
  let g = base();
  g.players[0].shaman = 4;
  g.seats[0].offerings = [
    { player: 1, card: card('骨'), element: '骨' },
    { player: 2, card: card('潮'), element: '潮' },
  ];
  g.players[0].hand = [card('风')];
  g = play(g, (a) => a.group === '供奉' && a.target === 0);
  assert.deepEqual(g.communal, [0]);
  assert.equal(g.players[0].echo, 2);
  assert.equal(g.players[1].echo, 1);
  assert.equal(g.players[2].echo, 1);
});
test('安魂先支付骨与禁忌，返还供奉、恢复心智、摸牌', () => {
  let g = base();
  g.seats[0].weather = 2;
  g.seats[0].taboo = true;
  g.seats[0].offerings = [{ player: 0, card: card('潮'), element: '潮' }];
  g.players[0].hand = [card('骨')];
  assert.equal(
    actions(g, 0).filter((a) => a.group === '安魂').length,
    0,
    '不能提前取回供奉支付',
  );
  g.players[0].hand.push(card('风'));
  g.players[0].mind = 3;
  g = play(g, (a) => a.group === '安魂');
  assert.equal(g.players[0].mind, 4);
  assert.equal(g.players[0].hand.length, 2);
  assert.equal(g.players[0].rested[0].god, 0);
});
test('移渡不支付禁忌且能立即觉醒', () => {
  let g = base();
  g.step = 'aux';
  g.seats[0].offerings = [{ player: 0, card: card('风'), element: '风' }];
  g.seats[1].taboo = true;
  g.seats[1].offerings = [
    { player: 0, card: card('炎'), element: '炎' },
    { player: 1, card: card('星'), element: '星' },
  ];
  g.players[0].hand = [];
  g = play(g, (a) => a.group === '守艺' && a.target === 1);
  assert.deepEqual(g.players[0].awake, [2]);
  assert.equal(g.step, 'main');
});
test('刻骨者只替代供奉槽语素，不替代安魂祭品', () => {
  let g = base();
  g.players[0].shaman = 2;
  g.players[0].hand = [card('星')];
  g.seats[0].weather = 2;
  assert.ok(actions(g, 0).some(label('作「骨」')));
  assert.ok(!actions(g, 0).some((a) => a.group === '安魂'));
  g = play(g, (a) => a.target === 0 && a.label.includes('作「骨」'));
  assert.equal(g.seats[0].offerings[0].card.element, '星');
  assert.equal(g.seats[0].offerings[0].element, '骨');
});
test('守火人先减风化后烧骨，无燃忆额外摸牌', () => {
  let g = base();
  g.step = 'aux';
  g.players[0].shaman = 3;
  g.players[0].hand = [card('骨')];
  g.seats[0].weather = 2;
  g = play(g, (a) => a.group === '守艺' && a.target === 0);
  assert.equal(g.seats[0].weather, 1);
  g = play(g, (a) => a.target === 0 && a.label.includes('−1'));
  assert.equal(g.seats[0].weather, 0);
  assert.equal(g.players[0].hand.length, 0);
  assert.equal(g.step, 'main');
});
test('玉米神不能取回本次祈神支付的牌', () => {
  let g = base();
  g.step = 'aux';
  g.players[0].awake = [8];
  g.players[0].hand = [card('骨')];
  g.discard = [card('风')];
  g = play(g, (a) => a.group === '祈神');
  assert.ok(!actions(g, 0).some(label('骨')));
  g = play(g, (a) => a.label.startsWith('取回'));
  assert.deepEqual(
    g.players[0].hand.map((c) => c.element),
    ['风'],
  );
  assert.ok(g.discard.some((c) => c.element === '骨'));
});
test('乌伦恢复心智，即使供奉让别人得神；奥贡免禁忌', () => {
  let g = base();
  g.step = 'aux';
  g.players[0].awake = [10];
  g.players[0].mind = 3;
  g.players[0].hand = [card('骨'), card('潮')];
  g.seats[1].offerings = [
    { player: 1, card: card('炎'), element: '炎' },
    { player: 1, card: card('风'), element: '风' },
  ];
  g = play(g, (a) => a.group === '祈神' && a.cards.includes(0));
  g = play(g, (a) => a.group === '供奉' && a.target === 1);
  assert.equal(g.players[0].mind, 4);
  assert.deepEqual(g.players[1].awake, [2]);
  let h = base();
  h.step = 'aux';
  h.players[0].awake = [7];
  h.players[0].hand = [card('星'), card('骨')];
  h.seats[0].taboo = true;
  h = play(h, (a) => a.group === '祈神' && a.cards.includes(48));
  h = play(h, (a) => a.group === '供奉' && a.target === 0);
  assert.equal(h.seats[0].taboo, false);
  assert.equal(h.players[0].hand.length, 0);
});
test('所有十二神的遗赠可以结算到主行动，且只用一次', () => {
  for (let god = 0; god < 12; god++) {
    let g = base();
    g.step = 'aux';
    g.players[0].rested = [{ god, used: false }];
    g.seats[0].weather = 1;
    g.seats[1].taboo = true;
    g.discard = [card('骨', 11), card('风', 11)];
    g = play(g, (a) => a.group === '遗赠');
    for (let n = 0; g.pending && n < 10; n++)
      g = act(g, 0, actions(g, 0)[0].id);
    assert.equal(g.step, 'main');
    assert.equal(g.players[0].rested[0].used, true);
  }
});
test('秘密合诵在所有人提交前不泄露，揭晓后抵消风化', () => {
  let g = base();
  g.phase = 'chorus';
  g.currentStorm = 8;
  g.chorusDone = true;
  g.seats[0].weather = 1;
  g.players[0].hand = [card('骨')];
  g.players[1].hand = [card('潮')];
  g.players[2].hand = [card('风')];
  g = play(g, (a) => a.target === 0, 0);
  const other = view(g, 1);
  assert.equal(other.players[0].hand.length, 0);
  assert.equal(other.players[0].handCount, 1);
  assert.equal(
    other.logs.some((l) => l.includes('合诵「骨」')),
    false,
  );
  assert.ok(!('chorus' in other));
  g = play(g, (a) => a.target === 0, 1);
  g = play(g, (a) => a.target === 0, 2);
  g = play(g, label('不出牌'), 3);
  assert.equal(g.seats[0].weather, 1);
  assert.ok(g.logs.some((l) => l.includes('合诵护住')));
});
test('最后一座湮灭立即结束，不结算后续严寒', () => {
  let g = base();
  g.phase = 'chorus';
  g.currentStorm = 8;
  g.seats.slice(1).forEach((s) => Object.assign(s, { god: null, ruins: true }));
  g.seats[0].weather = 2;
  const originalMind = g.players.map((p) => p.mind);
  for (let p = 0; p < 4; p++) g = play(g, label('不出牌'), p);
  assert.equal(g.phase, 'ended');
  assert.equal(g.failed, true);
  assert.deepEqual(
    g.players.map((p) => p.mind),
    originalMind,
  );
});
test('整理必须弃到上限；最后一轮剩余玩家都能行动', () => {
  let g = base();
  g.step = 'cleanup';
  g.players[0].mind = 2;
  g.players[0].hand = [card('骨'), card('风'), card('潮')];
  assert.ok(!actions(g, 0).some(label('结束回合')));
  g = play(g, label('弃置'));
  g.lastRound = true;
  g = play(g, label('结束回合'));
  assert.equal(g.phase, 'turn');
  assert.equal(g.turn, 1);
});
test('计分例20分；同分比较神数；失败无赢家', () => {
  const g = base();
  Object.assign(g.players[0], {
    awake: [0, 1],
    rested: [
      { god: 2, used: true },
      { god: 3, used: false },
    ],
    echo: 3,
  });
  assert.equal(score(g, g.players[0]).total, 20);
  g.players[1].echo = 20;
  g.phase = 'ended';
  assert.deepEqual(view(g, 0).winners, ['p0']);
  g.failed = true;
  assert.deepEqual(view(g, 0).winners, []);
});
test('房间身份与权限不从浏览器信任，投影无凭证、牌堆和随机种子', () => {
  const room = { members: members(4), game: base(), createdAt: 0 };
  const v = roomView('ABC234', 0, room, 'p0');
  const text = JSON.stringify(v);
  assert.ok(!text.includes('tokenHash'));
  assert.ok(!text.includes('secret'));
  assert.equal(v.game.players[1].hand.length, 0);
  assert.ok(!('rng' in v.game));
  assert.ok(!('storms' in v.game));
  assert.ok(!('gods' in v.game));
  assert.throws(() =>
    changeRoom({ ...room, game: null }, 'p1', { type: 'start' }, 1),
  );
  assert.throws(() => act(room.game, 1, '0'));
});
test('80局种子化流程检查：所有人数、合法行动、牌数守恒、能终局（不作为平衡结论）', () => {
  let count = 0;
  for (const n of [3, 4, 5, 6])
    for (let seed = 1; seed <= 20; seed++) {
      let g = createGame(members(n), seed);
      let r = seed;
      let steps = 0;
      while (g.phase !== 'ended' && steps++ < 3000) {
        invariants(g);
        const candidates = g.players.flatMap((_, p) =>
          actions(g, p).map((a) => ({ p, a })),
        );
        assert.ok(candidates.length > 0, `死锁: ${n}人 seed ${seed}`);
        r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
        const main = candidates.filter(
          (c) => c.a.group === '供奉' || c.a.group === '安魂',
        );
        const pool = main.length && r % 4 ? main : candidates;
        const chosen = pool[r % pool.length];
        g = act(g, chosen.p, chosen.a.id);
      }
      assert.equal(g.phase, 'ended', `${n}人 seed ${seed}不能终局`);
      invariants(g);
      count++;
    }
  assert.equal(count, 80);
});

test('风的巫术必须先承诺预见，不能偷看后改放禁忌', () => {
  let g = base();
  g.step = 'aux';
  g.players[0].hand = [card('风')];
  g = play(g, (a) => a.group === '燃忆');
  assert.equal(view(g, 0).forecast, null);
  g = play(g, (a) => a.label === '查看并调整风暴顶牌');
  assert.equal(view(g, 0).forecast.length, 2);
  assert.equal(view(g, 1).forecast, null);
  assert.ok(!actions(g, 0).some((a) => a.label.includes('禁忌')));
});
