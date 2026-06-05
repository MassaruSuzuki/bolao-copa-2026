import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const ADMIN_EMAIL = process.env["ADMIN_EMAIL"] ?? "admin@bolao.com";
const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] ?? "admin123";
const ADMIN_NAME = process.env["ADMIN_NAME"] ?? "Administrador";

export async function seedDefaultAdmin(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, ADMIN_EMAIL));

    if (existing) {
      logger.info({ email: ADMIN_EMAIL }, "Admin padrão já existe, pulando seed");
      return;
    }

    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.insert(usersTable).values({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashed,
      isAdmin: true,
      status: "active",
    });

    logger.info({ email: ADMIN_EMAIL }, "Admin padrão criado com sucesso");
  } catch (err) {
    logger.error({ err }, "Falha ao criar admin padrão");
  }
}
