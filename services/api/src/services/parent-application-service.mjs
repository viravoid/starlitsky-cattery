import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";

const INVITE_STATUS_ACTIVE = "active";
const INVITE_STATUS_REVOKED = "revoked";
const INVITE_STATUS_USED = "used";
const APPLICATION_STATUS_PENDING = "pending";
const APPLICATION_STATUS_APPROVED = "approved";
const APPLICATION_STATUS_REJECTED = "rejected";
const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_TOKEN_BYTES = 32;
const SHORT_CODE_LENGTH = 8;

const CREATE_INVITE_FIELDS = ["expiresAt", "maxUses", "note"];
const VERIFY_INVITE_FIELDS = ["code", "token"];
const SUBMIT_APPLICATION_FIELDS = [
  "inviteCode",
  "inviteToken",
  "displayName",
  "realName",
  "contactPhone",
  "contactWechat",
  "city",
  "existingCatClaims",
  "newCats",
];
const REVIEW_APPLICATION_FIELDS = ["adminNote"];

export async function createParentInvite(input, adminUser) {
  assertPlainObject(input);
  assertNoUnknownFields(input, CREATE_INVITE_FIELDS);

  const token = randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
  const shortCode = await generateUniqueShortCode();
  const invite = await prisma.parentInvite.create({
    data: {
      token_hash: hashInviteToken(token),
      short_code: shortCode,
      max_uses: optionalPositiveInteger(input.maxUses, "maxUses") ?? 1,
      expires_at: parseNullableDate(input.expiresAt, "expiresAt"),
      note: nullableString(input.note, "note"),
      created_by: adminUser.id,
    },
    include: inviteInclude,
  });

  return {
    ...toParentInviteDto(invite),
    token,
  };
}

