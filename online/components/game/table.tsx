'use client';
// 已在素材导入时压缩为 WebP；此处不引入运行时图片代理。
/* oxlint-disable nextjs/no-img-element */

import { useEffect, useRef, useState } from 'react';
import {
  Flame,
  Users,
  ArrowRight,
  Copy,
  BookOpen,
  Wifi,
  WifiOff,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { GODS, SHAMANS, STORMS } from '@/lib/game/content';
import { ELEMENTS, type Element } from '@/lib/game/engine';
import { MemoryCard } from './memory-card';
import { ScoreGuide, ActionPreview, Atmosphere } from './experience';
import { actionMemories, choiceKey } from '@/lib/game/presentation';
import { describeChanges } from '@/lib/game/feedback';
import type { RoomView } from '@/lib/rooms';

const COLORS = [
  '#b9cee7',
  '#eeb76c',
  '#bba7e8',
  '#ea987d',
  '#9dcab8',
  '#d8b8a1',
];
const MEMORY: Record<Element, string> = {
  骨: '调节一尊神的风化',
  风: '预见风暴或放置禁忌',
  潮: '摸一张记忆牌',
  炎: '燃烧不降低心智',
  星: '获得一点余音',
};
type Session = { code: string; token: string };
export default function Table() {
  const [room, setRoom] = useState<RoomView | null>(null),
    [session, setSession] = useState<Session | null>(null);
  const [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(true);
  const [detail, setDetail] = useState<number | null>(null),
    [inspectPlayer, setInspectPlayer] = useState<number | null>(null),
    [rules, setRules] = useState(false),
    [selectedCard, setSelectedCard] = useState<number | null>(null),
    [target, setTarget] = useState<number | null>(null),
    [group, setGroup] = useState('全部'),
    [choice, setChoice] = useState<string | null>(null),
    [copied, setCopied] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const lock = useRef(false);
  const revisionRef = useRef<{ code: string; revision: number } | null>(null);
  const previousRoom = useRef<RoomView | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; lines: string[] }[]>(
    [],
  );
  function accept(next: RoomView) {
    const old = revisionRef.current;
    if (old?.code === next.code && old.revision >= next.revision) return;
    revisionRef.current = { code: next.code, revision: next.revision };
    const previous = previousRoom.current;
    previousRoom.current = next;
    setRoom(next);
    if (previous?.code === next.code && previous.game && next.game) {
      // 租约、连接状态等房间更新不应打断选牌或播放结算音。
      if (JSON.stringify(previous.game) === JSON.stringify(next.game)) return;
      const lines = describeChanges(previous.game, next.game);
      if (lines.length)
        setFeedback((items) =>
          [{ id: `${next.code}-${next.revision}`, lines }, ...items].slice(
            0,
            12,
          ),
        );
    } else setFeedback([]);
    setChoice(null);
    setSelectedCard(null);
    setTarget(null);
    setGroup('全部');
  }
  useEffect(() => {
    try {
      const query = new URLSearchParams(location.search)
        .get('room')
        ?.toUpperCase();
      // 首次挂载从浏览器存储恢复座位；服务端不能读取这份凭证。
      const last = query || localStorage.getItem('truefire:last');
      if (last) {
        // oxlint-disable-next-line react/react-compiler
        setCode(last);
        const saved = localStorage.getItem(`truefire:${last}`);
        if (saved) {
          const s = { code: last, token: saved };
          sessionRef.current = s;
          setSession(s);
        }
      }
      setName(localStorage.getItem('truefire:name') || '');
    } catch {
      setError('浏览器未允许保存座位；刷新后可能无法恢复。');
    }
  }, []);
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const r = await fetch(`/api/rooms?code=${session!.code}`, {
          headers: { Authorization: `Bearer ${session!.token}` },
          signal: AbortSignal.timeout(12000),
        });
        const data = (await r.json()) as RoomView & {
          token?: string;
          error?: string;
        };
        if (!r.ok) throw new Error(data.error);
        if (!stopped) {
          accept(data);
          setConnected(true);
          if (data.aiPending && !lock.current) {
            const tick = await fetch('/api/rooms', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session!.token}`,
              },
              body: JSON.stringify({
                type: 'aiTick',
                code: session!.code,
                revision: data.revision,
              }),
              signal: AbortSignal.timeout(12000),
            });
            if (tick.ok && !stopped) accept((await tick.json()) as RoomView);
          }
        }
      } catch (e) {
        if (!stopped) {
          setConnected(false);
          setError(e instanceof Error ? e.message : '连接中断，正在重连');
        }
      } finally {
        if (!stopped) timer = setTimeout(poll, document.hidden ? 7000 : 1800);
      }
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [session]);

  async function send(type: string, extra: Record<string, unknown> = {}) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const saved = sessionRef.current;
      const r = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(saved ? { Authorization: `Bearer ${saved.token}` } : {}),
        },
        body: JSON.stringify({
          type,
          code: saved?.code ?? code.trim().toUpperCase(),
          name: name.trim(),
          revision: room?.revision,
          ...extra,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = (await r.json()) as RoomView & {
        token?: string;
        error?: string;
      };
      if (!r.ok) throw new Error(data.error || '操作失败');
      if (data.token) {
        const next = { code: data.code, token: data.token };
        sessionRef.current = next;
        setSession(next);
        try {
          localStorage.setItem(`truefire:${next.code}`, next.token);
          localStorage.setItem('truefire:last', next.code);
          localStorage.setItem('truefire:name', name.trim());
        } catch {
          setError('本次座位未能保存，请保留这个页面。');
        }
        history.replaceState(null, '', `?room=${next.code}`);
      }
      accept(data);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '连接失败，请重试');
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  function leaveView() {
    revisionRef.current = null;
    previousRoom.current = null;
    setFeedback([]);
    sessionRef.current = null;
    setSession(null);
    setRoom(null);
    setError('');
    history.replaceState(null, '', '/');
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${room!.code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`请复制地址栏链接，或告诉朋友房间号 ${room!.code}`);
    }
  }
  const g = room?.game,
    self = room?.members.findIndex((p) => p.id === room.you) ?? -1,
    me = g?.players[self];
  const visibleActions =
    g?.actions.filter(
      (a) =>
        (group === '全部' || a.group === group) &&
        (g.prompt !== null || target === null || a.target === target) &&
        (g.prompt !== null ||
          selectedCard === null ||
          a.cards?.includes(selectedCard)),
    ) ?? [];
  // 相同印刷语素的实体卡对选择等价，界面合并重复文案；服务端仍保留唯一卡号。
  const uniqueActions = visibleActions.filter(
    (a, i, arr) =>
      g &&
      arr.findIndex((b) => choiceKey(g, self, b) === choiceKey(g, self, a)) ===
        i,
  );
  const chosen = uniqueActions.find((a) => a.id === choice);
  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setRules(true)}>
          <Flame size={25} />
          <span>
            真名之火<small>最后的火塘</small>
          </span>
        </button>
        <div className="top-actions">
          {room && (
            <span className="connection">
              {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
              {connected ? '已连接' : '重连中'}
            </span>
          )}
          <Button variant="ghost" onClick={() => setRules(true)}>
            <BookOpen />
            玩法
          </Button>
        </div>
      </header>
      {error && (
        <div className="notice" role="alert">
          {error}
          <Button variant="ghost" onClick={() => setError('')}>
            关闭
          </Button>
        </div>
      )}
      {!room ? (
        <section className="entry">
          <div className="entry-art">
            <img src="/art/god05.webp" alt="火姥神守望最后的炉火" />
            <div>
              <span className="eyebrow">3–6 位萨满 · V1.2</span>
              <h1>火还没有熄灭。</h1>
              <p>与朋友围坐火塘，找回神明的名字。</p>
            </div>
          </div>
          <div className="entry-form">
            <span className="eyebrow">最后的火塘</span>
            <h2>{session ? '正在找回你的座位' : '今夜，你叫什么名字？'}</h2>
            <p className="muted">
              不用注册。用同一个浏览器回来，就能继续守夜。
            </p>
            <label htmlFor="name">你的名字</label>
            <Input
              id="name"
              value={name}
              maxLength={16}
              placeholder="给自己一个名字"
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
              disabled={!!session}
            />
            {session ? (
              <Button variant="outline" onClick={leaveView}>
                返回建房 / 加入
              </Button>
            ) : (
              <>
                <Button
                  className="big-button"
                  disabled={busy || !name.trim()}
                  onClick={() => send('create')}
                >
                  点起新火塘 <ArrowRight />
                </Button>
                <div className="divider">或加入朋友的火塘</div>
                <label htmlFor="room-code">六位房间号</label>
                <div className="join-row">
                  <Input
                    id="room-code"
                    value={code}
                    maxLength={6}
                    placeholder="例如 ABC234"
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                  <Button
                    variant="outline"
                    disabled={
                      busy || !name.trim() || !/^[A-Z2-9]{6}$/.test(code)
                    }
                    onClick={() => send('join')}
                  >
                    加入
                  </Button>
                </div>
              </>
            )}
            <p className="entry-note">
              共同守住火塘，再争取成为传火者。
              <br />
              语音交流可使用你们平时的聊天软件。
            </p>
          </div>
        </section>
      ) : !g ? (
        <section className="lobby">
          <div className="room-heading">
            <div>
              <span className="eyebrow">
                等待围坐 · {room.members.length} / 6 人
              </span>
              <h1>
                火塘 <span className="code">{room.code}</span>
              </h1>
            </div>
            <Button variant="outline" onClick={share}>
              <Copy />
              {copied ? '链接已复制' : '邀请朋友'}
            </Button>
          </div>
          <div className="lobby-grid">
            <div>
              <h2>选择你的传承</h2>
              <div className="shamans">
                {SHAMANS.map((s) => {
                  const owner = room.members.find((m) => m.shaman === s.id);
                  const yours = owner?.id === room.you;
                  return (
                    <button
                      key={s.id}
                      className={`shaman ${yours ? 'selected' : ''}`}
                      disabled={busy || Boolean(owner && !yours)}
                      onClick={() => send('select', { shaman: s.id })}
                    >
                      <span className="shaman-number">0{s.id + 1}</span>
                      <h3>{s.name}</h3>
                      <span className="muted">{s.timing}</span>
                      <p>{s.effect}</p>
                      <strong>
                        {yours
                          ? '你的萨满'
                          : owner
                            ? `${owner.name}已选择`
                            : '选择这位萨满'}
                      </strong>
                    </button>
                  );
                })}
              </div>
            </div>
            <aside className="panel lobby-aside">
              <h2>
                <Users size={19} />
                已经到场
              </h2>
              {room.members.map((m, i) => (
                <div className="member-row" key={m.id}>
                  <i style={{ background: COLORS[i] }} />
                  <span>
                    {m.name}
                    {m.id === room.you ? '（你）' : ''}
                    <small>{SHAMANS[m.shaman].name}</small>
                  </span>
                  {m.id === room.host && <span className="tag">房主</span>}
                </div>
              ))}
              <p className="muted">
                至少3人，最多6人。开局采用规则书的初次游戏神座配置。
              </p>
              {room.host === room.you && (
                <div className="ai-setup">
                  <p>一个人也能玩：添加至少两位 AI。</p>
                  <div className="action-groups">
                    <Button
                      variant="outline"
                      disabled={busy || room.members.length >= 6}
                      onClick={() => send('addBot')}
                    >
                      ＋ 添加AI
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy || !room.members.some((m) => m.bot)}
                      onClick={() => send('removeBot')}
                    >
                      移除AI
                    </Button>
                  </div>
                  <div className="action-groups">
                    <Button
                      variant={room.aiMode === 'local' ? 'default' : 'outline'}
                      onClick={() => send('aiMode', { mode: 'local' })}
                      disabled={busy}
                    >
                      本地AI · 免费
                    </Button>
                    <Button
                      variant={room.aiMode === 'api' ? 'default' : 'outline'}
                      onClick={() => send('aiMode', { mode: 'api' })}
                      disabled={busy}
                    >
                      API / 反代
                    </Button>
                  </div>
                  {room.aiMode === 'api' && (
                    <p className="muted">
                      使用本机 .dev.vars
                      中配置的接口与模型，可能产生接口费用。未配置或请求失败时由本地AI接管。
                    </p>
                  )}
                </div>
              )}
              {room.host === room.you ? (
                <Button
                  className="big-button"
                  disabled={busy || room.members.length < 3}
                  onClick={() => send('start')}
                >
                  开始守夜 <Flame />
                </Button>
              ) : (
                <p className="status-line">等待房主开始守夜</p>
              )}
              <Button variant="ghost" onClick={leaveView}>
                暂时离开页面
              </Button>
              <small className="muted">
                座位会保留；未操作的房间7天后过期。
              </small>
            </aside>
          </div>
        </section>
      ) : (
        <>
          <section className="game-heading">
            <div>
              <span className="eyebrow">
                火塘 {room.code} · 第 {g.round} / {g.maxRounds} 轮
              </span>
              <h1>
                {g.phase === 'ended'
                  ? g.failed
                    ? '最后的火熄灭了'
                    : '天亮了'
                  : g.phase === 'chorus'
                    ? '极夜合诵'
                    : STORMS[g.currentStorm].name}
              </h1>
              <p className="muted">
                风暴目标：
                {STORMS[g.currentStorm].targets
                  .map((i) => `${i + 1}号神座`)
                  .join('、')}{' '}
                · 每座风化 +1
              </p>
            </div>
            <div className="round-info">
              <span>后备神 {g.godCount} 尊 · 有限</span>
              <Atmosphere cue={feedback[0]?.id ?? ''} />
              <span>风暴 {g.stormCount}</span>
              <Button variant="ghost" onClick={share}>
                <Copy />
                {copied ? '已复制' : '房间链接'}
              </Button>
            </div>
          </section>
          <ScoreGuide g={g} self={self} />
          <div className="players-strip">
            {g.players.map((p, i) => (
              <button
                key={p.id}
                className={`player-chip ${g.acting === i && g.phase !== 'ended' ? 'active' : ''}`}
                style={{ '--player': COLORS[i] } as React.CSSProperties}
                onClick={() => setInspectPlayer(i)}
                aria-label={`查看${p.name}的公开神明与传承`}
              >
                <b>
                  {p.name}
                  {i === self ? ' · 你' : ''}
                  {i === g.starter ? ' ◇' : ''}
                </b>
                <small>{SHAMANS[p.shaman].name}</small>
                <span>
                  心智 {p.mind} · 手牌 {p.handCount} · 余音 {p.echo}
                </span>
                <span>
                  唤醒 {p.awake.length} · 安魂 {p.rested.length}
                </span>
              </button>
            ))}
          </div>
          {room.members.some((m) => m.bot) && (
            <p className="muted" aria-live="polite">
              {room.aiPending
                ? 'AI正在思考…'
                : (room.aiStatus ?? 'AI已就座，轮到它时自动行动。')}
            </p>
          )}
          {g.phase === 'ended' && (
            <section className="ending panel">
              <Sparkles />
              <div>
                <h2>
                  {g.failed
                    ? '本局没有传火者'
                    : `${g.players
                        .filter((p) => g.winners.includes(p.id))
                        .map((p) => p.name)
                        .join('、')}成为传火者`}
                </h2>
                <p>
                  {g.failed
                    ? '四座神座全部成为废墟，所有人共同失败。'
                    : '所有萨满共同完成守夜。'}
                </p>
                <div className="scores">
                  {g.players.map((p) => (
                    <div key={p.id}>
                      <b>
                        {p.name} · {g.failed ? '—' : p.score.total + '分'}
                      </b>
                      <small>
                        唤醒 {p.score.awaken} / 安魂 {p.score.rest} / 余音{' '}
                        {p.score.echo} / 守夜 {p.score.bonus}
                      </small>
                    </div>
                  ))}
                </div>
                <Button variant="outline" onClick={leaveView}>
                  返回，创建新火塘
                </Button>
              </div>
            </section>
          )}
          <div className="table-layout">
            <section className="table-main">
              <div className="seat-heading">
                <h2>四座神座</h2>
                <span className="muted">触碰神座 · 聆听神名</span>
              </div>
              <details className="refill-guide">
                <summary>远处还有 {g.godCount} 尊神，等待被记起</summary>
                <p>
                  唤醒 / 安魂 → 完成整理 → 后备补入。废墟永久关闭。
                  {g.godCount === 0
                    ? '后备已空，不会再补神。'
                    : `后备还剩 ${g.godCount} 尊，并非无限刷新。`}
                </p>
              </details>
              <div className="god-grid">
                {g.seats.map((s, i) => {
                  const god = s.god !== null ? GODS[s.god] : null;
                  return (
                    <article
                      key={`${i}-${s.god}-${s.ruins}`}
                      data-seat-index={i}
                      className={`god-card ${s.weather === 2 ? 'dying' : ''} ${target === i ? 'targeted' : ''} ${s.ruins ? 'ruins' : ''} ${selectedCard !== null && g.actions.some((a) => a.group === '供奉' && a.target === i && a.cards?.[0] === selectedCard) ? 'receives-memory' : ''}`}
                    >
                      <button
                        className="god-select"
                        disabled={!god}
                        aria-label={`选择${i + 1}号神座${god?.name ?? ''}`}
                        aria-pressed={target === i}
                        onClick={() => {
                          setTarget(target === i ? null : i);
                          setChoice(null);
                        }}
                      >
                        <div className="god-art">
                          {god && <img src={god.image} alt={god.name} />}
                          <span className="seat-no">0{i + 1}</span>
                          <span className="weather-tag">
                            {s.ruins
                              ? '永久关闭'
                              : s.weather === 2
                                ? '濒死 · 2 风化'
                                : s.weather === 1
                                  ? '1 风化'
                                  : '未风化'}
                          </span>
                        </div>
                        <div className="god-body">
                          <span className="eyebrow">
                            {god?.culture ??
                              (s.ruins
                                ? '遗忘之地'
                                : g.godCount
                                  ? '整理结束后补入'
                                  : '后备已用尽')}
                          </span>
                          <h3>{god?.name ?? (s.ruins ? '废墟' : '空神座')}</h3>
                          <div className="slots">
                            {god?.elements.map((e) => {
                              const o = s.offerings.find(
                                (o) => o.element === e,
                              );
                              return (
                                <span
                                  key={e}
                                  className={`element e-${ELEMENTS.indexOf(e as Element)} ${o ? 'offered' : ''}`}
                                  style={
                                    o
                                      ? {
                                          borderColor: COLORS[o.player],
                                          boxShadow: `inset 0 -4px ${COLORS[o.player]}`,
                                        }
                                      : {}
                                  }
                                >
                                  {e}
                                  <small>
                                    {o ? g.players[o.player].name : '空槽'}
                                  </small>
                                </span>
                              );
                            })}
                          </div>
                          {s.taboo && (
                            <span className="taboo">
                              禁忌 · 供奉 / 安魂额外弃一张
                            </span>
                          )}
                        </div>
                      </button>
                      {god && (
                        <Button
                          variant="ghost"
                          className="detail-button"
                          onClick={() => setDetail(god.id)}
                        >
                          神恩与遗赠 <ArrowRight size={15} />
                        </Button>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="table-note">
                <span>◇ 起始玩家</span>
                <span>
                  记忆堆 {g.deckCount} · 弃牌 {g.discard.length}
                </span>
                <span>众声觉醒 {g.communal.length} 尊</span>
              </div>
              {me && (
                <section className="hand-panel panel">
                  <div className="seat-heading">
                    <h2>
                      你的记忆{' '}
                      <span>
                        {me.handCount} / {me.mind}
                      </span>
                    </h2>
                    <span className="muted">剩余供奉印记 {me.marks} / 4</span>
                  </div>
                  <div className="hand">
                    {me.hand.map((c, index) => (
                      <MemoryCard
                        key={c.id}
                        id={c.id}
                        element={c.element}
                        description={MEMORY[c.element]}
                        selected={selectedCard === c.id}
                        index={index}
                        count={me.hand.length}
                        onSelect={() => {
                          setSelectedCard(selectedCard === c.id ? null : c.id);
                          setChoice(null);
                        }}
                        onOffer={(card, seat) => {
                          const offers = g.actions.filter(
                            (a) =>
                              a.group === '供奉' &&
                              a.target === seat &&
                              a.cards?.[0] === card,
                          );
                          if (!offers.length || busy) return;
                          setSelectedCard(card);
                          setTarget(seat);
                          setGroup('供奉');
                          setChoice(offers.length === 1 ? offers[0].id : null);
                        }}
                      />
                    ))}
                    {!me.hand.length && (
                      <p className="muted">
                        手中暂时没有记忆。主行动仍可寻忆。
                      </p>
                    )}
                  </div>
                  <p className="muted hand-tip">
                    点起一段记忆，再点亮它能回应的神座。也可用鼠标将它拖向神座，准备供奉。
                  </p>
                  <div className="collection">
                    <span>你的神明</span>
                    {me.awake.map((id) => (
                      <Button
                        key={id}
                        variant="outline"
                        onClick={() => setDetail(id)}
                      >
                        {GODS[id].name} · 唤醒
                      </Button>
                    ))}
                    {me.rested.map((r) => (
                      <Button
                        key={r.god}
                        variant="outline"
                        onClick={() => setDetail(r.god)}
                      >
                        {GODS[r.god].name} · {r.used ? '遗赠已用' : '遗赠可用'}
                      </Button>
                    ))}
                    {!me.awake.length && !me.rested.length && (
                      <small className="muted">名字仍在等待被说出。</small>
                    )}
                  </div>
                </section>
              )}
            </section>
            <aside className="table-aside">
              <section className="panel decision-feedback">
                <span className="eyebrow">火塘回响</span>
                <output
                  aria-live="polite"
                  aria-atomic="true"
                  key={feedback[0]?.id}
                  className="feedback-current"
                >
                  {feedback[0] ? (
                    feedback[0].lines.map((line, i) => <p key={i}>{line}</p>)
                  ) : (
                    <p>火在等你。今夜，你会留住谁的名字？</p>
                  )}
                </output>
                {feedback.length > 1 && (
                  <details>
                    <summary>此前的回响</summary>
                    {feedback.slice(1).map((item) => (
                      <div className="feedback-history" key={item.id}>
                        {item.lines.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    ))}
                  </details>
                )}
              </section>
              <section className="panel action-panel">
                <span className="eyebrow">
                  {g.phase === 'turn'
                    ? {
                        aux: '火光初起 · 辅助',
                        main: '说出真名 · 主行动',
                        cleanup: '收拢余烬 · 整理',
                      }[g.step]
                    : g.phase === 'cold'
                      ? '严寒结算'
                      : g.phase === 'chorus'
                        ? '秘密选择，同时揭晓'
                        : '守夜结束'}
                </span>
                <h2>
                  {g.actions.length
                    ? '轮到你了'
                    : g.phase === 'ended'
                      ? '留住这一夜'
                      : g.phase === 'chorus'
                        ? '等待其他人合诵'
                        : `等待${g.players[g.acting].name}`}
                </h2>
                {g.lastRound && g.phase !== 'ended' && (
                  <p className="tag">本轮为最后一轮</p>
                )}
                {g.prompt && <p className="effect-copy">{g.prompt}</p>}
                {g.forecast && (
                  <div className="forecast">
                    <b>只有你看见的风暴顶牌</b>
                    {g.forecast.map((id, i) => (
                      <p key={id}>
                        {i + 1}. {STORMS[id].name} · 神座
                        {STORMS[id].targets.map((n) => n + 1).join('、')}
                      </p>
                    ))}
                  </div>
                )}
                {g.phase === 'chorus' && (
                  <p className="muted">
                    {g.chorusReady.length} / {g.players.length}{' '}
                    人已决定。覆盖目标神的三种语素，可抵消本次一点风化。
                  </p>
                )}
                {g.phase === 'cold' && (
                  <p className="muted">
                    {STORMS[g.currentStorm].season === 1
                      ? '弃一张或燃烧一张。'
                      : '必须燃烧一张；心智为二仍可烧任意牌。'}
                  </p>
                )}
                {g.actions.length > 0 && (
                  <>
                    <div
                      className="action-groups"
                      hidden={new Set(g.actions.map((a) => a.group)).size < 2}
                    >
                      {['全部', ...new Set(g.actions.map((a) => a.group))].map(
                        (v) => (
                          <Button
                            key={v}
                            variant={v === group ? 'default' : 'outline'}
                            onClick={() => {
                              setGroup(v);
                              setChoice(null);
                            }}
                          >
                            {v === '守艺' ? '传承' : v}
                          </Button>
                        ),
                      )}
                    </div>
                    {(target !== null || selectedCard !== null) && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setTarget(null);
                          setSelectedCard(null);
                          setChoice(null);
                        }}
                      >
                        <RotateCcw />
                        看看其他可能
                      </Button>
                    )}
                    {uniqueActions.length ? (
                      <>
                        <div
                          className={`ritual-choices ${g.pool !== undefined ? 'memory-choices' : ''}`}
                          aria-label={
                            g.pool !== undefined ? '拾起记忆' : '选择仪式'
                          }
                        >
                          {uniqueActions.map((a) => {
                            const cards = actionMemories(g, self, a);
                            return (
                              <button
                                type="button"
                                key={a.id}
                                className={`ritual-choice ${choice === a.id ? 'selected' : ''}`}
                                aria-pressed={choice === a.id}
                                onClick={() => setChoice(a.id)}
                              >
                                {g.pool !== undefined && cards.length > 0 ? (
                                  <>
                                    <span className="memory-pair">
                                      {cards.map((c, i) => (
                                        <span
                                          className={`element e-${ELEMENTS.indexOf(c.element)}`}
                                          key={i}
                                        >
                                          {c.element}
                                        </span>
                                      ))}
                                    </span>
                                    <span>
                                      留下
                                      {cards
                                        .map((c) => `「${c.element}」`)
                                        .join('与')}
                                    </span>
                                  </>
                                ) : (
                                  a.label
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {chosen && (
                          <ActionPreview g={g} self={self} action={chosen} />
                        )}
                        <Button
                          className="big-button"
                          disabled={!chosen || busy || !connected}
                          onClick={() =>
                            chosen && send('act', { action: chosen.id })
                          }
                        >
                          {busy
                            ? '火光回应着…'
                            : g.pool !== undefined
                              ? '留住这些记忆'
                              : chosen?.group === '供奉'
                                ? '献上记忆'
                                : chosen?.group === '安魂'
                                  ? '送神入夜'
                                  : chosen?.group === '燃忆'
                                    ? '投入火中'
                                    : chosen?.group === '祈神'
                                      ? '呼唤神名'
                                      : chosen?.group === '寻忆'
                                        ? '拾起灰烬中的记忆'
                                        : chosen?.label.includes('结束回合')
                                          ? '交棒守夜'
                                          : '继续仪式'}
                          <ArrowRight />
                        </Button>
                      </>
                    ) : (
                      <p className="muted">
                        这段记忆暂时无法回应这尊神。试试别的记忆，或看看其他可能。
                      </p>
                    )}
                  </>
                )}
                {me && (
                  <details className="craft-info">
                    <summary>{SHAMANS[me.shaman].name}的传承</summary>
                    <p>{SHAMANS[me.shaman].effect}</p>
                    {me.craftUsed && <span className="tag">本夜已用</span>}
                  </details>
                )}
              </section>
              <section className="panel history-panel">
                <Tabs defaultValue="log">
                  <TabsList>
                    <TabsTrigger value="log">守夜记录</TabsTrigger>
                    <TabsTrigger value="discard">弃牌堆</TabsTrigger>
                  </TabsList>
                  <TabsContent value="log">
                    <ol>
                      {[...g.logs].reverse().map((l, i) => (
                        <li key={`${g.logs.length}-${i}`}>{l}</li>
                      ))}
                    </ol>
                  </TabsContent>
                  <TabsContent value="discard">
                    <p className="muted">公开弃牌 · 可洗回记忆堆</p>
                    {ELEMENTS.map((e) => (
                      <p className="discard-line" key={e}>
                        <span>{e}</span>
                        <b>
                          {g.discard.filter((c) => c.element === e).length} 张
                        </b>
                      </p>
                    ))}
                  </TabsContent>
                </Tabs>
              </section>
            </aside>
          </div>
        </>
      )}
      <footer>
        真名之火 · 最后的火塘 <span>线上初版 · 规则 V1.2</span>
      </footer>
      <Dialog
        open={inspectPlayer !== null}
        onOpenChange={(open) => {
          if (!open) setInspectPlayer(null);
        }}
      >
        <DialogContent className="rules-dialog">
          {g && inspectPlayer !== null && (
            <>
              <DialogTitle>
                {g.players[inspectPlayer].name} ·{' '}
                {SHAMANS[g.players[inspectPlayer].shaman].name}
              </DialogTitle>
              <DialogDescription>
                {SHAMANS[g.players[inspectPlayer].shaman].effect}
              </DialogDescription>
              <h3>唤醒的神</h3>
              <div className="collection">
                {g.players[inspectPlayer].awake.map((id) => (
                  <Button
                    variant="outline"
                    key={id}
                    onClick={() => {
                      setInspectPlayer(null);
                      setDetail(id);
                    }}
                  >
                    {GODS[id].name} · 5分
                  </Button>
                ))}
                {!g.players[inspectPlayer].awake.length && (
                  <p className="muted">尚未唤醒神明</p>
                )}
              </div>
              <h3>安魂的神</h3>
              <div className="collection">
                {g.players[inspectPlayer].rested.map((r) => (
                  <Button
                    variant="outline"
                    key={r.god}
                    onClick={() => {
                      setInspectPlayer(null);
                      setDetail(r.god);
                    }}
                  >
                    {GODS[r.god].name} ·{' '}
                    {r.used ? '遗赠已用 · 2分' : '遗赠可用 · 3分'}
                  </Button>
                ))}
                {!g.players[inspectPlayer].rested.length && (
                  <p className="muted">尚未为神明安魂</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="god-dialog">
          {detail !== null && (
            <>
              <img src={GODS[detail].image} alt={GODS[detail].name} />
              <div>
                <span className="eyebrow">
                  {GODS[detail].culture} · {GODS[detail].original}
                </span>
                <DialogTitle>{GODS[detail].name}</DialogTitle>
                <DialogDescription>{GODS[detail].story}</DialogDescription>
                <h3>神恩 / 遗赠</h3>
                <p>{GODS[detail].effect}</p>
                <p className="muted">
                  祈神：弃一张手牌，占辅助行动。
                  <br />
                  遗赠：免费使用一次，占辅助行动；使用后由3分降为2分。
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={rules} onOpenChange={setRules}>
        <DialogContent className="rules-dialog">
          <DialogTitle>这一夜，怎样守住火塘？</DialogTitle>
          <DialogDescription>
            大家共同守夜，也各自争取成为传火者。
          </DialogDescription>
          <ol>
            <li>每轮先翻风暴、结算严寒，再每人摸一张。</li>
            <li>
              你的回合：可选一项辅助 → 必须做一项主行动 → 弃到心智上限并补神。
            </li>
            <li>
              供奉三种真名语素。占两枚印记者得到神；三人各一枚则众声觉醒。
            </li>
            <li>
              两点风化的神可以安魂：支付一张骨或任意两张牌，回收供奉、恢复一点心智并摸一张。
            </li>
            <li>神受到第三点风化时湮灭。四座全毁，所有人共同失败。</li>
          </ol>
          <p>
            唤醒神5分；安魂神3分（遗赠已用2分）；另加余音。3–4人安魂至少2尊、5–6人至少3尊，额外2分。
          </p>
          <a
            className="rules-link"
            href="/rules.html"
            target="_blank"
            rel="noreferrer"
          >
            打开完整 V1.2 玩法书 ↗
          </a>
        </DialogContent>
      </Dialog>
    </main>
  );
}
