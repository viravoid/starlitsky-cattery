import {
  certifyExistingUserAsParent,
  getParentManagementOverview,
  listParentAdminEvents,
  listAdminUsers,
  setParentStatus,
} from "../services/admin-user-service.mjs";
import { requireAdminMutationRole } from "../middleware/auth.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeAdminUsersRequest(request, response, url, context) {
  if (url.pathname === "/admin/parent-overview") {
    if (request.method !== "GET") throw methodNotAllowed();
    await requireAdminMutationRole(request, context.config);
    sendSuccess(response, { data: await getParentManagementOverview() });
    return;
  }
  if (url.pathname === "/admin/users") {
    if (request.method !== "GET") throw methodNotAllowed();
    await requireAdminMutationRole(request, context.config);
    sendSuccess(response, {
      data: await listAdminUsers(url.searchParams),
    });
    return;
  }

  const userId = matchCertifyParentRoute(url.pathname);
  if (userId) {
    if (request.method !== "POST") throw methodNotAllowed();
    const adminUser = await requireAdminMutationRole(request, context.config);
    sendSuccess(response, {
      data: await certifyExistingUserAsParent(
        { ...(await readJsonBody(request)), userId },
        adminUser,
      ),
      message: "Existing user certified as parent",
    });
    return;
  }

  const eventsUserId = matchParentEventsRoute(url.pathname);
  if (eventsUserId) {
    if (request.method !== "GET") throw methodNotAllowed();
    await requireAdminMutationRole(request, context.config);
    sendSuccess(response, { data: await listParentAdminEvents(eventsUserId) });
    return;
  }

  const statusUserId = matchParentStatusRoute(url.pathname);
  if (statusUserId) {
    if (request.method !== "PATCH") throw methodNotAllowed();
    const adminUser = await requireAdminMutationRole(request, context.config);
    const body = await readJsonBody(request);
    sendSuccess(response, { data: await setParentStatus(statusUserId, body.status, adminUser) });
    return;
  }

  throw notFound("Admin user route not found");
}

function matchParentEventsRoute(pathname) {
  const match = pathname.match(/^\/admin\/users\/([^/]+)\/parent-events$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function matchParentStatusRoute(pathname) {
  const match = pathname.match(/^\/admin\/users\/([^/]+)\/parent-status$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function matchCertifyParentRoute(pathname) {
  const match = pathname.match(/^\/admin\/users\/([^/]+)\/certify-parent$/);
  return match ? decodeURIComponent(match[1]) : null;
}
