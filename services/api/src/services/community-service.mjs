import { prisma } from "../db/prisma.mjs";
import { badRequest, forbidden, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";
import { completeMediaUpload, requestImageUpload } from "./media-upload-service.mjs";

const CATEGORY_VALUES = new Set(["cattery_daily", "parent_share", "personal_thoughts"]);
const PARENT_CATEGORY_VALUES = new Set(["parent_share", "personal_thoughts"]);
const VISIBILITY_VALUES = new Set(["visible", "hidden", "archived"]);
const POST_CREATE_FIELDS = ["category", "content", "catIds", "litterIds", "visibility", "pinned"];
const POST_UPDATE_FIELDS = ["category", "content", "catIds", "litterIds", "visibility", "pinned"];
const COMMENT_CREATE_FIELDS = ["content"];

export async function listCommunityPosts(searchParams, viewer = null) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const where = buildPostWhere(searchParams);

  const [items, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      include: COMMUNITY_POST_INCLUDE,
      orderBy: [{ pinned: "desc" }, { created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.post.count({ where }),
  ]);
  const publicData = await getPublicPostSupplements(items.map((post) => post.id), { viewer });

  return {
    items: items.map((post) => toCommunityPostDto(post, publicData, { viewer })),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getCommunityPost(id, viewer = null) {
  const post = await prisma.post.findFirst({
    where: {
      id,
      deleted_at: null,
    },
    include: COMMUNITY_POST_DETAIL_INCLUDE,
  });

  if (!post) throw notFound("Community post not found");
  if (!canReadPostDetail(viewer, post)) throw notFound("Community post not found");

  const relationAccess = await getRelationAccessForPostDetail(viewer, post);
  const publicData = await getPublicPostSupplements([post.id], {
    includeComments: true,
    relationAccess,
    viewer,
  });
  return toCommunityPostDto(post, publicData);
}

export async function listMyCommunityPosts(searchParams, user) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const where = {
    author_user_id: user.id,
    deleted_at: null,
  };

  const [items, total] = await prisma.$transaction([
    prisma.post.findMany({
      where,
      include: COMMUNITY_POST_DETAIL_INCLUDE,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.post.count({ where }),
  ]);
  const publicData = await getPublicPostSupplements(items.map((post) => post.id), {
    includeComments: true,
    revealHiddenRelations: true,
    viewer: user,
  });

  return {
    items: items.map((post) =>
      toCommunityPostDto(post, publicData, {
        revealHiddenRelations: true,
        viewer: user,
      }),
    ),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getCommunityPostOptions(user) {
  const categories = getAllowedCreateCategories(user);
  if (categories.length === 0) throw forbidden("Current user cannot publish community posts");

  if (isPrivilegedUser(user)) {
    const [cats, litters] = await prisma.$transaction([
      prisma.cat.findMany({
        where: { deleted_at: null },
        select: {
          id: true,
          name: true,
          gender: true,
          color: true,
          lifecycle_status: true,
          visibility: true,
        },
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      }),
      prisma.litter.findMany({
        where: { deleted_at: null },
        select: {
          id: true,
          name: true,
          status: true,
          birth_date: true,
          expected_birth_date: true,
          visibility: true,
        },
        orderBy: [{ updated_at: "desc" }, { id: "asc" }],
      }),
    ]);

    return {
      categories,
      cats: cats.map(toPostOptionCatDto),
      litters: litters.map(toPostOptionLitterDto),
    };
  }

  const parentProfileId = getActiveParentProfileId(user);
  const links = await prisma.parentCatLink.findMany({
    where: {
      parent_profile_id: parentProfileId,
      status: "active",
      deleted_at: null,
      cat: { deleted_at: null },
    },
    include: { cat: true },
    orderBy: [{ started_at: "desc" }, { created_at: "desc" }, { id: "asc" }],
  });
  const catIds = links.map((link) => link.cat_id);
  const litters =
    catIds.length === 0
      ? []
      : await prisma.litter.findMany({
          where: {
            deleted_at: null,
            OR: [
              { father_cat_id: { in: catIds } },
              { mother_cat_id: { in: catIds } },
              { kitten_profiles: { some: { cat_id: { in: catIds } } } },
            ],
          },
          select: {
            id: true,
            name: true,
            status: true,
            birth_date: true,
            expected_birth_date: true,
            visibility: true,
          },
          orderBy: [{ updated_at: "desc" }, { id: "asc" }],
        });

  return {
    categories,
    cats: links.map((link) => ({
      ...toPostOptionCatDto(link.cat),
      relationship: link.relationship,
      startedAt: toIsoString(link.started_at),
    })),
    litters: litters.map(toPostOptionLitterDto),
  };
}

export async function createCommunityPost(input, user) {
  assertPlainObject(input);
  assertNoUnknownFields(input, POST_CREATE_FIELDS);
  const data = await normalizePostMutationInput(input, user, { mode: "create" });
  const authorSnapshot = getAuthorSnapshot(user);

  const post = await prisma.$transaction(async (transaction) => {
    const created = await transaction.post.create({
      data: {
        author_user_id: user.id,
        author_role_snapshot: authorSnapshot.role,
        author_name_snapshot: authorSnapshot.name,
        category: data.category,
        content: data.content,
        visibility: data.visibility,
        pinned: data.pinned,
      },
    });

    await replacePostRelations(transaction, created.id, data.catIds, data.litterIds);
    return transaction.post.findUnique({
      where: { id: created.id },
      include: COMMUNITY_POST_DETAIL_INCLUDE,
    });
  });

  const publicData = await getPublicPostSupplements([post.id], {
    includeComments: true,
    revealHiddenRelations: true,
    viewer: user,
  });
  return toCommunityPostDto(post, publicData, {
    revealHiddenRelations: true,
    viewer: user,
  });
}

export async function updateCommunityPost(id, input, user) {
  assertPlainObject(input);
  assertNoUnknownFields(input, POST_UPDATE_FIELDS);
  const existing = await getMutablePost(id);
  ensureCanManagePost(user, existing);
  const data = await normalizePostMutationInput(input, user, { mode: "update", existing });

  const post = await prisma.$transaction(async (transaction) => {
    await transaction.post.update({
      where: { id },
      data: {
        ...(data.category ? { category: data.category } : {}),
        ...(data.content ? { content: data.content } : {}),
        ...(data.visibility ? { visibility: data.visibility } : {}),
        ...(typeof data.pinned === "boolean" ? { pinned: data.pinned } : {}),
      },
    });
    if (data.catIds) await replacePostCats(transaction, id, data.catIds);
    if (data.litterIds) await replacePostLitters(transaction, id, data.litterIds);
    return transaction.post.findUnique({
      where: { id },
      include: COMMUNITY_POST_DETAIL_INCLUDE,
    });
  });

  const publicData = await getPublicPostSupplements([post.id], {
    includeComments: true,
    revealHiddenRelations: true,
    viewer: user,
  });
  return toCommunityPostDto(post, publicData, {
    revealHiddenRelations: true,
    viewer: user,
  });
}

export async function deleteCommunityPost(id, user) {
  const existing = await getMutablePost(id);
  ensureCanManagePost(user, existing);

  const now = new Date();
  const post = await prisma.post.update({
    where: { id },
    data: {
      deleted_at: now,
      visibility: "archived",
    },
    include: COMMUNITY_POST_DETAIL_INCLUDE,
  });

  const publicData = await getPublicPostSupplements([post.id], {
    includeComments: true,
    revealHiddenRelations: true,
    viewer: user,
  });
  return toCommunityPostDto(post, publicData, {
    revealHiddenRelations: true,
    viewer: user,
  });
}

export async function toggleCommunityPostLike(id, user) {
  await ensureVisiblePostExists(id);
  const existing = await prisma.postLike.findUnique({
    where: {
      post_id_user_id: {
        post_id: id,
        user_id: user.id,
      },
    },
    select: { id: true },
  });

  let liked = false;
  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.postLike.create({
      data: {
        post_id: id,
        user_id: user.id,
      },
    });
    liked = true;
  }

  const likeCount = await prisma.postLike.count({ where: { post_id: id } });
  return { liked, likeCount };
}

export async function createCommunityComment(postId, input, user) {
  assertPlainObject(input);
  assertNoUnknownFields(input, COMMENT_CREATE_FIELDS);
  await ensureVisiblePostExists(postId);

  const comment = await prisma.comment.create({
    data: {
      post_id: postId,
      author_user_id: user.id,
      content: normalizeContent(input.content, "content", 500),
    },
    include: COMMENT_INCLUDE,
  });

  return toCommunityCommentDto(comment, { viewer: user });
}

export async function deleteCommunityComment(postId, commentId, user) {
  await ensureVisiblePostExists(postId);
  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      post_id: postId,
      deleted_at: null,
    },
    include: COMMENT_INCLUDE,
  });
  if (!comment) throw notFound("Community comment not found");
  if (!isPrivilegedUser(user) && comment.author_user_id !== user.id) {
    throw forbidden("Only the comment author or a keeper can delete this comment");
  }

  const updated = await prisma.comment.update({
    where: { id: comment.id },
    data: {
      deleted_at: new Date(),
      visibility: "archived",
    },
    include: COMMENT_INCLUDE,
  });
  return toCommunityCommentDto(updated, { viewer: user });
}

export async function requestCommunityPostImageUpload(postId, input, user) {
  await ensureCanUploadToPost(postId, user);
  return requestImageUpload({
    ...input,
    ownerType: "post",
    ownerId: postId,
    bindingVisibility: "visible",
  });
}

export async function completeCommunityPostImageUpload(postId, mediaId, input, user) {
  await ensureCanUploadToPost(postId, user);
  const media = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaId,
      deleted_at: null,
      bindings: {
        some: {
          owner_type: "post",
          owner_id: postId,
          deleted_at: null,
        },
      },
    },
    select: { id: true },
  });
  if (!media) throw notFound("Community post media not found");
  return completeMediaUpload(mediaId, input);
}

