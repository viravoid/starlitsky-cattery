import { loginWithAdminPassword } from "../services/admin-auth-service.mjs";
import { assertRateLimit, buildIpRateLimitKey } from "../middleware/rate-limit.mjs";
import { methodNotAllowed, notFound } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";
import { sendSuccess } from "../utils/response.mjs";

export async function routeAdminAuthRequest(request, response, url, context) {
  if (url.pathname === "/admin-auth/login") {
    if (request.method !== "POST") throw methodNotAllowed();
    assertRateLimit(
      buildIpRateLimitKey(request, "admin-login", context.config.server),
      context.config.auth.adminLoginRateLimit,
    );
    sendSuccess(response, {
      statusCode: 201,
      data: await loginWithAdminPassword(
        await readJsonBody(request),
        context.config,
        request.headers["user-agent"],
      ),
      message: "Authenticated",
    });
    return;
  }

  throw notFound("Admin auth route not found");
}
