import { routeAuthRequest } from "./auth.mjs";
import { handleHealth } from "./health.mjs";
import { routeCatsRequest } from "./cats.mjs";
import { routeCommunityRequest } from "./community.mjs";
import { routeFixedPagesRequest } from "./fixed-pages.mjs";
import { routeLittersRequest } from "./litters.mjs";
import { routeMediaRequest } from "./media.mjs";
import { routeMeRequest } from "./me.mjs";
import { routeParentsRequest } from "./parents.mjs";
import { routeSelectionApplicationsRequest } from "./selection-applications.mjs";
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

  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) {
    await routeAuthRequest(request, response, url, context);
    return;
  }

  if (url.pathname === "/cats" || url.pathname.startsWith("/cats/")) {
    await routeCatsRequest(request, response, url, context);
    return;
  }

  if (
    url.pathname === "/community/post-options" ||
    url.pathname === "/community/posts" ||
    url.pathname.startsWith("/community/posts/")
  ) {
    await routeCommunityRequest(request, response, url, context);
    return;
  }

  if (url.pathname === "/litters" || url.pathname.startsWith("/litters/")) {
    await routeLittersRequest(request, response, url, context);
    return;
  }

  if (url.pathname === "/fixed-pages" || url.pathname.startsWith("/fixed-pages/")) {
    await routeFixedPagesRequest(request, response, url, context);
    return;
  }

  if (url.pathname === "/media" || url.pathname.startsWith("/media/")) {
    await routeMediaRequest(request, response, url, context);
    return;
  }

  if (url.pathname === "/me/cats" || url.pathname.startsWith("/me/cats/")) {
    await routeMeRequest(request, response, url, context);
    return;
  }

  if (
    url.pathname === "/selection-applications" ||
    url.pathname.startsWith("/selection-applications/")
  ) {
    await routeSelectionApplicationsRequest(request, response, url, context);
    return;
  }

  if (
    url.pathname === "/parent-profiles" ||
    url.pathname.startsWith("/parent-cat-links/") ||
    url.pathname === "/parent-invites" ||
    url.pathname.startsWith("/parent-invites/") ||
    url.pathname === "/parent-applications" ||
    url.pathname.startsWith("/parent-applications/")
  ) {
    await routeParentsRequest(request, response, url, context);
    return;
  }

  throw notFound("Route not found");
}
