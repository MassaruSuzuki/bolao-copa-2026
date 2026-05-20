import { Router, type IRouter } from "express";
import { db, predictionsTable, matchesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { UpsertPredictionBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const DEADLINE_MINUTES = 60; // 1 hour before match

router.post("/predictions", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpsertPredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { matchId, homeGoals, awayGoals } = parsed.data;
  const userId = req.user!.userId;

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId));
  if (!match) {
    res.status(404).json({ error: "Jogo não encontrado" });
    return;
  }

  if (match.status !== "upcoming") {
    res.status(400).json({ error: "Palpites só são permitidos para jogos não iniciados" });
    return;
  }

  const now = new Date();
  const deadline = new Date(match.matchDate.getTime() - DEADLINE_MINUTES * 60 * 1000);
  if (now >= deadline) {
    res.status(400).json({ error: "Prazo para palpites encerrado (1 hora antes do jogo)" });
    return;
  }

  const [existing] = await db
    .select()
    .from(predictionsTable)
    .where(and(eq(predictionsTable.userId, userId), eq(predictionsTable.matchId, matchId)));

  let prediction;
  if (existing) {
    [prediction] = await db
      .update(predictionsTable)
      .set({ homeGoals, awayGoals, updatedAt: new Date() })
      .where(eq(predictionsTable.id, existing.id))
      .returning();
  } else {
    [prediction] = await db
      .insert(predictionsTable)
      .values({ userId, matchId, homeGoals, awayGoals })
      .returning();
  }

  res.json({
    ...prediction,
    createdAt: prediction.createdAt.toISOString(),
    updatedAt: prediction.updatedAt.toISOString(),
  });
});

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
