import { Router, type IRouter } from "express";
import { db, predictionsTable, matchesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function calcPoints(
  predHome: number, predAway: number,
  realHome: number, realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return 5;
  const predWinner = predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";
  const realWinner = realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";
  if (predWinner === realWinner) return 3;
  return 0;
}

router.get("/ranking", requireAuth, async (_req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable).where(eq(usersTable.isAdmin, false));
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
  const allUsers = await db.select().from(usersTable).where(eq(usersTable.isAdmin, false));
  const finishedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "finished"));
  const liveMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "live"));
  const allPredictions = await db.select().from(predictionsTable);

  // Pick the first live match with a score (the "active" one)
  const liveMatch = liveMatches.find(
    (m) => m.homeScore !== null && m.awayScore !== null
  ) ?? liveMatches[0] ?? null;

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

    // Projected live bonus
    let liveBonus = 0;
    let predHome: number | null = null;
    let predAway: number | null = null;
    let currentHome: number | null = null;
    let currentAway: number | null = null;
    let proximity: number | null = null;
    let hasPrediction = false;

    if (liveMatch) {
      const pred = allPredictions.find(
        (p) => p.userId === user.id && p.matchId === liveMatch.id
      );
      if (pred) {
        hasPrediction = true;
        predHome = pred.homeGoals;
        predAway = pred.awayGoals;
        currentHome = liveMatch.homeScore ?? null;
        currentAway = liveMatch.awayScore ?? null;
        if (currentHome !== null && currentAway !== null) {
          liveBonus = calcPoints(predHome, predAway, currentHome, currentAway);
          // Proximity: total goal difference (lower = closer to exact)
          proximity = Math.abs(predHome - currentHome) + Math.abs(predAway - currentAway);
        }
      }
    }

    return {
      userId: user.id,
      name: user.name,
      basePoints,
      liveBonus,
      projectedTotal: basePoints + liveBonus,
      liveMatchId: liveMatch?.id ?? null,
      predHome,
      predAway,
      currentHome,
      currentAway,
      proximity,
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
