import { Router, type IRouter } from "express";
import { db, matchesTable, predictionsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateMatchBody, UpdateMatchBody, UpdateMatchParams, GetMatchParams, ListMatchesQueryParams } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/matches", async (req, res): Promise<void> => {
  const params = ListMatchesQueryParams.safeParse(req.query);
  const status = params.success ? params.data.status : undefined;

  const matches = await db
    .select()
    .from(matchesTable)
    .orderBy(matchesTable.matchDate);

  const filtered = status ? matches.filter((m) => m.status === status) : matches;

  res.json(
    filtered.map((m) => ({
      ...m,
      matchDate: m.matchDate.toISOString(),
      createdAt: m.createdAt.toISOString(),
    }))
  );
});

router.post("/matches", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { homeTeam, awayTeam, homeLogo, awayLogo, matchDate } = parsed.data;
  const [match] = await db
    .insert(matchesTable)
    .values({ homeTeam, awayTeam, homeLogo, awayLogo, matchDate: new Date(matchDate) })
    .returning();

  res.status(201).json({ ...match, matchDate: match.matchDate.toISOString(), createdAt: match.createdAt.toISOString() });
});

router.get("/matches/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetMatchParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, params.data.id));
  if (!match) {
    res.status(404).json({ error: "Jogo não encontrado" });
    return;
  }

  const preds = await db
    .select({
      id: predictionsTable.id,
      userId: predictionsTable.userId,
      matchId: predictionsTable.matchId,
      homeGoals: predictionsTable.homeGoals,
      awayGoals: predictionsTable.awayGoals,
      createdAt: predictionsTable.createdAt,
      updatedAt: predictionsTable.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userIsAdmin: usersTable.isAdmin,
      userCreatedAt: usersTable.createdAt,
    })
    .from(predictionsTable)
    .innerJoin(usersTable, eq(predictionsTable.userId, usersTable.id))
    .where(eq(predictionsTable.matchId, params.data.id));

  res.json({
    ...match,
    matchDate: match.matchDate.toISOString(),
    createdAt: match.createdAt.toISOString(),
    predictions: preds.map((p) => ({
      id: p.id,
      userId: p.userId,
      matchId: p.matchId,
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      user: {
        id: p.userId,
        name: p.userName,
        email: p.userEmail,
        isAdmin: p.userIsAdmin,
        createdAt: p.userCreatedAt.toISOString(),
      },
    })),
  });
});

router.patch("/matches/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateMatchParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.matchDate) {
    updateData.matchDate = new Date(parsed.data.matchDate);
  }

  const [match] = await db
    .update(matchesTable)
    .set(updateData)
    .where(eq(matchesTable.id, params.data.id))
    .returning();

  if (!match) {
    res.status(404).json({ error: "Jogo não encontrado" });
    return;
  }

  res.json({ ...match, matchDate: match.matchDate.toISOString(), createdAt: match.createdAt.toISOString() });
});

router.get("/matches/:id/predictions", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const preds = await db
    .select({
      id: predictionsTable.id,
      userId: predictionsTable.userId,
      matchId: predictionsTable.matchId,
      homeGoals: predictionsTable.homeGoals,
      awayGoals: predictionsTable.awayGoals,
      createdAt: predictionsTable.createdAt,
      updatedAt: predictionsTable.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userIsAdmin: usersTable.isAdmin,
      userCreatedAt: usersTable.createdAt,
    })
    .from(predictionsTable)
    .innerJoin(usersTable, eq(predictionsTable.userId, usersTable.id))
    .where(eq(predictionsTable.matchId, id));

  res.json(
    preds.map((p) => ({
      id: p.id,
      userId: p.userId,
      matchId: p.matchId,
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      user: {
        id: p.userId,
        name: p.userName,
        email: p.userEmail,
        isAdmin: p.userIsAdmin,
        createdAt: p.userCreatedAt.toISOString(),
      },
    }))
  );
});

export default router;
