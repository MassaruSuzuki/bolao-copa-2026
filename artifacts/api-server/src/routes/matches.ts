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

type MatchStatus = "upcoming" | "live" | "finished";

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
const DEADLINE_MINUTES = 15;

function getAutoStatus(match: {
  status: string;
  matchDate: Date;
  homeScore: number | null;
  awayScore: number | null;
}): MatchStatus {
  if (match.status === "live") {
    return "live";
  }

  if (match.status === "finished") {
    return "finished";
  }

  if (match.status === "upcoming") {
    return "upcoming";
  }

  return "upcoming";
}

function isDeadlineReached(matchDate: Date) {
  const diffMs = matchDate.getTime() - Date.now();
  return diffMs <= DEADLINE_MINUTES * 60 * 1000;
}

function toAdminMatchJson(match: typeof matchesTable.$inferSelect) {
  return {
    ...match,
    status: getAutoStatus(match),
    matchDate: match.matchDate.toISOString(),
    createdAt: match.createdAt.toISOString(),
  };
}

function toPublicMatchJson(match: typeof matchesTable.$inferSelect) {
  return {
    id: match.id,
    externalId: match.externalId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeLogo: match.homeLogo,
    awayLogo: match.awayLogo,
    matchDate: match.matchDate.toISOString(),
    status: getAutoStatus(match),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    youtubeUrl: match.youtubeUrl,
    createdAt: match.createdAt.toISOString(),
  };
}

router.get("/matches", async (req, res): Promise<void> => {
  const params = ListMatchesQueryParams.safeParse(req.query);
  const status = params.success ? params.data.status : undefined;

  const matches = await db
    .select()
    .from(matchesTable)
    .orderBy(matchesTable.matchDate);

  const withAutoStatus = matches.map((m) => ({
    ...m,
    status: getAutoStatus(m),
  }));

  const filtered = status
    ? withAutoStatus.filter((m) => m.status === status)
    : withAutoStatus;

  res.json(filtered.map((m) => toPublicMatchJson(m)));
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

    res.status(201).json(toAdminMatchJson(match));
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

  const autoStatus = getAutoStatus(match);
  const deadlineReached = isDeadlineReached(match.matchDate);

  const canPredict = autoStatus === "upcoming" && !deadlineReached;

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
      userAvatarUrl: usersTable.avatarUrl,
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

  const safeMatch = toPublicMatchJson(match);

  res.json({
    ...safeMatch,
    status: autoStatus,
    canPredict,
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
        avatarUrl: p.userAvatarUrl ?? null,
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

    res.json(toAdminMatchJson(match));
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
        userAvatarUrl: usersTable.avatarUrl,
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
          avatarUrl: p.userAvatarUrl ?? null,
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
    chatAvailable: !match.chatLocked,
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
      matchDate: matchesTable.matchDate,
      homeScore: matchesTable.homeScore,
      awayScore: matchesTable.awayScore,
      chatLocked: matchesTable.chatLocked,
    })
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId));

  if (!match) {
    res.status(404).json({ error: "Jogo não encontrado" });
    return;
  }

  const autoStatus = getAutoStatus(match);

  if (autoStatus !== "live" || match.chatLocked) {
    res.status(403).json({
      error: "Chat indisponível no momento",
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
