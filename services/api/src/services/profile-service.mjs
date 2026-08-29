import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";

const BREEDING_CREATE_FIELDS = [
  "category",
  "reproductiveState",
  "statusLabel",
  "trait",
  "source",
  "sortOrder",
];
const BREEDING_UPDATE_FIELDS = BREEDING_CREATE_FIELDS;
const KITTEN_CREATE_FIELDS = [
  "litterId",
  "saleStatus",
  "priceText",
  "structureRatingJson",
  "adoptedAt",
];
const KITTEN_UPDATE_FIELDS = KITTEN_CREATE_FIELDS;
const PARENT_PROFILE_CREATE_FIELDS = [
  "displayName",
  "realName",
  "contactPhone",
  "contactWechat",
  "city",
  "status",
  "note",
];
const PARENT_LINK_CREATE_FIELDS = [
  "parentProfileId",
  "relationship",
  "status",
  "startedAt",
  "endedAt",
  "note",
];
const PARENT_LINK_UPDATE_FIELDS = ["status"];

export async function getBreedingProfile(catId, options = { includeHidden: true }) {
  await ensureActiveCatExists(catId, options);
  const profile = await prisma.breedingCatProfile.findUnique({
    where: { cat_id: catId },
  });

  if (!profile) throw notFound("Breeding cat profile not found");
  return toBreedingProfileDto(profile);
}

export async function createBreedingProfile(catId, input) {
  assertPlainObject(input);
  await ensureActiveCatExists(catId);
  await ensureNoBreedingProfile(catId);

  const profile = await prisma.breedingCatProfile.create({
    data: {
      cat_id: catId,
      ...normalizeBreedingProfileInput(input, {
        mode: "create",
        allowedFields: BREEDING_CREATE_FIELDS,
      }),
    },
  });

  return toBreedingProfileDto(profile);
}

export async function updateBreedingProfile(catId, input) {
  assertPlainObject(input);
  await ensureBreedingProfileExists(catId);
  const data = normalizeBreedingProfileInput(input, {
    mode: "update",
    allowedFields: BREEDING_UPDATE_FIELDS,
  });

  if (Object.keys(data).length === 0) {
    throw badRequest("At least one breeding profile field must be provided");
  }

  const profile = await prisma.breedingCatProfile.update({
    where: { cat_id: catId },
    data,
  });

  return toBreedingProfileDto(profile);
}

export async function getKittenProfile(catId, options = { includeHidden: true }) {
  await ensureActiveCatExists(catId, options);
  const profile = await prisma.kittenProfile.findUnique({
    where: { cat_id: catId },
    include: {
      litter: {
        include: {
          father_cat: true,
          mother_cat: true,
        },
      },
    },
  });

  if (!profile) throw notFound("Kitten profile not found");
  return toKittenProfileDto(profile);
}

export async function createKittenProfile(catId, input) {
  assertPlainObject(input);
  await ensureActiveCatExists(catId);
  await ensureNoKittenProfile(catId);

  const data = normalizeKittenProfileInput(input, {
    mode: "create",
    allowedFields: KITTEN_CREATE_FIELDS,
  });
  await ensureActiveLitterExists(data.litter_id);

  const profile = await prisma.kittenProfile.create({
    data: {
      cat_id: catId,
      ...data,
    },
    include: {
      litter: {
        include: {
          father_cat: true,
          mother_cat: true,
        },
      },
    },
  });

  return toKittenProfileDto(profile);
}

export async function updateKittenProfile(catId, input) {
  assertPlainObject(input);
  await ensureKittenProfileExists(catId);
  const data = normalizeKittenProfileInput(input, {
    mode: "update",
    allowedFields: KITTEN_UPDATE_FIELDS,
  });

  if (Object.keys(data).length === 0) {
    throw badRequest("At least one kitten profile field must be provided");
  }
  if (data.litter_id) await ensureActiveLitterExists(data.litter_id);

  const profile = await prisma.kittenProfile.update({
    where: { cat_id: catId },
    data,
    include: {
      litter: {
        include: {
          father_cat: true,
          mother_cat: true,
        },
      },
    },
  });

  return toKittenProfileDto(profile);
}

export async function listLitterKittens(litterId) {
  await ensureActiveLitterExists(litterId);
  const profiles = await prisma.kittenProfile.findMany({
    where: { litter_id: litterId },
    include: { cat: true },
    orderBy: [{ cat_id: "asc" }],
  });

  return profiles.map(toKittenProfileDto);
}

export async function attachExistingCatToLitter(litterId, input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, [
    "catId",
    ...KITTEN_CREATE_FIELDS.filter((field) => field !== "litterId"),
  ]);
  const catId = requiredString(input.catId, "catId");

  return createKittenProfile(catId, {
    litterId,
    saleStatus: input.saleStatus,
    priceText: input.priceText,
    structureRatingJson: input.structureRatingJson,
    adoptedAt: input.adoptedAt,
  });
}

