import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/admin/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      status: usersTable.status,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(ne(usersTable.isAdmin, true));

  res.json(
    users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    }))
  );
});

router.post("/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [user] = await db.update(usersTable)
    .set({ status: "approved" })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  res.json({ ok: true, id: user.id, status: user.status });
});

router.post("/admin/users/:id/reject", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

  const [user] = await db.update(usersTable)
    .set({ status: "rejected" })
    .where(eq(usersTable.id, id))
    .returning();

  if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
  res.json({ ok: true, id: user.id, status: user.status });
});

export default router;
