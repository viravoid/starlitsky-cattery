import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:parent-application-verify.db";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { routeRequest } = await import("../routes/index.mjs");
const { approveParentApplication, rejectParentApplication, submitParentApplication } =
  await import("./parent-application-service.mjs");
const { certifyExistingUserAsParent } = await import("./admin-user-service.mjs");
const { verifyParentPhoneCode } = await import("./parent-phone-verification-service.mjs");

const config = {
  auth: {
    tokenSecret: "parent-flow-verify-secret",
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

const admin = await createUserWithRole("verify-admin", "keeper");
const user = await createUserWithRole("verify-user", "user");
const secondUser = await createUserWithRole("verify-user-2", "user");
const rejectedUser = await createUserWithRole("verify-user-3", "user");
const existingWechatUser = await createUserWithRole("verify-wechat-user", "user", {
  wechat_openid: "verify-openid-manual-parent",
});
const cat = await prisma.cat.create({
  data: {
    name: "Verify Existing Cat",
    lifecycle_status: "adopted",
    visibility: "visible",
  },
});
const hiddenCat = await prisma.cat.create({
  data: {
    name: "Verify Hidden Parent Cat",
    gender: "female",
    color: "hidden smoke",
    lifecycle_status: "adopted",
    visibility: "hidden",
  },
});
const secondHiddenCat = await prisma.cat.create({
  data: {
    name: "Verify Second Hidden Parent Cat",
    gender: "male",
    color: "hidden silver",
    lifecycle_status: "adopted",
    visibility: "hidden",
  },
});

const userCountBeforeManualParent = await prisma.user.count();
const manuallyCertified = await certifyExistingUserAsParent(
  {
    userId: existingWechatUser.id,
    displayName: "Manual Existing Parent",
    realName: "Manual Real Name",
    contactPhone: "13900000000",
    contactWechat: "manual-wechat",
    city: "Shanghai",
    note: "manual profile note",
    catLinks: [
      {
        catId: hiddenCat.id,
        relationship: "owner",
        startedAt: "2024-01-01",
        note: "manual verify link",
      },
    ],
  },
  admin,
);
assert.equal(
  manuallyCertified.id,
  existingWechatUser.id,
  "manual certification must reuse users.id",
);
assert.equal(
  await prisma.user.count(),
  userCountBeforeManualParent,
  "manual certification must not create a second User",
);
assert.equal(
  await prisma.user.count({
    where: { wechat_openid: "verify-openid-manual-parent" },
  }),
  1,
  "manual certification must not duplicate the WeChat account",
);
assert.equal(
  await prisma.userRole.count({
    where: { user_id: existingWechatUser.id, role: "parent", revoked_at: null },
  }),
  1,
  "manual certification should grant one active parent role",
);
const manualParentProfile = await prisma.parentProfile.findUnique({
  where: { user_id: existingWechatUser.id },
});
assert.equal(manualParentProfile?.status, "active", "manual certification should activate profile");
assert.equal(
  await prisma.parentCatLink.count({
    where: {
      parent_profile_id: manualParentProfile.id,
      cat_id: hiddenCat.id,
      relationship: "owner",
      status: "active",
      deleted_at: null,
    },
  }),
  1,
  "manual certification should create an active cat link",
);
const adminUsers = await routeGet("/admin/users?q=Manual&pageSize=10", admin);
assert.equal(
  adminUsers.items.some((item) => item.id === existingWechatUser.id && item.wechatBound),
  true,
  "admin user list should expose existing WeChat parent state",
);
const manualMyCats = await routeGet("/me/cats", existingWechatUser);
assert.equal(
  manualMyCats.items.some((item) => item.id === hiddenCat.id),
  true,
  "/me/cats should return cats bound to the same users.id",
);
const manualPostOptions = await routeGet("/community/post-options", existingWechatUser);
assert.deepEqual(
  manualPostOptions.categories,
  ["parent_share", "personal_thoughts"],
  "manually certified parent should receive parent community categories",
);
assert.equal(
  manualPostOptions.cats.some((item) => item.id === hiddenCat.id),
  true,
  "community post options should include the manually linked cat",
);
const manualProfileBeforeRepeat = await prisma.parentProfile.findUnique({
  where: { user_id: existingWechatUser.id },
});
await certifyExistingUserAsParent(
  {
    userId: existingWechatUser.id,
    catLinks: [{ catId: secondHiddenCat.id, relationship: "co_owner" }],
  },
  admin,
);
const manualProfileAfterRepeat = await prisma.parentProfile.findUnique({
  where: { user_id: existingWechatUser.id },
});
assert.deepEqual(
  pickParentProfileEditableFields(manualProfileAfterRepeat),
  pickParentProfileEditableFields(manualProfileBeforeRepeat),
  "repeat manual certification without profile fields must preserve existing ParentProfile fields",
);
assert.equal(
  manualProfileAfterRepeat?.activated_at?.toISOString(),
  manualProfileBeforeRepeat?.activated_at?.toISOString(),
  "repeat manual certification for an active profile must not reset activated_at",
);
assert.equal(
  await prisma.parentCatLink.count({
    where: {
      parent_profile_id: manualParentProfile.id,
      cat_id: secondHiddenCat.id,
      relationship: "co_owner",
      status: "active",
      deleted_at: null,
    },
  }),
  1,
  "repeat manual certification should still bind newly provided cats",
);
await assertRejects("duplicate active link should be blocked", () =>
  certifyExistingUserAsParent(
    {
      userId: existingWechatUser.id,
      displayName: "Manual Existing Parent",
      catLinks: [{ catId: hiddenCat.id, relationship: "owner" }],
    },
    admin,
  ),
);
await certifyExistingUserAsParent(
  {
    userId: existingWechatUser.id,
    displayName: "Manual Existing Parent Again",
  },
  admin,
);
assert.equal(
  await prisma.userRole.count({
    where: { user_id: existingWechatUser.id, role: "parent", revoked_at: null },
  }),
  1,
  "manual certification role grant should be idempotent",
);
const manualLink = await prisma.parentCatLink.findFirst({
  where: {
    parent_profile_id: manualParentProfile.id,
    cat_id: hiddenCat.id,
    relationship: "owner",
    deleted_at: null,
  },
});
const linkCountBeforeInvalidCreate = await prisma.parentCatLink.count();
await assertRouteJsonRejects(
  "invalid create relationship should fail",
  `/cats/${hiddenCat.id}/parent-links`,
  admin,
  "POST",
  {
    parentProfileId: manualParentProfile.id,
    relationship: "friend",
  },
  400,
);
await assertRouteJsonRejects(
  "invalid create status should fail",
  `/cats/${hiddenCat.id}/parent-links`,
  admin,
  "POST",
  {
    parentProfileId: manualParentProfile.id,
    relationship: "caregiver",
    status: "paused",
  },
  400,
);
assert.equal(
  await prisma.parentCatLink.count(),
  linkCountBeforeInvalidCreate,
  "invalid ParentCatLink create requests must not write rows",
);
await assertRouteJsonRejects(
  "invalid patch relationship should fail",
  `/parent-cat-links/${manualLink.id}`,
  admin,
  "PATCH",
  { relationship: "friend" },
  400,
);
await assertRouteJsonRejects(
  "invalid patch status should fail",
  `/parent-cat-links/${manualLink.id}`,
  admin,
  "PATCH",
  { status: "paused" },
  400,
);
const manualLinkAfterInvalidPatch = await prisma.parentCatLink.findUnique({
  where: { id: manualLink.id },
});
assert.equal(
  manualLinkAfterInvalidPatch.relationship,
  "owner",
  "invalid relationship PATCH must not mutate the link",
);
assert.equal(
  manualLinkAfterInvalidPatch.status,
  "active",
  "invalid status PATCH must not mutate the link",
);
const updatedManualLink = await routeJson(`/parent-cat-links/${manualLink.id}`, admin, "PATCH", {
  relationship: "caregiver",
  status: "ended",
  endedAt: "2024-06-01",
  note: "ended manually",
});
assert.equal(updatedManualLink.relationship, "caregiver", "relationship should be updatable");
assert.equal(updatedManualLink.status, "ended", "status should be updatable");
assert.equal(
  await prisma.parentCatLink.count({
    where: {
      parent_profile_id: manualParentProfile.id,
      cat_id: hiddenCat.id,
      status: "active",
      deleted_at: null,
    },
  }),
  0,
  "ending a link should remove active ownership for permission checks",
);
const manualMyCatsAfterEnd = await routeGet("/me/cats", existingWechatUser);
assert.equal(
  manualMyCatsAfterEnd.items.some((item) => item.id === hiddenCat.id),
  false,
  "ended manual link should no longer expose the cat in /me/cats",
);

await assertRejects("contact is required", () =>
  submitParentApplication(
    {
      displayName: "No Contact",
      existingCatClaims: [{ catId: cat.id }],
    },
    user,
  ),
);
await assertRejects("forged verification source is forbidden", () =>
  submitParentApplication(
    {
      displayName: "Forged",
      contactPhone: "13800000000",
      contactPhoneSource: "wechat_verified",
      existingCatClaims: [{ catId: cat.id }],
    },
    user,
  ),
);
await assertRejects("role and target user cannot be supplied", () =>
  submitParentApplication(
    {
      displayName: "Forged",
      contactWechat: "contact",
      role: "admin",
      userId: secondUser.id,
      existingCatClaims: [{ catId: cat.id }],
    },
    user,
  ),
);
await assertRouteJsonRejects(
  "application requires login",
  "/parent-applications",
  null,
  "POST",
  {
    displayName: "Anonymous",
    contactWechat: "contact",
    existingCatClaims: [{ catId: cat.id }],
  },
  401,
);
await assertRejects("hidden cat cannot be claimed by id", () =>
  submitParentApplication(
    {
      displayName: "Hidden",
      contactWechat: "hidden-contact",
      existingCatClaims: [{ catId: hiddenCat.id }],
    },
    user,
  ),
);
const candidates = await routeGet("/parent-applications/cat-candidates?q=Verify", user);
assert.equal(
  candidates.items.some((item) => item.id === cat.id),
  true,
);
assert.equal(
  candidates.items.some((item) => item.id === hiddenCat.id),
  false,
);
assert.deepEqual(Object.keys(candidates.items[0]).sort(), ["id", "name"]);
await assertRouteRejects(
  "anonymous cannot search",
  "/parent-applications/cat-candidates?q=Verify",
  null,
  401,
);
await assertRouteRejects(
  "blank search cannot enumerate",
  "/parent-applications/cat-candidates",
  user,
  400,
);

const application = await submitParentApplication(
  {
    displayName: "Existing Cat Parent",
    contactPhone: "13800000000",
    contactWechat: "existing-parent",
    existingCatClaims: [{ catId: cat.id, note: "this is my cat" }],
  },
  user,
);
assert.equal(application.invite, null);
assert.equal(
  await prisma.parentInvite.count(),
  0,
  "direct submission must not create or consume an invite",
);
assert.equal(application.contactPhoneSource, "self_provided");
assert.equal(await prisma.parentCatLink.count({ where: { cat_id: cat.id } }), 0);
await assertRejects("duplicate pending", () =>
  submitParentApplication(
    {
      displayName: "Again",
      contactWechat: "contact",
      existingCatClaims: [{ catId: cat.id }],
    },
    user,
  ),
);
const sameUserRace = await createUserWithRole("verify-same-user-race", "user");
const raced = await Promise.allSettled(
  [0, 1].map(() =>
    submitParentApplication(
      {
        displayName: "Race",
        contactWechat: "race-contact",
        existingCatClaims: [{ catId: cat.id }],
      },
      sameUserRace,
    ),
  ),
);
assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
assert.equal(
  await prisma.parentApplication.count({ where: { user_id: sameUserRace.id, status: "pending" } }),
  1,
);
const frequentUser = await createUserWithRole("frequent-user", "user");
for (let attempt = 0; attempt < 10; attempt += 1) {
  await assertRejects("invalid repeated submission", () =>
    submitParentApplication({}, frequentUser),
  );
}
await assert.rejects(
  () => submitParentApplication({}, frequentUser),
  (error) => error?.statusCode === 429,
);
await assertRouteRejectsForbidden(application.id, user);

const fakeConfig = {
  wechat: { appId: "test-app", appSecret: "test-secret", upstreamTimeoutMs: 500 },
};
const mockWechat = async (url) =>
  new Response(
    JSON.stringify(
      String(url).includes("cgi-bin/token")
        ? { access_token: "mock-access-token" }
        : { errcode: 0, phone_info: { phoneNumber: "13900000000" } },
    ),
    { status: 200, headers: { "content-type": "application/json" } },
  );
const verified = await verifyParentPhoneCode({ code: "valid-code-123" }, secondUser, fakeConfig, {
  fetcher: mockWechat,
});
assert.equal(verified.phone, "13900000000");
await assertRejects("phone code replay", () =>
  verifyParentPhoneCode({ code: "valid-code-123" }, secondUser, fakeConfig, {
    fetcher: mockWechat,
  }),
);
await assertRejects("another user cannot use proof", () =>
  submitParentApplication(
    {
      displayName: "Stolen",
      phoneVerificationToken: verified.verificationToken,
      newCats: [{ name: "Stolen Cat" }],
    },
    rejectedUser,
  ),
);
const expiredUser = await createUserWithRole("expired-proof-user", "user");
const expired = await verifyParentPhoneCode(
  { code: "expired-proof-code" },
  expiredUser,
  fakeConfig,
  { fetcher: mockWechat },
);
await prisma.parentPhoneVerification.updateMany({
  where: { user_id: expiredUser.id },
  data: { expires_at: new Date(Date.now() - 1000) },
});
await assertRejects("expired proof cannot submit", () =>
  submitParentApplication(
    {
      displayName: "Expired",
      phoneVerificationToken: expired.verificationToken,
      newCats: [{ name: "Expired Cat" }],
    },
    expiredUser,
  ),
);
const catCountBeforeNewApplication = await prisma.cat.count();
const newCatApplication = await submitParentApplication(
  {
    displayName: "New Cat Parent",
    phoneVerificationToken: verified.verificationToken,
    newCats: [{ name: "Verify New Cat", gender: "female", color: "blue" }],
  },
  secondUser,
);
assert.equal(newCatApplication.contactPhoneSource, "wechat_verified");
assert.ok(newCatApplication.contactPhoneVerifiedAt);
assert.equal(await prisma.cat.count(), catCountBeforeNewApplication);
await assertRejects("phone proof replay", () =>
  submitParentApplication(
    {
      displayName: "Replay",
      phoneVerificationToken: verified.verificationToken,
      newCats: [{ name: "Replay Cat" }],
    },
    rejectedUser,
  ),
);

for (const [code, fetcher] of [
  ["expired-code", async () => new Response(JSON.stringify({ errcode: 40029 }), { status: 200 })],
  [
    "network-failed",
    async () => {
      throw new Error("upstream failed");
    },
  ],
  [
    "quota-failed",
    async (url) =>
      new Response(
        JSON.stringify(
          String(url).includes("cgi-bin/token") ? { access_token: "mock" } : { errcode: 45011 },
        ),
        { status: 200 },
      ),
  ],
]) {
  await assertRejects(`phone failure ${code}`, () =>
    verifyParentPhoneCode({ code }, rejectedUser, fakeConfig, { fetcher }),
  );
}
await assertRouteJsonRejects(
  "phone verification requires login",
  "/parent-applications/phone-verifications",
  null,
  "POST",
  { code: "other-code-123" },
  401,
);

const approved = await approveParentApplication(application.id, { adminNote: "approved" }, admin);
assert.equal(approved.status, "approved");
const parentProfile = await prisma.parentProfile.findUnique({ where: { user_id: user.id } });
assert.equal(parentProfile?.contact_phone_source, "self_provided");
assert.equal(
  await prisma.userRole.count({ where: { user_id: user.id, role: "parent", revoked_at: null } }),
  1,
);
assert.equal(
  await prisma.parentCatLink.count({
    where: { parent_profile_id: parentProfile.id, cat_id: cat.id },
  }),
  1,
);
await approveParentApplication(application.id, { adminNote: "again" }, admin);
assert.equal(
  await prisma.parentCatLink.count({
    where: { parent_profile_id: parentProfile.id, cat_id: cat.id },
  }),
  1,
);
await approveParentApplication(newCatApplication.id, { adminNote: "new cat approved" }, admin);
assert.equal(await prisma.cat.count(), catCountBeforeNewApplication + 1);
const verifiedProfile = await prisma.parentProfile.findUnique({
  where: { user_id: secondUser.id },
});
assert.equal(verifiedProfile.contact_phone_source, "wechat_verified");
assert.equal(
  await prisma.user.findUnique({ where: { id: secondUser.id } }).then((item) => item.phone),
  null,
);

const rejectApplication = await submitParentApplication(
  {
    displayName: "Rejected Parent",
    contactWechat: "only-wechat",
    existingCatClaims: [{ catId: cat.id }],
  },
  rejectedUser,
);
assert.equal(rejectApplication.contactPhoneSource, "none");
await rejectParentApplication(rejectApplication.id, { adminNote: "not enough evidence" }, admin);
assert.equal(
  await prisma.userRole.count({
    where: { user_id: rejectedUser.id, role: "parent", revoked_at: null },
  }),
  0,
);
assert.equal(await prisma.parentProfile.count({ where: { user_id: rejectedUser.id } }), 0);
await assertRejects("reapply too soon", () =>
  submitParentApplication(
    {
      displayName: "Retry",
      contactWechat: "retry-contact",
      newCats: [{ name: "Retry Cat" }],
    },
    rejectedUser,
  ),
);
await prisma.parentApplication.update({
  where: { id: rejectApplication.id },
  data: { created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) },
});
const reapplication = await submitParentApplication(
  {
    displayName: "Retry",
    contactWechat: "retry-contact",
    newCats: [{ name: "Retry Cat" }],
  },
  rejectedUser,
);
assert.equal(reapplication.status, "pending");
const concurrentReview = await Promise.allSettled([
  approveParentApplication(reapplication.id, { adminNote: "first click" }, admin),
  approveParentApplication(reapplication.id, { adminNote: "second click" }, admin),
]);
assert.equal(
  concurrentReview.some((result) => result.status === "fulfilled"),
  true,
);
assert.equal(
  await prisma.parentCatLink.count({
    where: { parent_profile: { user_id: rejectedUser.id }, deleted_at: null },
  }),
  1,
  "concurrent review must create one cat link",
);

// A pre-migration invite remains available for audit and review.
const legacyInvite = await prisma.parentInvite.create({
  data: {
    token_hash: "legacy-audit-token-hash",
    short_code: "LEGACY01",
    status: "used",
    used_count: 0,
  },
});
const legacyUser = await createUserWithRole("legacy-user", "user");
const legacyApplication = await prisma.parentApplication.create({
  data: {
    user_id: legacyUser.id,
    invite_id: legacyInvite.id,
    pending_dedup_key: legacyUser.id,
    display_name: "Legacy Parent",
    contact_phone: "13700000000",
    existing_cat_claims_json: [{ catId: cat.id, relationship: "owner" }],
  },
});
const legacyReviewed = await approveParentApplication(legacyApplication.id, {}, admin);
assert.equal(legacyReviewed.invite?.id, legacyInvite.id);
assert.equal(legacyReviewed.contactPhoneSource, "unknown");
assert.equal(
  (await prisma.parentInvite.findUnique({ where: { id: legacyInvite.id } })).used_count,
  0,
);

console.info("parent application flow verification passed");
await prisma.$disconnect();

async function createUserWithRole(nickname, role, data = {}) {
  return prisma.user.create({
    data: {
      ...data,
      nickname,
      status: "active",
      roles: {
        create: { role },
      },
    },
    include: {
      parent_profile: true,
      roles: true,
    },
  });
}

async function assertRouteRejectsForbidden(applicationId, actingUser) {
  const token = `token-${actingUser.id}`;
  await prisma.userSession.create({
    data: {
      user_id: actingUser.id,
      token_hash: createHash("sha256").update(`${config.auth.tokenSecret}:${token}`).digest("hex"),
      expires_at: new Date(Date.now() + 60_000),
    },
  });

  const request = Readable.from([JSON.stringify({ adminNote: "should fail" })]);
  request.method = "POST";
  request.url = `/parent-applications/${applicationId}/approve`;
  request.headers = {
    authorization: `Bearer ${token}`,
    host: "127.0.0.1",
  };

  await assert.rejects(
    () => routeRequest(request, createResponse(), { config }),
    (error) => error?.statusCode === 403,
    "ordinary user should receive 403 from approval API",
  );
}

async function routeGet(url, actingUser) {
  return routeJson(url, actingUser, "GET");
}

async function routeJson(url, actingUser, method, body = undefined) {
  const response = createJsonResponse();
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await routeRequest(createRequest({ body, method, url, token }), response, { config });
  return response.data.data;
}

async function assertRouteRejects(label, url, actingUser, statusCode) {
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await assert.rejects(
    () => routeRequest(createRequest({ method: "GET", url, token }), createResponse(), { config }),
    (error) => error?.statusCode === statusCode,
    label,
  );
}

async function assertRouteJsonRejects(label, url, actingUser, method, body, statusCode) {
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await assert.rejects(
    () => routeRequest(createRequest({ body, method, url, token }), createResponse(), { config }),
    (error) => error?.statusCode === statusCode,
    label,
  );
}

function createRequest({ method, url, token = "", body = undefined }) {
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
  const token = `token-${actingUser.id}-${randomString()}`;
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

function randomString() {
  return Math.random().toString(36).slice(2);
}

function pickParentProfileEditableFields(profile) {
  return {
    display_name: profile?.display_name,
    real_name: profile?.real_name,
    contact_phone: profile?.contact_phone,
    contact_wechat: profile?.contact_wechat,
    city: profile?.city,
    note: profile?.note,
    status: profile?.status,
  };
}

async function assertRejects(label, action) {
  await assert.rejects(action, undefined, label);
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

    const migrationsDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../prisma/migrations",
    );
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
