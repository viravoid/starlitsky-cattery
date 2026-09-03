import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL ??= "file:admin-auth-verify.db";
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { routeRequest } = await import("../routes/index.mjs");

const RUN_PREFIX = "verify-admin-auth";
const config = {
  auth: {
    tokenSecret: "admin-auth-verify-secret",
    sessionTtlDays: 7,
    adminLoginChallengeTtlMs: 4 * 60 * 1000,
    adminLoginChallengeCreateRateLimit: { windowMs: 60_000, max: 100, maxBuckets: 1000 },
    adminLoginChallengePollRateLimit: { windowMs: 60_000, max: 100, maxBuckets: 1000 },
  },
  server: {
    host: "127.0.0.1",
    port: 0,
  },
  wechat: {
    appId: "",
    appSecret: "",
    mockLoginEnabled: true,
    mockQrEnabled: true,
    qrEnvVersion: "trial",
    qrCheckPath: true,
  },
};

await cleanup();

try {
  const ordinaryUser = await createUser({ id: `${RUN_PREFIX}-user`, roles: ["user"] });
  const parent = await createUser({ id: `${RUN_PREFIX}-parent`, roles: ["parent"] });
  const keeper = await createUser({ id: `${RUN_PREFIX}-keeper`, roles: ["keeper"] });
  const admin = await createUser({ id: `${RUN_PREFIX}-admin`, roles: ["admin"] });

  const pending = await createChallenge();
  assert.notEqual(pending.sceneCredential, pending.challenge.pollCredential);
  const pendingRecord = await prisma.adminLoginChallenge.findUnique({ where: { id: pending.challenge.id } });
  assert.ok(pendingRecord, "challenge should be stored");
  assert.equal(
    Object.values(pendingRecord).some((value) => value === pending.sceneCredential || value === pending.challenge.pollCredential),
    false,
    "DB must not store plaintext credentials",
  );
  assert.notEqual(pendingRecord.scene_credential_hash, pendingRecord.poll_credential_hash);

  await assertRouteRejects(
    "challenge id alone cannot poll",
    `/admin-auth/challenges/${pending.challenge.id}/poll`,
    null,
    400,
    "POST",
    {},
  );
  await assertRouteRejects(
    "wrong poll credential blocked",
    `/admin-auth/challenges/${pending.challenge.id}/poll`,
    null,
    401,
    "POST",
    { pollCredential: "wrong" },
  );
  await assertRouteRejects(
    "scene credential cannot browser poll",
    `/admin-auth/challenges/${pending.challenge.id}/poll`,
    null,
    401,
    "POST",
    { pollCredential: pending.sceneCredential },
  );
  const pendingPoll = await routeJson(`/admin-auth/challenges/${pending.challenge.id}/poll`, null, "POST", {
    pollCredential: pending.challenge.pollCredential,
  });
  assert.equal(pendingPoll.status, "pending");
  assert.equal("token" in pendingPoll, false);

  await assertRouteRejects(
    "wrong scene blocked",
    "/admin-auth/challenges/resolve",
    keeper,
    404,
    "POST",
    { sceneCredential: "wrong" },
  );

  await assertRoleCannotApprove(ordinaryUser, "ordinary user approve -> 403");
  await assertRoleCannotApprove(parent, "parent approve -> 403");
  await assertRoleCanApprove(keeper, "keeper approve -> PASS");
  await assertRoleCanApprove(admin, "admin approve -> PASS");

  const consume = await createChallenge();
  await approve(consume, keeper);
  const consumed = await routeJson(`/admin-auth/challenges/${consume.challenge.id}/poll`, null, "POST", {
    pollCredential: consume.challenge.pollCredential,
  });
  assert.equal(consumed.status, "approved");
  assert.ok(consumed.token, "approved poll should issue a session");
  assert.equal(consumed.user.id, keeper.id);

  const me = await routeJson("/auth/me", null, "GET", undefined, consumed.token);
  assert.equal(me.user.id, keeper.id, "/auth/me should resolve approved user");

  const secondConsume = await routeJson(`/admin-auth/challenges/${consume.challenge.id}/poll`, null, "POST", {
    pollCredential: consume.challenge.pollCredential,
  });
  assert.equal(secondConsume.status, "consumed");
  assert.equal("token" in secondConsume, false);

  await assertRouteRejects(
    "poll credential cannot miniapp approve",
    `/admin-auth/challenges/${consume.challenge.id}/approve`,
    keeper,
    401,
    "POST",
    { sceneCredential: consume.challenge.pollCredential },
  );

  const concurrent = await createChallenge();
  await approve(concurrent, admin);
  const doublePoll = await Promise.allSettled([
    routeJson(`/admin-auth/challenges/${concurrent.challenge.id}/poll`, null, "POST", {
      pollCredential: concurrent.challenge.pollCredential,
    }),
    routeJson(`/admin-auth/challenges/${concurrent.challenge.id}/poll`, null, "POST", {
      pollCredential: concurrent.challenge.pollCredential,
    }),
  ]);
  const successfulTokens = doublePoll
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((value) => value.token);
  assert.equal(successfulTokens.length, 1, "concurrent double poll should issue one token");

  const revoked = await createChallenge();
  await approve(revoked, keeper);
  await prisma.userRole.updateMany({
    where: { user_id: keeper.id, role: "keeper", revoked_at: null },
    data: { revoked_at: new Date() },
  });
  await assertRouteRejects(
    "approve then revoke role blocks consume",
    `/admin-auth/challenges/${revoked.challenge.id}/poll`,
    null,
    403,
    "POST",
    { pollCredential: revoked.challenge.pollCredential },
  );

  const expired = await createChallenge();
  await prisma.adminLoginChallenge.update({
    where: { id: expired.challenge.id },
    data: { expires_at: new Date(Date.now() - 1000) },
  });
  await assertRouteRejects(
    "expired blocked",
    `/admin-auth/challenges/${expired.challenge.id}/approve`,
    admin,
    400,
    "POST",
    { sceneCredential: expired.sceneCredential },
  );
  await assertRouteRejects(
    "expired reuse blocked",
    `/admin-auth/challenges/${expired.challenge.id}/poll`,
    null,
    400,
    "POST",
    { pollCredential: expired.challenge.pollCredential },
  );

  console.log("Admin auth verification passed");
} finally {
  await cleanup();
  await prisma.$disconnect();
}

