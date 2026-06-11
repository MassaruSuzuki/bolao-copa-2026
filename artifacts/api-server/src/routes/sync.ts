import { Router, type IRouter } from "express";
import { db, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import {
  fetchAllWcMatches,
  fetchLiveWcMatches,
  mapFdMatch,
  toInternalStatus,
} from "../services/footballData";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function safeScore(
  newScore: number | null | undefined,
  oldScore: number | null
): number | null {
  if (newScore === null || newScore === undefined) return oldScore;
  if (oldScore !== null && newScore < oldScore) return oldScore;
  return newScore;
}

function pickScore(score?: {
  fullTime?: { home: number | null; away: number | null };
  halfTime?: { home: number | null; away: number | null };
}) {
  return {
    home: score?.fullTime?.home ?? score?.halfTime?.home ?? null,
    away: score?.fullTime?.away ?? score?.halfTime?.away ?? null,
  };
}

async function fetchMatchByExternalId(externalId: number) {
  const response = await fetch(
    `https://api.football-data.org/v4/matches/${externalId}`,
    {
      headers: {
        "X-Auth-Token": process.env["FOOTBALL_DATA_API_KEY"] ?? "",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();

    logger.warn(
      {
        externalId,
        status: response.status,
        body: text,
      },
      "Falha ao buscar partida individual"
    );

    return null;
  }

  return response.json() as Promise<{
    id: number;
    utcDate: string;
    status:
      | "SCHEDULED"
      | "TIMED"
      | "IN_PLAY"
      | "PAUSED"
      | "FINISHED"
      | "SUSPENDED"
      | "POSTPONED"
      | "CANCELLED"
      | "AWARDED";
    score?: {
      winner?: string | null;
      fullTime?: {
        home: number | null;
        away: number | null;
      };
      halfTime?: {
        home: number | null;
        away: number | null;
      };
    };
  }>;
}

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
            homeScore: matchesTable.homeScore,
            awayScore: matchesTable.awayScore,
          })
          .from(matchesTable)
          .where(eq(matchesTable.externalId, fdMatch.id));

        if (!existing) {
          await db.insert(matchesTable).values(mapped);
          created++;
          continue;
        }

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
            homeScore: safeScore(mapped.homeScore, existing.homeScore),
            awayScore: safeScore(mapped.awayScore, existing.awayScore),
          })
          .where(eq(matchesTable.externalId, fdMatch.id));

        updated++;
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
        status: matchesTable.status,
        homeScore: matchesTable.homeScore,
        awayScore: matchesTable.awayScore,
      })
      .from(matchesTable)
      .where(eq(matchesTable.externalId, fdMatch.id));

    if (!existing) continue;

    await db
      .update(matchesTable)
      .set({
        status: "live",
        homeScore: safeScore(mapped.homeScore, existing.homeScore),
        awayScore: safeScore(mapped.awayScore, existing.awayScore),
      })
      .where(eq(matchesTable.externalId, fdMatch.id));

    updated++;
  }

  const liveInDb = await db
    .select({
      id: matchesTable.id,
      externalId: matchesTable.externalId,
      homeScore: matchesTable.homeScore,
      awayScore: matchesTable.awayScore,
    })
    .from(matchesTable)
    .where(eq(matchesTable.status, "live"));

  for (const match of liveInDb) {
    if (!match.externalId) continue;

    const individualMatch = await fetchMatchByExternalId(match.externalId);
    if (!individualMatch) continue;

    const currentScore = pickScore(individualMatch.score);
    const internalStatus = toInternalStatus(individualMatch.status);

    await db
      .update(matchesTable)
      .set({
        status: internalStatus,
        homeScore: safeScore(currentScore.home, match.homeScore),
        awayScore: safeScore(currentScore.away, match.awayScore),
      })
      .where(eq(matchesTable.id, match.id));

    updated++;
  }

  logger.info({ updated }, "Live scores synced");
  return { updated };
}

export default router;