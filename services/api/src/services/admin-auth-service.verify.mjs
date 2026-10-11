import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL ??= "file:admin-auth-verify.db";
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { resetRateLimitBuckets } = await import("../middleware/rate-limit.mjs");
const { prisma } = await import("../db/prisma.mjs");
const { routeRequest } = await import("../routes/index.mjs");
const { createAdminPasswordHash } = await import("./admin-auth-service.mjs");

const RUN_PREFIX = "verify-admin-auth";
const ADMIN_USERNAME = `${RUN_PREFIX}-admin`;
const ADMIN_PASSWORD = "correct horse battery staple";
const config = {
  auth: {
    tokenSecret: "admin-auth-verify-secret",
    sessionTtlDays: 7,
    adminUsername: ADMIN_USERNAME,
    adminPasswordHash: createAdminPasswordHash(ADMIN_PASSWORD),
    adminInitialPassword: "",
    adminLoginRateLimit: { windowMs: 60_000, max: 100, maxBuckets: 1000 },
  },
  server: {
    host: "127.0.0.1",
    port: 0,
  },
};

await cleanup();
resetRateLimitBuckets();

try {
  await assertRouteRejects(
    "unsupported challenge creation route is disabled",
    "/admin-auth/challenges",
    404,
    "POST",
    {},
  );
  await assertRouteRejects(
    "login requires a request body",
    "/admin-auth/login",
    400,
    "POST",
    undefined,
  );
  await assertRouteRejects(
    "login rejects unknown fields",
    "/admin-auth/login",
    400,
    "POST",
    { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, qrCredential: "nope" },
  );
  await assertRouteRejects(
    "wrong username is blocked",
    "/admin-auth/login",
    401,
    "POST",
    { username: "wrong", password: ADMIN_PASSWORD },
  );
  await assertRouteRejects(
    "wrong password is blocked",
    "/admin-auth/login",
    401,
    "POST",
    { username: ADMIN_USERNAME, password: "wrong" },
  );

  assert.equal(await prisma.user.count({ where: { nickname: ADMIN_USERNAME } }), 0);

  const authenticated = await routeJson("/admin-auth/login", "POST", {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  assert.ok(authenticated.token, "password login should issue a normal session token");
  assert.equal(authenticated.verificationMode, "admin-password");
  assert.equal(authenticated.user.nickname, ADMIN_USERNAME);
  assert.equal(authenticated.user.roles.includes("admin"), true);
  assert.equal(authenticated.user.roles.includes("keeper"), false);

  const userRecord = await prisma.user.findUnique({
    where: { id: authenticated.user.id },
    include: { roles: true },
  });
  assert.ok(userRecord, "admin user should be persisted for existing session auth");
  assert.equal(
    Object.values(userRecord).some((value) => value === ADMIN_PASSWORD),
    false,
    "users table must not store plaintext admin password",
  );
  assert.equal(
    userRecord.roles.some((role) => role.role === "admin" && !role.revoked_at),
    true,
    "configured admin user should have admin role",
  );

  const sessionRecord = await prisma.userSession.findFirst({
    where: { user_id: authenticated.user.id },
  });
  assert.ok(sessionRecord, "login should store a UserSession");
  assert.notEqual(sessionRecord.token_hash, authenticated.token, "session token must be hashed");

  const me = await routeJson("/auth/me", "GET", undefined, authenticated.token);
  assert.equal(me.user.id, authenticated.user.id, "/auth/me should resolve password login session");

  const secondLogin = await routeJson("/admin-auth/login", "POST", {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  });
  assert.equal(secondLogin.user.id, authenticated.user.id, "configured admin login should reuse one user");
  assert.equal(await prisma.user.count({ where: { nickname: ADMIN_USERNAME } }), 1);

  const initialPasswordConfig = {
    ...config,
    auth: {
      ...config.auth,
      adminPasswordHash: "",
      adminInitialPassword: ADMIN_PASSWORD,
    },
  };
  const initialPasswordLogin = await routeJson(
    "/admin-auth/login",
    "POST",
    { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    "",
    initialPasswordConfig,
  );
  assert.ok(initialPasswordLogin.token, "initial password env fallback should authenticate");

  resetRateLimitBuckets();
  const rateLimitedConfig = {
    ...config,
    auth: {
      ...config.auth,
      adminLoginRateLimit: { windowMs: 60_000, max: 2, maxBuckets: 1000 },
    },
  };
  await assertRouteRejects(
    "first bad attempt still uses credential validation",
    "/admin-auth/login",
    401,
    "POST",
    { username: ADMIN_USERNAME, password: "bad-1" },
    "",
    rateLimitedConfig,
  );
  await assertRouteRejects(
    "second bad attempt still uses credential validation",
    "/admin-auth/login",
    401,
    "POST",
    { username: ADMIN_USERNAME, password: "bad-2" },
    "",
    rateLimitedConfig,
  );
  await assertRouteRejects(
    "admin login rate limit blocks repeated attempts",
    "/admin-auth/login",
    429,
    "POST",
    { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    "",
    rateLimitedConfig,
  );

  resetRateLimitBuckets();
  const disabledConfig = {
    ...config,
    auth: {
      ...config.auth,
      adminPasswordHash: "",
      adminInitialPassword: "",
    },
  };
  await assertRouteRejects(
    "unconfigured password login is unavailable",
    "/admin-auth/login",
    503,
    "POST",
    { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    "",
    disabledConfig,
  );

  console.log("Admin auth verification passed");
} finally {
  await cleanup();
  await prisma.$disconnect();
}

async function routeJson(url, method, body = undefined, token = "", routeConfig = config) {
  const response = createJsonResponse();
  await routeRequest(createRequest({ body, method, url, token }), response, { config: routeConfig });
  return response.data.data;
}

async function assertRouteRejects(
  label,
  url,
  statusCode,
  method = "GET",
  body = undefined,
  token = "",
  routeConfig = config,
) {
  await assert.rejects(
    () => routeRequest(createRequest({ body, method, url, token }), createResponse(), { config: routeConfig }),
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
  await prisma.userSession.deleteMany({ where: { user_id: { startsWith: "admin-env-" } } });
  await prisma.userRole.deleteMany({ where: { user_id: { startsWith: "admin-env-" } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "admin-env-" } } });
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
