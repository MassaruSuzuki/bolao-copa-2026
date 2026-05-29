import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { requireAuth, signToken } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email já cadastrado" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({ name, email, password: hashed, status: "pending" });

  res.status(201).json({ pending: true });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  if (user.status === "pending") {
    res.status(403).json({ error: "pending", message: "Sua conta ainda não foi aprovada pelo administrador." });
    return;
  }

  if (user.status === "rejected") {
    res.status(403).json({ error: "rejected", message: "Sua conta foi recusada. Entre em contato com o administrador." });
    return;
  }

  const token = signToken({ userId: user.id, isAdmin: user.isAdmin });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
