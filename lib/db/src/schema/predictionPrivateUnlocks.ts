import {
  pgTable,
  serial,
  timestamp,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { matchesTable } from "./matches";

export const predictionPrivateUnlocksTable = pgTable(
  "prediction_private_unlocks",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),

    matchId: integer("match_id")
      .notNull()
      .references(() => matchesTable.id),

    createdByAdminId: integer("created_by_admin_id").references(
      () => usersTable.id
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [unique("prediction_private_unlock_unique").on(t.userId, t.matchId)]
);

export type PredictionPrivateUnlock =
  typeof predictionPrivateUnlocksTable.$inferSelect;