import { Router, type IRouter } from "express";
import { db, predictionsTable, matchesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const APP_TIME_ZONE = "America/Sao_Paulo";

type Winner = "home" | "away" | "draw";

type MatchPointItem = {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  status: string;
  points: number | null;
  hasPrediction: boolean;
  isFinished: boolean;
};

function calcPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
): number {
  if (predHome === realHome && predAway === realAway) return 3;

  const predWinner: Winner =
    predHome > predAway ? "home" : predHome < predAway ? "away" : "draw";

  const realWinner: Winner =
    realHome > realAway ? "home" : realHome < realAway ? "away" : "draw";

  return predWinner === realWinner ? 1 : 0;
}

function getDateKey(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysKey(date: Date, amount: number): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return getDateKey(copy);
}

function toTimestamp(value: Date | string): number {
  return new Date(value).getTime();
}

function isMatchFinished(match: { status: string; homeScore: number | null; awayScore: number | null }) {
  return match.status === "finished" && match.homeScore !== null && match.awayScore !== null;
}

/**
 * Escolhe quais jogos aparecem na coluna "Hoje".
 *
 * Regra final:
 * - A lista que gira mostra SOMENTE jogos que já aconteceram/encerraram.
 * - Antes de existir jogo encerrado hoje: mostra os jogos encerrados de ontem.
 * - Depois que houver jogo encerrado hoje: mostra somente os jogos encerrados de hoje.
 * - Nunca envia jogos scheduled/live/futuros para a tabela.
 */
function pickVisibleMatches<
  T extends {
    matchDate: Date | string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  },
>(matches: T[]) {
  const now = new Date();
  const todayKey = getDateKey(now);
  const yesterdayKey = addDaysKey(now, -1);

  const sortedFinishedMatches = [...matches]
    .filter(isMatchFinished)
    .sort((a, b) => toTimestamp(a.matchDate) - toTimestamp(b.matchDate));

  const todayFinishedMatches = sortedFinishedMatches.filter(
    (match) => getDateKey(match.matchDate) === todayKey,
  );

  if (todayFinishedMatches.length > 0) {
    return todayFinishedMatches;
  }

  const yesterdayFinishedMatches = sortedFinishedMatches.filter(
    (match) => getDateKey(match.matchDate) === yesterdayKey,
  );

  if (yesterdayFinishedMatches.length > 0) {
    return yesterdayFinishedMatches;
  }

  const lastFinished = sortedFinishedMatches[sortedFinishedMatches.length - 1];
  if (!lastFinished) return [];

  const lastFinishedKey = getDateKey(lastFinished.matchDate);

  return sortedFinishedMatches.filter(
    (match) => getDateKey(match.matchDate) === lastFinishedKey,
  );
}

/**
 * TABELA GERAL
 *
 * Regras:
 * - Total oficial soma somente jogos finished.
 * - Jogo live não entra no total oficial.
 * - A coluna "Hoje" NÃO usa todayGain para cada jogo.
 * - A coluna "Hoje" recebe visibleMatchPoints já sincronizado pelo backend.
 */