function buildPostWhere(searchParams) {
  const category = searchParams.get("category");
  const litterId = searchParams.get("litterId");
  const query = searchParams.get("q");
  const where = {
    deleted_at: null,
    visibility: "visible",
  };

  if (category) {
    if (!CATEGORY_VALUES.has(category)) throw badRequest("category contains an unsupported value");
    where.category = category;
  }
  if (litterId) {
    where.post_litters = {
      some: {
        litter_id: litterId,
        litter: {
          deleted_at: null,
          visibility: "visible",
        },
      },
    };
  }
  if (query) {
    where.content = { contains: query };
  }

  return where;
}

async function getPublicPostSupplements(
  postIds,
  { includeComments = false, relationAccess = null, revealHiddenRelations = false, viewer = null } = {},
) {
  const mediaByPostId = await listVisiblePostMedia(postIds);
  const [commentGroups, likeGroups, viewerLikes, comments] =
    postIds.length === 0
      ? [[], [], [], []]
      : await Promise.all([
          prisma.comment.groupBy({
            by: ["post_id"],
            where: {
              post_id: { in: postIds },
              deleted_at: null,
              visibility: "visible",
            },
            _count: { _all: true },
          }),
          prisma.postLike.groupBy({
            by: ["post_id"],
            where: {
              post_id: { in: postIds },
            },
            _count: { _all: true },
          }),
          viewer
            ? prisma.postLike.findMany({
                where: {
                  post_id: { in: postIds },
                  user_id: viewer.id,
                },
                select: { post_id: true },
              })
            : [],
          includeComments
            ? prisma.comment.findMany({
                where: {
                  post_id: { in: postIds },
                  deleted_at: null,
                  visibility: "visible",
                },
                include: COMMENT_INCLUDE,
                orderBy: [{ created_at: "asc" }, { id: "asc" }],
              })
            : [],
        ]);

  const commentsByPostId = new Map(postIds.map((postId) => [postId, []]));
  for (const comment of comments) {
    commentsByPostId.get(comment.post_id)?.push(toCommunityCommentDto(comment, { viewer }));
  }

  return {
    commentCountByPostId: new Map(
      commentGroups.map((group) => [group.post_id, group._count._all]),
    ),
    likeCountByPostId: new Map(likeGroups.map((group) => [group.post_id, group._count._all])),
    mediaByPostId,
    commentsByPostId,
    likedPostIds: new Set(viewerLikes.map((like) => like.post_id)),
    relationAccess: relationAccess ?? (revealHiddenRelations ? { revealAll: true } : null),
    viewer,
  };
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
      byPostId.get(binding.owner_id)?.push(toPostMediaDto(item, binding));
    }
  }
  for (const items of byPostId.values()) {
    items.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  }
  return byPostId;
}

