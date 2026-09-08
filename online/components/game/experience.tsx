'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RULES } from '@/lib/game/config';
import { GODS } from '@/lib/game/content';
import type { GameView, PublicAction } from '@/lib/game/engine';

export function ScoreGuide({ g, self }: { g: GameView; self: number }) {
  const p = g.players[self];
  if (!p) return null;
  const threshold = RULES.setups[g.players.length as 3 | 4 | 5 | 6].vigil;
  return (
    <section className="score-guide panel">
      <div>
        <span className="eyebrow">你的当前计分</span>
        <strong>
          {g.failed ? '—' : p.score.total}
          <small>分</small>
        </strong>
        <p>四座全毁则共同失败，分数作废。</p>
      </div>
      <div className="score-parts">
        <div>
          <b>{p.score.awaken}</b>
          <span>唤醒 {p.awake.length}尊 × 5</span>
        </div>
        <div>
          <b>{p.score.rest}</b>
          <span>
            安魂 {p.rested.filter((r) => !r.used).length}尊 × 3<br />
            已用遗赠 {p.rested.filter((r) => r.used).length}尊 × 2
          </span>
        </div>
        <div>
          <b>{p.echo}</b>
          <span>余音，每点1分</span>
        </div>
        <div>
          <b>{p.score.bonus}</b>
          <span>
            守夜 {p.rested.length}/{threshold}尊<br />
            {p.score.bonus
              ? '已获额外2分'
              : `再安魂${threshold - p.rested.length}尊得2分`}
          </span>
        </div>
      </div>
      <details>
        <summary>为什么补神？怎样算赢？</summary>
        <p>
          四座神座是同时等待处理的神，不是整局只有四尊。唤醒或安魂后，空位在该玩家回合整理结束时，从有限的后备堆补一尊；湮灭的神座成为废墟，永久关闭。后备用尽就不再补。当前后备还剩{' '}
          {g.godCount} 尊。
        </p>
        <p>
          供奉本身不加分。三槽填满时，拥有至少两枚供奉印记者得神（5分），其他参与者每枚得1余音；三人各一枚则各得1余音，神归公共区。织名者在符合守艺条件时额外得1余音。
        </p>
        <p>
          最后一张风暴，或“后备用尽且在场至多一神”时，完成本轮后计分；四座全成废墟则立即全员失败。否则最高分成为传火者，同分先比唤醒＋安魂总尊数，再同分并列。
        </p>
      </details>
    </section>
  );
}

