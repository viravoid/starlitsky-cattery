import { prisma } from "../db/prisma.mjs";
import { forbidden, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";

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
    items.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
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
    items.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  }
  return byPostId;
}

function toMyCatDto(link, mediaByCatId, timelinePosts = []) {
  const cat = link.cat;
  return {
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    birthday: toIsoString(cat.birthday),
    lifecycleStatus: cat.lifecycle_status,
    personality: cat.personality,
    visibility: cat.visibility,
    mediaAssets: mediaByCatId.get(cat.id) ?? [],
    relationship: link.relationship,
    relationshipStartedAt: toIsoString(link.started_at),
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
    sourceUrl: media.source_url,
    thumbnailUrl: media.thumbnail_url,
    title: media.title,
    altText: media.alt_text,
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
