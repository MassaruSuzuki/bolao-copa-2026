import { logger } from "../lib/logger";
import { syncLiveScores } from "../routes/sync";

const POLL_INTERVAL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

export function startLivePoller() {
  if (timer) return;
  logger.info("Live score poller started (60s interval)");
  timer = setInterval(async () => {
    try {
      const result = await syncLiveScores();
      if (result.updated > 0) {
        logger.info({ updated: result.updated }, "Live poller updated scores");
      }
    } catch (err) {
      logger.error({ err }, "Live poller error");
    }
  }, POLL_INTERVAL_MS);
}

export function stopLivePoller() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
