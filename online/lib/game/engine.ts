import { GODS, STORMS } from './content';
import { RULES } from './config';

export const ELEMENTS = ['骨', '风', '潮', '炎', '星'] as const;
export type Element = (typeof ELEMENTS)[number];
export type Card = { id: number; element: Element };
export type Player = {
  id: string;
  name: string;
  shaman: number;
  hand: Card[];
  mind: number;
  echo: number;
  awake: number[];
  rested: { god: number; used: boolean }[];
  craftUsed: boolean;
};
export type Seat = {
  god: number | null;
  ruins: boolean;
  weather: number;
  taboo: boolean;
  offerings: { player: number; card: Card; element: Element }[];
};
type Resume = 'aux' | 'burn' | 'cold' | 'main';
type Move = {
  op: string;
  label: string;
  group: string;
  cards?: number[];
  target?: number;
  source?: number;
  value?: number;
  element?: Element;
  indices?: number[];
};
type Prompt = {
  player: number;
  title: string;
  options: Move[];
  resume: Resume;
  pool?: Card[];
};
export type Game = {
  version: '1.2';
  rng: number;
  players: Player[];
  seats: Seat[];
  deck: Card[];
  discard: Card[];
  gods: number[];
  storms: number[];
  currentStorm: number;
  round: number;
  maxRounds: number;
  starter: number;
  turn: number;
  acted: number;
  step: 'aux' | 'main' | 'cleanup';
  phase: 'turn' | 'chorus' | 'cold' | 'ended';
  coldIndex: number;
  chorusDone: boolean;
  chorus: Record<number, { card: number | null; seat: number | null }>;
  pending: Prompt | null;
  temporary: { any: boolean; ogun: boolean; star: boolean; restOne: boolean };
  lastRound: boolean;
  failed: boolean;
  communal: number[];
  logs: string[];
};
export type PublicAction = {
  id: string;
  label: string;
  group: string;
  cards?: number[];
  target?: number;
};
const move = (
  op: string,
  label: string,
  group = '选择',
  rest: Partial<Move> = {},
): Move => ({ op, label, group, ...rest });
const cleanTemporary = () => ({
  any: false,
  ogun: false,
  star: false,
  restOne: false,
});
function random(g: Game) {
  g.rng = (Math.imul(1664525, g.rng) + 1013904223) >>> 0;
  return g.rng / 4294967296;
}
function shuffle<T>(g: Game, list: T[]) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random(g) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
function log(g: Game, text: string) {
  g.logs.push(text);
  if (g.logs.length > 160) g.logs.shift();
}
function draw(g: Game, count: number): Card[] {
  const result: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (!g.deck.length) g.deck = shuffle(g, g.discard.splice(0));
    const c = g.deck.shift();
    if (c) result.push(c);
  }
  return result;
}
function take(p: Player, id: number) {
  const i = p.hand.findIndex((c) => c.id === id);
  if (i < 0) throw new Error('手牌已变化，请重新选择');
  return p.hand.splice(i, 1)[0];
}
function pay(g: Game, p: Player, ids: number[]) {
  for (const id of ids) g.discard.push(take(p, id));
}
function active(g: Game) {
  return g.seats
    .map((s, i) => ({ ...s, i }))
    .filter((s) => s.god !== null && !s.ruins);
}
function godName(g: Game, seat: number) {
  const id = g.seats[seat].god;
  return id === null ? '空神座' : GODS[id].name;
}
function placed(g: Game, player: number) {
  return g.seats.reduce(
    (n, s) => n + s.offerings.filter((o) => o.player === player).length,
    0,
  );
}
function pairs<T>(items: T[]) {
  return items.flatMap((a, i) => items.slice(i + 1).map((b) => [a, b]));
}
function checkEnd(g: Game) {
  if (g.seats.every((s) => s.ruins)) {
    g.failed = true;
    g.phase = 'ended';
    g.pending = null;
    log(g, '四座神座全部成为废墟。火塘熄灭，所有人共同失败。');
  } else if (!g.storms.length || (!g.gods.length && active(g).length <= 1))
    g.lastRound = true;
}
function awake(g: Game, seat: number) {
  const s = g.seats[seat];
  if (s.god === null || s.offerings.length !== 3) return;
  const counts = g.players.map(
    (_, i) => s.offerings.filter((o) => o.player === i).length,
  );
  const owner = counts.findIndex((n) => n >= 2);
  const id = s.god;
  if (owner >= 0) {
    g.players[owner].awake.push(id);
    log(g, `${g.players[owner].name}唤醒了${GODS[id].name}。`);
  } else {
    g.communal.push(id);
    log(g, `${GODS[id].name}众声觉醒，参与者各得余音。`);
  }
  counts.forEach((count, i) => {
    if (count && i !== owner)
      g.players[i].echo += count + (g.players[i].shaman === 4 ? 1 : 0);
  });
  g.discard.push(...s.offerings.map((o) => o.card));
  Object.assign(s, { god: null, offerings: [], weather: 0, taboo: false });
}
function refill(g: Game) {
  for (const s of g.seats)
    if (s.god === null && !s.ruins && g.gods.length) s.god = g.gods.shift()!;
  checkEnd(g);
}
function startTurns(g: Game) {
  for (let n = 0; n < g.players.length; n++)
    g.players[(g.starter + n) % g.players.length].hand.push(...draw(g, 1));
  g.phase = 'turn';
  g.turn = g.starter;
  g.acted = 0;
  g.step = 'aux';
  g.temporary = cleanTemporary();
}
function advanceCold(g: Game) {
  while (
    g.coldIndex < g.players.length &&
    !g.players[(g.starter + g.coldIndex) % g.players.length].hand.length
  )
    g.coldIndex++;
  if (g.coldIndex >= g.players.length) startTurns(g);
}
function weather(g: Game) {
  const storm = STORMS[g.currentStorm];
  for (const target of storm.targets) {
    const s = g.seats[target];
    if (s.god === null || s.ruins) continue;
    const extra = Object.values(g.chorus)
      .filter((c) => c.seat === target && c.card !== null)
      .map((c) => ELEMENTS[Math.floor(c.card! / 12)]);
    const elements = new Set([...s.offerings.map((o) => o.element), ...extra]);
    if (
      extra.length &&
      GODS[s.god].elements.every((e) => elements.has(e as Element))
    ) {
      log(g, `合诵护住了${GODS[s.god].name}。`);
      continue;
    }
    s.weather++;
    if (s.weather === 3) {
      log(g, `${GODS[s.god].name}湮灭，${target + 1}号神座成为废墟。`);
      g.discard.push(...s.offerings.map((o) => o.card));
      Object.assign(s, {
        god: null,
        ruins: true,
        offerings: [],
        weather: 0,
        taboo: false,
      });
    }
    checkEnd(g);
    if (g.phase === 'ended') return;
  }
  g.chorus = {};
  checkEnd(g);
  if (storm.season === 0) startTurns(g);
  else {
    g.phase = 'cold';
    g.coldIndex = 0;
    advanceCold(g);
  }
}
function nextRound(g: Game) {
  g.round++;
  g.currentStorm = g.storms.shift()!;
  log(g, `第${g.round}轮 · ${STORMS[g.currentStorm].name}`);
  if (STORMS[g.currentStorm].season === 2 && !g.chorusDone) {
    g.chorusDone = true;
    g.phase = 'chorus';
    g.chorus = {};
  } else weather(g);
}
export function createGame(
  members: { id: string; name: string; shaman: number }[],
  seed: number,
): Game {
  if (
    members.length < RULES.minPlayers ||
    members.length > RULES.maxPlayers ||
    new Set(members.map((p) => p.shaman)).size !== members.length ||
    members.some((p) => p.shaman < 0 || p.shaman > 5)
  )
    throw new Error('需要3–6位不同萨满');
  const g: Game = {
    version: '1.2',
    rng: seed >>> 0,
    players: members.map(({ id, name, shaman }) => ({
      id,
      name,
      shaman,
      hand: [],
      mind: RULES.mind.max,
      echo: 0,
      awake: [],
      rested: [],
      craftUsed: false,
    })),
    seats: [],
    deck: [],
    discard: [],
    gods: [],
    storms: [],
    currentStorm: 0,
    round: 0,
    maxRounds: 0,
    starter: 0,
    turn: 0,
    acted: 0,
    step: 'aux',
    phase: 'turn',
    coldIndex: 0,
    chorusDone: false,
    chorus: {},
    pending: null,
    temporary: cleanTemporary(),
    lastRound: false,
    failed: false,
    communal: [],
    logs: [],
  };
  g.deck = shuffle(
    g,
    ELEMENTS.flatMap((element, n) =>
      Array.from({ length: 12 }, (_, i) => ({ id: n * 12 + i, element })),
    ),
  );
  // 初次游戏配置：毛伊、贝雅薇、火姥神、雨神。
  g.seats = [0, 2, 4, 9].map((god) => ({
    god,
    ruins: false,
    weather: 0,
    taboo: false,
    offerings: [],
  }));
  g.gods = shuffle(
    g,
    GODS.map((x) => x.id).filter((id) => ![0, 2, 4, 9].includes(id)),
  ).slice(0, RULES.setups[members.length as 3 | 4 | 5 | 6].gods - 4);
  const counts = RULES.setups[members.length as 3 | 4 | 5 | 6].storms;
  g.storms = counts.flatMap((n, season) =>
    shuffle(
      g,
      [0, 1, 2, 3].map((i) => i + season * 4),
    ).slice(0, n),
  );
  g.maxRounds = g.storms.length;
  g.starter = Math.floor(random(g) * members.length);
  g.players.forEach((p) => p.hand.push(...draw(g, RULES.startingHand)));
  nextRound(g);
  return g;
}
function finish(g: Game, resume: Resume) {
  const p = g.players[g.turn];
  if (resume === 'burn') {
    p.hand.push(...draw(g, 1));
    g.step = 'main';
  } else if (resume === 'aux') g.step = 'main';
  else if (resume === 'main') g.step = 'cleanup';
  else {
    const cp = g.players[(g.starter + g.coldIndex) % g.players.length];
    if (cp.hand.length > cp.mind)
      g.pending = {
        player: (g.starter + g.coldIndex) % g.players.length,
        title: '严寒燃烧后，将手牌弃到心智上限',
        options: cp.hand.map((c) =>
          move('trim', `弃置「${c.element}」`, '整理', { cards: [c.id] }),
        ),
        resume: 'cold',
      };
    else {
      g.coldIndex++;
      advanceCold(g);
    }
  }
}
function prompt(
  g: Game,
  player: number,
  title: string,
  options: Move[],
  resume: Resume,
  pool?: Card[],
) {
  if (!options.length) finish(g, resume);
  else g.pending = { player, title, options, resume, pool };
}
function windOptions(g: Game) {
  const o = [move('noop', '查看风暴后，保持顺序')];
  if (g.storms.length > 1) o.push(move('swapStorm', '交换顶上两张风暴'));
  return o;
}
function burn(g: Game, player: number, cardId: number, resume: Resume) {
  const p = g.players[player],
    c = take(p, cardId);
  g.discard.push(c);
  if (c.element !== '炎') p.mind = Math.max(RULES.mind.min, p.mind - 1);
  log(g, `${p.name}燃烧「${c.element}」。`);
  if (c.element === '潮') p.hand.push(...draw(g, 1));
  if (c.element === '星') p.echo++;
  if (c.element === '骨')
    return prompt(
      g,
      player,
      '骨的巫术 · 调整一尊神的风化',
      active(g).flatMap(
        (s) =>
          [
            s.weather < 2
              ? move('weather', `${GODS[s.god!].name}：风化 +1`, '巫术', {
                  target: s.i,
                  value: 1,
                })
              : null,
            s.weather > 0
              ? move('weather', `${GODS[s.god!].name}：风化 −1`, '巫术', {
                  target: s.i,
                  value: -1,
                })
              : null,
          ].filter((x) => x !== null) as Move[],
      ),
      resume,
    );
  if (c.element === '风')
    return prompt(
      g,
      player,
      '风的巫术 · 预见风暴或放置禁忌',
      [
        move('peek', '查看并调整风暴顶牌', '巫术'),
        ...active(g)
          .filter((s) => !s.taboo)
          .map((s) =>
            move('taboo', `给${GODS[s.god!].name}放置禁忌`, '巫术', {
              target: s.i,
              value: 1,
            }),
          ),
      ],
      resume,
    );
  finish(g, resume);
}
function transferOptions(g: Game, player: number) {
  return active(g).flatMap((s) =>
    s.offerings
      .filter((o) => o.player === player)
      .flatMap((o) =>
        active(g)
          .filter(
            (t) =>
              t.i !== s.i &&
              GODS[t.god!].elements.includes(o.element as never) &&
              !t.offerings.some((v) => v.element === o.element),
          )
          .map((t) =>
            move(
              'transfer',
              `将${GODS[s.god!].name}上的「${o.element}」移至${GODS[t.god!].name}`,
              '移渡',
              { source: s.i, target: t.i, cards: [o.card.id] },
            ),
          ),
      ),
  );
}
function godEffect(
  g: Game,
  player: number,
  god: number,
  resume: Resume,
  paid?: Card,
) {
  const p = g.players[player];
  const seats = active(g);
  let options: Move[] = [];
  switch (god) {
    case 0:
      options = transferOptions(g, player);
      break;
    case 1:
      g.temporary.restOne = true;
      break;
    case 2: {
      const targets = seats.filter((s) => s.weather > 0);
      options = [
        ...targets.map((s) => [s.i]),
        ...pairs(targets.map((s) => s.i)),
      ].map((indices) =>
        move(
          'heal',
          `为${indices.map((i) => godName(g, i)).join('、')}各移除一点风化`,
          '神恩',
          { indices },
        ),
      );
      options.push(move('noop', '不移除风化'));
      break;
    }
    case 3:
      options = pairs(seats).map(([a, b]) =>
        move(
          'swapWeather',
          `交换${GODS[a.god!].name}与${GODS[b.god!].name}的风化`,
          '神恩',
          { source: a.i, target: b.i },
        ),
      );
      break;
    case 4:
      p.mind = Math.min(RULES.mind.max, p.mind + 1);
      p.hand.push(...draw(g, 1));
      break;
    case 5:
      options = [
        move('drawOne', '不移除禁忌，摸一张牌'),
        ...seats
          .filter((s) => s.taboo)
          .map((s) =>
            move(
              'clearDraw',
              `移除${GODS[s.god!].name}的禁忌，并摸一张牌`,
              '神恩',
              { target: s.i },
            ),
          ),
      ];
      break;
    case 6:
      options = seats.map((s) =>
        move(
          'taboo',
          `${s.taboo ? '移除' : '放置'}${GODS[s.god!].name}的禁忌`,
          '神恩',
          { target: s.i, value: s.taboo ? 0 : 1 },
        ),
      );
      break;
    case 7:
      g.temporary.ogun = true;
      break;
    case 8: {
      const cards = ELEMENTS.map((e) =>
        g.discard.find((c) => c.element === e),
      ).filter(Boolean) as Card[];
      options = [
        move('noop', '不取回记忆'),
        ...cards.map((c) => [c]),
        ...pairs(cards),
      ].map((v) =>
        Array.isArray(v)
          ? move(
              'retrieve',
              `取回${v.map((c) => `「${c.element}」`).join('与')}`,
              '神恩',
              { cards: v.map((c) => c.id) },
            )
          : v,
      );
      break;
    }
    case 9:
      options = seats
        .filter((s) => s.weather < 2)
        .map((s) =>
          move('rain', `${GODS[s.god!].name}风化 +1，再摸一张牌`, '神恩', {
            target: s.i,
          }),
        );
      if (!options.length) {
        p.hand.push(...draw(g, 1));
      }
      break;
    case 10:
      g.temporary.star = true;
      break;
    case 11: {
      const pool = draw(g, 3);
      if (paid) g.discard.push(paid);
      return prompt(
        g,
        player,
        '巴亚奈 · 选一张入手，其余弃置',
        pool.map((c) =>
          move('pick', `留下「${c.element}」`, '寻忆', { cards: [c.id] }),
        ),
        resume,
        pool,
      );
    }
  }
  // 玉米神支付牌在选取期间仍独立放置，避免回收自己刚支付的牌。
  if (paid) g.discard.push(paid);
  prompt(g, player, `${GODS[god].name} · ${GODS[god].effect}`, options, resume);
}
function normalMoves(g: Game, player: number): Move[] {
  const p = g.players[player];
  const out: Move[] = [];
  const seats = active(g);
  if (g.step === 'cleanup')
    return p.hand.length > p.mind
      ? p.hand.map((c) =>
          move('trim', `弃置「${c.element}」`, '整理', { cards: [c.id] }),
        )
      : [move('endTurn', '结束回合', '整理')];
  if (g.step === 'aux') {
    out.push(move('skip', '跳过辅助，进入主行动', '辅助'));
    for (const c of p.hand)
      if (p.mind > 2 || c.element === '炎')
        out.push(
          move('burn', `燃忆「${c.element}」`, '燃忆', { cards: [c.id] }),
        );
    for (const god of p.awake)
      for (const c of p.hand)
        out.push(
          move('pray', `弃「${c.element}」，祈神 · ${GODS[god].name}`, '祈神', {
            value: god,
            cards: [c.id],
          }),
        );
    for (const r of p.rested)
      if (!r.used)
        out.push(
          move('legacy', `使用${GODS[r.god].name}的遗赠（价值 −1）`, '遗赠', {
            value: r.god,
          }),
        );
    if (p.shaman === 0)
      out.push(
        ...transferOptions(g, player).map((o) => ({
          ...o,
          op: 'craftTransfer',
          group: '守艺',
        })),
      );
    if (p.shaman === 1)
      out.push(move('listen', '听冬者 · 查看并调整风暴', '守艺'));
    if (p.shaman === 3)
      for (const s of seats.filter((s) => s.weather === 2))
        for (const c of p.hand)
          if (p.mind > 2 || c.element === '炎')
            out.push(
              move(
                'guard',
                `燃烧「${c.element}」，守护${GODS[s.god!].name}`,
                '守艺',
                { target: s.i, cards: [c.id] },
              ),
            );
    if (p.shaman === 5 && !p.craftUsed)
      out.push(move('way', '问途者 · 本回合任意语素（每局一次）', '守艺'));
  } else {
    out.push(move('seek', '寻忆 · 摸三张，留下两张', '寻忆'));
    for (const s of seats) {
      if (placed(g, player) < 4)
        for (const c of p.hand)
          for (const element of GODS[s.god!].elements as readonly Element[]) {
            const matches =
              c.element === element ||
              (p.shaman === 2 && element === '骨') ||
              g.temporary.any ||
              (g.temporary.ogun && ['骨', '炎'].includes(element)) ||
              (g.temporary.star && element === '星');
            if (!matches || s.offerings.some((o) => o.element === element))
              continue;
            const costs =
              s.taboo && !g.temporary.ogun
                ? p.hand.filter((x) => x.id !== c.id).map((x) => [x.id])
                : [[]];
            for (const extra of costs)
              out.push(
                move(
                  'offer',
                  `「${c.element}」${c.element !== element ? `作「${element}」` : ''}供奉${GODS[s.god!].name}${extra.length ? `；弃「${p.hand.find((x) => x.id === extra[0])!.element}」解禁忌` : ''}`,
                  '供奉',
                  { target: s.i, element, cards: [c.id, ...extra] },
                ),
              );
          }
      if (s.weather !== 2 && !(s.weather === 1 && g.temporary.restOne))
        continue;
      const sacrifices = [
        ...p.hand.filter((c) => c.element === '骨').map((c) => [c]),
        ...pairs(p.hand),
      ];
      for (const sacrifice of sacrifices) {
        const ids = sacrifice.map((c) => c.id);
        const extras = s.taboo
          ? p.hand.filter((c) => !ids.includes(c.id)).map((c) => [c.id])
          : [[]];
        for (const extra of extras)
          out.push(
            move(
              'rest',
              `安魂${GODS[s.god!].name} · 祭品${sacrifice.map((c) => c.element).join('＋')}${extra.length ? `；禁忌另弃${p.hand.find((c) => c.id === extra[0])!.element}` : ''}`,
              '安魂',
              { target: s.i, cards: [...ids, ...extra] },
            ),
          );
      }
    }
  }
  return out;
}
function moves(g: Game, player: number): Move[] {
  if (g.phase === 'ended' || player < 0) return [];
  if (g.pending) return g.pending.player === player ? g.pending.options : [];
  const p = g.players[player];
  if (g.phase === 'chorus') {
    if (g.chorus[player]) return [];
    return [
      move('chorus', '不出牌，确认合诵', '极夜合诵'),
      ...STORMS[g.currentStorm].targets.flatMap((target) =>
        g.seats[target].god === null
          ? []
          : p.hand.map((c) =>
              move(
                'chorus',
                `为${godName(g, target)}交出「${c.element}」`,
                '极夜合诵',
                { target, cards: [c.id] },
              ),
            ),
      ),
    ];
  }
  if (g.phase === 'cold')
    return player === (g.starter + g.coldIndex) % g.players.length
      ? p.hand.flatMap((c) => [
          move('coldBurn', `燃烧「${c.element}」并发动巫术`, '严寒', {
            cards: [c.id],
          }),
          ...(STORMS[g.currentStorm].season === 1
            ? [
                move(
                  'coldDiscard',
                  `弃置「${c.element}」（不降心智）`,
                  '严寒',
                  { cards: [c.id] },
                ),
              ]
            : []),
        ])
      : [];
  return g.turn === player ? normalMoves(g, player) : [];
}
// 所有输入必须匹配服务端生成的合法选项；外层使用房间 revision 防重复、防陈旧操作。
export function actions(g: Game, player: number): PublicAction[] {
  return moves(g, player).map((m, i) => ({
    id: String(i),
    label: m.label,
    group: m.group,
    cards: m.cards,
    target: m.target,
  }));
}
export function act(input: Game, player: number, actionId: string): Game {
  const g = structuredClone(input);
  if (!/^\d+$/.test(actionId)) throw new Error('无效操作');
  const m = moves(g, player)[Number(actionId)];
  if (!m) throw new Error('当前不能这样行动');
  const p = g.players[player];
  if (g.pending) {
    const pending = g.pending;
    g.pending = null;
    if (m.op === 'peek') {
      prompt(
        g,
        player,
        '风的巫术 · 查看并调整风暴',
        windOptions(g),
        pending.resume,
      );
      return g;
    }
    if (m.op === 'trim') {
      pay(g, p, m.cards!);
      finish(g, 'cold');
      return g;
    }
    if (m.op === 'pick') {
      for (const c of pending.pool!)
        if (m.cards!.includes(c.id)) p.hand.push(c);
        else g.discard.push(c);
    } else resolve(g, player, m);
    finish(g, pending.resume);
    return g;
  }
  switch (m.op) {
    case 'chorus':
      g.chorus[player] = { card: m.cards?.[0] ?? null, seat: m.target ?? null };
      if (Object.keys(g.chorus).length === g.players.length) {
        for (const [i, choice] of Object.entries(g.chorus))
          if (choice.card !== null) {
            const c = take(g.players[Number(i)], choice.card);
            g.discard.push(c);
            log(
              g,
              `${g.players[Number(i)].name}向${choice.seat! + 1}号神座合诵「${c.element}」。`,
            );
          }
        weather(g);
      }
      break;
    case 'coldDiscard':
      pay(g, p, m.cards!);
      log(g, `${p.name}弃牌抵御严寒。`);
      g.coldIndex++;
      advanceCold(g);
      break;
    case 'coldBurn':
      burn(g, player, m.cards![0], 'cold');
      break;
    case 'skip':
      g.step = 'main';
      break;
    case 'burn':
      burn(g, player, m.cards![0], 'burn');
      break;
    case 'pray': {
      const paid = take(p, m.cards![0]);
      log(g, `${p.name}祈求${GODS[m.value!].name}。`);
      if (m.value === 8) godEffect(g, player, m.value, 'aux', paid);
      else {
        g.discard.push(paid);
        godEffect(g, player, m.value!, 'aux');
      }
      break;
    }
    case 'legacy':
      p.rested.find((r) => r.god === m.value)!.used = true;
      log(g, `${p.name}使用${GODS[m.value!].name}的遗赠。`);
      godEffect(g, player, m.value!, 'aux');
      break;
    case 'craftTransfer':
      resolve(g, player, { ...m, op: 'transfer' });
      finish(g, 'aux');
      break;
    case 'listen':
      prompt(g, player, '听冬者 · 查看风暴顶牌', windOptions(g), 'aux');
      break;
    case 'guard':
      g.seats[m.target!].weather--;
      burn(g, player, m.cards![0], 'aux');
      break;
    case 'way':
      p.craftUsed = true;
      g.temporary.any = true;
      finish(g, 'aux');
      break;
    case 'seek': {
      const pool = draw(g, 3);
      const choices = pool.length <= 2 ? [pool] : pairs(pool);
      prompt(
        g,
        player,
        '寻忆 · 选择留下的记忆',
        choices.map((cs) =>
          move(
            'pick',
            `留下${cs.length ? cs.map((c) => `「${c.element}」`).join('与') : '零张（牌库已空）'}`,
            '寻忆',
            { cards: cs.map((c) => c.id) },
          ),
        ),
        'main',
        pool,
      );
      break;
    }
    case 'offer': {
      const s = g.seats[m.target!];
      const c = take(p, m.cards![0]);
      pay(g, p, m.cards!.slice(1));
      s.taboo = false;
      s.offerings.push({ card: c, player, element: m.element! });
      log(g, `${p.name}向${GODS[s.god!].name}供奉「${m.element}」。`);
      awake(g, m.target!);
      if (g.temporary.star) p.mind = Math.min(RULES.mind.max, p.mind + 1);
      g.step = 'cleanup';
      break;
    }
    case 'rest': {
      const s = g.seats[m.target!];
      pay(g, p, m.cards!);
      for (const o of s.offerings) g.players[o.player].hand.push(o.card);
      p.rested.push({ god: s.god!, used: false });
      log(g, `${p.name}为${GODS[s.god!].name}安魂。`);
      Object.assign(s, { god: null, offerings: [], weather: 0, taboo: false });
      p.mind = Math.min(RULES.mind.max, p.mind + 1);
      p.hand.push(...draw(g, 1));
      g.step = 'cleanup';
      break;
    }
    case 'trim':
      pay(g, p, m.cards!);
      break;
    case 'endTurn':
      refill(g);
      if (g.phase === 'ended') break;
      g.acted++;
      if (g.acted === g.players.length) {
        if (g.lastRound) {
          g.phase = 'ended';
          log(g, '天亮了，火塘里的灰还是温的。守夜结束。');
        } else {
          g.starter = (g.starter + 1) % g.players.length;
          nextRound(g);
        }
      } else {
        g.turn = (g.turn + 1) % g.players.length;
        g.step = 'aux';
        g.temporary = cleanTemporary();
      }
      break;
  }
  return g;
}
function resolve(g: Game, player: number, m: Move) {
  const p = g.players[player];
  switch (m.op) {
    case 'weather':
      g.seats[m.target!].weather += m.value!;
      break;
    case 'taboo':
      g.seats[m.target!].taboo = Boolean(m.value);
      break;
    case 'swapStorm':
      [g.storms[0], g.storms[1]] = [g.storms[1], g.storms[0]];
      break;
    case 'transfer': {
      const s = g.seats[m.source!];
      const i = s.offerings.findIndex((o) => o.card.id === m.cards![0]);
      g.seats[m.target!].offerings.push(s.offerings.splice(i, 1)[0]);
      awake(g, m.target!);
      break;
    }
    case 'heal':
      for (const i of m.indices!) g.seats[i].weather--;
      break;
    case 'swapWeather':
      [g.seats[m.source!].weather, g.seats[m.target!].weather] = [
        g.seats[m.target!].weather,
        g.seats[m.source!].weather,
      ];
      break;
    case 'drawOne':
      p.hand.push(...draw(g, 1));
      break;
    case 'clearDraw':
      g.seats[m.target!].taboo = false;
      p.hand.push(...draw(g, 1));
      break;
    case 'rain':
      g.seats[m.target!].weather++;
      p.hand.push(...draw(g, 1));
      break;
    case 'retrieve':
      for (const id of m.cards!) {
        const i = g.discard.findIndex((c) => c.id === id);
        p.hand.push(g.discard.splice(i, 1)[0]);
      }
      break;
  }
  if (m.op !== 'noop') log(g, `${p.name}：${m.label}。`);
}
export function score(g: Game, p: Player) {
  const threshold = RULES.setups[g.players.length as 3 | 4 | 5 | 6].vigil;
  const awaken = p.awake.length * RULES.points.awake;
  const rest = p.rested.reduce(
    (n, r) => n + (r.used ? RULES.points.usedLegacy : RULES.points.rested),
    0,
  );
  const bonus = p.rested.length >= threshold ? RULES.points.vigil : 0;
  return {
    awaken,
    rest,
    echo: p.echo,
    bonus,
    total: awaken + rest + p.echo + bonus,
    gods: p.awake.length + p.rested.length,
  };
}
export function view(g: Game, player: number) {
  const acting =
    g.pending?.player ??
    (g.phase === 'cold'
      ? (g.starter + g.coldIndex) % g.players.length
      : g.turn);
  const permitted = actions(g, player);
  const isWind =
    g.pending?.player === player &&
    g.pending.options.some(
      (o) => o.op === 'swapStorm' || (o.op === 'noop' && /风暴/.test(o.label)),
    );
  const scores = g.players.map((p) => ({
    id: p.id,
    name: p.name,
    ...score(g, p),
  }));
  const sorted = [...scores].sort(
    (a, b) => b.total - a.total || b.gods - a.gods,
  );
  return {
    version: g.version,
    players: g.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      shaman: p.shaman,
      mind: p.mind,
      echo: p.echo,
      awake: p.awake,
      rested: p.rested,
      craftUsed: p.craftUsed,
      hand: i === player ? p.hand : [],
      handCount: p.hand.length,
      marks: 4 - placed(g, i),
      score: score(g, p),
    })),
    seats: g.seats,
    round: g.round,
    maxRounds: g.maxRounds,
    currentStorm: g.currentStorm,
    stormCount: g.storms.length,
    godCount: g.gods.length,
    deckCount: g.deck.length,
    discard: g.discard,
    communal: g.communal,
    starter: g.starter,
    acting,
    phase: g.phase,
    step: g.step,
    lastRound: g.lastRound,
    failed: g.failed,
    logs: g.logs,
    actions: permitted,
    prompt: g.pending?.player === player ? g.pending.title : null,
    pool: g.pending?.player === player ? g.pending.pool : undefined,
    forecast: isWind ? g.storms.slice(0, 2) : null,
    chorusReady: Object.keys(g.chorus).map(Number),
    temporary: g.turn === player ? g.temporary : undefined,
    winners:
      g.phase === 'ended' && !g.failed
        ? sorted
            .filter(
              (p) => p.total === sorted[0].total && p.gods === sorted[0].gods,
            )
            .map((p) => p.id)
        : [],
  };
}
export type GameView = ReturnType<typeof view>;
