import { prisma } from "../db/prisma.mjs";
import { badRequest, forbidden, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";
import { resolveMediaSourceUrl, resolveMediaThumbnailUrl } from "./media-delivery-service.mjs";

const MY_CAT_CREATE_FIELDS = [
  "name",
  "gender",
  "color",
  "birthday",
  "personality",
  "relationship",
  "relationshipStartedAt",
  "note",
];
const MY_CAT_UPDATE_FIELDS = MY_CAT_CREATE_FIELDS;
const GENDER_VALUES = new Set(["male", "female"]);
const RELATIONSHIP_VALUES = new Set(["owner", "co_owner", "caregiver"]);
const OVERLAY_PREFIX = "parent-cat-profile:v1:";

export async function listMyCats(searchParams, user) {
  const parentProfileId = requireActiveParentProfileId(user);
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const where = buildActiveParentCatLinkWhere(parentProfileId);

  const [links, total] = await prisma.$transaction([
    prisma.parentCatLink.findMany({
      where,
      include: MY_CAT_LINK_INCLUDE,
      orderBy: [{ started_at: "desc" }, { created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.parentCatLink.count({ where }),
  ]);
  const mediaByCatId = await listVisibleCatMedia(links.map((link) => link.cat_id));

  return {
    items: links.map((link) => toMyCatDto(link, mediaByCatId)),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getMyCat(id, user) {
  const parentProfileId = requireActiveParentProfileId(user);
  const link = await prisma.parentCatLink.findFirst({
    where: {
      ...buildActiveParentCatLinkWhere(parentProfileId),
      cat_id: id,
    },
    include: MY_CAT_LINK_INCLUDE,
  });

  if (!link) throw notFound("My cat not found");
  const [mediaByCatId, timelinePosts] = await Promise.all([
    listVisibleCatMedia([link.cat_id]),
    listCatTimelinePosts(link.cat_id, user),
  ]);

  return toMyCatDto(link, mediaByCatId, timelinePosts);
}

export async function createMyCat(input, user) {
  const parentProfileId = requireActiveParentProfileId(user);
  const data = normalizeMyCatInput(input, {
    allowedFields: MY_CAT_CREATE_FIELDS,
    requireName: true,
  });
  const overlay = buildOverlay(data);

  const link = await prisma.$transaction(async (tx) => {
    const cat = await tx.cat.create({
      data: {
        name: data.name,
        gender: data.gender,
        color: data.color,
        birthday: parseOptionalDate(data.birthday, "birthday"),
        lifecycle_status: "adopted",
        personality: data.personality,
        story_json: { parentCreated: true },
        visibility: "hidden",
      },
    });

    return tx.parentCatLink.create({
      data: {
        parent_profile_id: parentProfileId,
        cat_id: cat.id,
        relationship: data.relationship,
        status: "active",
        started_at: parseOptionalDate(data.relationshipStartedAt, "relationshipStartedAt"),
        note: encodeOverlay(overlay),
        created_by: user.id,
      },
      include: MY_CAT_LINK_INCLUDE,
    });
  });

  const mediaByCatId = await listVisibleCatMedia([link.cat_id]);
  return toMyCatDto(link, mediaByCatId, []);
}

export async function updateMyCat(id, input, user) {
  const parentProfileId = requireActiveParentProfileId(user);
  const data = normalizeMyCatInput(input, {
    allowedFields: MY_CAT_UPDATE_FIELDS,
    requireName: false,
  });
  if (Object.keys(data).length === 0) throw badRequest("At least one my cat field must be provided");

  const existing = await findOwnedCatLink(parentProfileId, id);
  const overlay = {
    ...decodeOverlay(existing.note),
    ...buildOverlay(data),
  };
  const updateData = {
    note: encodeOverlay(overlay),
  };

  if (Object.hasOwn(data, "relationship")) updateData.relationship = data.relationship;
  if (Object.hasOwn(data, "relationshipStartedAt")) {
    updateData.started_at = parseOptionalDate(data.relationshipStartedAt, "relationshipStartedAt");
  }

  const updated = await prisma.parentCatLink.update({
    where: { id: existing.id },
    data: updateData,
    include: MY_CAT_LINK_INCLUDE,
  });
  const [mediaByCatId, timelinePosts] = await Promise.all([
    listVisibleCatMedia([updated.cat_id]),
    listCatTimelinePosts(updated.cat_id, user),
  ]);

  return toMyCatDto(updated, mediaByCatId, timelinePosts);
}

export async function deleteMyCat(id, user) {
  const parentProfileId = requireActiveParentProfileId(user);
  const existing = await findOwnedCatLink(parentProfileId, id);
  const deleted = await prisma.parentCatLink.update({
    where: { id: existing.id },
    data: {
      status: "inactive",
      ended_at: new Date(),
      deleted_at: new Date(),
    },
    include: MY_CAT_LINK_INCLUDE,
  });
  const mediaByCatId = await listVisibleCatMedia([deleted.cat_id]);
  return toMyCatDto(deleted, mediaByCatId, []);
}

function requireActiveParentProfileId(user) {
  if (!user?.roles?.includes("parent") || user.parentProfile?.status !== "active") {
    throw forbidden("Active parent profile is required");
  }
  return user.parentProfile.id;
}

function buildActiveParentCatLinkWhere(parentProfileId) {
  return {
    parent_profile_id: parentProfileId,
    status: "active",
    deleted_at: null,
    cat: {
      deleted_at: null,
    },
  };
}

async function findOwnedCatLink(parentProfileId, catId) {
  const link = await prisma.parentCatLink.findFirst({
    where: {
      ...buildActiveParentCatLinkWhere(parentProfileId),
      cat_id: catId,
    },
    include: MY_CAT_LINK_INCLUDE,
  });

  if (!link) throw notFound("My cat not found");
  return link;
}

async function listVisibleCatMedia(catIds) {
  if (catIds.length === 0) return new Map();

  const media = await prisma.mediaAsset.findMany({
    where: {
      deleted_at: null,
      status: "active",
      bindings: {
        some: {
          owner_type: "cat",
          owner_id: { in: catIds },
          visibility: "visible",
          deleted_at: null,
        },
      },
    },
    include: {
      bindings: {
        where: {
          owner_type: "cat",
          owner_id: { in: catIds },
          visibility: "visible",
          deleted_at: null,
        },
        orderBy: [{ sort_order: "asc" }, { created_at: "desc" }, { id: "asc" }],
      },
    },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });

  const byCatId = new Map(catIds.map((catId) => [catId, []]));
  for (const item of media) {
    for (const binding of item.bindings) {
      byCatId.get(binding.owner_id)?.push(toMediaDto(item, binding));
    }
  }
  for (const items of byCatId.values()) {
    items.sort(
      (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
    );
  }
  return byCatId;
}

async function listCatTimelinePosts(catId, user) {
  const posts = await prisma.post.findMany({
    where: {
      deleted_at: null,
      post_cats: {
        some: { cat_id: catId },
      },
      OR: [{ visibility: "visible" }, { author_user_id: user.id }],
    },
    include: {
      post_cats: { include: { cat: true } },
      post_litters: { include: { litter: true } },
    },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
    take: 50,
  });
  const postIds = posts.map((post) => post.id);
  const [mediaByPostId, commentGroups, likeGroups, viewerLikes] = await Promise.all([
    listVisiblePostMedia(postIds),
    postIds.length === 0
      ? []
      : prisma.comment.groupBy({
          by: ["post_id"],
          where: {
            post_id: { in: postIds },
            deleted_at: null,
            visibility: "visible",
          },
          _count: { _all: true },
        }),
    postIds.length === 0
      ? []
      : prisma.postLike.groupBy({
          by: ["post_id"],
          where: { post_id: { in: postIds } },
          _count: { _all: true },
        }),
    postIds.length === 0
      ? []
      : prisma.postLike.findMany({
          where: {
            post_id: { in: postIds },
            user_id: user.id,
          },
          select: { post_id: true },
        }),
  ]);

  const commentCountByPostId = new Map(
    commentGroups.map((group) => [group.post_id, group._count._all]),
  );
  const likeCountByPostId = new Map(likeGroups.map((group) => [group.post_id, group._count._all]));
  const likedPostIds = new Set(viewerLikes.map((like) => like.post_id));

  return posts.map((post) =>
    toTimelinePostDto(post, {
      commentCountByPostId,
      likeCountByPostId,
      likedPostIds,
      mediaByPostId,
      viewer: user,
    }),
  );
}

async function listVisiblePostMedia(postIds) {
  if (postIds.length === 0) return new Map();

  const media = await prisma.mediaAsset.findMany({
    where: {
      deleted_at: null,
      status: "active",
      bindings: {
        some: {
          owner_type: "post",
          owner_id: { in: postIds },
          visibility: "visible",
          deleted_at: null,
        },
      },
    },
    include: {
      bindings: {
        where: {
          owner_type: "post",
          owner_id: { in: postIds },
          visibility: "visible",
          deleted_at: null,
        },
        orderBy: [{ sort_order: "asc" }, { created_at: "desc" }, { id: "asc" }],
      },
    },
    orderBy: [{ created_at: "desc" }, { id: "asc" }],
  });

  const byPostId = new Map(postIds.map((postId) => [postId, []]));
  for (const item of media) {
    for (const binding of item.bindings) {
      byPostId.get(binding.owner_id)?.push(toMediaDto(item, binding));
    }
  }
  for (const items of byPostId.values()) {
    items.sort(
      (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
    );
  }
  return byPostId;
}

function toMyCatDto(link, mediaByCatId, timelinePosts = []) {
  const cat = link.cat;
  const overlay = decodeOverlay(link.note);
  return {
    id: cat.id,
    name: overlay.name ?? cat.name,
    gender: overlay.gender ?? cat.gender,
    color: overlay.color ?? cat.color,
    birthday: overlay.birthday ?? toIsoString(cat.birthday),
    lifecycleStatus: cat.lifecycle_status,
    personality: overlay.personality ?? cat.personality,
    visibility: cat.visibility,
    mediaAssets: mediaByCatId.get(cat.id) ?? [],
    relationship: link.relationship,
    relationshipStartedAt: toIsoString(link.started_at),
    note: overlay.note ?? null,
    litter: cat.kitten_profile?.litter ? toLitterDto(cat.kitten_profile.litter) : null,
    timelinePosts,
    createdAt: toIsoString(cat.created_at),
    updatedAt: toIsoString(cat.updated_at),
  };
}

function toTimelinePostDto(post, publicData) {
  return {
    id: post.id,
    authorName: post.author_name_snapshot,
    authorRole: post.author_role_snapshot,
    category: post.category,
    content: post.content,
    visibility: post.visibility,
    pinned: post.pinned,
    cats: post.post_cats.map((item) => toVisibleCatDto(item.cat)).filter(Boolean),
    litters: post.post_litters.map((item) => toVisibleLitterDto(item.litter)).filter(Boolean),
    mediaAssets: publicData.mediaByPostId.get(post.id) ?? [],
    comments: [],
    commentCount: publicData.commentCountByPostId.get(post.id) ?? 0,
    likeCount: publicData.likeCountByPostId.get(post.id) ?? 0,
    likedByMe: publicData.likedPostIds.has(post.id),
    canEdit: canManagePost(publicData.viewer, post),
    canDelete: canManagePost(publicData.viewer, post),
    createdAt: toIsoString(post.created_at),
    updatedAt: toIsoString(post.updated_at),
  };
}

function toVisibleCatDto(cat) {
  if (!cat || cat.deleted_at || cat.visibility !== "visible") return null;
  return {
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    lifecycleStatus: cat.lifecycle_status,
    visibility: cat.visibility,
  };
}

function toVisibleLitterDto(litter) {
  if (!litter || litter.deleted_at || litter.visibility !== "visible") return null;
  return toLitterDto(litter);
}

function toLitterDto(litter) {
  return {
    id: litter.id,
    name: litter.name,
    status: litter.status,
    birthDate: toIsoString(litter.birth_date),
    expectedBirthDate: toIsoString(litter.expected_birth_date),
    visibility: litter.visibility,
  };
}

function toMediaDto(media, binding) {
  return {
    id: media.id,
    kind: media.kind,
    sourceUrl: resolveMediaSourceUrl(media),
    thumbnailUrl: resolveMediaThumbnailUrl(media),
    title: media.title,
    altText: media.alt_text,
    mimeType: media.mime_type,
    width: media.width,
    height: media.height,
    usage: binding.usage,
    sortOrder: binding.sort_order,
  };
}

function canManagePost(user, post) {
  if (!user || !post) return false;
  return (
    user.roles?.includes("admin") ||
    user.roles?.includes("keeper") ||
    (user.roles?.includes("parent") && post.author_user_id === user.id)
  );
}

function toIsoString(value) {
  return value ? value.toISOString() : null;
}

function normalizeMyCatInput(input, { allowedFields, requireName }) {
  requireObject(input);
  rejectUnsupportedFields(input, allowedFields);
  const data = {};

  if (Object.hasOwn(input, "name") || requireName) {
    data.name = requiredString(input.name, "name", 80);
  }
  copyOptionalString(data, input, "gender", 16);
  if (Object.hasOwn(data, "gender") && data.gender && !GENDER_VALUES.has(data.gender)) {
    throw badRequest("gender must be male or female");
  }
  copyOptionalString(data, input, "color", 80);
  copyOptionalString(data, input, "birthday", 32);
  if (Object.hasOwn(data, "birthday")) parseOptionalDate(data.birthday, "birthday");
  copyOptionalString(data, input, "personality", 500);
  copyOptionalString(data, input, "relationshipStartedAt", 32);
  if (Object.hasOwn(data, "relationshipStartedAt")) {
    parseOptionalDate(data.relationshipStartedAt, "relationshipStartedAt");
  }
  copyOptionalString(data, input, "note", 500);

  if (Object.hasOwn(input, "relationship")) {
    data.relationship = requiredString(input.relationship, "relationship", 32);
    if (!RELATIONSHIP_VALUES.has(data.relationship)) {
      throw badRequest("relationship must be owner, co_owner, or caregiver");
    }
  } else if (requireName) {
    data.relationship = "owner";
  }

  return data;
}

function buildOverlay(data) {
  const overlay = {};
  for (const key of ["name", "gender", "color", "birthday", "personality", "note"]) {
    if (Object.hasOwn(data, key)) overlay[key] = data[key];
  }
  return overlay;
}

function encodeOverlay(overlay) {
  return `${OVERLAY_PREFIX}${JSON.stringify(overlay)}`;
}

function decodeOverlay(note) {
  if (!note || !note.startsWith(OVERLAY_PREFIX)) return {};
  try {
    const value = JSON.parse(note.slice(OVERLAY_PREFIX.length));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function requireObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("Request body must be a JSON object");
  }
}

function rejectUnsupportedFields(input, allowedFields) {
  const unsupported = Object.keys(input).filter((key) => !allowedFields.includes(key));
  if (unsupported.length > 0) {
    throw badRequest("Request body contains unsupported fields", { fields: unsupported });
  }
}

function requiredString(value, fieldName, maxLength) {
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw badRequest(`${fieldName} is required`);
  if (trimmed.length > maxLength) throw badRequest(`${fieldName} is too long`);
  return trimmed;
}

function copyOptionalString(data, input, fieldName, maxLength) {
  if (!Object.hasOwn(input, fieldName)) return;
  const value = input[fieldName];
  if (value === null || value === undefined || value === "") {
    data[fieldName] = null;
    return;
  }
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw badRequest(`${fieldName} is too long`);
  data[fieldName] = trimmed || null;
}

function parseOptionalDate(value, fieldName) {
  if (!value) return null;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be an ISO date string`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${fieldName} must be a valid ISO date string`);
  return date;
}

const MY_CAT_LINK_INCLUDE = {
  cat: {
    include: {
      kitten_profile: {
        include: {
          litter: true,
        },
      },
    },
  },
};
