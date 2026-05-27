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
          status: mapped.status,
          homeScore: mapped.homeScore,
          awayScore: mapped.awayScore,
        })
        .where(eq(matchesTable.externalId, fdMatch.id));
      updated++;
    }
  }

  // Also mark finished matches that were live
  await db
    .select({ id: matchesTable.id, externalId: matchesTable.externalId })
    .from(matchesTable)
    .where(eq(matchesTable.status, "live"))
    .then(async (liveInDb) => {
      const liveExternalIds = new Set(fdMatches.map((m) => m.id));
      for (const m of liveInDb) {
        if (m.externalId && !liveExternalIds.has(m.externalId)) {
          // Was live but no longer in live feed — fetch individual match to get final status
          try {
            const res = await fetch(
              `https://api.football-data.org/v4/matches/${m.externalId}`,
              { headers: { "X-Auth-Token": process.env["FOOTBALL_DATA_API_KEY"] ?? "" } }
            );
            if (res.ok) {
              const data = (await res.json()) as { status: string; score: { fullTime: { home: number | null; away: number | null } } };
              const newStatus =
                data.status === "FINISHED" || data.status === "AWARDED"
                  ? "finished"
                  : data.status === "IN_PLAY" || data.status === "PAUSED"
                  ? "live"
                  : "upcoming";
              await db
                .update(matchesTable)
                .set({
                  status: newStatus,
                  homeScore: data.score.fullTime.home ?? null,
                  awayScore: data.score.fullTime.away ?? null,
                })
                .where(eq(matchesTable.id, m.id));
            }
          } catch {
            // best-effort
          }
        }
      }
    });

  logger.info({ updated }, "Live scores synced");
  return { updated };
}

export default router;
