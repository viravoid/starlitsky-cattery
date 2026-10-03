import { requireAuth } from "../middleware/auth.mjs";
import {
  createMyCat,
  deleteMyCat,
  getMyCat,
  listMyCats,
  updateMyCat,
} from "../services/my-cats-service.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
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

    if (request.method === "POST") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await createMyCat(await readJsonBody(request), user),
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

    if (request.method === "PATCH") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await updateMyCat(catId, await readJsonBody(request), user),
      });
      return;
    }

    if (request.method === "DELETE") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await deleteMyCat(catId, user),
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
