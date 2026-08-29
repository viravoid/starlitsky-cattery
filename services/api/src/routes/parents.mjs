import {
  createParentProfile,
  listParentProfiles,
  updateParentCatLink,
} from "../services/profile-service.mjs";
import {
  approveParentApplication,
  createParentInvite,
  getMyParentApplication,
  listParentApplications,
  listParentInvites,
  rejectParentApplication,
  revokeParentInvite,
  submitParentApplication,
  verifyParentInvite,
} from "../services/parent-application-service.mjs";
import { requireAdminMutationRole, requireAuth } from "../middleware/auth.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeParentsRequest(request, response, url, context) {
  if (url.pathname === "/parent-invites/verify") {
    if (request.method !== "GET") throw methodNotAllowed();
    sendSuccess(response, {
      data: await verifyParentInvite({
        code: url.searchParams.get("code"),
        token: url.searchParams.get("token"),
      }),
      message: "Parent invite verified",
    });
    return;
  }

  if (url.pathname === "/parent-invites") {
    if (request.method === "GET") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await listParentInvites(url.searchParams),
      });
      return;
    }

    if (request.method === "POST") {
      const adminUser = await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createParentInvite(await readJsonBody(request), adminUser),
        message: "Parent invite created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const parentInviteId = matchParentInviteAction(url.pathname, "revoke");
  if (parentInviteId) {
    if (request.method !== "POST") throw methodNotAllowed();
    const adminUser = await requireAdminMutationRole(request, context.config);
    sendSuccess(response, {
      data: await revokeParentInvite(parentInviteId, await readJsonBody(request), adminUser),
      message: "Parent invite revoked",
    });
    return;
  }

  if (url.pathname === "/parent-applications/mine") {
    if (request.method !== "GET") throw methodNotAllowed();
    const user = await requireAuth(request, context.config);
    sendSuccess(response, {
      data: await getMyParentApplication(user),
      message: "Current parent application",
    });
    return;
  }

  if (url.pathname === "/parent-applications") {
    if (request.method === "GET") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await listParentApplications(url.searchParams),
      });
      return;
    }

    if (request.method === "POST") {
      const user = await requireAuth(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await submitParentApplication(await readJsonBody(request), user),
        message: "Parent application submitted",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const approveApplicationId = matchParentApplicationAction(url.pathname, "approve");
  if (approveApplicationId) {
    if (request.method !== "POST") throw methodNotAllowed();
    const adminUser = await requireAdminMutationRole(request, context.config);
    sendSuccess(response, {
      data: await approveParentApplication(
        approveApplicationId,
        await readJsonBody(request),
        adminUser,
      ),
      message: "Parent application approved",
    });
    return;
  }

  const rejectApplicationId = matchParentApplicationAction(url.pathname, "reject");
  if (rejectApplicationId) {
    if (request.method !== "POST") throw methodNotAllowed();
    const adminUser = await requireAdminMutationRole(request, context.config);
    sendSuccess(response, {
      data: await rejectParentApplication(
        rejectApplicationId,
        await readJsonBody(request),
        adminUser,
      ),
      message: "Parent application rejected",
    });
    return;
  }

  if (url.pathname === "/parent-profiles") {
    if (request.method === "GET") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await listParentProfiles(url.searchParams),
      });
      return;
    }

    if (request.method === "POST") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        statusCode: 201,
        data: await createParentProfile(await readJsonBody(request)),
        message: "Parent profile created",
      });
      return;
    }

    throw methodNotAllowed();
  }

  const parentCatLinkId = matchParentCatLinkId(url.pathname);
  if (parentCatLinkId) {
    if (request.method === "PATCH") {
      await requireAdminMutationRole(request, context.config);
      sendSuccess(response, {
        data: await updateParentCatLink(parentCatLinkId, await readJsonBody(request)),
        message: "Parent cat link updated",
      });
      return;
    }

    throw methodNotAllowed();
  }

  throw notFound("Parent route not found");
}

function matchParentCatLinkId(pathname) {
  const match = pathname.match(/^\/parent-cat-links\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function matchParentInviteAction(pathname, action) {
  const match = pathname.match(new RegExp(`^/parent-invites/([^/]+)/${action}$`));
  return match ? decodeURIComponent(match[1]) : null;
}

function matchParentApplicationAction(pathname, action) {
  const match = pathname.match(new RegExp(`^/parent-applications/([^/]+)/${action}$`));
  return match ? decodeURIComponent(match[1]) : null;
}
