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
      lines.push(`${p.name}唤醒了${GODS[id].name}，神恩从此回应这道呼唤`);
    for (const r of p.rested.filter(
      (r) => !old.rested.some((o) => o.god === r.god),
    ))
      lines.push(`${p.name}安魂${GODS[r.god].name}，留下最后一份馈赠`);
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
    if (s.ruins && !old.ruins)
      lines.push(`${i + 1}号神座化为废墟，再没有名字到来`);
    if (s.god !== null && s.god === old.god && s.weather !== old.weather)
      lines.push(
        `${GODS[s.god].name}风化 ${old.weather} → ${s.weather}${s.weather === 2 ? '，现在可以安魂' : ''}`,
      );
    if (
      s.god !== null &&
      s.god === old.god &&
      s.offerings.length > old.offerings.length
    )
      lines.push(
        `${GODS[s.god].name}真名 ${s.offerings.length}/3，声音渐渐清晰`,
      );
  });
  if (after.communal.length > before.communal.length)
    lines.push('众声觉醒：神留在众人之间');
  if (after.round !== before.round)
    lines.push(`进入第${after.round}轮，风雪又近了一些`);
  if (!lines.length && before.step !== after.step)
    lines.push(
      after.step === 'main'
        ? '火光初定。该供奉、安魂，或拾起新的记忆了。'
        : after.step === 'cleanup'
          ? '收拢手中的记忆，把火塘交给下一位守夜人。'
          : '新回合开始',
    );
  if (!lines.length && after.logs.at(-1) !== before.logs.at(-1))
    lines.push(after.logs.at(-1)!);
  if (!lines.length && after.chorusReady.length > before.chorusReady.length)
    lines.push('你的声音已藏入掌心，等待众人一同开口。');
  if (after.prompt && after.prompt !== before.prompt) lines.push(after.prompt);
  if (after.phase === 'ended' && before.phase !== 'ended')
    lines.push(
      after.failed
        ? '四座全毁：共同失败，本局分数作废。'
        : '守夜结束，最终分数已结算。',
    );
  return lines;
}
