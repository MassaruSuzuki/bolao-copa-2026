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
      predictions.map((p) => ({
        ...p,
        matchDate: p.matchDate.toISOString(),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
    );
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

  if (now >= deadline) {
    res.status(400).json({
      error: "Prazo para palpites encerrado (1 hora antes do jogo)",
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(predictionsTable)
    .where(
      and(
        eq(predictionsTable.userId, userId),
        eq(predictionsTable.matchId, matchId)
      )
    );

  if (existing) {
    res.status(409).json({
      error:
        "Você já tem um palpite para este jogo. Exclua-o para fazer um novo.",
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

  res.json({
    ...prediction,
    createdAt: prediction.createdAt.toISOString(),
    updatedAt: prediction.updatedAt.toISOString(),
  });
});

router.delete(
  "/predictions/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const userId = req.user!.userId;

    const [existing] = await db
      .select()
      .from(predictionsTable)
      .where(
        and(eq(predictionsTable.id, id), eq(predictionsTable.userId, userId))
      );

    if (!existing) {
      res.status(404).json({ error: "Palpite não encontrado" });
      return;
    }

    const [match] = await db
      .select()
      .from(matchesTable)
      .where(eq(matchesTable.id, existing.matchId));

    if (match && match.status !== "upcoming") {
      res.status(400).json({
        error: "Não é possível excluir palpite de jogo já iniciado",
      });
      return;
    }

    if (match) {
      const now = new Date();
      const deadline = new Date(
        match.matchDate.getTime() - DEADLINE_MINUTES * 60 * 1000
      );

      if (now >= deadline) {
        res.status(400).json({
          error: "Prazo encerrado, não é possível excluir o palpite",
        });
        return;
      }
    }

    await db.delete(predictionsTable).where(eq(predictionsTable.id, id));

    res.json({ ok: true });
  }
);

router.get("/predictions/my", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const preds = await db
    .select()
    .from(predictionsTable)
    .where(eq(predictionsTable.userId, userId));

  res.json(
    preds.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }))
  );
});

export default router;