async function assertRoleCannotApprove(user, label) {
  const challenge = await createChallenge();
  await assertRouteRejects(
    label,
    `/admin-auth/challenges/${challenge.challenge.id}/approve`,
    user,
    403,
    "POST",
    { sceneCredential: challenge.sceneCredential },
  );
}

async function assertRoleCanApprove(user, label) {
  const challenge = await createChallenge();
  const approved = await approve(challenge, user);
  assert.equal(approved.status, "approved", label);
}

async function createChallenge() {
  const challenge = await routeJson("/admin-auth/challenges", null, "POST", {});
  return {
    challenge,
    sceneCredential: extractSceneCredentialFromMockQr(challenge.qr.imageDataUrl),
  };
}

async function approve(challenge, user) {
  return routeJson(
    `/admin-auth/challenges/${challenge.challenge.id}/approve`,
    user,
    "POST",
    { sceneCredential: challenge.sceneCredential },
  );
}

function extractSceneCredentialFromMockQr(imageDataUrl) {
  assert.ok(imageDataUrl?.startsWith("data:image/svg+xml;base64,"), "verify uses dev mock QR");
  const svg = Buffer.from(imageDataUrl.split(",", 2)[1], "base64").toString("utf8");
  const match = svg.match(/a=([A-Za-z0-9_-]+)/);
  assert.ok(match, "mock QR should include admin scene credential");
  return match[1];
}

async function createUser({ id, roles }) {
  return prisma.user.create({
    data: {
      id,
      nickname: id,
      status: "active",
      roles: {
        create: roles.map((role) => ({ role })),
      },
    },
    include: { roles: true, parent_profile: true },
  });
}

async function routeJson(url, actingUser, method, body = undefined, token = "") {
  const response = createJsonResponse();
  const sessionToken = token || (actingUser ? await createSessionToken(actingUser) : "");
  await routeRequest(createRequest({ body, method, url, token: sessionToken }), response, { config });
  return response.data.data;
}

async function assertRouteRejects(label, url, actingUser, statusCode, method = "GET", body = undefined) {
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await assert.rejects(
    () => routeRequest(createRequest({ body, method, url, token }), createResponse(), { config }),
    (error) => error?.statusCode === statusCode,
    label,
  );
}

function createRequest({ body = undefined, method, url, token = "" }) {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  request.method = method;
  request.url = url;
  request.headers = {
    host: "127.0.0.1",
    "user-agent": "admin-auth-verify",
  };
  request.socket = { remoteAddress: "127.0.0.1" };
  if (token) request.headers.authorization = `Bearer ${token}`;
  return request;
}

async function createSessionToken(actingUser) {
  const token = `token-${actingUser.id}-${Math.random().toString(36).slice(2)}`;
  await prisma.userSession.create({
    data: {
      user_id: actingUser.id,
      token_hash: createHash("sha256").update(`${config.auth.tokenSecret}:${token}`).digest("hex"),
      expires_at: new Date(Date.now() + 60_000),
    },
  });
  return token;
}

function createResponse() {
  return {
    setHeader() {},
    writeHead() {},
    end() {},
  };
}

function createJsonResponse() {
  return {
    data: null,
    setHeader() {},
    writeHead() {},
    end(payload) {
      this.data = JSON.parse(payload);
    },
  };
}

async function cleanup() {
  await prisma.adminLoginChallenge.deleteMany();
  await prisma.userSession.deleteMany({ where: { user_id: { startsWith: RUN_PREFIX } } });
  await prisma.userRole.deleteMany({ where: { user_id: { startsWith: RUN_PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
}

async function ensureLocalSqliteSchema(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) return;

  const { DatabaseSync } = await import("node:sqlite");
  const sqlitePath = resolveSqlitePath(databaseUrl.slice("file:".length));
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const database = new DatabaseSync(sqlitePath);
  try {
    const hasUsersTable = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get();
    if (hasUsersTable) return;

    const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma/migrations");
    for (const folder of readdirSync(migrationsDir).sort()) {
      const migrationPath = resolve(migrationsDir, folder, "migration.sql");
      if (existsSync(migrationPath)) {
        database.exec(readFileSync(migrationPath, "utf8"));
      }
    }
  } finally {
    database.close();
  }
}

function resolveSqlitePath(rawPath) {
  const normalized = rawPath.trim().replace(/^"|"$/g, "");
  if (isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) return normalized;

  const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma");
  return resolve(prismaDir, normalized);
}
