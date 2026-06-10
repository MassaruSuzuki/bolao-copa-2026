import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const matchChatMessagesTable = pgTable("match_chat_messages", {
  id: serial("id").primaryKey(),

  matchId: integer("match_id")
    .notNull(),

  userId: integer("user_id")
    .notNull(),

  message: text("message")
    .notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export type MatchChatMessage =
  typeof matchChatMessagesTable.$inferSelect;

export type InsertMatchChatMessage =
  typeof matchChatMessagesTable.$inferInsert;