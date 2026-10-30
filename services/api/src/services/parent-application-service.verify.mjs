import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
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
const { updateMyProfile, uploadMyAvatar } = await import("./my-profile-service.mjs");
const { setObjectStorageTestClient } = await import("./object-storage-service.mjs");
const { config: runtimeConfig } = await import("../config/env.mjs");

const savedNodeEnv = process.env.NODE_ENV;
const savedPhoneFlag = process.env.WECHAT_PHONE_VERIFICATION_ENABLED;
process.env.NODE_ENV = "production";
delete process.env.WECHAT_PHONE_VERIFICATION_ENABLED;
const { config: productionPhoneDefaults } = await import("../config/env.mjs?phone-default-off");
assert.equal(productionPhoneDefaults.wechat.phoneVerificationEnabled, false);
process.env.WECHAT_PHONE_VERIFICATION_ENABLED = "true";
const { config: enabledPhoneConfig } = await import("../config/env.mjs?phone-explicit-on");
assert.equal(enabledPhoneConfig.wechat.phoneVerificationEnabled, true);
if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = savedNodeEnv;
if (savedPhoneFlag === undefined) delete process.env.WECHAT_PHONE_VERIFICATION_ENABLED;
else process.env.WECHAT_PHONE_VERIFICATION_ENABLED = savedPhoneFlag;

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
    phoneVerificationEnabled: false,
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
const profileUser = await createUserWithRole("verify-profile-user", "user");
const editedProfileUser = await updateMyProfile(profileUser.id, {
  nickname: "Community Name",
  gender: "female",
  city: "Shanghai",
  contactWechat: "profile_contact",
});
assert.equal(editedProfileUser.nickname, "Community Name");
assert.equal(editedProfileUser.gender, "female");
assert.equal(editedProfileUser.contactWechat, "profile_contact");
await prisma.parentProfile.create({ data: { user_id: profileUser.id, display_name: "Old Name", status: "active" } });
const editedParentUser = await updateMyProfile(profileUser.id, {
  nickname: "Parent Name",
  gender: "male",
  city: "Hangzhou",
  contactWechat: "updated_contact",
});
assert.equal(editedParentUser.parentProfile?.displayName, "Parent Name");
assert.equal(editedParentUser.city, "Hangzhou");
assert.equal((await prisma.parentProfile.findUnique({ where: { user_id: profileUser.id } }))?.gender, "male");
await assert.rejects(() => updateMyProfile(profileUser.id, {
  nickname: "Invalid", gender: "unsupported", city: null, contactWechat: null,
}), (error) => error?.statusCode === 400);
await assert.rejects(() => uploadMyAvatar(profileUser.id, {
  mimeType: "image/png", dataBase64: Buffer.from("not an image").toString("base64"),
}), (error) => error?.statusCode === 400);
const previousStorage = { ...runtimeConfig.storage };
Object.assign(runtimeConfig.storage, {
  provider: "s3", bucket: "verify-avatars", region: "test-region",
  endpoint: "https://storage.example.test", publicBaseUrl: "https://media.example.test",
  accessKeyId: "verify-key", accessKeySecret: "verify-secret", forcePathStyle: true,
});
let storedAvatar = null;
setObjectStorageTestClient({ async putObject(input) { storedAvatar = input; return { written: true }; } });
const uploadedAvatar = await uploadMyAvatar(profileUser.id, {
  mimeType: "image/png",
  dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l8WQAAAAASUVORK5CYII=",
});
assert.equal(storedAvatar?.contentType, "image/png");
assert.equal(storedAvatar?.body.length > 0, true);
assert.equal(uploadedAvatar.avatarUrl.startsWith("https://media.example.test/avatars/"), true);
const localAvatarDir = mkdtempSync(join(tmpdir(), "starlitsky-avatar-verify-"));
runtimeConfig.avatar.localStorageDir = localAvatarDir;
runtimeConfig.avatar.publicBaseUrl = "https://trial.example.test/trial-media/avatars/";
const localAvatar = await uploadMyAvatar(profileUser.id, {
  mimeType: "image/png",
  dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l8WQAAAAASUVORK5CYII=",
});
assert.equal(localAvatar.avatarUrl.startsWith(runtimeConfig.avatar.publicBaseUrl), true);
assert.equal(existsSync(join(localAvatarDir, localAvatar.avatarUrl.split("/").at(-1))), true);
rmSync(localAvatarDir, { recursive: true, force: true });
runtimeConfig.avatar.localStorageDir = "";
runtimeConfig.avatar.publicBaseUrl = "";
setObjectStorageTestClient(null);
Object.assign(runtimeConfig.storage, previousStorage);
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
await assertRouteRejects(
  "ordinary user cannot search private cat candidates",
  "/parent-applications/admin-cat-candidates?q=Verify",
  user,
  403,
);
await assertRouteRejects(
  "anonymous cannot search private cat candidates",
  "/parent-applications/admin-cat-candidates?q=Verify",
  null,
  401,
);
const privateCandidates = await routeGet(
  "/parent-applications/admin-cat-candidates?q=Verify",
  admin,
);
assert.equal(
  privateCandidates.some((item) => item.id === hiddenCat.id),
  true,
);
assert.equal(
  (await routeGet("/parent-applications/phone-verification-capability", user)).enabled,
  false,
);

