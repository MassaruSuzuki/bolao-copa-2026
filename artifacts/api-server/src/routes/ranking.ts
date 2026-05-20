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
  const allUsers = await db.select().from(usersTable);
  const finishedMatches = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.status, "finished"));
  const allPredictions = await db.select().from(predictionsTable);

  const ranking = allUsers.map((user) => {
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

    return {
      userId: user.id,
      name: user.name,
      totalPoints,
      exactScores,
      correctResults,
      totalPredictions,
    };
  });

  ranking.sort((a, b) => b.totalPoints - a.totalPoints);

  res.json(ranking);
});

export default router;
