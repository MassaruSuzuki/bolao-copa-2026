import { Router, type IRouter } from "express";
import { db, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import {
  fetchAllWcMatches,
  fetchLiveWcMatches,
  mapFdMatch,
} from "../services/footballData";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post(
  "/admin/sync-matches",
  requireAdmin,
  async (_req, res): Promise<void> => {
    try {
      const fdMatches = await fetchAllWcMatches();
      let created = 0;
      let updated = 0;

      for (const fdMatch of fdMatches) {
        if (!fdMatch.homeTeam?.name || !fdMatch.awayTeam?.name) continue;

        const mapped = mapFdMatch(fdMatch);

        const [existing] = await db
          .select({
            id: matchesTable.id,
            status: matchesTable.status,
          })
          .from(matchesTable)
          .where(eq(matchesTable.externalId, fdMatch.id));

        if (!existing) {
          await db.insert(matchesTable).values(mapped);
          created++;
        } else {
          const nextStatus =
            existing.status === "live" && mapped.status !== "finished"
              ? "live"
              : mapped.status;

          await db
            .update(matchesTable)
            .set({
              homeTeam: mapped.homeTeam,
              awayTeam: mapped.awayTeam,
              homeLogo: mapped.homeLogo,
              awayLogo: mapped.awayLogo,
              matchDate: mapped.matchDate,
              status: nextStatus,
              homeScore: mapped.homeScore,
              awayScore: mapped.awayScore,
            })
            .where(eq(matchesTable.externalId, fdMatch.id));

          updated++;
        }
      }

      logger.info({ created, updated }, "Sync completed");
      res.json({ ok: true, created, updated, total: fdMatches.length });
    } catch (err) {
      logger.error({ err }, "Sync failed");
      res.status(500).json({ error: String(err) });
    }
  }
);

router.post(
  "/admin/sync-live",
  requireAdmin,
  async (_req, res): Promise<void> => {
    try {
      const result = await syncLiveScores();
      res.json({ ok: true, ...result });
    } catch (err) {
      logger.error({ err }, "Live sync failed");
      res.status(500).json({ error: String(err) });
    }
  }
);

export async function syncLiveScores(): Promise<{ updated: number }> {
  const fdMatches = await fetchLiveWcMatches();
  let updated = 0;

  for (const fdMatch of fdMatches) {
    const mapped = mapFdMatch(fdMatch);

    const [existing] = await db
      .select({
        id: matchesTable.id,
      })
      .from(matchesTable)
      .where(eq(matchesTable.externalId, fdMatch.id));

    if (existing) {
      await db
        .update(matchesTable)
        .set({
          status: "live",
          homeScore: mapped.homeScore,
          awayScore: mapped.awayScore,
        })
        .where(eq(matchesTable.externalId, fdMatch.id));

      updated++;
    }
  }

  const liveInDb = await db
    .select({
      id: matchesTable.id,
      externalId: matchesTable.externalId,
      matchDate: matchesTable.matchDate,
    })
    .from(matchesTable)
    .where(eq(matchesTable.status, "live"));

  const liveExternalIds = new Set(fdMatches.map((m) => m.id));

  for (const match of liveInDb) {
    if (!match.externalId) continue;
    if (liveExternalIds.has(match.externalId)) continue;

    try {
      const response = await fetch(
        `https://api.football-data.org/v4/matches/${match.externalId}`,
        {
          headers: {
            "X-Auth-Token": process.env["FOOTBALL_DATA_API_KEY"] ?? "",
          },
        }
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        status: string;
        score: {
          fullTime: {
            home: number | null;
            away: number | null;
          };
        };
      };

      let nextStatus: "upcoming" | "live" | "finished" = "live";

      if (data.status === "FINISHED" || data.status === "AWARDED") {
        nextStatus = "finished";
      }

      await db
        .update(matchesTable)
        .set({
          status: nextStatus,
          homeScore: data.score.fullTime.home ?? null,
          awayScore: data.score.fullTime.away ?? null,
        })
        .where(eq(matchesTable.id, match.id));
    } catch {
      // Se a API falhar, mantém o jogo como live.
    }
  }

  logger.info({ updated }, "Live scores synced");
  return { updated };
}

export default router;