import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:selection-application-verify.db";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { routeRequest } = await import("../routes/index.mjs");

const RUN_PREFIX = "verify-selection-application";
const config = {
  auth: {
    tokenSecret: "selection-application-verify-secret",
    sessionTtlDays: 7,
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
  const user = await createUser({ id: `${RUN_PREFIX}-user`, roles: ["user"] });
  const ordinaryUser = await createUser({ id: `${RUN_PREFIX}-ordinary`, roles: ["user"] });
  const admin = await createUser({ id: `${RUN_PREFIX}-keeper`, roles: ["keeper"] });

  await assertRouteRejects(
    "missing required questionnaire fields should fail",
    "/selection-applications",
    null,
    400,
    "POST",
    { name: "Missing Fields" },
  );
  await assertRouteRejects(
    "invalid questionnaire phone should fail",
    "/selection-applications",
    null,
    400,
    "POST",
    buildApplicationPayload({ phone: "not-a-phone" }),
  );
  await assertRouteRejects(
    "unknown questionnaire fields should fail",
    "/selection-applications",
    null,
    400,
    "POST",
    { ...buildApplicationPayload(), unsupportedField: true },
  );

  const anonymousApplication = await routeJson("/selection-applications", null, "POST", buildApplicationPayload());
  assert.equal(anonymousApplication.status, "submitted", "anonymous questionnaire submit should persist");
  assert.equal(anonymousApplication.userId, null, "anonymous questionnaire should not invent ownership");

  const dedupPayload = buildApplicationPayload({
    clientDedupKey: `${RUN_PREFIX}-dedup-key`,
    name: "Dedup Submitter",
  });
  const firstDedup = await routeJson("/selection-applications", user, "POST", dedupPayload);
  const secondDedup = await routeJson("/selection-applications", user, "POST", dedupPayload);
  assert.equal(secondDedup.id, firstDedup.id, "client dedup key should make repeated submits idempotent");
  assert.equal(firstDedup.userId, user.id, "authenticated questionnaire should attach the user id");

  const mine = await routeJson("/selection-applications/me", user, "GET");
  assert.equal(mine.id, firstDedup.id, "user should read their latest questionnaire");
  await assertRouteRejects(
    "other user without questionnaire should not read mine",
    "/selection-applications/me",
    ordinaryUser,
    404,
  );

  await assertRouteRejects("guest cannot list questionnaire admin data", "/selection-applications", null, 401);
  await assertRouteRejects("ordinary user cannot list questionnaire admin data", "/selection-applications", user, 403);

  const adminList = await routeJson("/selection-applications?pageSize=100", admin, "GET");
  assert.equal(
    adminList.items.some((item) => item.id === anonymousApplication.id),
    true,
    "keeper should read submitted questionnaires",
  );

  await assertRouteRejects(
    "ordinary user cannot read questionnaire detail by id",
    `/selection-applications/${anonymousApplication.id}`,
    user,
    403,
  );
  const adminDetail = await routeJson(`/selection-applications/${anonymousApplication.id}`, admin, "GET");
  assert.equal(adminDetail.id, anonymousApplication.id, "keeper should read questionnaire detail");

  await assertRouteRejects(
    "ordinary user cannot review questionnaire",
    `/selection-applications/${anonymousApplication.id}`,
    user,
    403,
    "PATCH",
    { status: "reviewed", adminNote: "blocked" },
  );
  const reviewed = await routeJson(`/selection-applications/${anonymousApplication.id}`, admin, "PATCH", {
    status: "reviewed",
    adminNote: "reviewed in verifier",
  });
  assert.equal(reviewed.status, "reviewed", "keeper should update questionnaire review status");
  assert.equal(reviewed.adminNote, "reviewed in verifier", "keeper should persist questionnaire admin note");
  assert.equal(reviewed.reviewedBy?.id, admin.id, "keeper review should attach reviewer");

  await assertRouteRejects(
    "invalid review status should fail",
    `/selection-applications/${anonymousApplication.id}`,
    admin,
    400,
    "PATCH",
    { status: "invalid" },
  );

  console.info("selection application verification passed");
} finally {
  await cleanup();
  await prisma.$disconnect();
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

function buildApplicationPayload(overrides = {}) {
  return {
    clientDedupKey: `${RUN_PREFIX}-${Math.random().toString(36).slice(2)}`,
    name: "Questionnaire Submitter",
    gender: "female",
    phone: "13800000000",
    age: "30",
    job: "designer",
    city: "Shanghai",
    experience: "experienced",
    residents: "yes",
    residentsNeutered: "yes",
    hasKids: "no",
    housing: "owned",
    windowSealed: "yes",
    familyAgree: "yes",
    maineCoonKnowledge: "prepared",
    wantGender: "any",
    wantColor: "any",
    budget: "ready",
    acceptNeuter: "yes",
    monthlySpend: "ready",
    scientificFeeding: "yes",
    acceptActive: "yes",
    commitment: "yes",
    additionalNote: "created by verifier",
    ...overrides,
  };
}

async function routeJson(url, actingUser, method, body = undefined) {
  const response = createJsonResponse();
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await routeRequest(createRequest({ body, method, url, token }), response, { config });
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
  };
  if (token) {
    request.headers.authorization = `Bearer ${token}`;
  }
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
  await prisma.selectionApplication.deleteMany({
    where: {
      OR: [{ contact_name: { startsWith: "Questionnaire" } }, { client_dedup_key: { startsWith: RUN_PREFIX } }],
    },
  });
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

function rmLocalSqlite(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) return;
  const sqlitePath = resolveSqlitePath(databaseUrl.slice("file:".length));
  rmSync(sqlitePath, { force: true });
  rmSync(`${sqlitePath}-journal`, { force: true });
  rmSync(`${sqlitePath}-wal`, { force: true });
  rmSync(`${sqlitePath}-shm`, { force: true });
}

function resolveSqlitePath(rawPath) {
  const normalized = rawPath.trim().replace(/^"|"$/g, "");
  if (isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) return normalized;

  const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma");
  return resolve(prismaDir, normalized);
}
