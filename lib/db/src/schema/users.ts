import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),

  name: text("name").notNull(),

  email: text("email").notNull().unique(),

  password: text("password").notNull(),

  isAdmin: boolean("is_admin").notNull().default(false),

  status: text("status").notNull().default("pending"),

  avatarUrl: text("avatar_url"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});

export const updateUserPasswordSchema = z.object({
  password: z
    .string()
    .min(6, "A nova senha deve ter pelo menos 6 caracteres."),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserPassword = z.infer<typeof updateUserPasswordSchema>;
export type User = typeof usersTable.$inferSelect;