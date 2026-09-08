import { env } from 'cloudflare:workers';
import { changeRoom, roomView, type Room } from '@/lib/rooms';
const TTL = 7 * 24 * 60 * 60 * 1000;
function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
async function hash(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
function token(req: Request) {
  return req.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
}
function codeValue(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Z2-9]{6}$/.test(value))
    throw new Error('房间号应为6位字母或数字');
  return value;
}
async function load(code: string) {
  const row = await env.DB.prepare(
    'SELECT revision, state FROM rooms WHERE code = ? AND expires_at > ?',
  )
    .bind(code, Date.now())
    .first<{ revision: number; state: string }>();
  if (!row) throw new Error('房间不存在或已过期');
  return { revision: row.revision, room: JSON.parse(row.state) as Room };
}
async function identity(req: Request, room: Room) {
  const digest = await hash(token(req));
  const member = room.members.find((m) => m.tokenHash === digest);
  if (!member) throw new Error('座位凭证失效，请重新加入房间');
  return member;
}
export async function GET(req: Request) {
  try {
    const code = codeValue(new URL(req.url).searchParams.get('code'));
    const { room, revision } = await load(code);
    const m = await identity(req, room);
    return reply(roomView(code, revision, room, m.id));
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : '读取房间失败' },
      400,
    );
  }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin)
      return reply({ error: '请求来源不匹配' }, 403);
    const text = await req.text();
    if (text.length > 4096) return reply({ error: '请求过大' }, 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Error('无效请求');
    if (body.type === 'create' || body.type === 'join') {
      if (
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 16
      )
        throw new Error('名字需要1–16个字符');
      const raw = crypto.randomUUID() + crypto.randomUUID();
      const member = {
        id: crypto.randomUUID(),
        name: body.name.trim(),
        shaman: 0,
        tokenHash: await hash(raw),
      };
      if (body.type === 'create') {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for (let retry = 0; retry < 4; retry++) {
          const code = Array.from(
            crypto.getRandomValues(new Uint8Array(6)),
            (n) => alphabet[n % alphabet.length],
          ).join('');
          const room: Room = {
            members: [member],
            game: null,
            createdAt: Date.now(),
          };
          const inserted = await env.DB.prepare(
            'INSERT OR IGNORE INTO rooms (code, revision, state, expires_at) VALUES (?, 0, ?, ?)',
          )
            .bind(code, JSON.stringify(room), Date.now() + TTL)
            .run();
          if (inserted.meta.changes)
            return reply({ ...roomView(code, 0, room, member.id), token: raw });
        }
        throw new Error('暂时无法创建房间，请稍后再试');
      }
      const code = codeValue(body.code);
      const { room, revision } = await load(code);
      if (room.game)
        throw new Error('游戏已开始；已有玩家请用原浏览器恢复座位');
      if (room.members.length >= 6) throw new Error('房间已满');
      if (room.members.some((m) => m.name === member.name))
        throw new Error('名字已被使用，请换一个');
      member.shaman = [0, 1, 2, 3, 4, 5].find((n) =>
        room.members.every((m) => m.shaman !== n),
      )!;
      room.members.push(member);
      const changed = await env.DB.prepare(
        'UPDATE rooms SET state = ?, revision = revision + 1, expires_at = ? WHERE code = ? AND revision = ?',
      )
        .bind(JSON.stringify(room), Date.now() + TTL, code, revision)
        .run();
      if (!changed.meta.changes)
        return reply({ error: '有人同时加入，请重试' }, 409);
      return reply({
        ...roomView(code, revision + 1, room, member.id),
        token: raw,
      });
    }
    const code = codeValue(body.code);
    const { room, revision } = await load(code);
    const member = await identity(req, room);
    if (body.revision !== revision)
      return reply({ error: '牌桌已更新，请按最新状态重新选择' }, 409);
    const changedRoom = changeRoom(
      room,
      member.id,
      body,
      crypto.getRandomValues(new Uint32Array(1))[0],
    );
    const updated = await env.DB.prepare(
      'UPDATE rooms SET state = ?, revision = revision + 1, expires_at = ? WHERE code = ? AND revision = ?',
    )
      .bind(JSON.stringify(changedRoom), Date.now() + TTL, code, revision)
      .run();
    if (!updated.meta.changes)
      return reply({ error: '牌桌已更新，请重新选择' }, 409);
    return reply(roomView(code, revision + 1, changedRoom, member.id));
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : '暂时无法连接火塘' },
      400,
    );
  }
}
