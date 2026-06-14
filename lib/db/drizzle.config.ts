/// <reference types="node" />

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});