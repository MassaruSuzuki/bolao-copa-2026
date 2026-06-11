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
  if (predHome === realHome && predAway === realAway) {
    return 3;
  }

  const predResult =
    predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";

  const realResult =
    realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";

  if (predResult === realResult) {
    return 1;
  }

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
  try {
    const allUsers = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.isAdmin, false),
          eq(usersTable.status, "approved")
        )
      );

    const allMatches = await db
      .select()
      .from(matchesTable)
      .orderBy(matchesTable.matchDate);

    const allPredictions = await db.select().from(predictionsTable);

    const liveMatches = allMatches
      .filter((match) => match.status === "live")
      .map(serializeMatch);

    const upcomingMatches = allMatches
      .filter(
        (match) => match.status === "upcoming" || match.status === "live"
      )
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
          if (match.homeScore === null || match.awayScore === null) {
            continue;
          }

          const prediction = allPredictions.find(
            (p) => p.userId === user.id && p.matchId === match.id
          );

          if (!prediction) {
            continue;
          }

          totalPredictions++;

          const points = calcPoints(
            prediction.homeGoals,
            prediction.awayGoals,
            match.homeScore,
            match.awayScore
          );

          totalPoints += points;

          if (points === 3) {
            exactScores++;
          }

          if (points === 1) {
            correctResults++;
          }
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
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }

        if (b.exactScores !== a.exactScores) {
          return b.exactScores - a.exactScores;
        }

        if (b.correctResults !== a.correctResults) {
          return b.correctResults - a.correctResults;
        }

        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);

    res.json({
      totalParticipants: allUsers.length,
      totalMatches: allMatches.length,
      finishedMatches: finishedMatches.length,
      liveMatches,
      upcomingMatches,
      topRanking,
    });
  } catch (error) {
    console.error("Erro ao carregar dashboard:", error);

    res.status(500).json({
      message: "Erro ao carregar dashboard",
    });
  }
});

export default router;