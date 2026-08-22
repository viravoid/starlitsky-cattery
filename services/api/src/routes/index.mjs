import { handleHealth } from "./health.mjs";
import { notFound } from "../utils/errors.mjs";

export async function routeRequest(request, response, context) {
  const url = new URL(
    request.url || "/",
    `http://${request.headers.host || `${context.config.server.host}:${context.config.server.port}`}`,
  );

  if (request.method === "GET" && url.pathname === "/health") {
    handleHealth(request, response, context);
    return;
  }

  throw notFound("Route not found");
}
