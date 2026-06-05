import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET ?? "bolao-secret-key";

export interface AuthPayload {
  userId: number;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  db.select({ status: usersTable.status, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .then(([dbUser]) => {
      if (!dbUser) {
        res.status(401).json({ error: "Conta não encontrada" });
        return;
      }
      if (!dbUser.isAdmin && dbUser.status !== "approved") {
        res.status(401).json({ error: "Acesso negado. Sua conta foi rejeitada ou está pendente de aprovação." });
        return;
      }
      req.user = payload;
      next();
    })
    .catch((err) => {
      req.log?.error(err, "Auth middleware DB error");
      res.status(500).json({ error: "Erro interno" });
    });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  });
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}
