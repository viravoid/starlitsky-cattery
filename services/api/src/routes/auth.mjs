import {
  getCurrentUserFromRequest,
  loginWithWechatCode,
  revokeSessionFromRequest,
} from "../services/auth-service.mjs";
import { assertRateLimit, buildIpRateLimitKey } from "../middleware/rate-limit.mjs";
import { methodNotAllowed, unauthorized } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeAuthRequest(request, response, url, context) {
  if (url.pathname === "/auth/wechat/login") {
    if (request.method !== "POST") throw methodNotAllowed();

    assertRateLimit(
      buildIpRateLimitKey(request, "wechat-login", context.config.server),
      context.config.auth.wechatLoginRateLimit,
    );

    const body = await readJsonBody(request);
    sendSuccess(response, {
      statusCode: 201,
      data: await loginWithWechatCode({
        code: body.code,
        config: context.config,
        userAgent: request.headers["user-agent"],
      }),
      message: "Authenticated",
    });
    return;
  }

  if (url.pathname === "/auth/me") {
    if (request.method !== "GET") throw methodNotAllowed();

    const user = await getCurrentUserFromRequest(request, context.config);
    if (!user) throw unauthorized();

    sendSuccess(response, {
      data: { user },
      message: "Current user",
    });
    return;
  }

  if (url.pathname === "/auth/logout") {
    if (request.method !== "POST") throw methodNotAllowed();

    await revokeSessionFromRequest(request, context.config);
    sendSuccess(response, {
      data: null,
      message: "Logged out",
    });
    return;
  }

  throw methodNotAllowed();
}
