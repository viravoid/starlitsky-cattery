import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.mjs";
import { createSession, toCurrentUserDto } from "./auth-service.mjs";
import { createMiniProgramCode } from "./wechat-mini-program-code-service.mjs";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/errors.mjs";

const ADMIN_AUTH_PAGE = "pages/admin-auth/index";
const SCENE_PREFIX = "a=";
const STATUS_PENDING = "pending";
const STATUS_APPROVED = "approved";
const STATUS_CONSUMED = "consumed";
const STATUS_CANCELLED = "cancelled";
const SCENE_CREDENTIAL_BYTES = 16;
const POLL_CREDENTIAL_BYTES = 32;
const CREATE_FIELDS = [];
const RESOLVE_FIELDS = ["sceneCredential", "scene"];
const APPROVE_FIELDS = ["sceneCredential", "scene"];
const POLL_FIELDS = ["pollCredential"];
const ADMIN_ROLES = new Set(["keeper", "admin"]);

export async function createAdminLoginChallenge(input, config) {
  assertPlainObject(input);
  assertNoUnknownFields(input, CREATE_FIELDS);

  const sceneCredential = randomBytes(SCENE_CREDENTIAL_BYTES).toString("base64url");
  const pollCredential = randomBytes(POLL_CREDENTIAL_BYTES).toString("base64url");
  if (sceneCredential === pollCredential) throw badRequest("Could not create login challenge");

  const expiresAt = new Date(Date.now() + config.auth.adminLoginChallengeTtlMs);
  const challenge = await prisma.adminLoginChallenge.create({
    data: {
      scene_credential_hash: hashSceneCredential(sceneCredential, config),
      poll_credential_hash: hashPollCredential(pollCredential, config),
      expires_at: expiresAt,
    },
  });

  const qr = await createMiniProgramCode({
    scene: `${SCENE_PREFIX}${sceneCredential}`,
    page: ADMIN_AUTH_PAGE,
    config,
  });

  return {
    id: challenge.id,
    pollCredential,
    expiresAt: expiresAt.toISOString(),
    qr: toAdminQrDto(qr),
  };
}

export async function resolveAdminLoginChallenge(input, user, config) {
  assertPlainObject(input);
  assertNoUnknownFields(input, RESOLVE_FIELDS);
  assertAdminRole(user);

  const sceneCredential = normalizeSceneCredential(input);
  const now = new Date();
  const challenge = await prisma.adminLoginChallenge.findUnique({
    where: { scene_credential_hash: hashSceneCredential(sceneCredential, config) },
  });
  if (!challenge) throw notFound("Admin login challenge not found");

  const status = resolveStatus(challenge, now);
  if (status === STATUS_PENDING) {
    await prisma.adminLoginChallenge.updateMany({
      where: { id: challenge.id, status: STATUS_PENDING, scanned_at: null },
      data: { scanned_at: now },
    });
  }

  return toResolvedChallengeDto({ ...challenge, scanned_at: challenge.scanned_at || now }, status);
}

export async function approveAdminLoginChallenge(challengeId, input, user, config) {
  assertPlainObject(input);
  assertNoUnknownFields(input, APPROVE_FIELDS);
  assertAdminRole(user);

  const sceneCredential = normalizeSceneCredential(input);
  const now = new Date();
  const sceneCredentialHash = hashSceneCredential(sceneCredential, config);

  const challenge = await prisma.adminLoginChallenge.findUnique({
    where: { id: challengeId },
  });
  if (!challenge) throw notFound("Admin login challenge not found");

  if (challenge.scene_credential_hash !== sceneCredentialHash) {
    throw unauthorized("Invalid admin login challenge credential");
  }

  const status = resolveStatus(challenge, now);
  if (status === STATUS_APPROVED && challenge.approved_by_user_id === user.id) {
    return toResolvedChallengeDto(challenge, STATUS_APPROVED);
  }
  if (status !== STATUS_PENDING) {
    throw badRequest(`Admin login challenge is ${status}`);
  }

  const result = await prisma.adminLoginChallenge.updateMany({
    where: {
      id: challengeId,
      scene_credential_hash: sceneCredentialHash,
      status: STATUS_PENDING,
      expires_at: { gt: now },
      consumed_at: null,
      cancelled_at: null,
    },
    data: {
      status: STATUS_APPROVED,
      approved_by_user_id: user.id,
      approved_at: now,
      scanned_at: challenge.scanned_at || now,
    },
  });
  if (result.count !== 1) throw badRequest("Admin login challenge cannot be approved");

  const approved = await prisma.adminLoginChallenge.findUnique({ where: { id: challengeId } });
  return toResolvedChallengeDto(approved, STATUS_APPROVED);
}

