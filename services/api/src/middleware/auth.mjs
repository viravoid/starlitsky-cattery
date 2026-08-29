import { getCurrentUserFromRequest } from "../services/auth-service.mjs";
import { forbidden, unauthorized } from "../utils/errors.mjs";

export async function requireAuth(request, config) {
  const user = await getCurrentUserFromRequest(request, config);
  if (!user) throw unauthorized();
  return user;
}

export async function requireAnyRole(request, config, roles) {
  const user = await requireAuth(request, config);
  const allowed = new Set(roles);
  if (!user.roles.some((role) => allowed.has(role))) {
    throw forbidden();
  }
  return user;
}

export async function requireAdminMutationRole(request, config) {
  return requireAnyRole(request, config, ["admin", "keeper"]);
}
