import { requireAdminMutationRole, requireAuth } from "../middleware/auth.mjs";
import { getCurrentUserFromRequest } from "../services/auth-service.mjs";
import {
  getMyLatestSelectionApplication,
  getSelectionApplication,
  listSelectionApplications,
  submitSelectionApplication,
  updateSelectionApplicationReview,
} from "../services/selection-application-service.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeSelectionApplicationsRequest(request, response, url, context) {
  if (url.pathname === "/selection-applications") {
    if (request.method === "POST") {
      const user = await getCurrentUserFromRequest(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await submitSelectionApplication(await readJsonBody(request), { user }),
        message: "Selection application submitted",
      });
      return;
    }

    if (request.method === "GET") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await listSelectionApplications(url.searchParams),
      });
      return;
    }

    throw methodNotAllowed();
  }

  if (url.pathname === "/selection-applications/me") {
    if (request.method === "GET") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        data: await getMyLatestSelectionApplication(user.id),
      });
      return;
    }

    throw methodNotAllowed();
  }

  const id = matchSelectionApplicationId(url.pathname);
  if (id) {
    if (request.method === "GET") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await getSelectionApplication(id),
      });
      return;
    }

    if (request.method === "PATCH") {
      const reviewer = await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await updateSelectionApplicationReview(id, await readJsonBody(request), reviewer),
        message: "Selection application updated",
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Selection application route not found");
}

function matchSelectionApplicationId(pathname) {
  const match = pathname.match(/^\/selection-applications\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}
