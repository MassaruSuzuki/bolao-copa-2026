import { Router, type IRouter } from "express";
import { db, predictionsTable, matchesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function calcPoints(
  predHome: number, predAway: number,
  realHome: number, realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return 3;
  const predWinner = predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";
  const realWinner = realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";
  if (predWinner === realWinner) return 1;
  return 0;
}

router.get("/ranking", requireAuth, async (_req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable).where(and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved")));
  const finishedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "finished"));
  const allPredictions = await db.select().from(predictionsTable);

  // Today's finished matches (UTC date comparison)
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const todayFinished = finishedMatches.filter((m) => {
    const d = new Date(m.matchDate);
    return d >= todayStart && d < tomorrowStart;
  });

  const ranking = allUsers.map((user) => {
    let totalPoints = 0;
    let exactScores = 0;
    let correctResults = 0;
    let totalPredictions = 0;
    let todayGain = 0;

    for (const match of finishedMatches) {
      if (match.homeScore === null || match.awayScore === null) continue;
      const pred = allPredictions.find(
        (p) => p.userId === user.id && p.matchId === match.id
      );
      if (!pred) continue;
      totalPredictions++;
      const pts = calcPoints(pred.homeGoals, pred.awayGoals, match.homeScore, match.awayScore);
      totalPoints += pts;
      if (pts === 5) exactScores++;
      if (pts === 3) correctResults++;
    }

    for (const match of todayFinished) {
      if (match.homeScore === null || match.awayScore === null) continue;
      const pred = allPredictions.find(
        (p) => p.userId === user.id && p.matchId === match.id
      );
      if (!pred) continue;
      todayGain += calcPoints(pred.homeGoals, pred.awayGoals, match.homeScore, match.awayScore);
    }

    return {
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      totalPoints,
      exactScores,
      correctResults,
      totalPredictions,
      todayGain,
    };
  });

  ranking.sort((a, b) => b.totalPoints - a.totalPoints);
  res.json(ranking);
});

router.get("/ranking/live", requireAuth, async (_req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable).where(and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved")));
  const finishedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "finished"));
  const liveMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "live"));
  const allPredictions = await db.select().from(predictionsTable);

  // Only live matches that already have a score
  const scoredLiveMatches = liveMatches.filter(
    (m) => m.homeScore !== null && m.awayScore !== null
  );

  const ranking = allUsers.map((user) => {
    // Base points from finished matches
    let basePoints = 0;
    for (const match of finishedMatches) {
      if (match.homeScore === null || match.awayScore === null) continue;
      const pred = allPredictions.find(
        (p) => p.userId === user.id && p.matchId === match.id
      );
      if (!pred) continue;
      basePoints += calcPoints(pred.homeGoals, pred.awayGoals, match.homeScore, match.awayScore);
    }

    // Sum live bonus across ALL live matches with scores
    let liveBonus = 0;
    let proximityTotal: number | null = null;
    let hasPrediction = false;

    for (const liveMatch of scoredLiveMatches) {
      const pred = allPredictions.find(
        (p) => p.userId === user.id && p.matchId === liveMatch.id
      );
      if (!pred) continue;
      hasPrediction = true;
      const h = liveMatch.homeScore as number;
      const a = liveMatch.awayScore as number;
      liveBonus += calcPoints(pred.homeGoals, pred.awayGoals, h, a);
      const dist = Math.abs(pred.homeGoals - h) + Math.abs(pred.awayGoals - a);
      proximityTotal = (proximityTotal ?? 0) + dist;
    }

    return {
      userId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      basePoints,
      liveBonus,
      projectedTotal: basePoints + liveBonus,
      liveMatchId: scoredLiveMatches[0]?.id ?? null,
      predHome: null,
      predAway: null,
      currentHome: null,
      currentAway: null,
      proximity: proximityTotal,
      hasPrediction,
    };
  });

  // Sort: projected total desc, then proximity asc (lower = better), then name
  ranking.sort((a, b) => {
    if (b.projectedTotal !== a.projectedTotal) return b.projectedTotal - a.projectedTotal;
    if (a.proximity !== null && b.proximity !== null) return a.proximity - b.proximity;
    if (a.proximity !== null) return -1;
    if (b.proximity !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  res.json(ranking);
});

export default router;
