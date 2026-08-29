import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { prisma } from "../db/prisma.mjs";
import { routeRequest } from "../routes/index.mjs";
import {
  approveParentApplication,
  createParentInvite,
  rejectParentApplication,
  revokeParentInvite,
  submitParentApplication,
  verifyParentInvite,
} from "./parent-application-service.mjs";

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
  },
};

const admin = await createUserWithRole("verify-admin", "keeper");
const user = await createUserWithRole("verify-user", "user");
const secondUser = await createUserWithRole("verify-user-2", "user");
const rejectedUser = await createUserWithRole("verify-user-3", "user");
const cat = await prisma.cat.create({
  data: {
    name: "Verify Existing Cat",
    lifecycle_status: "adopted",
    visibility: "visible",
  },
});

await assertRejects("no invite cannot submit", () =>
  submitParentApplication(
    {
      displayName: "No Invite",
      existingCatClaims: [{ catId: cat.id }],
    },
    user,
  ),
);

const invite = await createParentInvite({ maxUses: 1, note: "verify invite" }, admin);
const validByCode = await verifyParentInvite({ code: invite.shortCode });
assert.equal(validByCode.valid, true, "valid short code should pass verification");

const validByToken = await verifyParentInvite({ token: invite.token });
assert.equal(validByToken.valid, true, "QR token should use the same invite flow");

const revoked = await createParentInvite({}, admin);
await revokeParentInvite(revoked.id, { adminNote: "verify revoke" }, admin);
const revokedCheck = await verifyParentInvite({ code: revoked.shortCode });
assert.equal(revokedCheck.valid, false, "revoked invite should be rejected");
assert.equal(revokedCheck.reason, "revoked");

const application = await submitParentApplication(
  {
    inviteCode: invite.shortCode,
    displayName: "Existing Cat Parent",
    realName: "Existing Claim",
    contactPhone: "13800000000",
    contactWechat: "existing-parent",
    city: "Shanghai",
    existingCatClaims: [{ catId: cat.id, note: "this is my cat" }],
  },
  user,
);
assert.equal(application.status, "pending");
assert.equal(
  await prisma.parentCatLink.count({ where: { cat_id: cat.id } }),
  0,
  "existing cat claim must not create ParentCatLink before approval",
);
assert.equal(
  (await verifyParentInvite({ code: invite.shortCode })).valid,
  false,
  "single-use invite should be consumed by submission",
);

await assertRejects("same user cannot submit another pending application", () =>
  submitParentApplication(
    {
      inviteCode: invite.shortCode,
      displayName: "Duplicate Pending",
      existingCatClaims: [{ catId: cat.id }],
    },
    user,
  ),
);

await assertRouteRejectsForbidden(application.id, user);

const approved = await approveParentApplication(application.id, { adminNote: "approved" }, admin);
assert.equal(approved.status, "approved");

const parentProfile = await prisma.parentProfile.findUnique({ where: { user_id: user.id } });
assert.equal(parentProfile?.status, "active", "approval should activate ParentProfile");
assert.ok(parentProfile?.activated_at, "approval should set activated_at");
assert.equal(
  await prisma.userRole.count({
    where: { user_id: user.id, role: "parent", revoked_at: null },
  }),
  1,
  "approval should grant one active parent role",
);
assert.equal(
  await prisma.parentCatLink.count({
    where: { parent_profile_id: parentProfile.id, cat_id: cat.id, deleted_at: null },
  }),
  1,
  "approval should link claimed existing cat",
);

await approveParentApplication(application.id, { adminNote: "approved again" }, admin);
assert.equal(
  await prisma.parentCatLink.count({
    where: { parent_profile_id: parentProfile.id, cat_id: cat.id, deleted_at: null },
  }),
  1,
  "duplicate approval must not duplicate ParentCatLink",
);

const newCatInvite = await createParentInvite({}, admin);
const catCountBeforeNewApplication = await prisma.cat.count();
const newCatApplication = await submitParentApplication(
  {
    inviteToken: newCatInvite.token,
    displayName: "New Cat Parent",
    newCats: [
      {
        name: "Verify New Cat",
        gender: "female",
        color: "blue",
        birthday: "2024-01-02",
        arrivedAt: "2024-04-05",
        personality: "quiet",
      },
    ],
  },
  secondUser,
);
assert.equal(
  await prisma.cat.count(),
  catCountBeforeNewApplication,
  "new cat application must not create Cat before approval",
);

await approveParentApplication(newCatApplication.id, { adminNote: "new cat approved" }, admin);
assert.equal(await prisma.cat.count(), catCountBeforeNewApplication + 1);
const newParentProfile = await prisma.parentProfile.findUnique({
  where: { user_id: secondUser.id },
});
assert.equal(
  await prisma.parentCatLink.count({
    where: { parent_profile_id: newParentProfile.id, deleted_at: null },
  }),
  1,
  "approval should link created Cat to parent",
);

const rejectInvite = await createParentInvite({}, admin);
const rejectApplication = await submitParentApplication(
  {
    inviteCode: rejectInvite.shortCode,
    displayName: "Rejected Parent",
    existingCatClaims: [{ catId: cat.id }],
  },
  rejectedUser,
);
await rejectParentApplication(rejectApplication.id, { adminNote: "not enough evidence" }, admin);
assert.equal(
  await prisma.userRole.count({
    where: { user_id: rejectedUser.id, role: "parent", revoked_at: null },
  }),
  0,
  "rejection must not grant parent role",
);
assert.equal(
  await prisma.parentProfile.count({ where: { user_id: rejectedUser.id } }),
  0,
  "rejection must not create ParentProfile",
);

console.info("parent application flow verification passed");

async function createUserWithRole(nickname, role) {
  return prisma.user.create({
    data: {
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

function createResponse() {
  return {
    setHeader() {},
    writeHead() {},
    end() {},
  };
}

async function assertRejects(label, action) {
  await assert.rejects(action, undefined, label);
}