function toCommunityPostDto(post, publicData) {
  return {
    id: post.id,
    authorName: post.author_name_snapshot,
    authorRole: post.author_role_snapshot,
    category: post.category,
    content: post.content,
    pinned: post.pinned,
    visibility: post.visibility,
    cats: post.post_cats
      .map((item) => toAccessibleCatDto(item.cat, publicData.relationAccess))
      .filter(Boolean),
    litters: post.post_litters
      .map((item) => toAccessibleLitterDto(item.litter, publicData.relationAccess))
      .filter(Boolean),
    mediaAssets: publicData.mediaByPostId.get(post.id) ?? [],
    comments: publicData.commentsByPostId.get(post.id) ?? [],
    commentCount: publicData.commentCountByPostId.get(post.id) ?? 0,
    likeCount: publicData.likeCountByPostId.get(post.id) ?? 0,
    likedByMe: publicData.likedPostIds.has(post.id),
    canEdit: canManagePost(publicData.viewer, post),
    canDelete: canManagePost(publicData.viewer, post),
    createdAt: toIsoString(post.created_at),
    updatedAt: toIsoString(post.updated_at),
  };
}

function toAccessibleCatDto(cat, relationAccess) {
  if (!cat || cat.deleted_at) return null;
  if (cat.visibility === "visible" || relationAccess?.revealAll || relationAccess?.catIds?.has(cat.id)) {
    return toRelatedCatDto(cat);
  }
  return null;
}

