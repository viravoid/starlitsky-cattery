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

  const visiblePost = await createPost({
    id: `${RUN_PREFIX}-visible-post`,
    authorUserId: admin.id,
    category: "cattery_daily",
    content: "Visible detail smoke",
    visibility: "visible",
    catIds: [visibleCat.id],
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

async function routeGet(url, actingUser) {
  const response = createJsonResponse();
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await routeRequest(createRequest({ method: "GET", url, token }), response, { config });
  return response.data.data;
}

async function assertRouteRejects(label, url, actingUser, statusCode) {
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await assert.rejects(
    () => routeRequest(createRequest({ method: "GET", url, token }), createResponse(), { config }),
    (error) => error?.statusCode === statusCode,
    label,
  );
}

function createRequest({ method, url, token = "" }) {
  const request = Readable.from([]);
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
  await prisma.postLike.deleteMany({ where: { user_id: { startsWith: RUN_PREFIX } } });
  await prisma.comment.deleteMany({ where: { author_user_id: { startsWith: RUN_PREFIX } } });
  await prisma.post.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
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
