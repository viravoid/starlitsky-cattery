import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL ??= "file:community-verify.db";
await ensureLocalSqliteSchema(process.env.DATABASE_URL);
const { prisma } = await import("../db/prisma.mjs");
const { routeRequest } = await import("../routes/index.mjs");

const RUN_PREFIX = "verify-community";

const config = {
  auth: {
    tokenSecret: "community-verify-secret",
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
    mockQrEnabled: true,
    qrEnvVersion: "trial",
    qrCheckPath: true,
  },
};

await cleanup();

try {
  const admin = await createUser({
    id: `${RUN_PREFIX}-admin`,
    nickname: "Verify Admin",
    roles: ["keeper"],
  });
  const parentA = await createUser({
    id: `${RUN_PREFIX}-parent-a-user`,
    nickname: "Verify Parent A",
    parentProfileId: `${RUN_PREFIX}-parent-a`,
    roles: ["parent"],
  });
  const parentB = await createUser({
    id: `${RUN_PREFIX}-parent-b-user`,
    nickname: "Verify Parent B",
    parentProfileId: `${RUN_PREFIX}-parent-b`,
    roles: ["parent"],
  });
  const ordinaryUser = await createUser({
    id: `${RUN_PREFIX}-ordinary-user`,
    nickname: "Verify Ordinary User",
    roles: ["user"],
  });

  const catA = await prisma.cat.create({
    data: {
      id: `${RUN_PREFIX}-cat-a`,
      name: "Verify Hidden Cat A",
      lifecycle_status: "adopted",
      visibility: "hidden",
    },
  });
  const catB = await prisma.cat.create({
    data: {
      id: `${RUN_PREFIX}-cat-b`,
      name: "Verify Hidden Cat B",
      lifecycle_status: "adopted",
      visibility: "hidden",
    },
  });
  const visibleCat = await prisma.cat.create({
    data: {
      id: `${RUN_PREFIX}-visible-cat`,
      name: "Verify Visible Cat",
      lifecycle_status: "adopted",
      visibility: "visible",
    },
  });

  await prisma.parentCatLink.createMany({
    data: [
      {
        id: `${RUN_PREFIX}-link-a`,
        parent_profile_id: parentA.parentProfile.id,
        cat_id: catA.id,
        active_dedup_key: `${RUN_PREFIX}-link-a`,
        relationship: "owner",
        status: "active",
      },
      {
        id: `${RUN_PREFIX}-link-b`,
        parent_profile_id: parentB.parentProfile.id,
        cat_id: catB.id,
        active_dedup_key: `${RUN_PREFIX}-link-b`,
        relationship: "owner",
        status: "active",
      },
    ],
  });
  const parentWithoutCats = await createUser({
    id: `${RUN_PREFIX}-parent-empty-user`,
    nickname: "Verify Empty Parent",
    parentProfileId: `${RUN_PREFIX}-parent-empty`,
    roles: ["parent"],
  });
  const disabledParent = await createUser({
    id: `${RUN_PREFIX}-disabled-parent-user`,
    nickname: "Verify Disabled Parent",
    parentProfileId: `${RUN_PREFIX}-disabled-parent`,
    roles: ["parent"],
  });
  await prisma.parentProfile.update({
    where: { id: disabledParent.parentProfile.id },
    data: { status: "disabled" },
  });
  const inactiveLinkedCat = await prisma.cat.create({
    data: {
      id: `${RUN_PREFIX}-inactive-linked-cat`,
      name: "Verify Inactive Linked Cat",
      lifecycle_status: "adopted",
      visibility: "hidden",
    },
  });
  await prisma.parentCatLink.create({
    data: {
      id: `${RUN_PREFIX}-inactive-link`,
      parent_profile_id: parentWithoutCats.parentProfile.id,
      cat_id: inactiveLinkedCat.id,
      active_dedup_key: `${RUN_PREFIX}-inactive-link`,
      relationship: "owner",
      status: "inactive",
    },
  });
  const litterA = await createLitter({
    id: `${RUN_PREFIX}-litter-a`,
    fatherCatId: catA.id,
    motherCatId: visibleCat.id,
    visibility: "hidden",
  });
  const litterB = await createLitter({
    id: `${RUN_PREFIX}-litter-b`,
    fatherCatId: catB.id,
    motherCatId: visibleCat.id,
    visibility: "hidden",
  });

  const visiblePost = await createPost({
    id: `${RUN_PREFIX}-visible-post`,
    authorUserId: admin.id,
    category: "cattery_daily",
    content: "Visible detail smoke",
    visibility: "visible",
    catIds: [visibleCat.id],
  });
  const visiblePostWithHiddenCat = await createPost({
    id: `${RUN_PREFIX}-visible-hidden-cat-post`,
    authorUserId: admin.id,
    category: "cattery_daily",
    content: "Visible post with hidden relation",
    visibility: "visible",
    catIds: [catA.id],
  });
  const ownHiddenPost = await createPost({
    id: `${RUN_PREFIX}-own-hidden-post`,
    authorUserId: parentA.id,
    category: "parent_share",
    content: "Own hidden detail smoke",
    visibility: "hidden",
    catIds: [catA.id],
  });
  const foreignHiddenPost = await createPost({
    id: `${RUN_PREFIX}-foreign-hidden-post`,
    authorUserId: parentB.id,
    category: "parent_share",
    content: "Foreign hidden detail smoke",
    visibility: "hidden",
    catIds: [catB.id],
  });
  const deletedPost = await createPost({
    id: `${RUN_PREFIX}-deleted-post`,
    authorUserId: parentA.id,
    category: "parent_share",
    content: "Deleted detail smoke",
    visibility: "visible",
    deletedAt: new Date(),
    catIds: [catA.id],
  });
  const disabledParentPost = await createPost({
    id: `${RUN_PREFIX}-disabled-parent-post`,
    authorUserId: disabledParent.id,
    category: "parent_share",
    content: "Disabled parent legacy post",
    visibility: "visible",
    catIds: [catA.id],
  });

  const guestVisible = await routeGet(`/community/posts/${visiblePost.id}`, null);
  assert.equal(guestVisible.id, visiblePost.id, "guest should read visible detail");

  await assertRouteRejects(
    "guest hidden detail should 404",
    `/community/posts/${ownHiddenPost.id}`,
    null,
    404,
  );

  const authorHidden = await routeGet(`/community/posts/${ownHiddenPost.id}`, parentA);
  assert.equal(authorHidden.id, ownHiddenPost.id, "author should read own hidden detail");
  assert.equal(authorHidden.cats.some((cat) => cat.id === catA.id), true);

  await assertRouteRejects(
    "other parent hidden detail should 404",
    `/community/posts/${ownHiddenPost.id}`,
    parentB,
    404,
  );

  await assertRouteRejects(
    "ordinary user hidden detail should 404",
    `/community/posts/${ownHiddenPost.id}`,
    ordinaryUser,
    404,
  );

  const adminHidden = await routeGet(`/community/posts/${foreignHiddenPost.id}`, admin);
  assert.equal(adminHidden.id, foreignHiddenPost.id, "keeper should read hidden detail");
  assert.equal(adminHidden.cats.some((cat) => cat.id === catB.id), true);

  await assertRouteRejects(
    "deleted detail should 404",
    `/community/posts/${deletedPost.id}`,
    parentA,
    404,
  );

  const publicPosts = await routeGet("/community/posts?pageSize=100", null);
  assert.equal(
    publicPosts.items.some((post) => post.id === ownHiddenPost.id || post.id === deletedPost.id),
    false,
    "public list should remain visible and non-deleted only",
  );

  const myCat = await routeGet(`/me/cats/${catA.id}`, parentA);
  assert.equal(myCat.id, catA.id, "active parent should read own hidden cat");
  assert.equal(
    myCat.timelinePosts.some((post) => post.id === ownHiddenPost.id),
    true,
    "own hidden post should appear in my-cat timeline",
  );
  assert.equal(
    myCat.timelinePosts.some((post) => post.id === foreignHiddenPost.id || post.id === deletedPost.id),
    false,
    "foreign hidden and deleted posts should not appear in my-cat timeline",
  );

  await assertRouteRejects("parent A cannot read parent B hidden cat", `/me/cats/${catB.id}`, parentA, 404);
  await assertRouteRejects("guest cannot list my cats", "/me/cats", null, 401);
  await assertRouteRejects("ordinary user cannot list my cats", "/me/cats", ordinaryUser, 403);
  const emptyParentCats = await routeGet("/me/cats", parentWithoutCats);
  assert.equal(emptyParentCats.items.length, 0, "active parent with no active links should get an empty list");
  await assertRouteRejects(
    "inactive ParentCatLink cannot read hidden cat",
    `/me/cats/${inactiveLinkedCat.id}`,
    parentWithoutCats,
    404,
  );
  await assertRouteRejects("disabled parent cannot list my cats", "/me/cats", disabledParent, 403);
  await assertRouteRejects(
    "disabled parent cannot create parent-share post",
    "/community/posts",
    disabledParent,
    403,
    "POST",
    { category: "parent_share", content: "disabled parent blocked", catIds: [catA.id] },
  );
  await assertRouteRejects(
    "disabled parent cannot edit legacy own post",
    `/community/posts/${disabledParentPost.id}`,
    disabledParent,
    403,
    "PATCH",
    { content: "disabled parent edit blocked" },
  );
  await assertRouteRejects(
    "disabled parent cannot delete legacy own post",
    `/community/posts/${disabledParentPost.id}`,
    disabledParent,
    403,
    "DELETE",
  );
  await assertRouteRejects(
    "disabled parent cannot upload media to legacy own post",
    `/community/posts/${disabledParentPost.id}/media/uploads`,
    disabledParent,
    403,
    "POST",
    { fileName: "blocked.jpg", mimeType: "image/jpeg", sizeBytes: 64 },
  );

  await assertRouteRejects(
    "guest create should be 401",
    "/community/posts",
    null,
    401,
    "POST",
    { category: "parent_share", content: "guest blocked" },
  );
  await assertRouteRejects(
    "ordinary user create should be 403",
    "/community/posts",
    ordinaryUser,
    403,
    "POST",
    { category: "parent_share", content: "user blocked" },
  );
  await assertRouteRejects(
    "parent cannot create cattery category",
    "/community/posts",
    parentA,
    403,
    "POST",
    { category: "cattery_daily", content: "wrong category" },
  );
  await assertRouteRejects(
    "parent cannot link foreign cat",
    "/community/posts",
    parentA,
    403,
    "POST",
    { category: "parent_share", content: "foreign cat", catIds: [catB.id] },
  );
  await assertRouteRejects(
    "parent cannot link foreign litter",
    "/community/posts",
    parentA,
    403,
    "POST",
    { category: "parent_share", content: "foreign litter", litterIds: [litterB.id] },
  );

  const createdPost = await routeJson("/community/posts", parentA, "POST", {
    category: "parent_share",
    content: "parent own post",
    catIds: [catA.id],
    litterIds: [litterA.id],
  });
  assert.equal(createdPost.category, "parent_share", "parent should create an allowed category");

  const updatedOwnPost = await routeJson(`/community/posts/${createdPost.id}`, parentA, "PATCH", {
    content: "parent own post updated",
  });
  assert.equal(updatedOwnPost.content, "parent own post updated", "author should edit own post");
  await assertRouteRejects(
    "foreign parent cannot edit post",
    `/community/posts/${createdPost.id}`,
    parentB,
    403,
    "PATCH",
    { content: "foreign edit" },
  );
  await assertRouteRejects(
    "foreign parent cannot delete post",
    `/community/posts/${createdPost.id}`,
    parentB,
    403,
    "DELETE",
  );

  const media = await prisma.mediaAsset.create({
    data: {
      id: `${RUN_PREFIX}-media`,
      kind: "image",
      source_url: "https://example.test/post.jpg",
      status: "active",
      bindings: {
        create: [
          {
            id: `${RUN_PREFIX}-media-post-binding`,
            owner_type: "post",
            owner_id: createdPost.id,
            usage: "gallery",
            sort_order: 0,
            visibility: "visible",
          },
          {
            id: `${RUN_PREFIX}-media-cat-binding`,
            owner_type: "cat",
            owner_id: catA.id,
            usage: "gallery",
            sort_order: 0,
            visibility: "visible",
          },
        ],
      },
    },
  });
  await assertRouteRejects(
    "foreign parent cannot delete post media",
    `/community/posts/${createdPost.id}/media/${media.id}`,
    parentB,
    403,
    "DELETE",
  );
  await routeJson(`/community/posts/${createdPost.id}/media/${media.id}`, parentA, "DELETE");
  const mediaAfterDelete = await prisma.mediaAsset.findUnique({
    where: { id: media.id },
    include: { bindings: true },
  });
  assert.equal(mediaAfterDelete?.deleted_at, null, "post media removal must not delete MediaAsset");
  assert.ok(
    mediaAfterDelete?.bindings.some(
      (binding) =>
        binding.id === `${RUN_PREFIX}-media-cat-binding` &&
        binding.deleted_at === null &&
        binding.visibility === "visible",
    ),
    "post media removal must not delete reused non-post bindings",
  );
  assert.ok(
    mediaAfterDelete?.bindings.some(
      (binding) =>
        binding.id === `${RUN_PREFIX}-media-post-binding` &&
        binding.deleted_at &&
        binding.visibility === "archived",
    ),
    "post media removal should soft-delete only the matching post binding",
  );
  await assertRouteRejects(
    "post media endpoint cannot delete a cat-only binding",
    `/community/posts/${createdPost.id}/media/${RUN_PREFIX}-missing-post-binding`,
    parentA,
    404,
    "DELETE",
  );

  const firstLike = await routeJson(`/community/posts/${visiblePost.id}/like`, parentA, "POST");
  const secondLike = await routeJson(`/community/posts/${visiblePost.id}/like`, parentA, "POST");
  assert.equal(firstLike.liked, true, "first like should create one like");
  assert.equal(secondLike.liked, false, "second like should toggle the same like off");
  assert.equal(
    await prisma.postLike.count({ where: { post_id: visiblePost.id, user_id: parentA.id } }),
    0,
    "like toggle should not leave duplicates",
  );

  const comment = await routeJson(`/community/posts/${visiblePost.id}/comments`, parentA, "POST", {
    content: "parent comment",
  });
  await assertRouteRejects(
    "foreign parent cannot delete comment",
    `/community/posts/${visiblePost.id}/comments/${comment.id}`,
    parentB,
    403,
    "DELETE",
  );
  await routeJson(`/community/posts/${visiblePost.id}/comments/${comment.id}`, parentA, "DELETE");
  const moderationComment = await routeJson(`/community/posts/${visiblePost.id}/comments`, parentA, "POST", {
    content: "moderation comment",
  });
  const hiddenComment = await routeJson(
    `/community/admin/posts/${visiblePost.id}/comments/${moderationComment.id}`,
    admin,
    "PATCH",
    { visibility: "hidden" },
  );
  assert.equal(hiddenComment.visibility, "hidden", "keeper should hide comments");
  const deletedComment = await routeJson(
    `/community/admin/posts/${visiblePost.id}/comments/${moderationComment.id}`,
    admin,
    "PATCH",
    { deleted: true },
  );
  assert.equal(deletedComment.deletedAt !== null, true, "keeper should soft-delete comments");

  const adminList = await routeGet("/community/admin/posts?includeDeleted=true&pageSize=100", admin);
  assert.equal(
    adminList.items.some((post) => post.id === deletedPost.id),
    true,
    "admin list should support deleted post review when requested",
  );
  await assertRouteRejects(
    "parent cannot use admin moderation list",
    "/community/admin/posts",
    parentA,
    403,
  );
  const hiddenByAdmin = await routeJson(`/community/admin/posts/${visiblePost.id}`, admin, "PATCH", {
    visibility: "hidden",
  });
  assert.equal(hiddenByAdmin.visibility, "hidden", "keeper should hide posts");
  const restoredByAdmin = await routeJson(`/community/admin/posts/${visiblePost.id}`, admin, "PATCH", {
    visibility: "visible",
    pinned: true,
  });
  assert.equal(restoredByAdmin.visibility, "visible", "keeper should restore posts");
  assert.equal(restoredByAdmin.pinned, true, "keeper should manage pinned posts");
  const softDeletedByAdmin = await routeJson(`/community/admin/posts/${visiblePost.id}`, admin, "PATCH", {
    deleted: true,
  });
  assert.equal(softDeletedByAdmin.deletedAt !== null, true, "keeper should soft-delete posts");

  const publicHiddenRelationPost = await routeGet(`/community/posts/${visiblePostWithHiddenCat.id}`, null);
  assert.equal(
    publicHiddenRelationPost.cats.some((cat) => cat.id === catA.id),
    false,
    "public post detail should redact hidden related cats",
  );
  const deletedOwnPost = await routeJson(`/community/posts/${createdPost.id}`, parentA, "DELETE");
  assert.equal(deletedOwnPost.canDelete, true, "author should delete own post");

  console.info("community security verification passed");
} finally {
  await cleanup();
  await prisma.$disconnect();
}

