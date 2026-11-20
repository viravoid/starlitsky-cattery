import { logger } from "../utils/logger.mjs";

export function attachRequestLogger(request, response) {
  const startedAt = Date.now();

  response.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    logger.info(
      `${request.method || "UNKNOWN"} ${safePathname(request.url)} ${response.statusCode} ${durationMs}ms`,
    );
  });
}

function safePathname(rawUrl) {
  try {
    return new URL(rawUrl || "/", "http://localhost").pathname;
  } catch {
    return "/invalid-url";
  }
}
