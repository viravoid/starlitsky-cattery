import { expireStalePendingImageUploads } from "./media-upload-service.mjs";
import { logger as defaultLogger } from "../utils/logger.mjs";

const DEFAULT_PENDING_UPLOAD_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_PENDING_UPLOAD_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PENDING_UPLOAD_CLEANUP_BATCH_SIZE = 100;

export function createPendingMediaUploadMaintenance({
  cleanup = expireStalePendingImageUploads,
  intervalMs = DEFAULT_PENDING_UPLOAD_CLEANUP_INTERVAL_MS,
  staleAfterMs = DEFAULT_PENDING_UPLOAD_STALE_AFTER_MS,
  batchSize = DEFAULT_PENDING_UPLOAD_CLEANUP_BATCH_SIZE,
  logger = defaultLogger,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let timer = null;
  let running = false;
  let stopped = true;

  async function runOnce(trigger = "manual") {
    if (running) {
      return { skipped: true, reason: "already_running" };
    }

    running = true;
    try {
      const result = await cleanup({
        batchSize,
        now: new Date(),
        staleAfterMs,
      });
      if (result?.expiredCount > 0) {
        logger.info(
          `Expired ${result.expiredCount} stale pending media upload(s) during ${trigger} cleanup`,
        );
      }
      return { skipped: false, failed: false, ...result };
    } catch (error) {
      logger.error("Stale pending media upload cleanup failed", error);
      return { skipped: false, failed: true, error };
    } finally {
      running = false;
    }
  }

  function scheduleNext() {
    if (stopped || !isPositiveInterval(intervalMs)) return;

    timer = setTimer(async () => {
      timer = null;
      await runOnce("interval");
      scheduleNext();
    }, intervalMs);
    timer?.unref?.();
  }

  function start() {
    if (!stopped || timer) return;
    stopped = false;
    void runOnce("startup");
    scheduleNext();
  }

  function stop() {
    stopped = true;
    if (timer) {
      clearTimer(timer);
      timer = null;
    }
  }

  return {
    runOnce,
    start,
    stop,
  };
}

function isPositiveInterval(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}
