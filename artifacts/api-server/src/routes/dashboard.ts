import { Router, type IRouter } from "express";
import { db, matchesTable, usersTable, predictionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

function calcPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return 5;

  const predWinner =
    predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";

  const realWinner =
    realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";

  if (predWinner === realWinner) return 3;

  return 0;
}

function serializeMatch(match: typeof matchesTable.$inferSelect) {
  return {
    ...match,
    matchDate: match.matchDate.toISOString(),
    createdAt: match.createdAt.toISOString(),
  };
}

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (_req, res): Promise<void> => {
  const allUsers = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved")));

  const allMatches = await db
    .select()
    .from(matchesTable)
    .orderBy(matchesTable.matchDate);

  const allPredictions = await db.select().from(predictionsTable);

  const liveMatches = allMatches
    .filter((match) => match.status === "live")
    .map(serializeMatch);

  const upcomingMatches = allMatches
    .filter((match) => match.status === "upcoming" || match.status === "live")
    .slice(0, 5)
    .map(serializeMatch);

  const finishedMatches = allMatches.filter(
    (match) => match.status === "finished"
  );

  const topRanking = allUsers
    .map((user) => {
      let totalPoints = 0;
      let exactScores = 0;
      let correctResults = 0;
      let totalPredictions = 0;

      for (const match of finishedMatches) {
        if (match.homeScore === null || match.awayScore === null) continue;

        const prediction = allPredictions.find(
          (p) => p.userId === user.id && p.matchId === match.id
        );

        if (!prediction) continue;

        totalPredictions++;

        const points = calcPoints(
          prediction.homeGoals,
          prediction.awayGoals,
          match.homeScore,
          match.awayScore
        );

        totalPoints += points;

        if (points === 5) exactScores++;
        if (points === 3) correctResults++;
      }

      return {
        userId: user.id,
        name: user.name,
        totalPoints,
        exactScores,
        correctResults,
        totalPredictions,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 5);

  res.json({
    totalParticipants: allUsers.length,
    totalMatches: allMatches.length,
    finishedMatches: finishedMatches.length,
    liveMatches,
    upcomingMatches,
    topRanking,
  });
});

export default router;