export async function listParentInvites(searchParams) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const query = searchParams.get("q");
  const where = {};

  if (status) where.status = status;
  if (query) {
    where.OR = [
      { short_code: { contains: normalizeShortCode(query) } },
      { note: { contains: query } },
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.parentInvite.findMany({
      where,
      include: inviteInclude,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.parentInvite.count({ where }),
  ]);

  return {
    items: items.map(toParentInviteDto),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function verifyParentInvite(input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, VERIFY_INVITE_FIELDS);

  const invite = await findInviteByCredential(input);
  if (!invite) {
    return {
      valid: false,
      reason: "not_found",
      invite: null,
    };
  }

  const reason = getInviteInvalidReason(invite, new Date());
  return {
    valid: !reason,
    reason,
    invite: toParentInvitePublicDto(invite),
  };
}

export async function submitParentApplication(input, user) {
  assertPlainObject(input);
  assertNoUnknownFields(input, SUBMIT_APPLICATION_FIELDS);

  const profile = normalizeProfileInput(input);
  const existingCatClaims = normalizeExistingCatClaims(input.existingCatClaims);
  const newCats = normalizeNewCats(input.newCats);
  if (existingCatClaims.length === 0 && newCats.length === 0) {
    throw badRequest("At least one existing cat claim or new cat must be provided");
  }

  const application = await prisma.$transaction(async (transaction) => {
    const pending = await transaction.parentApplication.findFirst({
      where: {
        user_id: user.id,
        status: APPLICATION_STATUS_PENDING,
      },
      select: { id: true },
    });
    if (pending) throw badRequest("User already has an active pending parent application");

    const invite = await findInviteByCredential(input, transaction);
    if (!invite) throw badRequest("Invite is invalid");

    const invalidReason = getInviteInvalidReason(invite, new Date());
    if (invalidReason) throw badRequest(`Invite is ${invalidReason}`);

    await ensureClaimedCatsExist(existingCatClaims, transaction);

    const created = await transaction.parentApplication.create({
      data: {
        user_id: user.id,
        invite_id: invite.id,
        display_name: profile.displayName,
        real_name: profile.realName,
        contact_phone: profile.contactPhone,
        contact_wechat: profile.contactWechat,
        city: profile.city,
        existing_cat_claims_json: existingCatClaims,
        new_cats_json: newCats,
      },
      include: applicationInclude,
    });

    const usedCount = invite.used_count + 1;
    await transaction.parentInvite.update({
      where: { id: invite.id },
      data: {
        used_count: usedCount,
        status: usedCount >= invite.max_uses ? INVITE_STATUS_USED : INVITE_STATUS_ACTIVE,
      },
    });

    return created;
  });

  return toParentApplicationDto(application);
}

export async function getMyParentApplication(user) {
  const application = await prisma.parentApplication.findFirst({
    where: {
      user_id: user.id,
    },
    include: applicationInclude,
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });

  return application ? toParentApplicationDto(application) : null;
}

export async function listParentApplications(searchParams) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const query = searchParams.get("q");
  const where = {};

  if (status) where.status = status;
  if (query) {
    where.OR = [
      { display_name: { contains: query } },
      { real_name: { contains: query } },
      { contact_phone: { contains: query } },
      { contact_wechat: { contains: query } },
      { city: { contains: query } },
      { invite: { short_code: { contains: normalizeShortCode(query) } } },
      { user: { nickname: { contains: query } } },
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.parentApplication.findMany({
      where,
      include: applicationInclude,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.parentApplication.count({ where }),
  ]);

  return {
    items: await Promise.all(items.map(toParentApplicationDto)),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function approveParentApplication(applicationId, input, adminUser) {
  assertPlainObject(input);
  assertNoUnknownFields(input, REVIEW_APPLICATION_FIELDS);

  const application = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.parentApplication.findUnique({
      where: { id: applicationId },
      include: applicationInclude,
    });
    if (!existing) throw notFound("Parent application not found");
    if (existing.status === APPLICATION_STATUS_APPROVED) return existing;
    if (existing.status !== APPLICATION_STATUS_PENDING) {
      throw badRequest("Only pending applications can be approved");
    }

    const now = new Date();
    const parentProfile = await upsertActiveParentProfile(existing, transaction, now);
    await ensureParentRole(existing.user_id, adminUser.id, transaction);
    await createExistingCatLinks(existing, parentProfile.id, adminUser.id, transaction);
    await createNewCatsAndLinks(existing, parentProfile.id, adminUser.id, transaction);

    return transaction.parentApplication.update({
      where: { id: applicationId },
      data: {
        status: APPLICATION_STATUS_APPROVED,
        admin_note: nullableString(input.adminNote, "adminNote"),
        reviewed_by: adminUser.id,
        reviewed_at: now,
        approved_parent_profile_id: parentProfile.id,
      },
      include: applicationInclude,
    });
  });

  return toParentApplicationDto(application);
}

export async function rejectParentApplication(applicationId, input, adminUser) {
  assertPlainObject(input);
  assertNoUnknownFields(input, REVIEW_APPLICATION_FIELDS);

  const application = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.parentApplication.findUnique({
      where: { id: applicationId },
      include: applicationInclude,
    });
    if (!existing) throw notFound("Parent application not found");
    if (existing.status === APPLICATION_STATUS_REJECTED) return existing;
    if (existing.status !== APPLICATION_STATUS_PENDING) {
      throw badRequest("Only pending applications can be rejected");
    }

    return transaction.parentApplication.update({
      where: { id: applicationId },
      data: {
        status: APPLICATION_STATUS_REJECTED,
        admin_note: nullableString(input.adminNote, "adminNote"),
        reviewed_by: adminUser.id,
        reviewed_at: new Date(),
      },
      include: applicationInclude,
    });
  });

  return toParentApplicationDto(application);
}

export async function revokeParentInvite(inviteId, input, adminUser) {
  assertPlainObject(input);
  assertNoUnknownFields(input, REVIEW_APPLICATION_FIELDS);

  const existing = await prisma.parentInvite.findUnique({
    where: { id: inviteId },
    select: { id: true },
  });
  if (!existing) throw notFound("Parent invite not found");

  const invite = await prisma.parentInvite.update({
    where: { id: inviteId },
    data: {
      status: INVITE_STATUS_REVOKED,
      note: nullableString(input.adminNote, "adminNote"),
      revoked_by: adminUser.id,
      revoked_at: new Date(),
    },
    include: inviteInclude,
  });

  return toParentInviteDto(invite);
}

async function upsertActiveParentProfile(application, transaction, now) {
  return transaction.parentProfile.upsert({
    where: { user_id: application.user_id },
    update: {
      display_name: application.display_name,
      real_name: application.real_name,
      contact_phone: application.contact_phone,
      contact_wechat: application.contact_wechat,
      city: application.city,
      status: "active",
      activated_at: now,
      note: application.admin_note,
    },
    create: {
      user_id: application.user_id,
      display_name: application.display_name,
      real_name: application.real_name,
      contact_phone: application.contact_phone,
      contact_wechat: application.contact_wechat,
      city: application.city,
      status: "active",
      activated_at: now,
      note: application.admin_note,
    },
  });
}

async function ensureParentRole(userId, adminUserId, transaction) {
  const existing = await transaction.userRole.findFirst({
    where: {
      user_id: userId,
      role: "parent",
      revoked_at: null,
    },
    select: { id: true },
  });
  if (existing) return;

  await transaction.userRole.create({
    data: {
      user_id: userId,
      role: "parent",
      granted_by: adminUserId,
    },
  });
}

async function createExistingCatLinks(application, parentProfileId, adminUserId, transaction) {
  const claims = getJsonArray(application.existing_cat_claims_json);
  for (const claim of claims) {
    await ensureParentCatLink({
      parentProfileId,
      catId: claim.catId,
      relationship: claim.relationship || "owner",
      startedAt: parseNullableDate(claim.startedAt, "startedAt"),
      note: claim.note || null,
      adminUserId,
      transaction,
    });
  }
}

async function createNewCatsAndLinks(application, parentProfileId, adminUserId, transaction) {
  const cats = getJsonArray(application.new_cats_json);
  for (const input of cats) {
    const cat = await transaction.cat.create({
      data: {
        name: input.name,
        gender: input.gender,
        color: input.color,
        birthday: parseNullableDate(input.birthday, "birthday"),
        lifecycle_status: "adopted",
        personality: input.personality,
        story_json: {
          source: "parent_application",
          applicationId: application.id,
          arrivedAt: input.arrivedAt,
          note: input.note,
        },
        visibility: "hidden",
      },
    });

    await ensureParentCatLink({
      parentProfileId,
      catId: cat.id,
      relationship: input.relationship || "owner",
      startedAt: parseNullableDate(input.arrivedAt, "arrivedAt"),
      note: input.note || null,
      adminUserId,
      transaction,
    });
  }
}

async function ensureParentCatLink({
  parentProfileId,
  catId,
  relationship,
  startedAt,
  note,
  adminUserId,
  transaction,
}) {
  const existing = await transaction.parentCatLink.findFirst({
    where: {
      parent_profile_id: parentProfileId,
      cat_id: catId,
      relationship,
      deleted_at: null,
    },
    select: { id: true },
  });
  if (existing) return;

  await transaction.parentCatLink.create({
    data: {
      parent_profile_id: parentProfileId,
      cat_id: catId,
      relationship,
      status: "active",
      started_at: startedAt,
      note,
      created_by: adminUserId,
    },
  });
}

async function findInviteByCredential(input, client = prisma) {
  if (typeof input.inviteToken === "string" || typeof input.token === "string") {
    const token = typeof input.inviteToken === "string" ? input.inviteToken : input.token;
    const trimmedToken = token.trim();
    if (!trimmedToken) throw badRequest("Invite token is required");
    return client.parentInvite.findUnique({
      where: { token_hash: hashInviteToken(trimmedToken) },
      include: inviteInclude,
    });
  }

  if (typeof input.inviteCode === "string" || typeof input.code === "string") {
    const code = typeof input.inviteCode === "string" ? input.inviteCode : input.code;
    const shortCode = normalizeShortCode(code);
    if (!shortCode) throw badRequest("Invite code is required");
    return client.parentInvite.findUnique({
      where: { short_code: shortCode },
      include: inviteInclude,
    });
  }

  throw badRequest("Invite code or token is required");
}

function getInviteInvalidReason(invite, now) {
  if (invite.status === INVITE_STATUS_REVOKED) return "revoked";
  if (invite.status === INVITE_STATUS_USED || invite.used_count >= invite.max_uses) return "used";
  if (invite.status !== INVITE_STATUS_ACTIVE) return "inactive";
  if (invite.expires_at && invite.expires_at <= now) return "expired";
  return null;
}

async function ensureClaimedCatsExist(claims, transaction) {
  if (claims.length === 0) return;

  const cats = await transaction.cat.findMany({
    where: {
      id: { in: claims.map((claim) => claim.catId) },
      deleted_at: null,
    },
    select: { id: true },
  });
  const existingIds = new Set(cats.map((cat) => cat.id));
  const missing = claims.filter((claim) => !existingIds.has(claim.catId));
  if (missing.length > 0) {
    throw badRequest("One or more claimed cats do not exist", {
      catIds: missing.map((claim) => claim.catId),
    });
  }
}

async function attachClaimedCatDetails(applicationDto) {
  const claims = applicationDto.existingCatClaims;
  if (claims.length === 0) return applicationDto;

  const cats = await prisma.cat.findMany({
    where: {
      id: { in: claims.map((claim) => claim.catId) },
    },
    select: {
      id: true,
      name: true,
      gender: true,
      color: true,
      lifecycle_status: true,
      visibility: true,
      deleted_at: true,
    },
  });
  const catsById = new Map(cats.map((cat) => [cat.id, cat]));

  return {
    ...applicationDto,
    existingCatClaims: claims.map((claim) => ({
      ...claim,
      cat: catsById.has(claim.catId) ? toCatSummaryDto(catsById.get(claim.catId)) : null,
    })),
  };
}

async function generateUniqueShortCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const shortCode = Array.from(
      { length: SHORT_CODE_LENGTH },
      () => SHORT_CODE_ALPHABET[randomBytes(1)[0] % SHORT_CODE_ALPHABET.length],
    ).join("");
    const existing = await prisma.parentInvite.findUnique({
      where: { short_code: shortCode },
      select: { id: true },
    });
    if (!existing) return shortCode;
  }

  throw badRequest("Could not generate a unique invite code");
}