const application = await submitParentApplication(
  {
    displayName: "Existing Cat Parent",
    gender: "female",
    contactPhone: "13800000000",
    contactWechat: "existing-parent",
    existingCatClaims: [{ catId: cat.id, note: "this is my cat" }],
  },
  user,
);
assert.equal(application.invite, null);
assert.equal(application.gender, "female");
assert.equal(
  await prisma.parentInvite.count(),
  0,
  "direct submission must not create or consume an invite",
);
assert.equal(application.contactPhoneSource, "self_provided");
await assertRejects("invalid applicant gender", () =>
  submitParentApplication(
    {
      displayName: "Invalid gender",
      gender: "unsupported",
      contactWechat: "contact",
      existingCatClaims: [{ catId: cat.id }],
    },
    user,
  ),
);
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
  wechat: {
    appId: "test-app",
    appSecret: "test-secret",
    phoneVerificationEnabled: true,
    upstreamTimeoutMs: 500,
  },
};
let disabledFetches = 0;
await assert.rejects(
  () =>
    verifyParentPhoneCode(
      { code: "disabled-code-123" },
      secondUser,
      {
        wechat: { appId: "test-app", appSecret: "test-secret", phoneVerificationEnabled: false },
      },
      {
        fetcher: async () => {
          disabledFetches += 1;
          throw new Error("must not fetch");
        },
      },
    ),
  (error) => error?.statusCode === 503,
);
assert.equal(disabledFetches, 0, "disabled verification must never call WeChat");
assert.equal(await prisma.parentPhoneVerification.count({ where: { user_id: secondUser.id } }), 0);
const mockWechatUrls = [];
const mockWechat = async (url) => {
  mockWechatUrls.push(String(url));
  return new Response(
    JSON.stringify(
      String(url).includes("cgi-bin/token")
        ? { access_token: "mock-access-token" }
        : { errcode: 0, phone_info: { phoneNumber: "13900000000" } },
    ),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};
const verified = await verifyParentPhoneCode({ code: "valid-code-123" }, secondUser, fakeConfig, {
  fetcher: mockWechat,
});
assert.equal(verified.phone, "13900000000");
assert.equal(mockWechatUrls.length, 2);
assert.equal(mockWechatUrls[0].includes("cgi-bin/token"), true);
assert.equal(mockWechatUrls[1].includes("getuserphonenumber"), true);
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
  await assert.rejects(
    () => verifyParentPhoneCode({ code }, rejectedUser, fakeConfig, { fetcher }),
    (error) => error?.statusCode === 503 && !error.message.includes("mock-access-token"),
    `phone failure ${code} must be handled without exposing upstream data`,
  );
}
await assertRouteJsonRejects(
  "disabled phone route rejects request",
  "/parent-applications/phone-verifications",
  user,
  "POST",
  { code: "disabled-route-code" },
  503,
);
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
await assertRejects("new cat needs explicit creation confirmation", () =>
  approveParentApplication(newCatApplication.id, { adminNote: "incomplete" }, admin),
);
await approveParentApplication(
  newCatApplication.id,
  {
    adminNote: "new cat approved",
    newCatConfirmations: [{ index: 0, action: "create", confirmedName: "Verify New Cat" }],
  },
  admin,
);
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
  approveParentApplication(
    reapplication.id,
    {
      adminNote: "first click",
      newCatConfirmations: [{ index: 0, action: "create", confirmedName: "Retry Cat" }],
    },
    admin,
  ),
  approveParentApplication(
    reapplication.id,
    {
      adminNote: "second click",
      newCatConfirmations: [{ index: 0, action: "create", confirmedName: "Retry Cat" }],
    },
    admin,
  ),
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

