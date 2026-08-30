import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";

const CATEGORY_VALUES = new Set(["cattery_daily", "parent_share", "personal_thoughts"]);

export async function listCommunityPosts(searchParams) {
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
  const publicData = await getPublicPostSupplements(items.map((post) => post.id));

  return {
    items: items.map((post) => toCommunityPostDto(post, publicData)),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getCommunityPost(id) {
  const post = await prisma.post.findFirst({
    where: {
      id,
      deleted_at: null,
      visibility: "visible",
    },
    include: COMMUNITY_POST_INCLUDE,
  });

  if (!post) throw notFound("Community post not found");
  const publicData = await getPublicPostSupplements([post.id]);
  return toCommunityPostDto(post, publicData);
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

async function getPublicPostSupplements(postIds) {
  const mediaByPostId = await listVisiblePostMedia(postIds);
  const [commentGroups, likeGroups] =
    postIds.length === 0
      ? [[], []]
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
        ]);

  return {
    commentCountByPostId: new Map(
      commentGroups.map((group) => [group.post_id, group._count._all]),
    ),
    likeCountByPostId: new Map(likeGroups.map((group) => [group.post_id, group._count._all])),
    mediaByPostId,
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
    cats: post.post_cats.map((item) => toPublicCatDto(item.cat)).filter(Boolean),
    litters: post.post_litters.map((item) => toPublicLitterDto(item.litter)).filter(Boolean),
    mediaAssets: publicData.mediaByPostId.get(post.id) ?? [],
    commentCount: publicData.commentCountByPostId.get(post.id) ?? 0,
    likeCount: publicData.likeCountByPostId.get(post.id) ?? 0,
    createdAt: toIsoString(post.created_at),
    updatedAt: toIsoString(post.updated_at),
  };
}

function toPublicCatDto(cat) {
  if (!cat || cat.deleted_at || cat.visibility !== "visible") return null;
  return {
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    lifecycleStatus: cat.lifecycle_status,
  };
}

function toPublicLitterDto(litter) {
  if (!litter || litter.deleted_at || litter.visibility !== "visible") return null;
  return {
    id: litter.id,
    name: litter.name,
    status: litter.status,
    birthDate: toIsoString(litter.birth_date),
    expectedBirthDate: toIsoString(litter.expected_birth_date),
  };
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

function toIsoString(value) {
  return value ? value.toISOString() : null;
}

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