router.get("/ranking", requireAuth, async (_req, res): Promise<void> => {
  try {
    const allUsers = await db
      .select()
      .from(usersTable)
      .where(
        and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved")),
      );

    const allMatches = await db.select().from(matchesTable);
    const allPredictions = await db.select().from(predictionsTable);

    const predictionByUserAndMatch = new Map<string, (typeof allPredictions)[number]>();

    for (const prediction of allPredictions) {
      predictionByUserAndMatch.set(`${prediction.userId}:${prediction.matchId}`, prediction);
    }

    const finishedMatches = allMatches.filter(isMatchFinished);
    const visibleMatches = pickVisibleMatches(allMatches);

    const ranking = allUsers.map((user) => {
      let totalPoints = 0;
      let exactScores = 0;
      let correctResults = 0;
      let totalPredictions = 0;
      let todayGain = 0;

      const allMatchPoints: MatchPointItem[] = [];

      for (const match of finishedMatches) {
        const pred = predictionByUserAndMatch.get(`${user.id}:${match.id}`);
        let points = 0;
        const hasPrediction = Boolean(pred);

        totalPredictions++;

        if (pred) {
          points = calcPoints(
            pred.homeGoals,
            pred.awayGoals,
            match.homeScore as number,
            match.awayScore as number,
          );

          totalPoints += points;

          if (points === 3) exactScores++;
          if (points === 1) correctResults++;
        }

        allMatchPoints.push({
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          matchDate: match.matchDate.toISOString(),
          status: match.status,
          points,
          hasPrediction,
          isFinished: true,
        });
      }

      const visibleMatchPoints: MatchPointItem[] = visibleMatches.map((match) => {
        const pred = predictionByUserAndMatch.get(`${user.id}:${match.id}`);
        const finished = isMatchFinished(match);
        let points: number | null = null;

        if (finished) {
          points = pred
            ? calcPoints(
                pred.homeGoals,
                pred.awayGoals,
                match.homeScore as number,
                match.awayScore as number,
              )
            : 0;

          todayGain += points;
        }

        return {
          matchId: match.id,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          matchDate: match.matchDate.toISOString(),
          status: match.status,
          points,
          hasPrediction: Boolean(pred),
          isFinished: finished,
        };
      });

      return {
        userId: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        totalPoints,
        exactScores,
        correctResults,
        totalPredictions,

        // Soma apenas dos jogos visíveis que já terminaram. Use só como resumo.
        todayGain,

        // Lista definitiva para a coluna Hoje: jogo e ponto vêm juntos.
        visibleMatchPoints,

        // Compatibilidade com versões anteriores do frontend.
        todayMatchPoints: visibleMatchPoints,
        allMatchPoints,
        finishedMatchPoints: allMatchPoints,
      };
    });

    ranking.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
      if (b.correctResults !== a.correctResults) return b.correctResults - a.correctResults;
      return a.name.localeCompare(b.name, "pt-BR");
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
        and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved")),
      );

    const liveMatches = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.status, "live"));

    const allPredictions = await db.select().from(predictionsTable);

    const scoredLiveMatches = liveMatches.filter(
      (match) => match.homeScore !== null && match.awayScore !== null,
    );

    const ranking = allUsers.map((user) => {
      let livePoints = 0;
      let proximityTotal: number | null = null;
      let hasPrediction = false;

      for (const liveMatch of scoredLiveMatches) {
        const pred = allPredictions.find(
          (prediction) =>
            prediction.userId === user.id && prediction.matchId === liveMatch.id,
        );

        if (!pred) continue;

        hasPrediction = true;

        const homeScore = liveMatch.homeScore as number;
        const awayScore = liveMatch.awayScore as number;

        const points = calcPoints(pred.homeGoals, pred.awayGoals, homeScore, awayScore);
        livePoints += points;

        const proximity =
          Math.abs(pred.homeGoals - homeScore) + Math.abs(pred.awayGoals - awayScore);

        proximityTotal = (proximityTotal ?? 0) + proximity;
      }

      return {
        userId: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        livePoints,
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
      if (b.livePoints !== a.livePoints) return b.livePoints - a.livePoints;

      if (a.proximity !== null && b.proximity !== null) {
        return a.proximity - b.proximity;
      }

      if (a.proximity !== null) return -1;
      if (b.proximity !== null) return 1;

      return a.name.localeCompare(b.name, "pt-BR");
    });

    res.json(ranking);
  } catch (error) {
    console.error("Erro ao buscar ranking ao vivo:", error);
    res.status(500).json({ message: "Erro ao buscar ranking ao vivo." });
  }
});

/**
 * PARTIDAS AO VIVO COM PARTICIPANTES
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
          and(eq(usersTable.isAdmin, false), eq(usersTable.status, "approved")),
        );

      const liveMatches = await db
        .select()
        .from(matchesTable)
        .where(eq(matchesTable.status, "live"));

      const allPredictions = await db.select().from(predictionsTable);

      const result = liveMatches.map((match) => {
        const matchPredictions = allPredictions.filter(
          (prediction) => prediction.matchId === match.id,
        );

        const participants = allUsers.map((user) => {
          const pred = matchPredictions.find(
            (prediction) => prediction.userId === user.id,
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
              match.awayScore,
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
          if (b.points !== a.points) return b.points - a.points;

          if (a.proximity !== null && b.proximity !== null) {
            return a.proximity - b.proximity;
          }

          if (a.proximity !== null) return -1;
          if (b.proximity !== null) return 1;

          return a.name.localeCompare(b.name, "pt-BR");
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
  },
);

export default router;