export async function listParentProfiles(searchParams) {
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
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.parentProfile.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.parentProfile.count({ where }),
  ]);

  return {
    items: items.map(toParentProfileDto),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function createParentProfile(input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, PARENT_PROFILE_CREATE_FIELDS);

  const profile = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        nickname: nullableString(input.displayName, "displayName"),
        roles: {
          create: {
            role: "parent",
          },
        },
      },
    });

    return transaction.parentProfile.create({
      data: {
        user_id: user.id,
        display_name: requiredString(input.displayName, "displayName"),
        real_name: nullableString(input.realName, "realName"),
        contact_phone: nullableString(input.contactPhone, "contactPhone"),
        contact_wechat: nullableString(input.contactWechat, "contactWechat"),
        city: nullableString(input.city, "city"),
        status: optionalString(input.status, "status") ?? "active",
        note: nullableString(input.note, "note"),
      },
    });
  });

  return toParentProfileDto(profile);
}

export async function listCatParentLinks(catId) {
  await ensureActiveCatExists(catId);
  const links = await prisma.parentCatLink.findMany({
    where: {
      cat_id: catId,
      deleted_at: null,
    },
    include: { parent_profile: true },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });

  return links.map(toParentCatLinkDto);
}

export async function createCatParentLink(catId, input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, PARENT_LINK_CREATE_FIELDS);
  await ensureActiveCatExists(catId);

  const parentProfileId = requiredString(input.parentProfileId, "parentProfileId");
  const relationship = requiredString(input.relationship, "relationship");
  const status = optionalString(input.status, "status") ?? "active";
  await ensureParentProfileExists(parentProfileId);

  let link;
  try {
    link = await prisma.parentCatLink.create({
      data: {
        cat_id: catId,
        parent_profile_id: parentProfileId,
        active_dedup_key:
          status === "active"
            ? buildParentCatLinkDedupKey(parentProfileId, catId, relationship)
            : null,
        relationship,
        status,
        started_at: parseNullableDate(input.startedAt, "startedAt"),
        ended_at: parseNullableDate(input.endedAt, "endedAt"),
        note: nullableString(input.note, "note"),
      },
      include: { parent_profile: true },
    });
  } catch (error) {
    if (error?.code === "P2002") throw badRequest("Parent cat link already exists");
    throw error;
  }

  return toParentCatLinkDto(link);
}

export async function updateParentCatLink(linkId, input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, PARENT_LINK_UPDATE_FIELDS);

  const existing = await prisma.parentCatLink.findFirst({
    where: {
      id: linkId,
      deleted_at: null,
    },
  });
  if (!existing) throw notFound("Parent cat link not found");

  const link = await prisma.parentCatLink.update({
    where: { id: linkId },
    data: {
      status: requiredString(input.status, "status"),
      active_dedup_key:
        input.status === "active"
          ? buildParentCatLinkDedupKey(
              existing.parent_profile_id,
              existing.cat_id,
              existing.relationship,
            )
          : null,
    },
    include: { parent_profile: true },
  });

  return toParentCatLinkDto(link);
}

async function ensureActiveCatExists(catId, options = { includeHidden: true }) {
  const cat = await prisma.cat.findFirst({
    where: {
      id: catId,
      deleted_at: null,
      ...(options.includeHidden ? {} : { visibility: "visible" }),
    },
    select: { id: true },
  });
  if (!cat) throw notFound("Cat not found");
}

async function ensureActiveLitterExists(litterId) {
  const litter = await prisma.litter.findFirst({
    where: {
      id: litterId,
      deleted_at: null,
    },
    select: { id: true },
  });
  if (!litter) throw notFound("Litter not found");
}

async function ensureParentProfileExists(parentProfileId) {
  const profile = await prisma.parentProfile.findUnique({
    where: { id: parentProfileId },
    select: { id: true },
  });
  if (!profile) throw notFound("Parent profile not found");
}

async function ensureNoBreedingProfile(catId) {
  const existing = await prisma.breedingCatProfile.findUnique({
    where: { cat_id: catId },
    select: { cat_id: true },
  });
  if (existing) throw badRequest("Breeding cat profile already exists");
}

async function ensureBreedingProfileExists(catId) {
  await ensureActiveCatExists(catId);
  const existing = await prisma.breedingCatProfile.findUnique({
    where: { cat_id: catId },
    select: { cat_id: true },
  });
  if (!existing) throw notFound("Breeding cat profile not found");
}

async function ensureNoKittenProfile(catId) {
  const existing = await prisma.kittenProfile.findUnique({
    where: { cat_id: catId },
    select: { cat_id: true },
  });
  if (existing) throw badRequest("Kitten profile already exists");
}