function toAccessibleLitterDto(litter, relationAccess) {
  if (!litter || litter.deleted_at) return null;
  if (
    litter.visibility === "visible" ||
    relationAccess?.revealAll ||
    relationAccess?.litterIds?.has(litter.id)
  ) {
    return toRelatedLitterDto(litter);
  }
  return null;
}

function toRelatedCatDto(cat) {
  if (!cat || cat.deleted_at) return null;
  return {
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    lifecycleStatus: cat.lifecycle_status,
    visibility: cat.visibility,
  };
}

function toPublicCatDto(cat) {
  if (!cat || cat.deleted_at || cat.visibility !== "visible") return null;
  return toRelatedCatDto(cat);
}

function toRelatedLitterDto(litter) {
  if (!litter || litter.deleted_at) return null;
  return {
    id: litter.id,
    name: litter.name,
    status: litter.status,
    birthDate: toIsoString(litter.birth_date),
    expectedBirthDate: toIsoString(litter.expected_birth_date),
    visibility: litter.visibility,
  };
}

function toPublicLitterDto(litter) {
  if (!litter || litter.deleted_at || litter.visibility !== "visible") return null;
  return toRelatedLitterDto(litter);
}

function toPostMediaDto(media, binding) {
  return {
    id: media.id,
    kind: media.kind,
    sourceUrl: media.source_url,
    thumbnailUrl: media.thumbnail_url,
    title: media.title,
    altText: media.alt_text,
    usage: binding.usage,
    sortOrder: binding.sort_order,
  };
}

