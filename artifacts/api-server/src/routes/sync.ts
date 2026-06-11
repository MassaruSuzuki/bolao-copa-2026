import { Router, type IRouter } from "express";
import { db, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/auth";
import { fetchAllWcMatches, fetchLiveWcMatches, mapFdMatch } from "../services/footballData";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/admin/sync-matches", requireAdmin, async (req, res): Promise<void> => {
  try {
    const fdMatches = await fetchAllWcMatches();
    let created = 0;
    let updated = 0;

    for (const fdMatch of fdMatches) {
      // Skip matches where teams are not yet defined (knockout stage placeholders)
      if (!fdMatch.homeTeam?.name || !fdMatch.awayTeam?.name) continue;

      const mapped = mapFdMatch(fdMatch);
      const existing = await db
        .select({ id: matchesTable.id })
        .from(matchesTable)
        .where(eq(matchesTable.externalId, fdMatch.id));

      if (existing.length === 0) {
        await db.insert(matchesTable).values(mapped);
        created++;
      } else {
        await db
          .update(matchesTable)
          .set({
            homeTeam: mapped.homeTeam,
            awayTeam: mapped.awayTeam,
            homeLogo: mapped.homeLogo,
            awayLogo: mapped.awayLogo,
            matchDate: mapped.matchDate,
            status: mapped.status,
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
});

router.post("/admin/sync-live", requireAdmin, async (req, res): Promise<void> => {
  try {
    const result = await syncLiveScores();
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "Live sync failed");
    res.status(500).json({ error: String(err) });
  }
});

export async function syncLiveScores(): Promise<{ updated: number }> {
  const fdMatches = await fetchLiveWcMatches();
  let updated = 0;

  for (const fdMatch of fdMatches) {
    const mapped = mapFdMatch(fdMatch);

    const existing = await db
      .select({ id: matchesTable.id })
      .from(matchesTable)
      .where(eq(matchesTable.externalId, fdMatch.id));

    if (existing.length > 0) {
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

  for (const m of liveInDb) {
    if (!m.externalId) continue;

    if (liveExternalIds.has(m.externalId)) continue;

    try {
      const res = await fetch(
        `https://api.football-data.org/v4/matches/${m.externalId}`,
        {
          headers: {
            "X-Auth-Token": process.env["FOOTBALL_DATA_API_KEY"] ?? "",
          },
        }
      );

      if (!res.ok) continue;

      const data = (await res.json()) as {
        status: string;
        score: {
          fullTime: {
            home: number | null;
            away: number | null;
          };
        };
      };

      let newStatus: "upcoming" | "live" | "finished" = "live";

      if (data.status === "FINISHED" || data.status === "AWARDED") {
        newStatus = "finished";
      }

      if (
        data.status === "IN_PLAY" ||
        data.status === "PAUSED" ||
        data.status === "TIMED" ||
        data.status === "SCHEDULED"
      ) {
        newStatus = "live";
      }

      await db
        .update(matchesTable)
        .set({
          status: newStatus,
          homeScore: data.score.fullTime.home ?? null,
          awayScore: data.score.fullTime.away ?? null,
        })
        .where(eq(matchesTable.id, m.id));
    } catch {
      // Se a API falhar, mantém como live para não derrubar o jogo da tela.
    }
  }

  logger.info({ updated }, "Live scores synced");
  return { updated };
}

export default router;
