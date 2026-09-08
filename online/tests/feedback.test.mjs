import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, view } from '../work/tests/game/engine.js';
import { describeChanges } from '../work/tests/game/feedback.js';
import { rankActions } from '../work/tests/game/ai.js';
function initial() {
  return createGame(
    Array.from({ length: 3 }, (_, i) => ({
      id: String(i),
      name: `玩家${i}`,
      shaman: i,
    })),
    41,
  );
}
test('反馈区区分暂未得分的供奉、守夜加分与终局共同失败', () => {
  const before = view(initial(), 0),
    after = structuredClone(before);
  after.seats[0].offerings.push({
    player: 0,
    element: '骨',
    card: { id: 999, element: '骨' },
  });
  assert.ok(
    describeChanges(before, after).some((s) => s.includes('声音渐渐清晰')),
  );
  after.players[0].score.total += 5;
  after.players[0].score.bonus += 2;
  assert.ok(
    describeChanges(before, after).some((s) => s.includes('+5分（含守夜奖励')),
  );
  after.phase = 'ended';
  after.failed = true;
  assert.ok(describeChanges(before, after).some((s) => s.includes('分数作废')));
});
test('补神反馈不把新神误报为旧神供奉进展；效果选牌也有反馈', () => {
  const before = view(initial(), 0),
    after = structuredClone(before);
  after.seats[0].god = (before.seats[0].god + 1) % 12;
  after.seats[0].offerings.push({
    player: 0,
    element: '骨',
    card: { id: 999, element: '骨' },
  });
  const lines = describeChanges(before, after);
  assert.ok(lines.some((s) => s.includes('后备剩')));
  assert.ok(!lines.some((s) => s.includes('声音渐渐清晰')));
  const pending = structuredClone(before);
  pending.prompt = '选择留下的记忆';
  assert.ok(describeChanges(before, pending).includes(pending.prompt));
  assert.deepEqual(describeChanges(before, structuredClone(before)), []);
});
test('AI会为恢复心智祈求火姥神，但手牌紧张时保留主行动资源', () => {
  const v = view(initial(), 0);
  v.players[0].mind = 3;
  v.players[0].hand = [
    { id: 998, element: '潮' },
    { id: 999, element: '星' },
  ];
  v.actions = [
    { id: '0', label: '跳过辅助，进入主行动', group: '辅助' },
    { id: '1', label: '弃「潮」，祈神 · 火姥神', group: '祈神', cards: [998] },
  ];
  assert.equal(rankActions(v, 0)[0].id, '1');
  v.players[0].hand.pop();
  assert.equal(rankActions(v, 0)[0].id, '0');
});

import { actionMemories, choiceKey } from '../work/tests/game/presentation.js';
test('寻忆预览读取翻开的记忆，等价组合合并且不猜测未知牌', () => {
  const v = view(initial(), 0);
  v.pool = [
    { id: 901, element: '潮' },
    { id: 902, element: '风' },
    { id: 903, element: '潮' },
  ];
  const a = { id: 'a', label: '留下潮风', group: '寻忆', cards: [901, 902] };
  const b = { ...a, id: 'b', label: '留下风潮', cards: [902, 903] };
  assert.deepEqual(
    actionMemories(v, 0, a).map((c) => c.element),
    ['潮', '风'],
  );
  assert.equal(choiceKey(v, 0, a), choiceKey(v, 0, b));
  assert.deepEqual(actionMemories(v, 0, { ...a, cards: [9999] }), []);
});