async function createUser({ id, nickname, parentProfileId = null, roles }) {
  const user = await prisma.user.create({
    data: {
      id,
      nickname,
      status: "active",
      roles: {
        create: roles.map((role) => ({ role })),
      },
      ...(parentProfileId
        ? {
            parent_profile: {
              create: {
                id: parentProfileId,
                display_name: nickname,
                status: "active",
                activated_at: new Date(),
              },
            },
          }
        : {}),
    },
    include: {
      parent_profile: true,
      roles: true,
    },
  });

  return {
    ...user,
    parentProfile: user.parent_profile
      ? {
          id: user.parent_profile.id,
          displayName: user.parent_profile.display_name,
          status: user.parent_profile.status,
          activatedAt: user.parent_profile.activated_at?.toISOString() ?? null,
        }
      : null,
    roles: user.roles.map((role) => role.role),
  };
}

async function createPost({ id, authorUserId, category, content, visibility, deletedAt = null, catIds = [] }) {
  return prisma.post.create({
    data: {
      id,
      author_user_id: authorUserId,
      author_role_snapshot: category === "cattery_daily" ? "keeper" : "parent",
      author_name_snapshot: category === "cattery_daily" ? "Verify Keeper" : "Verify Parent",
      category,
      content,
      visibility,
      deleted_at: deletedAt,
      post_cats: {
        create: catIds.map((catId) => ({ cat_id: catId })),
      },
    },
  });
}