export async function pollAdminLoginChallenge(challengeId, input, config, userAgent) {
  assertPlainObject(input);
  assertNoUnknownFields(input, POLL_FIELDS);

  const pollCredential = requiredString(input.pollCredential, "pollCredential");
  const now = new Date();
  const pollCredentialHash = hashPollCredential(pollCredential, config);
  const challenge = await prisma.adminLoginChallenge.findUnique({
    where: { id: challengeId },
  });
  if (!challenge) throw notFound("Admin login challenge not found");
  if (challenge.poll_credential_hash !== pollCredentialHash) {
    throw unauthorized("Invalid admin login challenge credential");
  }

  const status = resolveStatus(challenge, now);
  if (status === STATUS_PENDING) {
    return {
      status,
      expiresAt: challenge.expires_at.toISOString(),
    };
  }
  if (status === STATUS_CONSUMED) {
    return {
      status,
      expiresAt: challenge.expires_at.toISOString(),
    };
  }
  if (status !== STATUS_APPROVED) {
    throw badRequest(`Admin login challenge is ${status}`);
  }

  return prisma.$transaction(async (transaction) => {
    const claim = await transaction.adminLoginChallenge.findUnique({
      where: { id: challengeId },
      include: {
        approved_by: {
          include: {
            roles: true,
            parent_profile: true,
          },
        },
      },
    });
    if (!claim || claim.poll_credential_hash !== pollCredentialHash) {
      throw unauthorized("Invalid admin login challenge credential");
    }
    if (resolveStatus(claim, now) !== STATUS_APPROVED || !claim.approved_by) {
      throw badRequest(`Admin login challenge is ${resolveStatus(claim, now)}`);
    }
    if (claim.approved_by.status !== "active" || !hasAdminRole(toCurrentUserDto(claim.approved_by))) {
      throw forbidden("Approver no longer has admin access");
    }

    const result = await transaction.adminLoginChallenge.updateMany({
      where: {
        id: challengeId,
        poll_credential_hash: pollCredentialHash,
        status: STATUS_APPROVED,
        expires_at: { gt: now },
        consumed_at: null,
        cancelled_at: null,
      },
      data: {
        status: STATUS_CONSUMED,
        consumed_at: now,
      },
    });
    if (result.count !== 1) {
      return {
        status: STATUS_CONSUMED,
        expiresAt: claim.expires_at.toISOString(),
      };
    }

    const session = await createSession({
      userId: claim.approved_by.id,
      config,
      userAgent,
      client: transaction,
      cleanup: false,
    });

    return {
      status: STATUS_APPROVED,
      expiresAt: claim.expires_at.toISOString(),
      token: session.token,
      sessionExpiresAt: session.expiresAt.toISOString(),
      user: toCurrentUserDto(claim.approved_by),
    };
  });
}

export function parseAdminLoginSceneCredential(scene) {
  const trimmed = typeof scene === "string" ? decodeURIComponent(scene).trim() : "";
  if (!trimmed) return "";
  if (trimmed.startsWith(SCENE_PREFIX)) return trimmed.slice(SCENE_PREFIX.length);
  return "";
}

export function hashAdminLoginSceneCredentialForVerify(credential, config) {
  return hashSceneCredential(credential, config);
}

export function hashAdminLoginPollCredentialForVerify(credential, config) {
  return hashPollCredential(credential, config);
}

function normalizeSceneCredential(input) {
  if (typeof input.sceneCredential === "string") {
    return requiredString(input.sceneCredential, "sceneCredential");
  }

  const credential = parseAdminLoginSceneCredential(input.scene);
  if (!credential) throw badRequest("Admin login scene credential is required");
  return credential;
}

function toAdminQrDto(qr) {
  return {
    provider: qr.provider,
    status: qr.status,
    page: qr.page,
    imageDataUrl: qr.imageDataUrl,
    message: qr.message,
  };
}

function toResolvedChallengeDto(challenge, status) {
  return {
    id: challenge.id,
    requestedAt: challenge.created_at.toISOString(),
    expiresAt: challenge.expires_at.toISOString(),
    status,
  };
}

function resolveStatus(challenge, now) {
  if (challenge.cancelled_at || challenge.status === STATUS_CANCELLED) return STATUS_CANCELLED;
  if (challenge.consumed_at || challenge.status === STATUS_CONSUMED) return STATUS_CONSUMED;
  if (challenge.expires_at <= now) return "expired";
  if (challenge.status === STATUS_APPROVED) return STATUS_APPROVED;
  return STATUS_PENDING;
}

function assertAdminRole(user) {
  if (!hasAdminRole(user)) throw forbidden("Only keeper or admin can approve admin login");
}

function hasAdminRole(user) {
  return Array.isArray(user?.roles) && user.roles.some((role) => ADMIN_ROLES.has(role));
}

function hashSceneCredential(credential, config) {
  return createHash("sha256")
    .update(`admin-login-scene:${config.auth.tokenSecret}:${credential}`)
    .digest("hex");
}

function hashPollCredential(credential, config) {
  return createHash("sha256")
    .update(`admin-login-poll:${config.auth.tokenSecret}:${credential}`)
    .digest("hex");
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
