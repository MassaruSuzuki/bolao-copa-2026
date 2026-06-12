import { Router, type IRouter } from "express";
import { db, predictionsTable, matchesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function calcPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return 3;

  const predWinner =
    predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";

  const realWinner =
    realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";

  if (predWinner === realWinner) return 1;

  return 0;
}

/**
 * TABELA GERAL
 *
 * Regra:
 * - Só soma pontos de partidas encerradas.
 * - Partida ao vivo NÃO entra no total oficial.
 * - Quando a partida virar "finished", os pontos entram automaticamente.
 */
router.get("/ranking", requireAuth, async (_req, res): Promise<void> => {
  try {
    const allUsers = await db
      .select()
      .from(usersTable)
      .where(
        and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved"))
      );

    const finishedMatches = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.status, "finished"));

    const allPredictions = await db.select().from(predictionsTable);

    const now = new Date();

    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    const tomorrowStart = new Date(
      todayStart.getTime() + 24 * 60 * 60 * 1000
    );

    const todayFinishedMatches = finishedMatches.filter((match) => {
      const matchDate = new Date(match.matchDate);
      return matchDate >= todayStart && matchDate < tomorrowStart;
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
          (prediction) =>
            prediction.userId === user.id && prediction.matchId === match.id
        );

        if (!pred) {
          totalPredictions++;
          continue;
        }

        totalPredictions++;

        const points = calcPoints(
          pred.homeGoals,
          pred.awayGoals,
          match.homeScore,
          match.awayScore
        );

        totalPoints += points;

        if (points === 3) exactScores++;
        if (points === 1) correctResults++;
      }

      for (const match of todayFinishedMatches) {
        if (match.homeScore === null || match.awayScore === null) continue;

        const pred = allPredictions.find(
          (prediction) =>
            prediction.userId === user.id && prediction.matchId === match.id
        );

        if (!pred) continue;

        todayGain += calcPoints(
          pred.homeGoals,
          pred.awayGoals,
          match.homeScore,
          match.awayScore
        );
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

    ranking.sort((a, b) => {
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
    });

    res.json(ranking);
  } catch (error) {
    console.error("Erro ao buscar ranking geral:", error);
    res.status(500).json({ message: "Erro ao buscar ranking geral." });
  }
});

/**
 * RANKING AO VIVO
 *
 * Regra:
 * - Começa zerado quando a partida inicia.
 * - Mostra apenas os pontos da partida ao vivo.
 * - Não soma pontos antigos da tabela.
 */
router.get("/ranking/live", requireAuth, async (_req, res): Promise<void> => {
  try {
    const allUsers = await db
      .select()
      .from(usersTable)
      .where(
        and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved"))
      );

    const liveMatches = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.status, "live"));

    const allPredictions = await db.select().from(predictionsTable);

    const scoredLiveMatches = liveMatches.filter(
      (match) => match.homeScore !== null && match.awayScore !== null
    );

    const ranking = allUsers.map((user) => {
      let livePoints = 0;
      let proximityTotal: number | null = null;
      let hasPrediction = false;

      for (const liveMatch of scoredLiveMatches) {
        const pred = allPredictions.find(
          (prediction) =>
            prediction.userId === user.id &&
            prediction.matchId === liveMatch.id
        );

        if (!pred) continue;

        hasPrediction = true;

        const homeScore = liveMatch.homeScore as number;
        const awayScore = liveMatch.awayScore as number;

        const points = calcPoints(
          pred.homeGoals,
          pred.awayGoals,
          homeScore,
          awayScore
        );

        livePoints += points;

        const proximity =
          Math.abs(pred.homeGoals - homeScore) +
          Math.abs(pred.awayGoals - awayScore);

        proximityTotal = (proximityTotal ?? 0) + proximity;
      }

      return {
        userId: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,

        livePoints,

        /**
         * Compatibilidade com frontend antigo.
         * Todos representam apenas pontos do ao vivo.
         */
        basePoints: 0,
        liveBonus: livePoints,
        projectedTotal: livePoints,

        liveMatchId: scoredLiveMatches[0]?.id ?? liveMatches[0]?.id ?? null,
        predHome: null,
        predAway: null,
        currentHome: scoredLiveMatches[0]?.homeScore ?? null,
        currentAway: scoredLiveMatches[0]?.awayScore ?? null,
        proximity: proximityTotal,
        hasPrediction,
      };
    });

    ranking.sort((a, b) => {
      if (b.livePoints !== a.livePoints) {
        return b.livePoints - a.livePoints;
      }

      if (a.proximity !== null && b.proximity !== null) {
        return a.proximity - b.proximity;
      }

      if (a.proximity !== null) return -1;
      if (b.proximity !== null) return 1;

      return a.name.localeCompare(b.name);
    });

    res.json(ranking);
  } catch (error) {
    console.error("Erro ao buscar ranking ao vivo:", error);
    res.status(500).json({ message: "Erro ao buscar ranking ao vivo." });
  }
});

/**
 * PARTIDAS AO VIVO COM PARTICIPANTES
 *
 * Regra:
 * - Cada partida ao vivo mostra pontos separados.
 * - Pontos começam em 0.
 * - Só calcula pontos se a partida tiver placar.
 */
router.get(
  "/ranking/live-matches",
  requireAuth,
  async (_req, res): Promise<void> => {
    try {
      const allUsers = await db
        .select()
        .from(usersTable)
        .where(
          and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved"))
        );

      const liveMatches = await db
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.status, "live"));

      const allPredictions = await db.select().from(predictionsTable);

      const result = liveMatches.map((match) => {
        const matchPredictions = allPredictions.filter(
          (prediction) => prediction.matchId === match.id
        );

        const participants = allUsers.map((user) => {
          const pred = matchPredictions.find(
            (prediction) => prediction.userId === user.id
          );

          if (!pred) {
            return {
              userId: user.id,
              name: user.name,
              avatarUrl: user.avatarUrl ?? null,
              hasPrediction: false,
              predHome: null,
              predAway: null,
              points: 0,
              proximity: null,
            };
          }

          let points = 0;
          let proximity: number | null = null;

          if (match.homeScore !== null && match.awayScore !== null) {
            points = calcPoints(
              pred.homeGoals,
              pred.awayGoals,
              match.homeScore,
              match.awayScore
            );

            proximity =
              Math.abs(pred.homeGoals - match.homeScore) +
              Math.abs(pred.awayGoals - match.awayScore);
          }

          return {
            userId: user.id,
            name: user.name,
            avatarUrl: user.avatarUrl ?? null,
            hasPrediction: true,
            predHome: pred.homeGoals,
            predAway: pred.awayGoals,
            points,
            proximity,
          };
        });

        participants.sort((a, b) => {
          if (a.hasPrediction && !b.hasPrediction) return -1;
          if (!a.hasPrediction && b.hasPrediction) return 1;

          if (b.points !== a.points) {
            return b.points - a.points;
          }

          if (a.proximity !== null && b.proximity !== null) {
            return a.proximity - b.proximity;
          }

          if (a.proximity !== null) return -1;
          if (b.proximity !== null) return 1;

          return a.name.localeCompare(b.name);
        });

        return {
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeLogo: match.homeLogo,
          awayLogo: match.awayLogo,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          hasScore: match.homeScore !== null && match.awayScore !== null,
          participants,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Erro ao buscar partidas ao vivo:", error);
      res.status(500).json({ message: "Erro ao buscar partidas ao vivo." });
    }
  }
);

export default router;