import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "../db/prisma.mjs";
import { createSession, toCurrentUserDto } from "./auth-service.mjs";
import { badRequest, forbidden, serviceUnavailable, unauthorized } from "../utils/errors.mjs";

const ADMIN_ROLE = "admin";
const LOGIN_FIELDS = ["username", "password"];
const PASSWORD_HASH_ALGORITHM = "scrypt";
const PASSWORD_HASH_PARAMETERS = {
  N: 16_384,
  r: 8,
  p: 1,
  keyLength: 32,
};

export async function loginWithAdminPassword(input, config, userAgent) {
  assertPlainObject(input);
  assertNoUnknownFields(input, LOGIN_FIELDS);

  const username = requiredString(input.username, "username");
  const password = requiredString(input.password, "password");
  const expectedUsername = String(config.auth.adminUsername || "").trim();
  const passwordHash = resolveConfiguredPasswordHash(config);

  if (!expectedUsername || !passwordHash) {
    throw serviceUnavailable("Admin password login is not configured");
  }

  const usernameMatches = timingSafeStringEqual(username, expectedUsername);
  const passwordMatches = verifyAdminPassword(password, passwordHash);
  if (!usernameMatches || !passwordMatches) {
    throw unauthorized("Invalid admin credentials");
  }

  const user = await ensureConfiguredAdminUser(expectedUsername);
  if (user.status !== "active") {
    throw forbidden("Configured admin user is disabled");
  }
  const session = await createSession({
    userId: user.id,
    config,
    userAgent,
  });

  return {
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
    user: toCurrentUserDto(user),
    verificationMode: "admin-password",
  };
}

export function createAdminPasswordHash(password) {
  const trimmedPassword = typeof password === "string" ? password : "";
  if (!trimmedPassword) throw badRequest("password is required");

  const salt = randomBytes(16);
  const key = derivePasswordKey(trimmedPassword, salt);
  return [
    PASSWORD_HASH_ALGORITHM,
    String(PASSWORD_HASH_PARAMETERS.N),
    String(PASSWORD_HASH_PARAMETERS.r),
    String(PASSWORD_HASH_PARAMETERS.p),
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

function resolveConfiguredPasswordHash(config) {
  const configuredHash = String(config.auth.adminPasswordHash || "").trim();
  if (configuredHash) return configuredHash;

  const initialPassword = String(config.auth.adminInitialPassword || "");
  return initialPassword ? createDeterministicInitialPasswordHash(initialPassword, config) : "";
}

function createDeterministicInitialPasswordHash(password, config) {
  const salt = createHash("sha256")
    .update(`admin-initial-password:${config.auth.tokenSecret}:${config.auth.adminUsername}`)
    .digest()
    .subarray(0, 16);
  const key = derivePasswordKey(password, salt);
  return [
    PASSWORD_HASH_ALGORITHM,
    String(PASSWORD_HASH_PARAMETERS.N),
    String(PASSWORD_HASH_PARAMETERS.r),
    String(PASSWORD_HASH_PARAMETERS.p),
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

function verifyAdminPassword(password, passwordHash) {
  const parsed = parsePasswordHash(passwordHash);
  const derived = scryptSync(password, parsed.salt, parsed.key.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
  });
  return timingSafeEqual(derived, parsed.key);
}

function parsePasswordHash(passwordHash) {
  const parts = String(passwordHash || "").split("$");
  if (parts.length !== 6 || parts[0] !== PASSWORD_HASH_ALGORITHM) {
    throw serviceUnavailable("Admin password hash is invalid");
  }

  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  const salt = Buffer.from(rawSalt, "base64url");
  const key = Buffer.from(rawKey, "base64url");
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    throw serviceUnavailable("Admin password hash parameters are invalid");
  }
  if (N <= 1 || r <= 0 || p <= 0 || salt.length < 16 || key.length < 32) {
    throw serviceUnavailable("Admin password hash parameters are unsafe");
  }
  return { N, r, p, salt, key };
}

async function ensureConfiguredAdminUser(username) {
  const userId = getConfiguredAdminUserId(username);
  const now = new Date();
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {
      nickname: username,
      last_login_at: now,
    },
    create: {
      id: userId,
      nickname: username,
      last_login_at: now,
      roles: {
        create: {
          role: ADMIN_ROLE,
        },
      },
    },
    include: {
      roles: true,
      parent_profile: true,
    },
  });

  if (!user.roles.some((role) => role.role === ADMIN_ROLE && !role.revoked_at)) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        roles: {
          create: {
            role: ADMIN_ROLE,
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

function getConfiguredAdminUserId(username) {
  const digest = createHash("sha256").update(`admin-user:${username}`).digest("hex").slice(0, 32);
  return `admin-env-${digest}`;
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function derivePasswordKey(password, salt) {
  return scryptSync(password, salt, PASSWORD_HASH_PARAMETERS.keyLength, {
    N: PASSWORD_HASH_PARAMETERS.N,
    r: PASSWORD_HASH_PARAMETERS.r,
    p: PASSWORD_HASH_PARAMETERS.p,
  });
}

function assertPlainObject(value, label = "Request body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${label} must be a JSON object`);
  }
}

function assertNoUnknownFields(input, allowedFields) {
  const allowed = new Set(allowedFields);
  const unknownFields = Object.keys(input).filter((field) => !allowed.has(field));
  if (unknownFields.length > 0) {
    throw badRequest("Request body contains unsupported fields", {
      fields: unknownFields,
    });
  }
}

function requiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest(`${fieldName} is required`);
  }
  return value.trim();
}
