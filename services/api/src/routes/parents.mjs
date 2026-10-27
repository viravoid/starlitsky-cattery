import {
  createParentProfile,
  listParentProfiles,
  updateParentCatLink,
} from "../services/profile-service.mjs";
import {
  approveParentApplication,
  getMyParentApplication,
  listParentApplications,
  rejectParentApplication,
  searchAdminParentCatCandidates,
  searchParentClaimCatCandidates,
  submitParentApplication,
} from "../services/parent-application-service.mjs";
import { verifyParentPhoneCode } from "../services/parent-phone-verification-service.mjs";
import { requireAdminMutationRole, requireAuth } from "../middleware/auth.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeParentsRequest(request, response, url, context) {
  if (url.pathname === "/parent-applications/phone-verification-capability") {
    if (request.method !== "GET") throw methodNotAllowed();
    sendSuccess(response, {
      data: {
        enabled:
          context.config.wechat.phoneVerificationEnabled === true &&
          Boolean(context.config.wechat.appId && context.config.wechat.appSecret),
      },
    });
    return;
  }

  if (url.pathname === "/parent-applications/phone-verifications") {
    if (request.method !== "POST") throw methodNotAllowed();
    const user = await requireAuth(request, context.config);
    sendSuccess(response, {
      data: await verifyParentPhoneCode(await readJsonBody(request), user, context.config),
      message: "WeChat phone obtained",
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

  if (url.pathname === "/parent-applications/cat-candidates") {
    if (request.method !== "GET") throw methodNotAllowed();
    const user = await requireAuth(request, context.config);
    sendSuccess(response, {
      data: await searchParentClaimCatCandidates(url.searchParams, user),
      message: "Parent claim cat candidates",
    });
    return;
  }

  if (url.pathname === "/parent-applications/admin-cat-candidates") {
    if (request.method !== "GET") throw methodNotAllowed();
    await requireAdminMutationRole(request, context.config);
    sendSuccess(response, { data: await searchAdminParentCatCandidates(url.searchParams) });
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

function matchParentApplicationAction(pathname, action) {
  const match = pathname.match(new RegExp(`^/parent-applications/([^/]+)/${action}$`));
  return match ? decodeURIComponent(match[1]) : null;
}
