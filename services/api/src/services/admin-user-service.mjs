import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";
import {
  validateParentCatLinkRelationship,
  validateParentCatLinkStatus,
} from "./parent-cat-link-validation.mjs";

const CERTIFY_PARENT_FIELDS = [
  "userId",
  "displayName",
  "realName",
  "contactPhone",
  "contactWechat",
  "city",
  "note",
  "catLinks",
];
const CERTIFY_PARENT_LINK_FIELDS = [
  "catId",
  "relationship",
  "status",
  "startedAt",
  "endedAt",
  "note",
];

export async function listAdminUsers(searchParams) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const query = searchParams.get("q")?.trim();
  const role = searchParams.get("role")?.trim();
  const parentStatus = searchParams.get("parentStatus")?.trim();
  const wechatBound = searchParams.get("wechatBound")?.trim();

  const where = {};
  if (query) {
    where.OR = [
      { id: { contains: query } },
      { nickname: { contains: query } },
      { phone: { contains: query } },
      { wechat_openid: { contains: query } },
      { parent_profile: { is: { display_name: { contains: query } } } },
      { parent_profile: { is: { real_name: { contains: query } } } },
    ];
  }
  if (role) {
    where.roles = { some: { role, revoked_at: null } };
  }
  if (parentStatus) {
    where.parent_profile = { is: { status: parentStatus } };
  }
  if (wechatBound === "true") {
    where.wechat_openid = { not: null };
  } else if (wechatBound === "false") {
    where.wechat_openid = null;
  }

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      include: USER_MANAGEMENT_INCLUDE,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map(toAdminUserDto),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function certifyExistingUserAsParent(input, adminUser) {
  assertPlainObject(input);
  assertNoUnknownFields(input, CERTIFY_PARENT_FIELDS);

  const userId = requiredString(input.userId, "userId");
  const links = normalizeParentCatLinks(input.catLinks);

  const user = await prisma.$transaction(async (transaction) => {
    const existingUser = await transaction.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, status: true },
    });
    if (!existingUser) throw notFound("User not found");
    if (existingUser.status !== "active") throw badRequest("Only active users can be certified");

    await ensureCatsExist(links, transaction);
    const now = new Date();
    await ensureParentRole(userId, adminUser.id, transaction);

    let profile = await transaction.parentProfile.findUnique({
      where: { user_id: userId },
    });
    if (profile) {
      const data = buildExistingParentProfileUpdate(input, profile, now);
      if (Object.keys(data).length > 0) {
        profile = await transaction.parentProfile.update({
          where: { id: profile.id },
          data,
        });
      }
    } else {
      profile = await transaction.parentProfile.create({
        data: {
          user_id: userId,
          display_name:
            nullableString(input.displayName, "displayName") ||
            existingUser.nickname ||
            `User ${userId.slice(0, 8)}`,
          real_name: nullableString(input.realName, "realName"),
          contact_phone: nullableString(input.contactPhone, "contactPhone"),
          contact_wechat: nullableString(input.contactWechat, "contactWechat"),
          city: nullableString(input.city, "city"),
          status: "active",
          activated_at: now,
          note: nullableString(input.note, "note"),
        },
      });
    }

    for (const link of links) {
      await createParentCatLink(profile.id, link, adminUser.id, transaction);
    }

    return transaction.user.findUnique({
      where: { id: userId },
      include: USER_MANAGEMENT_INCLUDE,
    });
  });

  return toAdminUserDto(user);
}

function buildExistingParentProfileUpdate(input, profile, now) {
  const data = {};
  const providedDisplayName = getProvidedNonEmptyString(input, "displayName");
  if (providedDisplayName !== undefined) data.display_name = providedDisplayName;
  if (Object.hasOwn(input, "realName")) data.real_name = nullableString(input.realName, "realName");
  if (Object.hasOwn(input, "contactPhone")) {
    data.contact_phone = nullableString(input.contactPhone, "contactPhone");
  }
  if (Object.hasOwn(input, "contactWechat")) {
    data.contact_wechat = nullableString(input.contactWechat, "contactWechat");
  }
  if (Object.hasOwn(input, "city")) data.city = nullableString(input.city, "city");
  if (Object.hasOwn(input, "note")) data.note = nullableString(input.note, "note");
  if (profile.status !== "active") {
    data.status = "active";
    data.activated_at = now;
  }
  return data;
}