function normalizeProfileInput(input) {
  return {
    displayName: requiredString(input.displayName, "displayName"),
    realName: nullableString(input.realName, "realName"),
    contactPhone: nullableString(input.contactPhone, "contactPhone"),
    contactWechat: nullableString(input.contactWechat, "contactWechat"),
    city: nullableString(input.city, "city"),
  };
}

function normalizeExistingCatClaims(value) {
  const claims = getOptionalArray(value, "existingCatClaims");
  return claims.map((claim, index) => {
    assertPlainObject(claim, `existingCatClaims[${index}]`);
    assertNoUnknownFields(claim, ["catId", "relationship", "startedAt", "note"]);
    return {
      catId: requiredString(claim.catId, `existingCatClaims[${index}].catId`),
      relationship:
        optionalString(claim.relationship, `existingCatClaims[${index}].relationship`) ?? "owner",
      startedAt: optionalDateString(claim.startedAt, `existingCatClaims[${index}].startedAt`),
      note: nullableString(claim.note, `existingCatClaims[${index}].note`),
    };
  });
}

function normalizeNewCats(value) {
  const cats = getOptionalArray(value, "newCats");
  return cats.map((cat, index) => {
    assertPlainObject(cat, `newCats[${index}]`);
    assertNoUnknownFields(cat, [
      "name",
      "gender",
      "color",
      "birthday",
      "arrivedAt",
      "personality",
      "note",
      "relationship",
    ]);
    return {
      name: requiredString(cat.name, `newCats[${index}].name`),
      gender: nullableString(cat.gender, `newCats[${index}].gender`),
      color: nullableString(cat.color, `newCats[${index}].color`),
      birthday: optionalDateString(cat.birthday, `newCats[${index}].birthday`),
      arrivedAt: optionalDateString(cat.arrivedAt, `newCats[${index}].arrivedAt`),
      personality: nullableString(cat.personality, `newCats[${index}].personality`),
      note: nullableString(cat.note, `newCats[${index}].note`),
      relationship: optionalString(cat.relationship, `newCats[${index}].relationship`) ?? "owner",
    };
  });
}

