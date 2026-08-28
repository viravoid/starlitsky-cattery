import { handleHealth } from "./health.mjs";
import { routeCatsRequest } from "./cats.mjs";
import { routeFixedPagesRequest } from "./fixed-pages.mjs";
import { routeLittersRequest } from "./litters.mjs";
import { routeMediaRequest } from "./media.mjs";
import { routeParentsRequest } from "./parents.mjs";
import { notFound } from "../utils/errors.mjs";
import { sendNoContent } from "../utils/response.mjs";

export async function routeRequest(request, response, context) {
  const url = new URL(
    request.url || "/",
    `http://${request.headers.host || `${context.config.server.host}:${context.config.server.port}`}`,
  );

  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    handleHealth(request, response, context);
    return;
  }

  if (url.pathname === "/cats" || url.pathname.startsWith("/cats/")) {
    await routeCatsRequest(request, response, url);
    return;
  }

  if (url.pathname === "/litters" || url.pathname.startsWith("/litters/")) {
    await routeLittersRequest(request, response, url);
    return;
  }

  if (url.pathname === "/fixed-pages" || url.pathname.startsWith("/fixed-pages/")) {
    await routeFixedPagesRequest(request, response, url);
    return;
  }

  if (url.pathname === "/media" || url.pathname.startsWith("/media/")) {
    await routeMediaRequest(request, response, url);
    return;
  }

  if (url.pathname === "/parent-profiles" || url.pathname.startsWith("/parent-cat-links/")) {
    await routeParentsRequest(request, response, url);
    return;
  }

  throw notFound("Route not found");
}
