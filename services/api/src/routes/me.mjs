import { requireAuth } from "../middleware/auth.mjs";
import { getMyCat, listMyCats } from "../services/my-cats-service.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeMeRequest(request, response, url, context) {
  if (url.pathname === "/me/cats") {
    if (request.method === "GET") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await listMyCats(url.searchParams, user),
      });
      return;
    }

    throw methodNotAllowed();
  }

  const catId = matchMyCatId(url.pathname);
  if (catId) {
    if (request.method === "GET") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await getMyCat(catId, user),
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Me route not found");
}

function matchMyCatId(pathname) {
  const match = pathname.match(/^\/me\/cats\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
