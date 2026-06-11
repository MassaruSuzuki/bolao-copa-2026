import app from "./app";
import { logger } from "./lib/logger";
// import { startLivePoller } from "./services/livePoller";
import { seedDefaultAdmin } from "./lib/seedAdmin";
// import { syncMatchesOnStartup } from "./lib/syncMatchesOnStartup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Desativado temporariamente para não sobrescrever status manual dos jogos.
  // Depois vamos corrigir o livePoller.ts e religar.
  // startLivePoller();

  seedDefaultAdmin();

  // Desativado para não sobrescrever jogos colocados manualmente como Ao Vivo.
  // Quando quiser sincronizar jogos da Copa, use o botão "Sincronizar Copa 2026" no Admin.
  // syncMatchesOnStartup();
});