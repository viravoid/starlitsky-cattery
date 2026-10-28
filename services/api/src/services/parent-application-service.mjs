import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";
import { validateParentCatLinkRelationship } from "./parent-cat-link-validation.mjs";
import { consumeParentPhoneVerification } from "./parent-phone-verification-service.mjs";
import { limitParentRequest } from "./parent-request-limit.mjs";

const INVITE_STATUS_ACTIVE = "active";
const INVITE_STATUS_REVOKED = "revoked";
const INVITE_STATUS_USED = "used";
const APPLICATION_STATUS_PENDING = "pending";
const APPLICATION_STATUS_APPROVED = "approved";
const APPLICATION_STATUS_REJECTED = "rejected";

const SUBMIT_APPLICATION_FIELDS = [
  "phoneVerificationToken",
  "displayName",
  "realName",
  "contactPhone",
  "contactWechat",
  "city",
  "existingCatClaims",
  "unlistedCatClaims",
  "newCats",
];
const REVIEW_APPLICATION_FIELDS = ["adminNote", "unlistedCatResolutions", "newCatConfirmations"];

export async function submitParentApplication(input, user) {
  limitParentRequest("submit", user.id, { max: 10, windowMs: 60 * 60 * 1000 });
  assertPlainObject(input);
  assertNoUnknownFields(input, SUBMIT_APPLICATION_FIELDS);

  const profile = normalizeProfileInput(input);
  if (!profile.contactPhone && !profile.contactWechat && !input.phoneVerificationToken) {
    throw badRequest("Please provide a phone number or WeChat contact");
  }
  if (profile.contactPhone && input.phoneVerificationToken) {
    throw badRequest("Choose either a WeChat phone or a manually entered phone");
  }
  const existingCatClaims = normalizeExistingCatClaims(input.existingCatClaims);
  const unlistedCatClaims = normalizeUnlistedCatClaims(input.unlistedCatClaims);
  const newCats = normalizeNewCats(input.newCats);
  if (existingCatClaims.length + unlistedCatClaims.length + newCats.length === 0) {
    throw badRequest("At least one existing cat claim or new cat must be provided");
  }

  const application = await prisma.$transaction(async (transaction) => {
    const activeParent = await transaction.parentProfile.findUnique({
      where: { user_id: user.id },
      select: { status: true },
    });
    if (activeParent?.status === "active") throw badRequest("Parent identity is already active");
    const pending = await transaction.parentApplication.findFirst({
      where: { user_id: user.id, status: APPLICATION_STATUS_PENDING },
      select: { id: true },
    });
    if (pending) throw badRequest("User already has an active pending parent application");
    await ensureClaimedCatsExist(existingCatClaims, transaction);
    const recent = await transaction.parentApplication.findFirst({
      where: { user_id: user.id, created_at: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      select: { id: true },
    });
    if (recent) throw badRequest("Please wait one hour before submitting another application");
    const verifiedPhone = input.phoneVerificationToken
      ? await consumeParentPhoneVerification(transaction, user.id, input.phoneVerificationToken)
      : null;

    try {
      return await transaction.parentApplication.create({
        data: {
          user_id: user.id,
          pending_dedup_key: user.id,
          display_name: profile.displayName,
          real_name: profile.realName,
          contact_phone: verifiedPhone?.phone ?? profile.contactPhone,
          contact_phone_source: verifiedPhone
            ? "wechat_verified"
            : profile.contactPhone
              ? "self_provided"
              : "none",
          contact_phone_verified_at: verifiedPhone?.verifiedAt ?? null,
          contact_wechat: profile.contactWechat,
          city: profile.city,
          existing_cat_claims_json: existingCatClaims,
          unlisted_cat_claims_json: unlistedCatClaims,
          new_cats_json: newCats,
        },
        include: applicationInclude,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw badRequest("User already has an active pending parent application");
      }
      throw error;
    }
  });

  return toParentApplicationDto(application);
}

export async function searchParentClaimCatCandidates(searchParams, user) {
  limitParentRequest("search", user.id, { max: 30, windowMs: 60 * 1000 });
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const query = searchParams.get("q")?.trim();
  if (!query || query.length < 2 || page > 5 || pageSize > 20) {
    throw badRequest(
      "Search requires at least two characters and is limited to five pages of 20 cats",
    );
  }
  const where = {
    deleted_at: null,
    visibility: "visible",
    name: { contains: query },
  };

  const [items, total] = await prisma.$transaction([
    prisma.cat.findMany({
      where,
      select: {
        id: true,
        name: true,
      },
      orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.cat.count({ where }),
  ]);

  return {
    items: items.map(toParentClaimCatCandidateDto),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function searchAdminParentCatCandidates(searchParams) {
  const query = searchParams.get("q")?.trim();
  if (!query || query.length < 2 || query.length > 80) {
    throw badRequest("Search requires 2 to 80 characters");
  }
  const cats = await prisma.cat.findMany({
    where: { deleted_at: null, name: { contains: query } },
    select: { id: true, name: true, gender: true, color: true, visibility: true },
    orderBy: [{ updated_at: "desc" }, { id: "asc" }],
    take: 20,
  });
  return cats.map((cat) => ({
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    visibility: cat.visibility,
  }));
}

export async function getMyParentApplication(user) {
  const application = await prisma.parentApplication.findFirst({
    where: {
      user_id: user.id,
    },
    include: applicationInclude,
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });

  return application ? toParentApplicationDto(application, { publicView: true }) : null;
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
    const now = new Date();
    const claim = await transaction.parentApplication.updateMany({
      where: { id: applicationId, status: APPLICATION_STATUS_PENDING },
      data: {
        status: APPLICATION_STATUS_APPROVED,
        admin_note: nullableString(input.adminNote, "adminNote"),
        reviewed_by: adminUser.id,
        reviewed_at: now,
        pending_dedup_key: null,
      },
    });
    if (claim.count === 0) {
      const current = await transaction.parentApplication.findUnique({
        where: { id: applicationId },
        include: applicationInclude,
      });
      if (!current) throw notFound("Parent application not found");
      if (current.status === APPLICATION_STATUS_APPROVED) return current;
      throw badRequest("Only pending applications can be approved");
    }

    const existing = await transaction.parentApplication.findUnique({
      where: { id: applicationId },
      include: applicationInclude,
    });
    if (!existing) throw notFound("Parent application not found");

    const parentProfile = await upsertActiveParentProfile(existing, transaction, now);
    await ensureParentRole(existing.user_id, adminUser.id, transaction);
    await createExistingCatLinks(existing, parentProfile.id, adminUser.id, transaction);
    await createUnlistedCatLinks(
      existing,
      input.unlistedCatResolutions,
      parentProfile.id,
      adminUser.id,
      transaction,
    );
    await createNewCatsAndLinks(
      existing,
      input.newCatConfirmations,
      parentProfile.id,
      adminUser.id,
      transaction,
    );

    return transaction.parentApplication.update({
      where: { id: applicationId },
      data: {
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
    const result = await transaction.parentApplication.updateMany({
      where: { id: applicationId, status: APPLICATION_STATUS_PENDING },
      data: {
        status: APPLICATION_STATUS_REJECTED,
        admin_note: nullableString(input.adminNote, "adminNote"),
        reviewed_by: adminUser.id,
        reviewed_at: new Date(),
        pending_dedup_key: null,
      },
    });

    if (result.count === 0) {
      const current = await transaction.parentApplication.findUnique({
        where: { id: applicationId },
        include: applicationInclude,
      });
      if (!current) throw notFound("Parent application not found");
      if (current.status === APPLICATION_STATUS_REJECTED) return current;
      throw badRequest("Only pending applications can be rejected");
    }

    return transaction.parentApplication.findUnique({
      where: { id: applicationId },
      include: applicationInclude,
    });
  });

  return toParentApplicationDto(application);
}

async function upsertActiveParentProfile(application, transaction, now) {
  return transaction.parentProfile.upsert({
    where: { user_id: application.user_id },
    update: {
      display_name: application.display_name,
      real_name: application.real_name,
      contact_phone: application.contact_phone,
      contact_phone_source: application.contact_phone_source,
      contact_phone_verified_at: application.contact_phone_verified_at,
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
      contact_phone_source: application.contact_phone_source,
      contact_phone_verified_at: application.contact_phone_verified_at,
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

async function createUnlistedCatLinks(
  application,
  resolutions,
  parentProfileId,
  adminUserId,
  transaction,
) {
  const claims = getJsonArray(application.unlisted_cat_claims_json);
  const decisions = validateReviewDecisions(resolutions, claims, "unlistedCatResolutions");
  for (const [index, claim] of claims.entries()) {
    const decision = decisions.get(index);
    assertPlainObject(decision, `unlistedCatResolutions[${index}]`);
    assertNoUnknownFields(decision, ["index", "catId", "confirmedCatName", "confirmedClaimName"]);
    if (decision.confirmedClaimName !== claim.name)
      throw badRequest("Claim confirmation does not match application");
    const catId = requiredString(decision.catId, "catId");
    const cat = await transaction.cat.findFirst({
      where: { id: catId, deleted_at: null },
      select: { name: true },
    });
    if (!cat || cat.name !== decision.confirmedCatName) {
      throw badRequest("Selected cat confirmation is missing or stale");
    }
    await ensureParentCatLink({
      parentProfileId,
      catId,
      relationship: claim.relationship || "owner",
      startedAt: parseNullableDate(claim.arrivedAt, "arrivedAt"),
      note: claim.identification,
      adminUserId,
      transaction,
    });
  }
}

async function createNewCatsAndLinks(
  application,
  confirmations,
  parentProfileId,
  adminUserId,
  transaction,
) {
  const cats = getJsonArray(application.new_cats_json);
  const decisions = validateReviewDecisions(confirmations, cats, "newCatConfirmations");
  for (const [index, input] of cats.entries()) {
    const decision = decisions.get(index);
    assertPlainObject(decision, `newCatConfirmations[${index}]`);
    assertNoUnknownFields(decision, [
      "index",
      "action",
      "confirmedName",
      "catId",
      "confirmedCatName",
    ]);
    if (decision.confirmedName !== input.name)
      throw badRequest("New cat confirmation does not match application");
    if (decision.action === "link_existing") {
      const catId = requiredString(decision.catId, "catId");
      const target = await transaction.cat.findFirst({
        where: { id: catId, deleted_at: null },
        select: { name: true },
      });
      if (!target || target.name !== decision.confirmedCatName) {
        throw badRequest("Selected cat confirmation is missing or stale");
      }
      await ensureParentCatLink({
        parentProfileId,
        catId,
        relationship: input.relationship || "owner",
        startedAt: parseNullableDate(input.arrivedAt, "arrivedAt"),
        note: input.note || null,
        adminUserId,
        transaction,
      });
      continue;
    }
    if (decision.action !== "create" || decision.catId || decision.confirmedCatName) {
      throw badRequest("New cat requires an explicit create or existing cat decision");
    }
    const sameName = await transaction.cat.findMany({
      where: { deleted_at: null },
      select: { name: true },
    });
    if (
      sameName.some(
        (cat) => cat.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase(),
      )
    ) {
      throw badRequest(
        "A cat with this name already exists; review its profile before creating a new cat",
      );
    }
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

function validateReviewDecisions(value, items, fieldName) {
  if (items.length === 0 && value == null) return new Map();
  if (!Array.isArray(value) || value.length !== items.length) {
    throw badRequest(`Every ${fieldName} item must be explicitly confirmed`);
  }
  const decisions = new Map();
  for (const decision of value) {
    if (
      !Number.isInteger(decision?.index) ||
      decision.index < 0 ||
      decision.index >= items.length ||
      decisions.has(decision.index)
    ) {
      throw badRequest(`Invalid ${fieldName} index`);
    }
    decisions.set(decision.index, decision);
  }
  return decisions;
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
  const activeDedupKey = buildParentCatLinkDedupKey(parentProfileId, catId, relationship);
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

  try {
    await transaction.parentCatLink.create({
      data: {
        parent_profile_id: parentProfileId,
        cat_id: catId,
        active_dedup_key: activeDedupKey,
        relationship,
        status: "active",
        started_at: startedAt,
        note,
        created_by: adminUserId,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return;
    throw error;
  }
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
      visibility: "visible",
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

function normalizeProfileInput(input) {
  const profile = {
    displayName: requiredString(input.displayName, "displayName"),
    realName: nullableString(input.realName, "realName"),
    contactPhone: nullableString(input.contactPhone, "contactPhone"),
    contactWechat: nullableString(input.contactWechat, "contactWechat"),
    city: nullableString(input.city, "city"),
  };
  if (
    profile.displayName.length > 40 ||
    [profile.realName, profile.contactWechat, profile.city].some(
      (value) => value && value.length > 80,
    )
  ) {
    throw badRequest("Profile field is too long");
  }
  if (profile.contactPhone && !/^\+?[0-9 -]{7,20}$/.test(profile.contactPhone)) {
    throw badRequest("Contact phone format is invalid");
  }
  return profile;
}

function normalizeExistingCatClaims(value) {
  const claims = getOptionalArray(value, "existingCatClaims");
  if (claims.length > 3) throw badRequest("Too many cat claims");
  return claims.map((claim, index) => {
    assertPlainObject(claim, `existingCatClaims[${index}]`);
    assertNoUnknownFields(claim, ["catId", "relationship", "startedAt", "note"]);
    return {
      catId: requiredString(claim.catId, `existingCatClaims[${index}].catId`),
      relationship: validateParentCatLinkRelationship(
        optionalString(claim.relationship, `existingCatClaims[${index}].relationship`) ?? "owner",
        `existingCatClaims[${index}].relationship`,
      ),
      startedAt: optionalDateString(claim.startedAt, `existingCatClaims[${index}].startedAt`),
      note: nullableString(claim.note, `existingCatClaims[${index}].note`),
    };
  });
}

function normalizeNewCats(value) {
  const cats = getOptionalArray(value, "newCats");
  if (cats.length > 3) throw badRequest("Too many cats");
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
      relationship: validateParentCatLinkRelationship(
        optionalString(cat.relationship, `newCats[${index}].relationship`) ?? "owner",
        `newCats[${index}].relationship`,
      ),
    };
  });
}

function normalizeUnlistedCatClaims(value) {
  const claims = getOptionalArray(value, "unlistedCatClaims");
  if (claims.length > 3) throw badRequest("Too many unlisted cat claims");
  return claims.map((claim, index) => {
    assertPlainObject(claim, `unlistedCatClaims[${index}]`);
    assertNoUnknownFields(claim, ["name", "identification", "arrivedAt", "relationship"]);
    const name = requiredString(claim.name, `unlistedCatClaims[${index}].name`);
    const identification = requiredString(
      claim.identification,
      `unlistedCatClaims[${index}].identification`,
    );
    if (name.length > 80 || identification.length > 500)
      throw badRequest("Unlisted cat claim is too long");
    return {
      name,
      identification,
      arrivedAt: optionalDateString(claim.arrivedAt, `unlistedCatClaims[${index}].arrivedAt`),
      relationship: validateParentCatLinkRelationship(
        optionalString(claim.relationship, `unlistedCatClaims[${index}].relationship`) ?? "owner",
        `unlistedCatClaims[${index}].relationship`,
      ),
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

function toParentInvitePublicDto(invite) {
  const invalidReason = getInviteInvalidReason(invite, new Date());
  return {
    id: invite.id,
    shortCode: invite.short_code,
    status: invite.status,
    maxUses: invite.max_uses,
    usedCount: invite.used_count,
    expiresAt: toIsoString(invite.expires_at),
    isUsable: !invalidReason,
    invalidReason,
  };
}

async function toParentApplicationDto(application, { publicView = false } = {}) {
  const dto = {
    id: application.id,
    userId: application.user_id,
    status: application.status,
    displayName: application.display_name,
    realName: application.real_name,
    contactPhone: application.contact_phone,
    contactPhoneSource: application.contact_phone_source,
    contactPhoneVerifiedAt: toIsoString(application.contact_phone_verified_at),
    contactWechat: application.contact_wechat,
    city: application.city,
    existingCatClaims: getJsonArray(application.existing_cat_claims_json),
    unlistedCatClaims: getJsonArray(application.unlisted_cat_claims_json),
    newCats: getJsonArray(application.new_cats_json),
    adminNote: application.admin_note,
    reviewedAt: toIsoString(application.reviewed_at),
    approvedParentProfileId: application.approved_parent_profile_id,
    createdAt: toIsoString(application.created_at),
    updatedAt: toIsoString(application.updated_at),
    user: application.user
      ? publicView
        ? {
            id: application.user.id,
            nickname: application.user.nickname,
            avatarUrl: application.user.avatar_url,
            phone: null,
          }
        : toUserSummaryDto(application.user)
      : null,
    invite: application.invite ? toParentInvitePublicDto(application.invite) : null,
    reviewedBy: application.reviewer ? toUserSummaryDto(application.reviewer) : null,
  };

  return publicView ? dto : attachClaimedCatDetails(dto);
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

function toParentClaimCatCandidateDto(cat) {
  return {
    id: cat.id,
    name: cat.name,
  };
}

function buildParentCatLinkDedupKey(parentProfileId, catId, relationship) {
  return `${parentProfileId}:${catId}:${relationship}`;
}

function isUniqueConstraintError(error) {
  return error?.code === "P2002";
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

function toIsoString(value) {
  return value ? value.toISOString() : null;
}

const applicationInclude = {
  user: true,
  invite: true,
  reviewer: true,
};
