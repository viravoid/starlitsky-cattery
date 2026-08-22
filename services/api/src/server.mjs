import { createServer } from "node:http";
import { config } from "./config/env.mjs";
import { handleError } from "./middleware/error-handler.mjs";
import { attachRequestLogger } from "./middleware/request-logger.mjs";
import { routeRequest } from "./routes/index.mjs";
import { logger } from "./utils/logger.mjs";

const server = createServer(async (request, response) => {
  attachRequestLogger(request, response);

  try {
    await routeRequest(request, response, { config });
  } catch (error) {
    handleError(error, response);
  }
});

server.listen(config.server.port, config.server.host, () => {
  logger.info(
    `starlitsky-api listening at http://${config.server.host}:${config.server.port}`,
  );
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
});
