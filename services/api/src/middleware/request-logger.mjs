import { logger } from "../utils/logger.mjs";

export function attachRequestLogger(request, response) {
  const startedAt = Date.now();

  response.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    logger.info(
      `${request.method || "UNKNOWN"} ${request.url || "/"} ${response.statusCode} ${durationMs}ms`,
    );
  });
}
