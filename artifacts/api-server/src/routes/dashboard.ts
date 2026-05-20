import { Router, type IRouter } from "express";
import { db, matchesTable, usersTable, predictionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (_req, res): Promise<void> => {
  const allUsers = await db.select().from(usersTable);
  const allMatches = await db.select().from(matchesTable).orderBy(matchesTable.matchDate);
  const allPredictions = await db.select().from(predictionsTable);

  const upcomingMatches = allMatches
    .filter((m) => m.status === "upcoming")
    .slice(0, 5)
    .map((m) => ({ ...m, matchDate: m.matchDate.toISOString(), createdAt: m.createdAt.toISOString() }));

  const liveMatches = allMatches
    .filter((m) => m.status === "live")
    .map((m) => ({ ...m, matchDate: m.matchDate.toISOString(), createdAt: m.createdAt.toISOString() }));

  const finishedMatches = allMatches.filter((m) => m.status === "finished");

  const topRanking = allUsers
    .map((user) => {
      let totalPoints = 0;
      let exactScores = 0;
      let correctResults = 0;
      let totalPredictions = 0;
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
      return { userId: user.id, name: user.name, totalPoints, exactScores, correctResults, totalPredictions };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 5);

  res.json({
    totalParticipants: allUsers.length,
    upcomingMatches,
    liveMatches,
    topRanking,
    totalMatches: allMatches.length,
    finishedMatches: finishedMatches.length,
  });
});

export default router;