async function ensureParentRole(userId, adminUserId, transaction) {
  const existing = await transaction.userRole.findFirst({
    where: { user_id: userId, role: "parent", revoked_at: null },
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

async function ensureCatsExist(links, transaction) {
  if (links.length === 0) return;

  const cats = await transaction.cat.findMany({
    where: {
      id: { in: links.map((link) => link.catId) },
      deleted_at: null,
    },
    select: { id: true },
  });
  const existingIds = new Set(cats.map((cat) => cat.id));
  const missing = links.filter((link) => !existingIds.has(link.catId));
  if (missing.length > 0) {
    throw badRequest("One or more cats do not exist", {
      catIds: missing.map((link) => link.catId),
    });
  }
}

async function createParentCatLink(parentProfileId, link, adminUserId, transaction) {
  const status = link.status ?? "active";
  const relationship = link.relationship ?? "owner";
  const activeDedupKey =
    status === "active" ? buildParentCatLinkDedupKey(parentProfileId, link.catId, relationship) : null;

  try {
    await transaction.parentCatLink.create({
      data: {
        parent_profile_id: parentProfileId,
        cat_id: link.catId,
        active_dedup_key: activeDedupKey,
        relationship,
        status,
        started_at: parseNullableDate(link.startedAt, "startedAt"),
        ended_at: parseNullableDate(link.endedAt, "endedAt"),
        note: nullableString(link.note, "note"),
        created_by: adminUserId,
      },
    });
  } catch (error) {
    if (error?.code === "P2002") throw badRequest("Parent cat link already exists");
    throw error;
  }
}

function normalizeParentCatLinks(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw badRequest("catLinks must be an array");

  return value.map((link, index) => {
    assertPlainObject(link, `catLinks[${index}]`);
    assertNoUnknownFields(link, CERTIFY_PARENT_LINK_FIELDS);
    return {
      catId: requiredString(link.catId, `catLinks[${index}].catId`),
      relationship: validateParentCatLinkRelationship(
        optionalString(link.relationship, `catLinks[${index}].relationship`) ?? "owner",
        `catLinks[${index}].relationship`,
      ),
      status: validateParentCatLinkStatus(
        optionalString(link.status, `catLinks[${index}].status`) ?? "active",
        `catLinks[${index}].status`,
      ),
      startedAt: link.startedAt ?? null,
      endedAt: link.endedAt ?? null,
      note: link.note ?? null,
    };
  });
}

function toAdminUserDto(user) {
  return {
    id: user.id,
    wechatBound: Boolean(user.wechat_openid),
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    phone: user.phone,
    status: user.status,
    roles: resolveActiveRoles(user),
    parentProfile: user.parent_profile
      ? {
          ...toParentProfileDto(user.parent_profile),
          links: user.parent_profile.parent_cat_links.map(toParentCatLinkDto),
        }
      : null,
    pendingApplication: user.parent_applications[0]
      ? {
          id: user.parent_applications[0].id,
          status: user.parent_applications[0].status,
          displayName: user.parent_applications[0].display_name,
          createdAt: toIsoString(user.parent_applications[0].created_at),
        }
      : null,
    createdAt: toIsoString(user.created_at),
    updatedAt: toIsoString(user.updated_at),
  };
}

function resolveActiveRoles(user) {
  const roles = new Set(
    user.roles.filter((role) => !role.revoked_at).map((role) => role.role).filter(Boolean),
  );
  roles.add("user");
  if (user.parent_profile?.status === "active") roles.add("parent");
  return ["admin", "keeper", "parent", "user"].filter((role) => roles.has(role));
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
    cat: link.cat ? toCatSummaryDto(link.cat) : undefined,
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

function getProvidedNonEmptyString(input, fieldName) {
  if (!Object.hasOwn(input, fieldName)) return undefined;
  return optionalString(input[fieldName], fieldName);
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

function buildParentCatLinkDedupKey(parentProfileId, catId, relationship) {
  return `${parentProfileId}:${catId}:${relationship}`;
}

function toIsoString(value) {
  return value ? value.toISOString() : null;
}

const USER_MANAGEMENT_INCLUDE = {
  roles: true,
  parent_profile: {
    include: {
      parent_cat_links: {
        where: { deleted_at: null },
        include: { cat: true },
        orderBy: [{ status: "asc" }, { created_at: "desc" }, { id: "asc" }],
      },
    },
  },
  parent_applications: {
    where: { status: "pending" },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
    take: 1,
  },
};
