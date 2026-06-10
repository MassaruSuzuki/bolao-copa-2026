import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  externalId: integer("external_id").unique(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  homeLogo: text("home_logo"),
  awayLogo: text("away_logo"),
  matchDate: timestamp("match_date", { withTimezone: true }).notNull(),
  status: text("status", { enum: ["upcoming", "live", "finished"] }).notNull().default("upcoming"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  youtubeUrl: text("youtube_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  chatLocked: boolean("chat_locked").notNull().default(false),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
