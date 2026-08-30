import { getFixedPage, listFixedPages, updateFixedPage } from "../services/fixed-page-service.mjs";
import { requireAdminMutationRole } from "../middleware/auth.mjs";
import { getCurrentUserFromRequest } from "../services/auth-service.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeFixedPagesRequest(request, response, url, context) {
  const readOptions = await resolveFixedPageReadOptions(request, context.config);

  if (url.pathname === "/fixed-pages") {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listFixedPages(readOptions),
      });
      return;
    }

    throw methodNotAllowed();
  }

  const slug = matchFixedPageSlug(url.pathname);
  if (slug) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getFixedPage(slug, readOptions),
      });
      return;
    }

    if (request.method === "PATCH") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await updateFixedPage(slug, await readJsonBody(request)),
        message: "Fixed page updated",
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Fixed page route not found");
}

async function resolveFixedPageReadOptions(request, config) {
  const user = await getCurrentUserFromRequest(request, config);
  return {
    includeHidden: Boolean(user?.roles.some((role) => role === "admin" || role === "keeper")),
  };
}

function matchFixedPageSlug(pathname) {
  const match = pathname.match(/^\/fixed-pages\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
