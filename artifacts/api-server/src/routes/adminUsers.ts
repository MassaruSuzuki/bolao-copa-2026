import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

router.get(
  "/admin/users",
  requireAuth,
  requireAdmin,
  async (_req, res): Promise<void> => {
    try {
      const users = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          status: usersTable.status,
          createdAt: usersTable.createdAt,
          avatarUrl: usersTable.avatarUrl,
        })
        .from(usersTable)
        .where(ne(usersTable.isAdmin, true));

      res.json(
        users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).json({ error: "Erro ao listar usuários" });
    }
  }
);

router.post(
  "/admin/users/:id/approve",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      const [user] = await db
        .update(usersTable)
        .set({ status: "approved" })
        .where(eq(usersTable.id, id))
        .returning();

      if (!user) {
        res.status(404).json({ error: "Usuário não encontrado" });
        return;
      }

      res.json({
        ok: true,
        id: user.id,
        status: user.status,
      });
    } catch (error) {
      console.error("Erro ao aprovar usuário:", error);
      res.status(500).json({ error: "Erro ao aprovar usuário" });
    }
  }
);

router.post(
  "/admin/users/:id/reject",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      const [user] = await db
        .update(usersTable)
        .set({ status: "rejected" })
        .where(eq(usersTable.id, id))
        .returning();

      if (!user) {
        res.status(404).json({ error: "Usuário não encontrado" });
        return;
      }

      res.json({
        ok: true,
        id: user.id,
        status: user.status,
      });
    } catch (error) {
      console.error("Erro ao rejeitar usuário:", error);
      res.status(500).json({ error: "Erro ao rejeitar usuário" });
    }
  }
);

router.patch(
  "/admin/users/:id/password",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      const { password } = req.body;

      if (isNaN(id)) {
        res.status(400).json({ error: "ID inválido" });
        return;
      }

      if (!password || typeof password !== "string" || password.length < 6) {
        res.status(400).json({
          error: "A nova senha deve ter pelo menos 6 caracteres.",
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [user] = await db
        .update(usersTable)
        .set({
          password: hashedPassword,
        })
        .where(eq(usersTable.id, id))
        .returning({
          id: usersTable.id,
          email: usersTable.email,
        });

      if (!user) {
        res.status(404).json({ error: "Usuário não encontrado" });
        return;
      }

      res.json({
        ok: true,
        message: "Senha alterada com sucesso.",
        id: user.id,
        email: user.email,
      });
    } catch (error) {
      console.error("Erro ao alterar senha do usuário:", error);
      res.status(500).json({ error: "Erro ao alterar senha do usuário" });
    }
  }
);

export default router;