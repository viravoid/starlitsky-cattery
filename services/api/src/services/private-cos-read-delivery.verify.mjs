import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:private-cos-read-delivery-verify.db";
process.env.STORAGE_PROVIDER = "cos";
process.env.STORAGE_BUCKET = "verify-private-bucket";
process.env.STORAGE_REGION = "ap-shanghai";
process.env.STORAGE_ENDPOINT = "";
process.env.STORAGE_ACCESS_KEY_ID = "verify-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "verify-secret-key";
process.env.STORAGE_PUBLIC_BASE_URL = "";
process.env.STORAGE_KEY_PREFIX = "verify-media";
process.env.STORAGE_UPLOAD_EXPIRES_SECONDS = "600";
process.env.STORAGE_READ_EXPIRES_SECONDS = "7200";
process.env.STORAGE_MAX_IMAGE_BYTES = "10485760";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { createPresignedGetUrl, createPresignedPutUpload } =
  await import("./object-storage-service.mjs");
const { getCat } = await import("./cat-service.mjs");
const { getCommunityPost } = await import("./community-service.mjs");
const { getFixedPage } = await import("./fixed-page-service.mjs");
const { getMedia, updateMedia } = await import("./media-service.mjs");
const { getMyCat } = await import("./my-cats-service.mjs");

const RUN_PREFIX = "verify-private-cos-read";
const STORAGE_HOST = "verify-private-bucket.cos.ap-shanghai.myqcloud.com";
const SECRET = process.env.STORAGE_ACCESS_KEY_SECRET;
const MANAGED_OBJECT_KEY = "verify-media/images/space name+中文.jpg";
const STORED_SOURCE_URL = `https://${STORAGE_HOST}/${encodePath(MANAGED_OBJECT_KEY)}`;

await cleanup();

