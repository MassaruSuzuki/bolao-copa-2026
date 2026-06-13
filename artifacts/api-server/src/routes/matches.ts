import { Router, type IRouter } from "express";
import {
  db,
  matchesTable,
  predictionsTable,
  usersTable,
  matchChatMessagesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateMatchBody,
  GetMatchParams,
  ListMatchesQueryParams,
} from "@workspace/api-zod";
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

router.post(
  "/matches",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateMatchBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { homeTeam, awayTeam, homeLogo, awayLogo, matchDate } = parsed.data;

    const [match] = await db
      .insert(matchesTable)
      .values({
        homeTeam,
        awayTeam,
        homeLogo,
        awayLogo,
        matchDate: new Date(matchDate),
      })
      .returning();

    res.status(201).json({
      ...match,
      matchDate: match.matchDate.toISOString(),
      createdAt: match.createdAt.toISOString(),
    });
  }
);

router.get("/matches/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetMatchParams.safeParse({ id: parseInt(raw, 10) });

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, params.data.id));

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
    .innerJoin(
      usersTable,
      and(
        eq(predictionsTable.userId, usersTable.id),
        eq(usersTable.status, "approved")
      )
    )
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

router.patch(
  "/matches/:id",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const matchId = parseInt(raw, 10);

    if (Number.isNaN(matchId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const body = req.body as {
      homeTeam?: string;
      awayTeam?: string;
      homeLogo?: string | null;
      awayLogo?: string | null;
      matchDate?: string;
      status?: "upcoming" | "live" | "finished";
      homeScore?: number | null;
      awayScore?: number | null;
      youtubeUrl?: string | null;
    };

    const updateData: Record<string, unknown> = {};

    if (body.homeTeam !== undefined) updateData.homeTeam = body.homeTeam;
    if (body.awayTeam !== undefined) updateData.awayTeam = body.awayTeam;
    if (body.homeLogo !== undefined) updateData.homeLogo = body.homeLogo;
    if (body.awayLogo !== undefined) updateData.awayLogo = body.awayLogo;
    if (body.youtubeUrl !== undefined) updateData.youtubeUrl = body.youtubeUrl;

    if (body.status !== undefined) {
      if (!["upcoming", "live", "finished"].includes(body.status)) {
        res.status(400).json({ error: "Status inválido" });
        return;
      }

      updateData.status = body.status;
    }

    if (body.matchDate !== undefined) {
      const matchDate = new Date(body.matchDate);

      if (Number.isNaN(matchDate.getTime())) {
        res.status(400).json({ error: "Data inválida" });
        return;
      }

      updateData.matchDate = matchDate;
    }

    if (body.homeScore !== undefined) updateData.homeScore = body.homeScore;
    if (body.awayScore !== undefined) updateData.awayScore = body.awayScore;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "Nenhum campo para atualizar" });
      return;
    }

    const [match] = await db
      .update(matchesTable)
      .set(updateData)
      .where(eq(matchesTable.id, matchId))
      .returning();

    if (!match) {
      res.status(404).json({ error: "Jogo não encontrado" });
      return;
    }

    res.json({
      ...match,
      matchDate: match.matchDate.toISOString(),
      createdAt: match.createdAt.toISOString(),
    });
  }
);