const hiddenClaimUser = await createUserWithRole("hidden-claim-user", "user");
const hiddenClaimApplication = await submitParentApplication(
  {
    displayName: "Hidden Cat Parent",
    contactWechat: "hidden-parent-contact",
    unlistedCatClaims: [
      { name: hiddenCat.name, identification: "female smoke, adopted in spring" },
    ],
  },
  hiddenClaimUser,
);
assert.equal(hiddenClaimApplication.unlistedCatClaims[0].name, hiddenCat.name);
assert.equal(JSON.stringify(hiddenClaimApplication).includes(hiddenCat.id), false);
assert.equal(
  JSON.stringify(await routeGet("/parent-applications/mine", hiddenClaimUser)).includes(
    hiddenCat.id,
  ),
  false,
);
const beforeHiddenReview = await prisma.cat.count();
await assertRejects("unidentified hidden cat must block approval", () =>
  approveParentApplication(hiddenClaimApplication.id, {}, admin),
);
assert.equal(await prisma.parentProfile.count({ where: { user_id: hiddenClaimUser.id } }), 0);
assert.equal(
  await prisma.userRole.count({ where: { user_id: hiddenClaimUser.id, role: "parent" } }),
  0,
);
assert.equal(
  (await prisma.parentApplication.findUnique({ where: { id: hiddenClaimApplication.id } })).status,
  "pending",
);
await assertRejects("wrong target name must block misbinding", () =>
  approveParentApplication(
    hiddenClaimApplication.id,
    {
      unlistedCatResolutions: [
        {
          index: 0,
          catId: secondHiddenCat.id,
          confirmedCatName: hiddenCat.name,
          confirmedClaimName: hiddenCat.name,
        },
      ],
    },
    admin,
  ),
);
assert.equal(await prisma.cat.count(), beforeHiddenReview);
assert.equal(
  await prisma.parentCatLink.count({
    where: { cat_id: secondHiddenCat.id, parent_profile: { user_id: hiddenClaimUser.id } },
  }),
  0,
);
await approveParentApplication(
  hiddenClaimApplication.id,
  {
    unlistedCatResolutions: [
      {
        index: 0,
        catId: hiddenCat.id,
        confirmedCatName: hiddenCat.name,
        confirmedClaimName: hiddenCat.name,
      },
    ],
  },
  admin,
);
assert.equal(
  await prisma.cat.count(),
  beforeHiddenReview,
  "hidden claim must not create a duplicate Cat",
);
assert.equal(
  await prisma.parentCatLink.count({
    where: { cat_id: hiddenCat.id, parent_profile: { user_id: hiddenClaimUser.id } },
  }),
  1,
);