try {
  const signedGet = createPresignedGetUrl({ objectKey: MANAGED_OBJECT_KEY });
  const signedGetUrl = new URL(signedGet.url);
  assert.equal(signedGet.method, "GET", "read presign should describe GET semantics");
  assert.equal(signedGet.provider, "cos", "read presign should keep provider");
  assert.equal(signedGet.bucket, "verify-private-bucket", "read presign should keep bucket");
  assert.equal(signedGetUrl.host, STORAGE_HOST, "read presign should derive the COS host");
  assert.equal(signedGetUrl.pathname, `/${encodePath(MANAGED_OBJECT_KEY)}`);
  assert.equal(signedGetUrl.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.match(
    signedGetUrl.searchParams.get("X-Amz-Credential") ?? "",
    /^verify-access-key\/\d{8}\/ap-shanghai\/s3\/aws4_request$/,
  );
  assert.equal(signedGetUrl.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.equal(signedGetUrl.searchParams.get("X-Amz-Expires"), "3600");
  assert.ok(
    signedGetUrl.searchParams.get("X-Amz-Signature"),
    "read presign must include a signature",
  );
  assert.equal(signedGet.url.includes(SECRET), false, "read presign must not expose the secret");

  const signedPut = createPresignedPutUpload({
    objectKey: MANAGED_OBJECT_KEY,
    mimeType: "image/jpeg",
  });
  const signedPutUrl = new URL(signedPut.upload.url);
  assert.equal(signedPut.upload.method, "PUT", "upload presign should still use PUT");
  assert.equal(signedPutUrl.host, STORAGE_HOST, "upload presign should keep the COS host");
  assert.equal(signedPutUrl.pathname, `/${encodePath(MANAGED_OBJECT_KEY)}`);
  assert.equal(signedPutUrl.searchParams.get("X-Amz-SignedHeaders"), "content-type;host");
  assert.equal(
    signedPut.upload.url.includes(SECRET),
    false,
    "upload presign must not expose the secret",
  );

  const { cat, managedMedia, externalMedia, invalidManagedMedia, parentUser, post } =
    await seedDeliveryRecords();

  const managedDto = await getMedia(managedMedia.id);
  assertSignedDeliveryUrl(managedDto.sourceUrl, MANAGED_OBJECT_KEY);
  assert.equal(managedDto.storedSourceUrl, STORED_SOURCE_URL);
  assert.equal(managedDto.thumbnailUrl, "https://thumb.example/managed-thumb.jpg");
  const managedAfterRead = await prisma.mediaAsset.findUnique({ where: { id: managedMedia.id } });
  assert.equal(
    managedAfterRead?.source_url,
    STORED_SOURCE_URL,
    "reading managed media must not persist a short-lived signed URL",
  );

  const updatedManaged = await updateMedia(managedMedia.id, { title: "Updated managed title" });
  assertSignedDeliveryUrl(updatedManaged.sourceUrl, MANAGED_OBJECT_KEY);
  const managedAfterUpdate = await prisma.mediaAsset.findUnique({ where: { id: managedMedia.id } });
  assert.equal(
    managedAfterUpdate?.source_url,
    STORED_SOURCE_URL,
    "updating unrelated media fields must not rewrite the persisted source_url",
  );
  await assert.rejects(
    () => updateMedia(managedMedia.id, { sourceUrl: managedDto.sourceUrl }),
    (error) => error?.statusCode === 400,
    "managed media update must reject presigned sourceUrl persistence",
  );

  const externalDto = await getMedia(externalMedia.id);
  assert.equal(
    externalDto.sourceUrl,
    "https://external.example/image.jpg",
    "external media source URL must remain unchanged",
  );

  const invalidManagedDto = await getMedia(invalidManagedMedia.id);
  assert.equal(
    invalidManagedDto.sourceUrl,
    "https://fallback.example/invalid-managed.jpg",
    "invalid managed metadata should fall back to the stored compatible URL",
  );

  const catDto = await getCat(cat.id, { includeHidden: true });
  const catManaged = catDto.mediaAssets.find((item) => item.id === managedMedia.id);
  assertSignedDeliveryUrl(catManaged?.sourceUrl, MANAGED_OBJECT_KEY);
  const catExternal = catDto.mediaAssets.find((item) => item.id === externalMedia.id);
  assert.equal(catExternal?.sourceUrl, "https://external.example/image.jpg");

  const pageDto = await getFixedPage("about", { includeHidden: true });
  const pageManaged = pageDto.mediaAssets.find((item) => item.id === managedMedia.id);
  assertSignedDeliveryUrl(pageManaged?.sourceUrl, MANAGED_OBJECT_KEY);

  const postDto = await getCommunityPost(post.id, null);
  const postManaged = postDto.mediaAssets.find((item) => item.id === managedMedia.id);
  assertSignedDeliveryUrl(postManaged?.sourceUrl, MANAGED_OBJECT_KEY);

  const myCatDto = await getMyCat(cat.id, parentUser);
  const myCatManaged = myCatDto.mediaAssets.find((item) => item.id === managedMedia.id);
  assertSignedDeliveryUrl(myCatManaged?.sourceUrl, MANAGED_OBJECT_KEY);

  console.info("Private COS read delivery verification passed");
} finally {
  await cleanup();
  await prisma.$disconnect();
  rmLocalSqlite(process.env.DATABASE_URL);
}

async function seedDeliveryRecords() {
  const parentUser = await prisma.user.create({
    data: {
      id: `${RUN_PREFIX}-parent-user`,
      nickname: "Verify Parent",
      status: "active",
      roles: { create: [{ role: "parent" }] },
      parent_profile: {
        create: {
          id: `${RUN_PREFIX}-parent-profile`,
          display_name: "Verify Parent",
          status: "active",
          activated_at: new Date(),
        },
      },
    },
    include: { parent_profile: true, roles: true },
  });
  const author = await prisma.user.create({
    data: {
      id: `${RUN_PREFIX}-author`,
      nickname: "Verify Author",
      status: "active",
      roles: { create: [{ role: "keeper" }] },
    },
  });
  const cat = await prisma.cat.create({
    data: {
      id: `${RUN_PREFIX}-cat`,
      name: "Private COS Cat",
      lifecycle_status: "growing",
      visibility: "visible",
    },
  });
  await prisma.parentCatLink.create({
    data: {
      id: `${RUN_PREFIX}-parent-link`,
      parent_profile_id: parentUser.parent_profile.id,
      cat_id: cat.id,
      active_dedup_key: `${RUN_PREFIX}-parent-link`,
      relationship: "owner",
      status: "active",
    },
  });
  await prisma.fixedPage.create({
    data: {
      id: "fixed-page-about",
      slug: "about",
      title: "About",
      status: "published",
    },
  });
  const post = await prisma.post.create({
    data: {
      id: `${RUN_PREFIX}-post`,
      author_user_id: author.id,
      author_role_snapshot: "keeper",
      author_name_snapshot: "Verify Keeper",
      category: "cattery_daily",
      content: "Private COS delivery post",
      visibility: "visible",
    },
  });

  const managedMedia = await prisma.mediaAsset.create({
    data: {
      id: `${RUN_PREFIX}-managed`,
      kind: "image",
      source_url: STORED_SOURCE_URL,
      thumbnail_url: "https://thumb.example/managed-thumb.jpg",
      status: "active",
      metadata_json: {
        upload: {
          provider: "cos",
          bucket: "verify-private-bucket",
          objectKey: MANAGED_OBJECT_KEY,
          verifiedAt: "2026-09-12T00:00:00.000Z",
        },
      },
      bindings: {
        create: [
          visibleBinding("cat", cat.id, "cover", 0),
          visibleBinding("fixed_page", "fixed-page-about", "cover", 0),
          visibleBinding("post", post.id, "gallery", 0),
        ],
      },
    },
  });
  const externalMedia = await prisma.mediaAsset.create({
    data: {
      id: `${RUN_PREFIX}-external`,
      kind: "image",
      source_url: "https://external.example/image.jpg",
      status: "active",
      bindings: {
        create: [visibleBinding("cat", cat.id, "gallery", 10)],
      },
    },
  });
  const invalidManagedMedia = await prisma.mediaAsset.create({
    data: {
      id: `${RUN_PREFIX}-invalid-managed`,
      kind: "image",
      source_url: "https://fallback.example/invalid-managed.jpg",
      status: "active",
      metadata_json: { upload: { objectKey: "" } },
    },
  });

  return {
    cat,
    managedMedia,
    externalMedia,
    invalidManagedMedia,
    parentUser: {
      ...parentUser,
      parentProfile: {
        id: parentUser.parent_profile.id,
        displayName: parentUser.parent_profile.display_name,
        status: parentUser.parent_profile.status,
        activatedAt: parentUser.parent_profile.activated_at?.toISOString() ?? null,
      },
      roles: parentUser.roles.map((role) => role.role),
    },
    post,
  };
}

function visibleBinding(ownerType, ownerId, usage, sortOrder) {
  return {
    owner_type: ownerType,
    owner_id: ownerId,
    usage,
    sort_order: sortOrder,
    visibility: "visible",
  };
}

function assertSignedDeliveryUrl(value, objectKey) {
  assert.equal(typeof value, "string");
  const url = new URL(value);
  assert.equal(url.host, STORAGE_HOST);
  assert.equal(url.pathname, `/${encodePath(objectKey)}`);
  assert.equal(url.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "3600");
  assert.ok(url.searchParams.get("X-Amz-Signature"), "delivery URL must include a signature");
  assert.equal(value.includes(SECRET), false, "delivery URL must not expose the secret");
}

async function cleanup() {
  await prisma.mediaBinding.deleteMany({
    where: {
      OR: [{ media_id: { startsWith: RUN_PREFIX } }, { owner_id: { startsWith: RUN_PREFIX } }],
    },
  });
  await prisma.mediaAsset.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.post.deleteMany({
    where: {
      OR: [{ id: { startsWith: RUN_PREFIX } }, { author_user_id: { startsWith: RUN_PREFIX } }],
    },
  });
  await prisma.fixedPage.deleteMany({ where: { id: "fixed-page-about" } });
  await prisma.parentCatLink.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.cat.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.parentProfile.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.userRole.deleteMany({ where: { user_id: { startsWith: RUN_PREFIX } } });
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

    const migrationsDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../prisma/migrations",
    );
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

function rmLocalSqlite(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) return;
  const sqlitePath = resolveSqlitePath(databaseUrl.slice("file:".length));
  rmSync(sqlitePath, { force: true });
  rmSync(`${sqlitePath}-journal`, { force: true });
  rmSync(`${sqlitePath}-wal`, { force: true });
  rmSync(`${sqlitePath}-shm`, { force: true });
}

function resolveSqlitePath(rawPath) {
  const normalized = rawPath.trim().replace(/^"|"$/g, "");
  if (isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) return normalized;

  const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma");
  return resolve(prismaDir, normalized);
}

function encodePath(path) {
  return String(path)
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((part) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}
