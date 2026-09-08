import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
// 一房间一行；revision compare-and-swap 保证跨请求的原子行动。
export const rooms = sqliteTable('rooms', {
  code: text('code').primaryKey(),
  revision: integer('revision').notNull().default(0),
  state: text('state').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