function toCommunityCommentDto(comment, { viewer = null } = {}) {
  const author = comment.author;
  const parentProfile = author?.parent_profile;
  const roles = Array.isArray(author?.roles)
    ? author.roles.filter((role) => !role.revoked_at).map((role) => role.role)
    : [];
  const authorRole = parentProfile?.status === "active" ? "parent" : roles[0] || "user";
  return {
    id: comment.id,
    postId: comment.post_id,
    authorName: parentProfile?.display_name || author?.nickname || "星月猫友",
    authorRole,
    content: comment.content,
    visibility: comment.visibility,
    canDelete: Boolean(viewer && (isPrivilegedUser(viewer) || viewer.id === comment.author_user_id)),
    createdAt: toIsoString(comment.created_at),
    updatedAt: toIsoString(comment.updated_at),
    deletedAt: toIsoString(comment.deleted_at),
  };
}

async function normalizePostMutationInput(input, user, { mode, existing = null }) {
  if (mode === "create" && !canCreateAnyCategory(user)) {
    throw forbidden("Current user cannot publish community posts");
  }

  const data = {};
  if (mode === "create" || Object.hasOwn(input, "category")) {
    data.category = normalizeCategory(input.category);
    ensureCanUseCategory(user, data.category);
  }
  if (mode === "create" || Object.hasOwn(input, "content")) {
    data.content = normalizeContent(input.content, "content", 2000);
  }
  if (Object.hasOwn(input, "visibility")) {
    data.visibility = normalizeVisibility(input.visibility);
  } else if (mode === "create") {
    data.visibility = "visible";
  }
  if (Object.hasOwn(input, "pinned")) {
    if (!isPrivilegedUser(user)) throw forbidden("Only keepers can pin community posts");
    data.pinned = Boolean(input.pinned);
  } else if (mode === "create") {
    data.pinned = false;
  }
  if (Object.hasOwn(input, "catIds") || mode === "create") {
    data.catIds = await normalizeAllowedCatIds(input.catIds, user);
  }
  if (Object.hasOwn(input, "litterIds") || mode === "create") {
    data.litterIds = await normalizeAllowedLitterIds(input.litterIds, user, data.catIds);
  }

  if (mode === "update" && Object.keys(data).length === 0) {
    throw badRequest("At least one post field must be provided");
  }
  if (existing && data.category) ensureCanUseCategory(user, data.category);

  return data;
}

function normalizeCategory(value) {
  const category = requiredString(value, "category");
  if (!CATEGORY_VALUES.has(category)) throw badRequest("category contains an unsupported value");
  return category;
}

function normalizeVisibility(value) {
  const visibility = requiredString(value, "visibility");
  if (!VISIBILITY_VALUES.has(visibility)) throw badRequest("visibility contains an unsupported value");
  return visibility;
}

function normalizeContent(value, fieldName, maxLength) {
  const content = requiredString(value, fieldName);
  if (content.length > maxLength) {
    throw badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  }
  return content;
}

async function normalizeAllowedCatIds(value, user) {
  const catIds = normalizeIdArray(value, "catIds");
  if (catIds.length === 0) return [];

  if (isPrivilegedUser(user)) {
    const cats = await prisma.cat.findMany({
      where: { id: { in: catIds }, deleted_at: null },
      select: { id: true },
    });
    return assertAllRequestedIdsExist(catIds, cats, "catIds");
  }

  const parentProfileId = getActiveParentProfileId(user);
  const links = await prisma.parentCatLink.findMany({
    where: {
      parent_profile_id: parentProfileId,
      cat_id: { in: catIds },
      status: "active",
      deleted_at: null,
      cat: { deleted_at: null },
    },
    select: { cat_id: true },
  });
  const allowedIds = links.map((link) => link.cat_id);
  if (allowedIds.length !== catIds.length) {
    throw forbidden("Parent can only link their own active cats");
  }
  return catIds;
}

