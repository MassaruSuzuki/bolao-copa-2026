import { Router, type IRouter } from "express";
import {
  db,
  predictionsTable,
  matchesTable,
  usersTable,
  predictionPrivateUnlocksTable,
} from "@workspace/db";
import { eq, and, desc, or, gt, isNull } from "drizzle-orm";
import { UpsertPredictionBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

const DEADLINE_MINUTES = 15;

function toIsoPrediction<T extends { createdAt: Date; updatedAt: Date }>(
  prediction: T
) {
  return {
    ...prediction,
    createdAt: prediction.createdAt.toISOString(),
    updatedAt: prediction.updatedAt.toISOString(),
  };
}

async function hasPrivatePredictionUnlock(userId: number, matchId: number) {
  const now = new Date();

  const [unlock] = await db
    .select()
    .from(predictionPrivateUnlocksTable)
    .where(
      and(
        eq(predictionPrivateUnlocksTable.userId, userId),
        eq(predictionPrivateUnlocksTable.matchId, matchId),
        or(
          isNull(predictionPrivateUnlocksTable.expiresAt),
          gt(predictionPrivateUnlocksTable.expiresAt, now)
        )
      )
    );

  return Boolean(unlock);
}

router.post(
  "/admin/predictions/private-unlock",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const userId = Number(req.body.userId);
    const matchId = Number(req.body.matchId);
    const adminId = req.user!.userId;

    if (Number.isNaN(userId) || Number.isNaN(matchId)) {
      res.status(400).json({ error: "userId ou matchId inválido" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, matchId));

    if (!match) {
      res.status(404).json({ error: "Jogo não encontrado" });
      return;
    }

    await db
      .insert(predictionPrivateUnlocksTable)
      .values({
        userId,
        matchId,
        createdByAdminId: adminId,
        expiresAt: null,
      })
      .onConflictDoUpdate({
        target: [
          predictionPrivateUnlocksTable.userId,
          predictionPrivateUnlocksTable.matchId,
        ],
        set: {
          createdByAdminId: adminId,
          createdAt: new Date(),
          expiresAt: null,
        },
      });

    res.json({
      ok: true,
      message: "Palpite liberado somente para este usuário.",
      userId,
      matchId,
    });
  }
);

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

    const [updated] = await db
      .update(predictionsTable)
      .set({
        homeGoals,
        awayGoals,
        updatedAt: req.body.updatedAt ? new Date(req.body.updatedAt) : new Date(),
      })
      .where(eq(predictionsTable.id, predictionId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Palpite não encontrado" });
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
    res.status(404).json({ error: "Jogo não encontrado" });
    return;
  }

  const now = new Date();
  const deadline = new Date(
    match.matchDate.getTime() - DEADLINE_MINUTES * 60 * 1000
  );

  const privateUnlock = await hasPrivatePredictionUnlock(userId, matchId);

  console.log("PRIVATE UNLOCK TEST", {
    userId,
    matchId,
    privateUnlock,
    predictionUnlocked: match.predictionUnlocked,
    status: match.status,
    deadline,
    now,
  });

  if (match.status !== "upcoming" && !privateUnlock) {
    res.status(400).json({
      error: "Palpites só são permitidos para jogos não iniciados",
    });
    return;
  }

  if (now >= deadline && !match.predictionUnlocked && !privateUnlock) {
    res.status(400).json({
      error: "Prazo para palpites encerrado.",
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
    const [updated] = await db
      .update(predictionsTable)
      .set({
        homeGoals,
        awayGoals,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(predictionsTable.userId, userId),
          eq(predictionsTable.matchId, matchId)
        )
      )
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

    if (Number.isNaN(predictionId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const userId = req.user!.userId;

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

    const privateUnlock = await hasPrivatePredictionUnlock(
      userId,
      existingPrediction.matchId
    );

    if (match.status !== "upcoming" && !privateUnlock) {
      res.status(400).json({
        error: "Não é possível excluir palpite de jogo já iniciado",
      });
      return;
    }

    const now = new Date();
    const deadline = new Date(
      match.matchDate.getTime() - DEADLINE_MINUTES * 60 * 1000
    );

    if (now >= deadline && !match.predictionUnlocked && !privateUnlock) {
      res.status(400).json({
        error: "Prazo encerrado.",
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