function getOptionalArray(value, fieldName) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw badRequest(`${fieldName} must be an array`);
  return value;
}

function getJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function toParentInviteDto(invite) {
  const invalidReason = getInviteInvalidReason(invite, new Date());
  return {
    id: invite.id,
    shortCode: invite.short_code,
    status: invite.status,
    maxUses: invite.max_uses,
    usedCount: invite.used_count,
    expiresAt: toIsoString(invite.expires_at),
    note: invite.note,
    revokedAt: toIsoString(invite.revoked_at),
    createdAt: toIsoString(invite.created_at),
    updatedAt: toIsoString(invite.updated_at),
    createdBy: invite.creator ? toUserSummaryDto(invite.creator) : null,
    revokedBy: invite.revoker ? toUserSummaryDto(invite.revoker) : null,
    isUsable: !invalidReason,
    invalidReason,
  };
}

function toParentInvitePublicDto(invite) {
  const dto = toParentInviteDto(invite);
  return {
    id: dto.id,
    shortCode: dto.shortCode,
    status: dto.status,
    maxUses: dto.maxUses,
    usedCount: dto.usedCount,
    expiresAt: dto.expiresAt,
    isUsable: dto.isUsable,
    invalidReason: dto.invalidReason,
  };
}

async function toParentApplicationDto(application) {
  const dto = {
    id: application.id,
    userId: application.user_id,
    status: application.status,
    displayName: application.display_name,
    realName: application.real_name,
    contactPhone: application.contact_phone,
    contactWechat: application.contact_wechat,
    city: application.city,
    existingCatClaims: getJsonArray(application.existing_cat_claims_json),
    newCats: getJsonArray(application.new_cats_json),
    adminNote: application.admin_note,
    reviewedAt: toIsoString(application.reviewed_at),
    approvedParentProfileId: application.approved_parent_profile_id,
    createdAt: toIsoString(application.created_at),
    updatedAt: toIsoString(application.updated_at),
    user: application.user ? toUserSummaryDto(application.user) : null,
    invite: application.invite ? toParentInvitePublicDto(application.invite) : null,
    reviewedBy: application.reviewer ? toUserSummaryDto(application.reviewer) : null,
  };

  return attachClaimedCatDetails(dto);
}