async function ensureKittenProfileExists(catId) {
  await ensureActiveCatExists(catId);
  const existing = await prisma.kittenProfile.findUnique({
    where: { cat_id: catId },
    select: { cat_id: true },
  });
  if (!existing) throw notFound("Kitten profile not found");
}

function normalizeBreedingProfileInput(input, { mode, allowedFields }) {
  assertNoUnknownFields(input, allowedFields);
  const data = {};

  if (mode === "create" || Object.hasOwn(input, "category")) {
    data.breeding_role = requiredString(input.category, "category");
  }
  if (mode === "create" || Object.hasOwn(input, "reproductiveState")) {
    data.reproductive_state = requiredString(input.reproductiveState, "reproductiveState");
  }

  data.status_label = nullableString(input.statusLabel, "statusLabel");
  data.trait = nullableString(input.trait, "trait");
  data.source = nullableString(input.source, "source");
  if (Object.hasOwn(input, "sortOrder")) {
    data.sort_order = optionalInteger(input.sortOrder, "sortOrder") ?? 0;
  }

  return removeUndefined(data);
}

function normalizeKittenProfileInput(input, { mode, allowedFields }) {
  assertNoUnknownFields(input, allowedFields);
  const data = {};

  if (mode === "create" || Object.hasOwn(input, "litterId")) {
    data.litter_id = requiredString(input.litterId, "litterId");
  }
  if (Object.hasOwn(input, "saleStatus")) {
    data.sale_status = optionalString(input.saleStatus, "saleStatus") ?? "evaluating";
  } else if (mode === "create") {
    data.sale_status = "evaluating";
  }
  data.price_text = nullableString(input.priceText, "priceText");
  if (Object.hasOwn(input, "structureRatingJson")) {
    data.structure_rating_json = input.structureRatingJson ?? null;
  }
  if (Object.hasOwn(input, "adoptedAt")) {
    data.adopted_at = parseNullableDate(input.adoptedAt, "adoptedAt");
  }

  return removeUndefined(data);
}

function toBreedingProfileDto(profile) {
  return {
    catId: profile.cat_id,
    category: profile.breeding_role,
    reproductiveState: profile.reproductive_state,
    statusLabel: profile.status_label,
    trait: profile.trait,
    source: profile.source,
    sortOrder: profile.sort_order,
  };
}

function toKittenProfileDto(profile) {
  return {
    catId: profile.cat_id,
    litterId: profile.litter_id,
    saleStatus: profile.sale_status,
    priceText: profile.price_text,
    structureRatingJson: profile.structure_rating_json,
    adoptedAt: toIsoString(profile.adopted_at),
    cat: profile.cat ? toCatSummaryDto(profile.cat) : undefined,
    litter: profile.litter ? toLitterSummaryDto(profile.litter) : undefined,
  };
}

function toLitterSummaryDto(litter) {
  return {
    id: litter.id,
    name: litter.name,
    status: litter.status,
    fatherCatId: litter.father_cat_id,
    motherCatId: litter.mother_cat_id,
    fatherCat: litter.father_cat ? toCatSummaryDto(litter.father_cat) : undefined,
    motherCat: litter.mother_cat ? toCatSummaryDto(litter.mother_cat) : undefined,
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
  };
}

function toParentProfileDto(profile) {
  return {
    id: profile.id,
    userId: profile.user_id,
    displayName: profile.display_name,
    realName: profile.real_name,
    contactPhone: profile.contact_phone,
    contactWechat: profile.contact_wechat,
    city: profile.city,
    status: profile.status,
    activatedAt: toIsoString(profile.activated_at),
    note: profile.note,
    createdAt: toIsoString(profile.created_at),
    updatedAt: toIsoString(profile.updated_at),
  };
}

function toParentCatLinkDto(link) {
  return {
    id: link.id,
    parentProfileId: link.parent_profile_id,
    catId: link.cat_id,
    relationship: link.relationship,
    status: link.status,
    startedAt: toIsoString(link.started_at),
    endedAt: toIsoString(link.ended_at),
    note: link.note,
    createdAt: toIsoString(link.created_at),
    updatedAt: toIsoString(link.updated_at),
    deletedAt: toIsoString(link.deleted_at),
    parentProfile: link.parent_profile ? toParentProfileDto(link.parent_profile) : undefined,
  };
}

function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Request body must be a JSON object");
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
  return value.trim();
}

function nullableString(value, fieldName) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
  return value.trim() || null;
}

function optionalInteger(value, fieldName) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw badRequest(`${fieldName} must be an integer`);
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

function removeUndefined(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function buildParentCatLinkDedupKey(parentProfileId, catId, relationship) {
  return `${parentProfileId}:${catId}:${relationship}`;
}

function toIsoString(value) {
  return value ? value.toISOString() : null;
}
