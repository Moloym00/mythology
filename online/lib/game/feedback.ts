import { GODS } from './content';
import type { GameView } from './engine';

export function describeChanges(before: GameView, after: GameView): string[] {
  const lines: string[] = [];
  after.players.forEach((p, i) => {
    const old = before.players[i];
    if (!old) return;
    const score = p.score.total - old.score.total;
    if (score)
      lines.push(
        `${p.name} ${score > 0 ? '+' : ''}${score}分${p.score.bonus > old.score.bonus ? '（含守夜奖励＋2）' : ''}`,
      );
    for (const id of p.awake.filter((id) => !old.awake.includes(id)))
      lines.push(`${p.name}唤醒了${GODS[id].name}，获得可重复祈求的神恩`);
    for (const r of p.rested.filter(
      (r) => !old.rested.some((o) => o.god === r.god),
    ))
      lines.push(`${p.name}安魂${GODS[r.god].name}，获得一次遗赠`);
    if (p.mind !== old.mind)
      lines.push(`${p.name}心智 ${old.mind} → ${p.mind}`);
    if (p.handCount !== old.handCount)
      lines.push(`${p.name}手牌 ${old.handCount} → ${p.handCount}`);
  });
  after.seats.forEach((s, i) => {
    const old = before.seats[i];
    if (s.god !== null && s.god !== old.god)
      lines.push(
        `${i + 1}号神座迎来${GODS[s.god].name}，后备剩${after.godCount}尊`,
      );
    if (s.ruins && !old.ruins) lines.push(`${i + 1}号神座永久关闭，不再补神`);
    if (s.god !== null && s.god === old.god && s.weather !== old.weather)
      lines.push(
        `${GODS[s.god].name}风化 ${old.weather} → ${s.weather}${s.weather === 2 ? '，现在可以安魂' : ''}`,
      );
    if (
      s.god !== null &&
      s.god === old.god &&
      s.offerings.length > old.offerings.length
    )
      lines.push(`${GODS[s.god].name}真名 ${s.offerings.length}/3，尚未计分`);
  });
  if (after.communal.length > before.communal.length)
    lines.push('众声觉醒：神留在公共区，不属于任何玩家');
  if (after.round !== before.round)
    lines.push(`进入第${after.round}轮，风暴与严寒开始结算`);
  if (!lines.length && before.step !== after.step)
    lines.push(
      after.step === 'main'
        ? '辅助结束，现在选择供奉、安魂或寻忆'
        : after.step === 'cleanup'
          ? '主行动完成，整理手牌后才补入新神'
          : '新回合开始',
    );
  if (!lines.length && after.logs.at(-1) !== before.logs.at(-1))
    lines.push(after.logs.at(-1)!);
  if (!lines.length && after.chorusReady.length > before.chorusReady.length)
    lines.push('合诵选择已锁定，等待其他人同时揭晓');
  if (after.prompt && after.prompt !== before.prompt) lines.push(after.prompt);
  if (after.phase === 'ended' && before.phase !== 'ended')
    lines.push(
      after.failed
        ? '四座全毁：共同失败，本局分数作废。'
        : '守夜结束，最终分数已结算。',
    );
  return lines;
}
