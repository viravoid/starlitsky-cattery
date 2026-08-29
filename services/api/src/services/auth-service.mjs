import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.mjs";
import { badRequest, serviceUnavailable, unauthorized } from "../utils/errors.mjs";

const WECHAT_CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";
const BASE_ROLE = "user";
const ROLE_ORDER = ["admin", "keeper", "parent", "user"];

export async function loginWithWechatCode({ code, config, userAgent }) {
  const trimmedCode = typeof code === "string" ? code.trim() : "";
  if (!trimmedCode) throw badRequest("WeChat login code is required");

  const wechatIdentity = await exchangeWechatCode(trimmedCode, config);
  const user = await upsertWechatUser(wechatIdentity);
  const session = await createSession({ userId: user.id, config, userAgent });

  return {
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: toCurrentUserDto(user),
    verificationMode: wechatIdentity.mocked ? "mock" : "wechat",
  };
}

export async function getCurrentUserFromRequest(request, config) {
  const token = extractBearerToken(request);
  if (!token) return null;

  const tokenHash = hashToken(token, config);
  const now = new Date();
  const session = await prisma.userSession.findUnique({
    where: { token_hash: tokenHash },
    include: {
      user: {
        include: {
          roles: true,
          parent_profile: true,
        },
      },
    },
  });

  if (!session || session.revoked_at || session.expires_at <= now) return null;
  if (session.user.status !== "active") return null;

  await prisma.userSession.update({
    where: { id: session.id },
    data: { last_seen_at: now },
  });

  return toCurrentUserDto(session.user);
}

export async function revokeSessionFromRequest(request, config) {
  const token = extractBearerToken(request);
  if (!token) return false;

  const result = await prisma.userSession.updateMany({
    where: {
      token_hash: hashToken(token, config),
      revoked_at: null,
    },
    data: {
      revoked_at: new Date(),
    },
  });

  return result.count > 0;
}

export function extractBearerToken(request) {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") return "";

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function exchangeWechatCode(code, config) {
  if (config.wechat.appId && config.wechat.appSecret) {
    return exchangeWechatCodeWithApi(code, config);
  }

  if (config.wechat.mockLoginEnabled) {
    return createMockWechatIdentity(code);
  }

  throw serviceUnavailable("WeChat credentials are not configured");
}

async function exchangeWechatCodeWithApi(code, config) {
  const url = new URL(WECHAT_CODE2SESSION_URL);
  url.searchParams.set("appid", config.wechat.appId);
  url.searchParams.set("secret", config.wechat.appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url);
  if (!response.ok) {
    throw serviceUnavailable("WeChat identity verification failed");
  }

  const payload = await response.json();
  if (payload.errcode) {
    throw unauthorized("Invalid WeChat login code");
  }

  if (!payload.openid || typeof payload.openid !== "string") {
    throw serviceUnavailable("WeChat identity response did not include openid");
  }

  return {
    openid: payload.openid,
    unionid: typeof payload.unionid === "string" ? payload.unionid : null,
    mocked: false,
  };
}

function createMockWechatIdentity(code) {
  const digest = createHash("sha256").update(code).digest("hex").slice(0, 24);
  return {
    openid: `mock_${digest}`,
    unionid: null,
    mocked: true,
  };
}

async function upsertWechatUser(identity) {
  const now = new Date();
  const user = await prisma.user.upsert({
    where: { wechat_openid: identity.openid },
    update: {
      wechat_unionid: identity.unionid,
      last_login_at: now,
    },
    create: {
      wechat_openid: identity.openid,
      wechat_unionid: identity.unionid,
      last_login_at: now,
      roles: {
        create: {
          role: BASE_ROLE,
        },
      },
    },
    include: {
      roles: true,
      parent_profile: true,
    },
  });

  if (!user.roles.some((role) => role.role === BASE_ROLE && !role.revoked_at)) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        roles: {
          create: {
            role: BASE_ROLE,
          },
        },
      },
      include: {
        roles: true,
        parent_profile: true,
      },
    });
  }

  return user;
}

async function createSession({ userId, config, userAgent }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.auth.sessionTtlDays * 24 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      user_id: userId,
      token_hash: hashToken(token, config),
      user_agent: trimOptionalString(userAgent, 512),
      expires_at: expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

function hashToken(token, config) {
  return createHash("sha256").update(`${config.auth.tokenSecret}:${token}`).digest("hex");
}

export function toCurrentUserDto(user) {
  const roles = resolveActiveRoles(user);
  const currentRole = roles.find((role) => ROLE_ORDER.includes(role)) || BASE_ROLE;

  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    status: user.status,
    roles,
    currentRole,
    parentProfile: user.parent_profile
      ? {
          id: user.parent_profile.id,
          displayName: user.parent_profile.display_name,
          status: user.parent_profile.status,
          activatedAt: toIsoString(user.parent_profile.activated_at),
        }
      : null,
  };
}

function resolveActiveRoles(user) {
  const roles = new Set(
    user.roles.filter((role) => !role.revoked_at).map((role) => role.role).filter(Boolean),
  );
  roles.add(BASE_ROLE);

  if (user.parent_profile?.status === "active") {
    roles.add("parent");
  }

  return ROLE_ORDER.filter((role) => roles.has(role));
}

function trimOptionalString(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : null;
}
