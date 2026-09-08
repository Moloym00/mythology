import { act, createGame, view, type Game, type GameView } from './game/engine';
export type Member = {
  id: string;
  name: string;
  shaman: number;
  tokenHash: string;
  bot?: boolean;
};
export type Room = {
  members: Member[];
  game: Game | null;
  createdAt: number;
  aiLease?: number;
  aiMode?: 'local' | 'api';
  aiStatus?: string;
};
export type RoomView = {
  code: string;
  revision: number;
  you: string;
  host: string;
  members: Omit<Member, 'tokenHash'>[];
  game: GameView | null;
  aiPending: boolean;
  aiMode: 'local' | 'api';
  aiStatus?: string;
};
export function roomView(
  code: string,
  revision: number,
  room: Room,
  memberId: string,
): RoomView {
  return {
    code,
    revision,
    you: memberId,
    host: room.members[0].id,
    members: room.members.map(({ id, name, shaman, bot }) => ({
      id,
      name,
      shaman,
      bot,
    })),
    aiPending: Boolean(
      room.game &&
      room.members.some((m, i) => m.bot && view(room.game!, i).actions.length),
    ),
    aiMode: room.aiMode ?? 'local',
    aiStatus: room.aiStatus,
    game: room.game
      ? view(
          room.game,
          room.members.findIndex((m) => m.id === memberId),
        )
      : null,
  };
}
export function changeRoom(
  room: Room,
  memberId: string,
  body: { type: string; shaman?: number; action?: string; mode?: string },
  seed: number,
): Room {
  const next = structuredClone(room),
    member = next.members.find((m) => m.id === memberId);
  if (!member) throw new Error('座位凭证失效');
  if (
    body.type === 'addBot' ||
    body.type === 'removeBot' ||
    body.type === 'aiMode'
  ) {
    if (next.members[0].id !== memberId) throw new Error('只有房主可以设置AI');
    if (next.game) throw new Error('请在开局前设置AI');
    if (body.type === 'aiMode') {
      if (!['local', 'api'].includes(body.mode ?? ''))
        throw new Error('无效AI模式');
      next.aiMode = body.mode as 'local' | 'api';
    } else if (body.type === 'removeBot') {
      const i = next.members.findLastIndex((m) => m.bot);
      if (i >= 0) next.members.splice(i, 1);
    } else {
      if (next.members.length >= 6) throw new Error('房间已满');
      const shaman = [0, 1, 2, 3, 4, 5].find((n) =>
        next.members.every((m) => m.shaman !== n),
      )!;
      next.members.push({
        id: `bot-${crypto.randomUUID()}`,
        name: `AI·${['渡魂', '听冬', '刻骨', '守火', '织名', '问途'][shaman]}`,
        shaman,
        bot: true,
        tokenHash: '',
      });
    }
  } else if (body.type === 'select') {
    if (next.game) throw new Error('开局后不能更换萨满');
    if (!Number.isInteger(body.shaman) || body.shaman! < 0 || body.shaman! > 5)
      throw new Error('请选择有效萨满');
    if (
      next.members.some((m) => m.id !== member.id && m.shaman === body.shaman)
    )
      throw new Error('这位萨满已经有人选择');
    member.shaman = body.shaman!;
  } else if (body.type === 'start') {
    if (next.members[0].id !== memberId) throw new Error('只有房主可以开始');
    if (next.game) throw new Error('游戏已经开始');
    next.game = createGame(next.members, seed);
  } else if (body.type === 'act') {
    if (!next.game) throw new Error('游戏尚未开始');
    next.game = act(
      next.game,
      next.members.findIndex((m) => m.id === memberId),
      body.action ?? '',
    );
  } else throw new Error('未知操作');
  return next;
}
