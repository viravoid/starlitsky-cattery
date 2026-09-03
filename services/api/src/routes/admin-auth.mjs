import {
  approveAdminLoginChallenge,
  createAdminLoginChallenge,
  pollAdminLoginChallenge,
  resolveAdminLoginChallenge,
} from "../services/admin-auth-service.mjs";
import { requireAnyRole } from "../middleware/auth.mjs";
import { assertRateLimit, buildIpRateLimitKey } from "../middleware/rate-limit.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeAdminAuthRequest(request, response, url, context) {
  if (url.pathname === "/admin-auth/challenges") {
    if (request.method !== "POST") throw methodNotAllowed();
    assertRateLimit(
      buildIpRateLimitKey(request, "admin-login-create", context.config.server),
      context.config.auth.adminLoginChallengeCreateRateLimit,
    );
    sendSuccess(response, {
      statusCode: 201,
      data: await createAdminLoginChallenge(await readJsonBody(request), context.config),
      message: "Admin login challenge created",
    });
    return;
  }

  if (url.pathname === "/admin-auth/challenges/resolve") {
    if (request.method !== "POST") throw methodNotAllowed();
    const user = await requireAnyRole(request, context.config, ["keeper", "admin"]);
    sendSuccess(response, {
      data: await resolveAdminLoginChallenge(await readJsonBody(request), user, context.config),
      message: "Admin login challenge resolved",
    });
    return;
  }

  const pollChallengeId = matchChallengeAction(url.pathname, "poll");
  if (pollChallengeId) {
    if (request.method !== "POST") throw methodNotAllowed();
    assertRateLimit(
      buildIpRateLimitKey(request, "admin-login-poll", context.config.server),
      context.config.auth.adminLoginChallengePollRateLimit,
    );
    sendSuccess(response, {
      data: await pollAdminLoginChallenge(
        pollChallengeId,
        await readJsonBody(request),
        context.config,
        request.headers["user-agent"],
      ),
      message: "Admin login challenge polled",
    });
    return;
  }

  const approveChallengeId = matchChallengeAction(url.pathname, "approve");
  if (approveChallengeId) {
    if (request.method !== "POST") throw methodNotAllowed();
    const user = await requireAnyRole(request, context.config, ["keeper", "admin"]);
    sendSuccess(response, {
      data: await approveAdminLoginChallenge(
        approveChallengeId,
        await readJsonBody(request),
        user,
        context.config,
      ),
      message: "Admin login challenge approved",
    });
    return;
  }

  throw notFound("Admin auth route not found");
}

function matchChallengeAction(pathname, action) {
  const match = pathname.match(new RegExp(`^/admin-auth/challenges/([^/]+)/${action}$`));
  return match ? decodeURIComponent(match[1]) : null;
}
