import { getFixedPage, listFixedPages, updateFixedPage } from "../services/fixed-page-service.mjs";
import { requireAdminMutationRole } from "../middleware/auth.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeFixedPagesRequest(request, response, url, context) {
  if (url.pathname === "/fixed-pages") {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await listFixedPages(),
      });
      return;
    }

    throw methodNotAllowed();
  }

  const slug = matchFixedPageSlug(url.pathname);
  if (slug) {
    if (request.method === "GET") {
      sendSuccess(response, {
        data: await getFixedPage(slug),
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

function matchFixedPageSlug(pathname) {
  const match = pathname.match(/^\/fixed-pages\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