export function ActionPreview({
  g,
  self,
  action,
}: {
  g: GameView;
  self: number;
  action: PublicAction;
}) {
  const p = g.players[self],
    s = action.target === undefined ? undefined : g.seats[action.target];
  let text = '确认后按所选效果结算；需要指定目标或选牌时，还会继续让你选择。';
  if (action.group === '供奉' && s) {
    const own = s.offerings.filter((o) => o.player === self).length;
    if (s.offerings.length < 2)
      text = `现在不加分。真名进度 ${s.offerings.length}/3 → ${s.offerings.length + 1}/3，你在这尊神上的印记 ${own} → ${own + 1}。`;
    else {
      const owners = g.players.map(
        (_, i) =>
          s.offerings.filter((o) => o.player === i).length +
          (i === self ? 1 : 0),
      );
      const winner = owners.findIndex((n) => n >= 2);
      text =
        winner === self
          ? '补满后你获得这尊神：＋5分，并获得神恩。空位要到整理结束才补神。'
          : winner >= 0
            ? `补满后${g.players[winner].name}得神（＋5分），你得${p.shaman === 4 ? 2 : 1}余音。`
            : `三人各一枚，众声觉醒：你得${p.shaman === 4 ? 2 : 1}余音，神不归任何人。`;
    }
  } else if (action.group === '安魂') {
    const threshold = RULES.setups[g.players.length as 3 | 4 | 5 | 6].vigil;
    text = `安魂神＋3分${p.rested.length + 1 === threshold ? '，同时达成守夜奖励＋2分' : ''}；心智恢复1（最高5），摸1张。神上的供奉退回各自主人，空位在整理后补神。`;
  } else if (action.group === '遗赠')
    text =
      '消耗这份遗赠，神的价值由3分降为2分（−1分），仍计入安魂数量。具体效果随后结算。';
  else if (action.group === '燃忆') {
    const c = p.hand.find((c) => c.id === action.cards?.[0]);
    text = `燃烧${c?.element ?? '选定'}牌，${c?.element === '炎' ? '心智不降' : '心智上限−1（最低2）'}，发动巫术，再摸1张；${c?.element === '星' ? '星会直接＋1余音。' : '是否获分取决于后续效果。'}`;
  } else if (action.group === '寻忆' && action.cards?.length)
    text = '留下所选记忆，不直接加分；本次具体留牌数量以当前提示为准。';
  else if (action.group === '寻忆')
    text =
      '补充手牌，不直接加分。摸至多3张，选择至多2张留下；回合结束才弃到心智上限。';
  else if (action.label.includes('结束回合'))
    text = `结束整理，空神座依次补入后备神（剩${g.godCount}尊）；废墟不补。然后轮到下一位，或结算轮末。`;
  else if (action.label.includes('跳过辅助'))
    text = '不花牌、不改分数，直接进入主行动。辅助是可选步骤。';
  if (action.group === '祈神' || action.group === '遗赠') {
    const god = GODS.find((god) => action.label.includes(god.name));
    if (god)
      text = `${action.group === '祈神' ? '弃1张牌，不直接改分数。' : '使用后这尊神由3分降为2分（−1分）。'}${god.effect}`;
  }
  if (action.group === '整理' && action.cards?.length)
    text = '弃置这张记忆，不直接扣分。弃至心智上限后，再结束回合并补神。';
  if (action.group === '极夜合诵')
    text =
      '秘密锁定选择，所有人决定后一起揭晓。覆盖目标神的三种语素可抵消一点风化；这一步不直接计分。';
  return (
    <div className="action-impact">
      <b>这一步会发生什么</b>
      {action.cards?.length ? (
        <small>
          选定手牌：
          {action.cards
            .map((id) => p.hand.find((c) => c.id === id)?.element ?? '待选记忆')
            .join('、')}
        </small>
      ) : null}
      <p>{text}</p>
    </div>
  );
}

export function Atmosphere({ cue }: { cue: string }) {
  const [on, setOn] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const gain = useRef<GainNode | null>(null);
  const toggling = useRef(false);
  async function toggle() {
    if (toggling.current) return;
    toggling.current = true;
    try {
      if (context.current) {
        await context.current.close();
        context.current = null;
        setOn(false);
        return;
      }
      const c = new AudioContext();
      context.current = c;
      await c.resume();
      const master = c.createGain();
      master.gain.value = 0.035;
      master.connect(c.destination);
      gain.current = master;
      for (const frequency of [130.81, 196, 261.63]) {
        const tone = c.createOscillator();
        tone.type = 'sine';
        tone.frequency.value = frequency;
        tone.connect(master);
        tone.start();
      }
      setOn(true);
    } catch {
      const c = context.current;
      context.current = null;
      gain.current = null;
      if (c && c.state !== 'closed') await c.close();
      setOn(false);
    } finally {
      toggling.current = false;
    }
  }
  useEffect(() => {
    const c = context.current;
    if (!c || !gain.current || !cue || document.hidden) return;
    const tone = c.createOscillator(),
      envelope = c.createGain();
    tone.frequency.value = 523.25;
    envelope.gain.setValueAtTime(0.001, c.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.6, c.currentTime + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.7);
    tone.connect(envelope);
    envelope.connect(gain.current);
    tone.start();
    tone.stop(c.currentTime + 0.75);
  }, [cue]);
  useEffect(() => {
    const change = () => {
      const c = context.current;
      if (c) void (document.hidden ? c.suspend() : c.resume()).catch(() => {});
    };
    document.addEventListener('visibilitychange', change);
    return () => {
      document.removeEventListener('visibilitychange', change);
      void context.current?.close();
    };
  }, []);
  return (
    <Button
      variant="ghost"
      aria-pressed={on}
      onClick={() => {
        void toggle().catch(() => setOn(false));
      }}
    >
      {on ? '关闭氛围音' : '开启氛围音'}
    </Button>
  );
}