async function normalizeAllowedLitterIds(value, user, alreadyAllowedCatIds = null) {
  const litterIds = normalizeIdArray(value, "litterIds");
  if (litterIds.length === 0) return [];

  if (isPrivilegedUser(user)) {
    const litters = await prisma.litter.findMany({
      where: { id: { in: litterIds }, deleted_at: null },
      select: { id: true },
    });
    return assertAllRequestedIdsExist(litterIds, litters, "litterIds");
  }

  const parentProfileId = getActiveParentProfileId(user);
  const parentCatIds =
    alreadyAllowedCatIds && alreadyAllowedCatIds.length > 0
      ? alreadyAllowedCatIds
      : await listActiveParentCatIds(parentProfileId);
  if (parentCatIds.length === 0) throw forbidden("Parent has no active cats to link litters");

  const litters = await prisma.litter.findMany({
    where: {
      id: { in: litterIds },
      deleted_at: null,
      OR: [
        { father_cat_id: { in: parentCatIds } },
        { mother_cat_id: { in: parentCatIds } },
        { kitten_profiles: { some: { cat_id: { in: parentCatIds } } } },
      ],
    },
    select: { id: true },
  });
  return assertAllRequestedIdsExist(litterIds, litters, "litterIds");
}

async function listActiveParentCatIds(parentProfileId) {
  const links = await prisma.parentCatLink.findMany({
    where: {
      parent_profile_id: parentProfileId,
      status: "active",
      deleted_at: null,
      cat: { deleted_at: null },
    },
    select: { cat_id: true },
  });
  return links.map((link) => link.cat_id);
}

function normalizeIdArray(value, fieldName) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw badRequest(`${fieldName} must be an array`);
  return Array.from(new Set(value.map((item, index) => requiredString(item, `${fieldName}[${index}]`))));
}

function assertAllRequestedIdsExist(requestedIds, records, fieldName) {
  const found = new Set(records.map((record) => record.id));
  const missing = requestedIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw forbidden(`One or more ${fieldName} are not allowed`, { ids: missing });
  }
  return requestedIds;
}

async function replacePostRelations(transaction, postId, catIds, litterIds) {
  await replacePostCats(transaction, postId, catIds);
  await replacePostLitters(transaction, postId, litterIds);
}

async function replacePostCats(transaction, postId, catIds) {
  await transaction.postCat.deleteMany({ where: { post_id: postId } });
  for (const catId of catIds) {
    await transaction.postCat.create({ data: { post_id: postId, cat_id: catId } });
  }
}

async function replacePostLitters(transaction, postId, litterIds) {
  await transaction.postLitter.deleteMany({ where: { post_id: postId } });
  for (const litterId of litterIds) {
    await transaction.postLitter.create({ data: { post_id: postId, litter_id: litterId } });
  }
}

async function getMutablePost(id) {
  const post = await prisma.post.findFirst({
    where: { id, deleted_at: null },
    include: COMMUNITY_POST_DETAIL_INCLUDE,
  });
  if (!post) throw notFound("Community post not found");
  return post;
}

async function ensureVisiblePostExists(id) {
  const post = await prisma.post.findFirst({
    where: { id, deleted_at: null, visibility: "visible" },
    select: { id: true },
  });
  if (!post) throw notFound("Community post not found");
}

async function ensureCanUploadToPost(postId, user) {
  const post = await getMutablePost(postId);
  ensureCanManagePost(user, post);
  if (!isPrivilegedUser(user) && !hasRole(user, "parent")) {
    throw forbidden("Only parents and keepers can upload post images");
  }
}

function ensureCanManagePost(user, post) {
  if (!canManagePost(user, post)) throw forbidden("Current user cannot manage this post");
}

function canManagePost(user, post) {
  if (!user || !post) return false;
  return isPrivilegedUser(user) || (hasRole(user, "parent") && post.author_user_id === user.id);
}

function canReadPostDetail(user, post) {
  if (!post || post.deleted_at) return false;
  if (post.visibility === "visible") return true;
  if (!user) return false;
  return isPrivilegedUser(user) || post.author_user_id === user.id;
}

