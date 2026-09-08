'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { actionMemories } from '@/lib/game/presentation';
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
        <span className="eyebrow">你留住的火</span>
        <strong>
          {g.failed ? '—' : p.score.total}
          <small>分</small>
        </strong>
        <p>天亮时，谁将成为传火者？</p>
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
        <summary>守夜的约定 · 计分与神座</summary>
        <p>
          四座神座是同时等待处理的神，不是整局只有四尊。唤醒或安魂后，空位在该玩家回合整理结束时，从有限的后备堆补一尊；湮灭的神座成为废墟，永久关闭。后备用尽就不再补。当前后备还剩{' '}
          {g.godCount} 尊。
        </p>
        <p>
          供奉本身不加分。三槽填满时，拥有至少两枚供奉印记者得神（5分），其他参与者每枚得1余音；三人各一枚则各得1余音，神归公共区。织名者在符合传承条件时额外得1余音。
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
  let text = '';
  let title = action.group === '守艺' ? '传承' : action.group;
  const elements = actionMemories(g, self, action).map((c) => c.element);
  const names = elements.map((e) => `「${e}」`).join('、');
  if (action.group === '供奉' && s) {
    const own = s.offerings.filter((o) => o.player === self).length;
    if (s.offerings.length < 2)
      text = `真名渐渐清晰：${s.offerings.length + 1}/3。你留下的印记：${own + 1}枚。`;
    else {
      const owners = g.players.map(
        (_, i) =>
          s.offerings.filter((o) => o.player === i).length +
          (i === self ? 1 : 0),
      );
      const winner = owners.findIndex((n) => n >= 2);
      text =
        winner === self
          ? '真名完整了。这尊神将回应你的呼唤。＋5分 · 获得神恩'
          : winner >= 0
            ? `神将回应${g.players[winner].name}（＋5分）。你的声音也被记住：＋${p.shaman === 4 ? 2 : 1}余音。`
            : `三道声音合为真名。神将留在众人之间，你获得${p.shaman === 4 ? 2 : 1}余音。`;
    }
  } else if (action.group === '安魂') {
    const threshold = RULES.setups[g.players.length as 3 | 4 | 5 | 6].vigil;
    text = `送这尊神安然入夜。＋3分${p.rested.length + 1 === threshold ? ' · 守夜＋2分' : ''} · 心智＋1（至多5）· 摸1张。供奉回到各自主人手中。`;
  } else if (action.group === '遗赠')
    text = '借用神最后的馈赠。遗赠使用后，计分由3降为2。';
  else if (action.group === '燃忆') {
    const c = p.hand.find((c) => c.id === action.cards?.[0]);
    text = `燃烧${c?.element ?? '选定'}牌，${c?.element === '炎' ? '心智不降' : '心智上限−1（最低2）'}，发动巫术，再摸1张；${c?.element === '星' ? '星留下＋1余音。' : ''}`;
  } else if (action.group === '寻忆' && g.pool !== undefined) {
    title = '把它们带回火边';
    text = names
      ? `${names}将留在你手中，其余记忆归于灰烬。`
      : '灰烬中已没有可以带走的记忆。';
  } else if (action.group === '寻忆')
    text = '从灰烬中寻找至多三段记忆，留下其中至多两段。';
  else if (action.label.includes('结束回合'))
    text = g.godCount
      ? '把这一刻交给下一位守夜人。空下的神座，将有新的名字到来。'
      : '把这一刻交给下一位守夜人。远处已没有等待的神。';
  else if (action.label.includes('跳过辅助'))
    text = '让记忆留在手中，准备供奉、安魂或寻忆。';
  if (action.group === '祈神' || action.group === '遗赠') {
    const god = GODS.find((god) => action.label.includes(god.name));
    if (god)
      text = `${action.group === '祈神' ? '献出1张记忆，唤起神恩。' : '借用最后的馈赠（−1分）。'}${god.effect}`;
  }
  if (action.group === '整理' && action.cards?.length)
    text = `将${names || '这段记忆'}还给灰烬。手中还能容纳${p.mind}张记忆。`;
  if (action.group === '极夜合诵')
    text =
      '将声音藏在掌心，等众人一起开口。凑齐神的三种语素，便能抵挡一点风化。';
  if (!text) return null;
  return (
    <div className="action-impact">
      <b>{title}</b>
      {names && action.group !== '寻忆' && <small>{names}</small>}
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
