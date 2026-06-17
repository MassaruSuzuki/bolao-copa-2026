import { Router, type IRouter } from "express";
import {
  db,
  predictionsTable,
  matchesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { UpsertPredictionBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const DEADLINE_MINUTES = 10;

function toIsoPrediction<T extends { createdAt: Date; updatedAt: Date }>(
  prediction: T
) {
  return {
    ...prediction,
    createdAt: prediction.createdAt.toISOString(),
    updatedAt: prediction.updatedAt.toISOString(),
  };
}

function getPredictionDeadline(matchDate: Date) {
  return new Date(matchDate.getTime() - DEADLINE_MINUTES * 60 * 1000);
}

async function canUserSubmitPrediction(params: {
  userId: number;
  match: typeof matchesTable.$inferSelect;
}) {
  const { match } = params;

  if (match.status === "finished") {
    return false;
  }

  if (match.predictionUnlocked === true) {
    return true;
  }

  if (match.status !== "upcoming") {
    return false;
  }

  const now = new Date();
  const deadline = getPredictionDeadline(match.matchDate);

  return now < deadline;
}

router.get(
  "/admin/predictions",
  requireAuth,
  requireAdmin,
  async (_req, res): Promise<void> => {
    const predictions = await db
      .select({
        id: predictionsTable.id,
        userId: predictionsTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
        matchId: predictionsTable.matchId,
        homeTeam: matchesTable.homeTeam,
        awayTeam: matchesTable.awayTeam,
        homeLogo: matchesTable.homeLogo,
        awayLogo: matchesTable.awayLogo,
        matchDate: matchesTable.matchDate,
        status: matchesTable.status,
        homeGoals: predictionsTable.homeGoals,
        awayGoals: predictionsTable.awayGoals,
        createdAt: predictionsTable.createdAt,
        updatedAt: predictionsTable.updatedAt,
      })
      .from(predictionsTable)
      .innerJoin(usersTable, eq(predictionsTable.userId, usersTable.id))
      .innerJoin(matchesTable, eq(predictionsTable.matchId, matchesTable.id))
      .orderBy(desc(predictionsTable.createdAt));

    res.json(
      predictions.map((prediction) => ({
        ...prediction,
        matchDate: prediction.matchDate.toISOString(),
        createdAt: prediction.createdAt.toISOString(),
        updatedAt: prediction.updatedAt.toISOString(),
      }))
    );
  }
);

router.patch(
  "/admin/predictions/:id",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const predictionId = Number(req.params.id);

    if (Number.isNaN(predictionId)) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }

    const parsed = UpsertPredictionBody.omit({ matchId: true }).safeParse(
      req.body
    );

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { homeGoals, awayGoals } = parsed.data;

    const [updated] = await db
      .update(predictionsTable)
      .set({
        homeGoals,
        awayGoals,
        updatedAt: new Date(),
      })
      .where(eq(predictionsTable.id, predictionId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Palpite não encontrado." });
      return;
    }

    res.json(toIsoPrediction(updated));
  }
);

router.post("/predictions", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpsertPredictionBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { matchId, homeGoals, awayGoals } = parsed.data;
  const userId = req.user!.userId;

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId));

  if (!match) {
    res.status(404).json({ error: "Jogo não encontrado." });
    return;
  }

  const allowed = await canUserSubmitPrediction({ userId, match });

  if (!allowed) {
    res.status(403).json({ error: "Palpites indisponíveis." });
    return;
  }

  const [existingPrediction] = await db
    .select()
    .from(predictionsTable)
    .where(
      and(
        eq(predictionsTable.userId, userId),
        eq(predictionsTable.matchId, matchId)
      )
    );

  if (existingPrediction) {
    const [updated] = await db
      .update(predictionsTable)
      .set({
        homeGoals,
        awayGoals,
        updatedAt: new Date(),
      })
      .where(eq(predictionsTable.id, existingPrediction.id))
      .returning();

    res.json(toIsoPrediction(updated));
    return;
  }

  const [prediction] = await db
    .insert(predictionsTable)
    .values({
      userId,
      matchId,
      homeGoals,
      awayGoals,
    })
    .returning();

  res.json(toIsoPrediction(prediction));
});

router.delete(
  "/predictions/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const predictionId = Number(req.params.id);
    const userId = req.user!.userId;

    if (Number.isNaN(predictionId)) {
      res.status(400).json({ error: "ID inválido." });
      return;
    }

    const [existingPrediction] = await db
      .select()
      .from(predictionsTable)
      .where(
        and(
          eq(predictionsTable.id, predictionId),
          eq(predictionsTable.userId, userId)
        )
      );

    if (!existingPrediction) {
      res.status(404).json({ error: "Palpite não encontrado." });
      return;
    }

    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, existingPrediction.matchId));

    if (!match) {
      res.status(404).json({ error: "Jogo não encontrado." });
      return;
    }

    const allowed = await canUserSubmitPrediction({ userId, match });

    if (!allowed) {
      res.status(403).json({ error: "Palpites indisponíveis." });
      return;
    }

    await db
      .delete(predictionsTable)
      .where(
        and(
          eq(predictionsTable.id, predictionId),
          eq(predictionsTable.userId, userId)
        )
      );

    res.json({
      ok: true,
      deletedPredictionId: predictionId,
    });
  }
);

router.get("/predictions/my", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const predictions = await db
    .select()
    .from(predictionsTable)
    .where(eq(predictionsTable.userId, userId));

  res.json(predictions.map((prediction) => toIsoPrediction(prediction)));
});

export default router;