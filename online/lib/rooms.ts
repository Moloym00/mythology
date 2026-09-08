import { act, createGame, view, type Game, type GameView } from './game/engine';
export type Member = {
  id: string;
  name: string;
  shaman: number;
  tokenHash: string;
};
export type Room = { members: Member[]; game: Game | null; createdAt: number };
export type RoomView = {
  code: string;
  revision: number;
  you: string;
  host: string;
  members: Omit<Member, 'tokenHash'>[];
  game: GameView | null;
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
    members: room.members.map(({ id, name, shaman }) => ({ id, name, shaman })),
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
  body: { type: string; shaman?: number; action?: string },
  seed: number,
): Room {
  const next = structuredClone(room),
    member = next.members.find((m) => m.id === memberId);
  if (!member) throw new Error('座位凭证失效');
  if (body.type === 'select') {
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