async function getRelationAccessForPostDetail(user, post) {
  if (!user) return null;
  if (isPrivilegedUser(user)) return { revealAll: true };
  if (post.author_user_id !== user.id || !hasRole(user, "parent") || user.parentProfile?.status !== "active") {
    return null;
  }

  const linkedCatIds = post.post_cats.map((item) => item.cat_id);
  const linkedLitterIds = post.post_litters.map((item) => item.litter_id);
  const [catLinks, allowedLitters] = await Promise.all([
    linkedCatIds.length === 0
      ? []
      : prisma.parentCatLink.findMany({
          where: {
            parent_profile_id: user.parentProfile.id,
            cat_id: { in: linkedCatIds },
            status: "active",
            deleted_at: null,
            cat: { deleted_at: null },
          },
          select: { cat_id: true },
        }),
    linkedLitterIds.length === 0
      ? []
      : prisma.litter.findMany({
          where: {
            id: { in: linkedLitterIds },
            deleted_at: null,
            OR: [
              {
                father_cat: {
                  parent_cat_links: {
                    some: {
                      parent_profile_id: user.parentProfile.id,
                      status: "active",
                      deleted_at: null,
                    },
                  },
                },
              },
              {
                mother_cat: {
                  parent_cat_links: {
                    some: {
                      parent_profile_id: user.parentProfile.id,
                      status: "active",
                      deleted_at: null,
                    },
                  },
                },
              },
              {
                kitten_profiles: {
                  some: {
                    cat: {
                      parent_cat_links: {
                        some: {
                          parent_profile_id: user.parentProfile.id,
                          status: "active",
                          deleted_at: null,
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
          select: { id: true },
        }),
  ]);

  return {
    catIds: new Set(catLinks.map((link) => link.cat_id)),
    litterIds: new Set(allowedLitters.map((litter) => litter.id)),
  };
}

function ensureCanUseCategory(user, category) {
  if (isPrivilegedUser(user)) return;
  if (hasRole(user, "parent") && PARENT_CATEGORY_VALUES.has(category)) return;
  throw forbidden("Current user cannot publish this category");
}

function canCreateAnyCategory(user) {
  return getAllowedCreateCategories(user).length > 0;
}

function getAllowedCreateCategories(user) {
  if (!user) return [];
  if (isPrivilegedUser(user)) return Array.from(CATEGORY_VALUES);
  if (hasRole(user, "parent") && getActiveParentProfileId(user)) {
    return Array.from(PARENT_CATEGORY_VALUES);
  }
  return [];
}

function getActiveParentProfileId(user) {
  if (!hasRole(user, "parent")) throw forbidden("Active parent profile is required");
  const profile = user.parentProfile;
  if (!profile || profile.status !== "active") {
    throw forbidden("Active parent profile is required");
  }
  return profile.id;
}

function isPrivilegedUser(user) {
  return hasRole(user, "admin") || hasRole(user, "keeper");
}

function hasRole(user, role) {
  return Boolean(user?.roles?.includes(role));
}

function getAuthorSnapshot(user) {
  if (hasRole(user, "keeper")) return { name: user.nickname || "星月猫舍", role: "keeper" };
  if (hasRole(user, "admin")) return { name: user.nickname || "星月猫舍", role: "admin" };
  if (hasRole(user, "parent") && user.parentProfile?.displayName) {
    return { name: user.parentProfile.displayName, role: "parent" };
  }
  return { name: user.nickname || "星月猫友", role: "user" };
}

function toPostOptionCatDto(cat) {
  return {
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    lifecycleStatus: cat.lifecycle_status,
    visibility: cat.visibility,
  };
}

function toPostOptionLitterDto(litter) {
  return {
    id: litter.id,
    name: litter.name,
    status: litter.status,
    birthDate: toIsoString(litter.birth_date),
    expectedBirthDate: toIsoString(litter.expected_birth_date),
    visibility: litter.visibility,
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

function toIsoString(value) {
  return value ? value.toISOString() : null;
}

const COMMENT_INCLUDE = {
  author: {
    include: {
      roles: true,
      parent_profile: true,
    },
  },
};

const COMMUNITY_POST_INCLUDE = {
  post_cats: {
    include: {
      cat: true,
    },
  },
  post_litters: {
    include: {
      litter: true,
    },
  },
};

const COMMUNITY_POST_DETAIL_INCLUDE = {
  ...COMMUNITY_POST_INCLUDE,
  author: true,
};
