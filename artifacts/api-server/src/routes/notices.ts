import { Router, type IRouter } from "express";
import { db, noticesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/notices", requireAuth, async (_req, res): Promise<void> => {
  const notices = await db
    .select()
    .from(noticesTable)
    .where(eq(noticesTable.isActive, true))
    .orderBy(desc(noticesTable.createdAt));

  res.json(notices);
});

router.post(
  "/notices",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const { title, message } = req.body;

    if (!title || !message) {
      res.status(400).json({
        error: "Título e mensagem são obrigatórios",
      });
      return;
    }

    const [notice] = await db
      .insert(noticesTable)
      .values({
        title,
        message,
        isActive: true,
      })
      .returning();

    res.status(201).json(notice);
  }
);

router.patch(
  "/notices/:id/deactivate",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const [notice] = await db
      .update(noticesTable)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(noticesTable.id, id))
      .returning();

    if (!notice) {
      res.status(404).json({ error: "Aviso não encontrado" });
      return;
    }

    res.json(notice);
  }
);

router.delete(
  "/notices/:id",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    await db.delete(noticesTable).where(eq(noticesTable.id, id));

    res.json({ success: true });
  }
);

export default router;