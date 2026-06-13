import { logger } from "../lib/logger";
import { syncLiveScores } from "../routes/sync";

const POLL_INTERVAL_MS = 60_000;

let timer: NodeJS.Timeout | null = null;

async function runSync(): Promise<void> {
  try {
    const result = await syncLiveScores();

    logger.info(
      {
        updated: result.updated,
      },
      "Live poller sync completed"
    );
  } catch (err) {
    logger.error(
      {
        err,
      },
      "Live poller sync failed"
    );
  }
}

export function startLivePoller(): void {
  if (timer) {
    logger.warn("Live poller already running");
    return;
  }

  logger.info(
    {
      intervalMs: POLL_INTERVAL_MS,
    },
    "Live poller started"
  );

  // Executa imediatamente ao iniciar o servidor
  void runSync();

  // Continua executando a cada 60 segundos
  timer = setInterval(() => {
    void runSync();
  }, POLL_INTERVAL_MS);
}

export function stopLivePoller(): void {
  if (!timer) {
    return;
  }

  clearInterval(timer);
  timer = null;

  logger.info("Live poller stopped");
}