router.patch(
  "/admin/matches/:id/prediction-unlock",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const matchId = Number(req.params.id);

    if (Number.isNaN(matchId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const [updated] = await db
      .update(matchesTable)
      .set({ predictionUnlocked: true })
      .where(eq(matchesTable.id, matchId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Jogo não encontrado" });
      return;
    }

    res.json({
      success: true,
      match: {
        ...updated,
        matchDate: updated.matchDate.toISOString(),
        createdAt: updated.createdAt.toISOString(),
      },
    });
  }
);

router.patch(
  "/admin/matches/:id/prediction-lock",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const matchId = Number(req.params.id);

    if (Number.isNaN(matchId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const [updated] = await db
      .update(matchesTable)
      .set({ predictionUnlocked: false })
      .where(eq(matchesTable.id, matchId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Jogo não encontrado" });
      return;
    }

    res.json({
      success: true,
      match: {
        ...updated,
        matchDate: updated.matchDate.toISOString(),
        createdAt: updated.createdAt.toISOString(),
      },
    });
  }
);

router.delete(
  "/admin/matches/:id",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const matchId = parseInt(raw, 10);

    if (Number.isNaN(matchId)) {
      res.status(400).json({ error: "ID inválido" });
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

    const existingPredictions = await db
      .select({ id: predictionsTable.id })
      .from(predictionsTable)
      .where(eq(predictionsTable.matchId, matchId));

    if (existingPredictions.length > 0) {
      res.status(409).json({
        error:
          "Não é possível excluir esta partida porque ela possui palpites. Para preservar o histórico dos jogadores, a exclusão foi bloqueada.",
      });
      return;
    }

    await db
      .delete(matchChatMessagesTable)
      .where(eq(matchChatMessagesTable.matchId, matchId));

    await db.delete(matchesTable).where(eq(matchesTable.id, matchId));

    res.json({ success: true });
  }
);

router.get(
  "/matches/:id/predictions",
  requireAuth,
  async (req, res): Promise<void> => {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);

    if (Number.isNaN(id)) {
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
      .innerJoin(
        usersTable,
        and(
          eq(predictionsTable.userId, usersTable.id),
          eq(usersTable.status, "approved")
        )
      )
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
  }
);

router.get("/matches/:id/chat", requireAuth, async (req, res): Promise<void> => {
  const matchId = Number(req.params.id);

  if (Number.isNaN(matchId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const [match] = await db
    .select({
      id: matchesTable.id,
      chatLocked: matchesTable.chatLocked,
    })
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId));

  if (!match) {
    res.status(404).json({ error: "Jogo não encontrado" });
    return;
  }

  const messages = await db
    .select({
      id: matchChatMessagesTable.id,
      matchId: matchChatMessagesTable.matchId,
      userId: matchChatMessagesTable.userId,
      message: matchChatMessagesTable.message,
      createdAt: matchChatMessagesTable.createdAt,
      userName: usersTable.name,
      userAvatarUrl: usersTable.avatarUrl,
    })
    .from(matchChatMessagesTable)
    .innerJoin(usersTable, eq(matchChatMessagesTable.userId, usersTable.id))
    .where(eq(matchChatMessagesTable.matchId, matchId))
    .orderBy(matchChatMessagesTable.createdAt);

  res.json({
    chatLocked: match.chatLocked,
    messages: messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

router.post("/matches/:id/chat", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const matchId = parseInt(raw, 10);

  if (Number.isNaN(matchId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const message = String(req.body?.message ?? "").trim();

  if (!message) {
    res.status(400).json({ error: "Mensagem vazia" });
    return;
  }

  if (message.length > 300) {
    res.status(400).json({ error: "Mensagem muito longa" });
    return;
  }

  const [match] = await db
    .select({
      id: matchesTable.id,
      status: matchesTable.status,
      chatLocked: matchesTable.chatLocked,
    })
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId));

  if (!match) {
    res.status(404).json({ error: "Jogo não encontrado" });
    return;
  }

  if (match.status !== "live") {
    res.status(403).json({
      error: "O chat só fica aberto durante jogos ao vivo",
    });
    return;
  }

  if (match.chatLocked) {
    res.status(403).json({
      error: "O chat foi bloqueado pelo administrador",
    });
    return;
  }

  const [created] = await db
    .insert(matchChatMessagesTable)
    .values({
      matchId,
      userId: req.user!.userId,
      message,
    })
    .returning();

  res.status(201).json({
    id: created.id,
    matchId: created.matchId,
    userId: created.userId,
    message: created.message,
    createdAt: created.createdAt.toISOString(),
  });
});

router.patch(
  "/matches/:id/chat/lock",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const matchId = Number(req.params.id);

    if (Number.isNaN(matchId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const body = req.body as { locked?: boolean };
    const locked = body.locked === true;

    const [updated] = await db
      .update(matchesTable)
      .set({ chatLocked: locked })
      .where(eq(matchesTable.id, matchId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Jogo não encontrado" });
      return;
    }

    res.json({
      matchId,
      chatLocked: updated.chatLocked,
    });
  }
);

router.delete(
  "/matches/:id/chat",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const matchId = Number(req.params.id);

    if (Number.isNaN(matchId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    await db
      .delete(matchChatMessagesTable)
      .where(eq(matchChatMessagesTable.matchId, matchId));

    res.json({ success: true });
  }
);

export default router;