const mistakenNewUser = await createUserWithRole("mistaken-new-user", "user");
const mistakenNewApplication = await submitParentApplication(
  {
    displayName: "Mistaken New Cat",
    contactWechat: "mistaken-new-contact",
    newCats: [{ name: hiddenCat.name }],
  },
  mistakenNewUser,
);
await assertRejects("existing hidden cat name must block duplicate creation", () =>
  approveParentApplication(
    mistakenNewApplication.id,
    {
      newCatConfirmations: [{ index: 0, action: "create", confirmedName: hiddenCat.name }],
    },
    admin,
  ),
);
assert.equal(await prisma.cat.count(), beforeHiddenReview);
assert.equal(await prisma.parentProfile.count({ where: { user_id: mistakenNewUser.id } }), 0);
await approveParentApplication(
  mistakenNewApplication.id,
  {
    newCatConfirmations: [
      {
        index: 0,
        action: "link_existing",
        confirmedName: hiddenCat.name,
        catId: hiddenCat.id,
        confirmedCatName: hiddenCat.name,
      },
    ],
  },
  admin,
);
assert.equal(await prisma.cat.count(), beforeHiddenReview);
assert.equal(
  await prisma.parentCatLink.count({
    where: { cat_id: hiddenCat.id, parent_profile: { user_id: mistakenNewUser.id } },
  }),
  1,
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

// Exercise the requests sent by the published client and admin bundle against the new API.
await assertRouteRejects("ordinary user cannot list invites", "/parent-invites", user, 403);
await assertRouteJsonRejects(
  "ordinary user cannot create invites",
  "/parent-invites",
  user,
  "POST",
  {},
  403,
);
const issued = await routeJson("/parent-invites", admin, "POST", { maxUses: 1 });
assert.equal(issued.isUsable, true);
assert.equal(
  (await routeGet("/parent-invites?pageSize=20", admin)).items.some(
    (item) => item.id === issued.id,
  ),
  true,
);
assert.equal((await routeGet(`/parent-invites/verify?code=${issued.shortCode}`, null)).valid, true);
assert.equal((await routeGet(`/parent-invites/verify?token=${issued.token}`, null)).valid, true);
assert.equal(
  (await routeGet(`/parent-invites/verify?qrCredential=${issued.qr.scene.slice(2)}`, null)).valid,
  true,
);
const oldClientUser = await createUserWithRole("old-client-user", "user");
const oldSearch = await routeGet(
  `/parent-applications/cat-candidates?q=V&code=${issued.shortCode}`,
  oldClientUser,
);
assert.equal(
  oldSearch.items.some((item) => item.id === cat.id),
  true,
);
assert.equal(
  oldSearch.items.some((item) => item.id === hiddenCat.id),
  false,
);
assert.deepEqual(Object.keys(oldSearch.items[0]).sort(), ["id", "name"]);
await assertRouteRejects(
  "old search still needs login",
  `/parent-applications/cat-candidates?q=V&code=${issued.shortCode}`,
  null,
  401,
);
await assertRouteRejects(
  "invalid invite cannot search",
  "/parent-applications/cat-candidates?q=V&code=INVALID1",
  oldClientUser,
  400,
);
await assertRouteJsonRejects(
  "old client cannot claim hidden cat",
  "/parent-applications",
  oldClientUser,
  "POST",
  {
    inviteCode: issued.shortCode,
    displayName: "Old",
    existingCatClaims: [{ catId: hiddenCat.id }],
  },
  400,
);
assert.equal((await prisma.parentInvite.findUnique({ where: { id: issued.id } })).used_count, 0);
const oldSubmitted = await routeJson("/parent-applications", oldClientUser, "POST", {
  inviteCode: issued.shortCode,
  displayName: "Old",
  existingCatClaims: [{ catId: cat.id }],
});
assert.equal(oldSubmitted.invite.id, issued.id);
assert.equal(
  await prisma.userRole.count({
    where: { user_id: oldClientUser.id, role: "parent", revoked_at: null },
  }),
  0,
);
await routeJson(`/parent-applications/${oldSubmitted.id}/approve`, admin, "POST", {
  adminNote: "legacy review",
});
assert.equal(
  await prisma.userRole.count({
    where: { user_id: oldClientUser.id, role: "parent", revoked_at: null },
  }),
  1,
);
assert.equal(
  await prisma.parentCatLink.count({
    where: { parent_profile: { user_id: oldClientUser.id }, cat_id: cat.id, deleted_at: null },
  }),
  1,
);
assert.equal((await prisma.parentInvite.findUnique({ where: { id: issued.id } })).used_count, 1);
assert.equal(
  (await routeGet(`/parent-invites/verify?code=${issued.shortCode}`, null)).reason,
  "used",
);
const secondIssued = await routeJson("/parent-invites", admin, "POST", { maxUses: 1 });
await routeJson(`/parent-invites/${secondIssued.id}/revoke`, admin, "POST", {
  adminNote: "transition",
});
assert.equal(
  (await routeGet(`/parent-invites/verify?code=${secondIssued.shortCode}`, null)).reason,
  "revoked",
);
const oldNewCatUser = await createUserWithRole("old-new-cat-user", "user");
const thirdIssued = await routeJson("/parent-invites", admin, "POST", { maxUses: 1 });
const oldNewCat = await routeJson("/parent-applications", oldNewCatUser, "POST", {
  inviteToken: thirdIssued.token,
  displayName: "Old new cat",
  newCats: [{ name: "Unconfirmed legacy cat", relationship: "owner" }],
});
await assertRouteJsonRejects(
  "old admin cannot create cat without explicit confirmation",
  `/parent-applications/${oldNewCat.id}/approve`,
  admin,
  "POST",
  { adminNote: "legacy review" },
  400,
);
assert.equal((await prisma.parentApplication.findUnique({ where: { id: oldNewCat.id } })).status, "pending");
assert.equal(await prisma.cat.count({ where: { name: "Unconfirmed legacy cat" } }), 0);

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