async function createLitter({ id, fatherCatId, motherCatId, visibility }) {
  return prisma.litter.create({
    data: {
      id,
      name: id,
      father_cat_id: fatherCatId,
      mother_cat_id: motherCatId,
      status: "born",
      visibility,
    },
  });
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

async function assertRouteRejects(label, url, actingUser, statusCode, method = "GET", body = undefined) {
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await assert.rejects(
    () => routeRequest(createRequest({ body, method, url, token }), createResponse(), { config }),
    (error) => error?.statusCode === statusCode,
    label,
  );
}

function createRequest({ body = undefined, method, url, token = "" }) {
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
  const token = `token-${actingUser.id}-${Math.random().toString(36).slice(2)}`;
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

async function cleanup() {
  const runPosts = await prisma.post.findMany({
    where: {
      OR: [{ id: { startsWith: RUN_PREFIX } }, { author_user_id: { startsWith: RUN_PREFIX } }],
    },
    select: { id: true },
  });
  const runPostIds = runPosts.map((post) => post.id);

  await prisma.mediaBinding.deleteMany({
    where: {
      OR: [
        { id: { startsWith: RUN_PREFIX } },
        { owner_id: { startsWith: RUN_PREFIX } },
        { owner_id: { in: runPostIds } },
      ],
    },
  });
  await prisma.mediaAsset.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.postLike.deleteMany({
    where: {
      OR: [{ user_id: { startsWith: RUN_PREFIX } }, { post_id: { in: runPostIds } }],
    },
  });
  await prisma.comment.deleteMany({
    where: {
      OR: [{ author_user_id: { startsWith: RUN_PREFIX } }, { post_id: { in: runPostIds } }],
    },
  });
  await prisma.post.deleteMany({
    where: {
      OR: [{ id: { startsWith: RUN_PREFIX } }, { author_user_id: { startsWith: RUN_PREFIX } }],
    },
  });
  await prisma.parentCatLink.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.litter.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.cat.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.parentProfile.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.userRole.deleteMany({ where: { user_id: { startsWith: RUN_PREFIX } } });
  await prisma.userSession.deleteMany({ where: { user_id: { startsWith: RUN_PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
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

    const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma/migrations");
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

function resolveSqlitePath(rawPath) {
  const normalized = rawPath.trim().replace(/^"|"$/g, "");
  if (isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) return normalized;

  const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma");
  return resolve(prismaDir, normalized);
}