function toUserSummaryDto(user) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    phone: user.phone,
  };
}

function toCatSummaryDto(cat) {
  return {
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    lifecycleStatus: cat.lifecycle_status,
    visibility: cat.visibility,
    deletedAt: toIsoString(cat.deleted_at),
  };
}

function hashInviteToken(token) {
  return createHash("sha256").update(`parent-invite:${token}`).digest("hex");
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

function optionalString(value, fieldName) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
  return value.trim() || undefined;
}

function nullableString(value, fieldName) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
  return value.trim() || null;
}

function optionalPositiveInteger(value, fieldName) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 100) {
    throw badRequest(`${fieldName} must be an integer from 1 to 100`);
  }
  return parsed;
}

function parseNullableDate(value, fieldName) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be an ISO date string`);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${fieldName} must be a valid ISO date string`);
  }

  return parsed;
}

function optionalDateString(value, fieldName) {
  if (value == null || value === "") return null;
  const parsed = parseNullableDate(value, fieldName);
  return parsed ? parsed.toISOString() : null;
}

function normalizeShortCode(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function toIsoString(value) {
  return value ? value.toISOString() : null;
}

const inviteInclude = {
  creator: true,
  revoker: true,
};

const applicationInclude = {
  user: true,
  invite: true,
  reviewer: true,
};
