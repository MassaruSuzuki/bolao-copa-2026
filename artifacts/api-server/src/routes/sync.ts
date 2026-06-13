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

const LIVE_FALLBACK_WINDOW_MS = 3 * 60 * 60 * 1000;

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

function shouldForceLiveByTime(matchDate: Date, apiStatus: string): boolean {
  const now = Date.now();
  const start = new Date(matchDate).getTime();
  const end = start + LIVE_FALLBACK_WINDOW_MS;

  return (
    now >= start &&
    now <= end &&
    (apiStatus === "SCHEDULED" || apiStatus === "TIMED")
  );
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
      { externalId, status: response.status, body: text },
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
      fullTime?: { home: number | null; away: number | null };
      halfTime?: { home: number | null; away: number | null };
    };
  }>;
}

async function syncAllMatches(): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  const fdMatches = await fetchAllWcMatches();

  let created = 0;
  let updated = 0;

  for (const fdMatch of fdMatches) {
    if (!fdMatch.homeTeam?.name || !fdMatch.awayTeam?.name) continue;

    const mapped = mapFdMatch(fdMatch);

    const [existing] = await db
      .select({
        id: matchesTable.id,
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

    await db
      .update(matchesTable)
      .set({
        homeTeam: mapped.homeTeam,
        awayTeam: mapped.awayTeam,
        homeLogo: mapped.homeLogo,
        awayLogo: mapped.awayLogo,
        matchDate: mapped.matchDate,
        status: mapped.status,
        homeScore: safeScore(mapped.homeScore, existing.homeScore),
        awayScore: safeScore(mapped.awayScore, existing.awayScore),
      })
      .where(eq(matchesTable.externalId, fdMatch.id));

    updated++;
  }

  return {
    created,
    updated,
    total: fdMatches.length,
  };
}

export async function syncLiveScores(): Promise<{
  updated: number;
  correctedFromAllSync: number;
}> {
  let updated = 0;

  const allSync = await syncAllMatches();
  const correctedFromAllSync = allSync.updated;

  const fdLiveMatches = await fetchLiveWcMatches();

  for (const fdMatch of fdLiveMatches) {
    const mapped = mapFdMatch(fdMatch);

    const [existing] = await db
      .select({
        id: matchesTable.id,
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

  const matchesToCheck = await db
    .select({
      id: matchesTable.id,
      externalId: matchesTable.externalId,
      homeTeam: matchesTable.homeTeam,
      awayTeam: matchesTable.awayTeam,
      matchDate: matchesTable.matchDate,
      status: matchesTable.status,
      homeScore: matchesTable.homeScore,
      awayScore: matchesTable.awayScore,
    })
    .from(matchesTable);

  for (const match of matchesToCheck) {
    if (!match.externalId) continue;

    const statusText = String(match.status);

    const shouldCheck =
      statusText === "scheduled" || statusText === "live";

    if (!shouldCheck) continue;

    const individualMatch = await fetchMatchByExternalId(match.externalId);
    if (!individualMatch) continue;

    const currentScore = pickScore(individualMatch.score);
    const apiInternalStatus = toInternalStatus(individualMatch.status);

    const finalStatus = shouldForceLiveByTime(
      match.matchDate,
      individualMatch.status
    )
      ? "live"
      : apiInternalStatus;

    await db
      .update(matchesTable)
      .set({
        status: finalStatus,
        homeScore: safeScore(currentScore.home, match.homeScore),
        awayScore: safeScore(currentScore.away, match.awayScore),
      })
      .where(eq(matchesTable.id, match.id));

    updated++;

    logger.info(
      {
        id: match.id,
        externalId: match.externalId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        oldStatus: match.status,
        apiStatus: individualMatch.status,
        finalStatus,
      },
      "Partida conferida individualmente no sync automático"
    );
  }

  logger.info(
    {
      updated,
      correctedFromAllSync,
    },
    "Live scores synced"
  );

  return {
    updated,
    correctedFromAllSync,
  };
}

router.post(
  "/admin/sync-matches",
  requireAdmin,
  async (_req, res): Promise<void> => {
    try {
      const result = await syncAllMatches();

      logger.info(result, "Sync geral concluído");

      res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      logger.error({ err }, "Sync geral falhou");
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

      res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      logger.error({ err }, "Live sync failed");
      res.status(500).json({ error: String(err) });
    }
  }
);

export default router;