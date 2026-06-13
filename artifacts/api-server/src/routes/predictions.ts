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

const DEADLINE_MINUTES = 60;

function toIsoPrediction<T extends { createdAt: Date; updatedAt: Date }>(
  prediction: T
) {
  return {
    ...prediction,
    createdAt: prediction.createdAt.toISOString(),
    updatedAt: prediction.updatedAt.toISOString(),
  };
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
        predictionUnlocked: matchesTable.predictionUnlocked,

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
      predictions.map((p) => ({
        ...p,
        matchDate: p.matchDate.toISOString(),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
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
      res.status(400).json({ error: "ID inválido" });
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

    let updatedAt: Date | undefined;

    if (req.body.updatedAt) {
      const parsedUpdatedAt = new Date(req.body.updatedAt);

      if (Number.isNaN(parsedUpdatedAt.getTime())) {
        res.status(400).json({ error: "Data de atualização inválida" });
        return;
      }

      updatedAt = parsedUpdatedAt;
    }

    const [existing] = await db
      .select()
      .from(predictionsTable)
      .where(eq(predictionsTable.id, predictionId));

    if (!existing) {
      res.status(404).json({ error: "Palpite não encontrado" });
      return;
    }

    const [updated] = await db
      .update(predictionsTable)
      .set({
        homeGoals,
        awayGoals,
        ...(updatedAt ? { updatedAt } : {}),
      })
      .where(eq(predictionsTable.id, predictionId))
      .returning();

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
    res.status(404).json({ error: "Jogo não encontrado" });
    return;
  }

  if (match.status !== "upcoming") {
    res.status(400).json({
      error: "Palpites só são permitidos para jogos não iniciados",
    });
    return;
  }

  const now = new Date();
  const deadline = new Date(
    match.matchDate.getTime() - DEADLINE_MINUTES * 60 * 1000
  );

  if (now >= deadline && !match.predictionUnlocked) {
    res.status(400).json({
      error: "Prazo para palpites encerrado. Aguarde liberação do admin.",
    });
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
    res.status(409).json({
      error: "Você já tem um palpite para este jogo.",
    });
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

    if (Number.isNaN(predictionId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const userId = req.user!.userId;

    const [existingPrediction] = await db
      .select({
        id: predictionsTable.id,
        userId: predictionsTable.userId,
        matchId: predictionsTable.matchId,
      })
      .from(predictionsTable)
      .where(
        and(
          eq(predictionsTable.id, predictionId),
          eq(predictionsTable.userId, userId)
        )
      );

    if (!existingPrediction) {
      res.status(404).json({ error: "Palpite não encontrado" });
      return;
    }

    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, existingPrediction.matchId));

    if (!match) {
      res.status(404).json({ error: "Jogo não encontrado" });
      return;
    }

    if (match.status !== "upcoming") {
      res.status(400).json({
        error: "Não é possível excluir palpite de jogo já iniciado",
      });
      return;
    }

    const now = new Date();
    const deadline = new Date(
      match.matchDate.getTime() - DEADLINE_MINUTES * 60 * 1000
    );

    if (now >= deadline && !match.predictionUnlocked) {
      res.status(400).json({
        error:
          "Prazo encerrado. Só é possível excluir se o admin liberar os palpites.",
      });
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

  const preds = await db
    .select()
    .from(predictionsTable)
    .where(eq(predictionsTable.userId, userId));

  res.json(preds.map((p) => toIsoPrediction(p)));
});

export default router;