import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:media-upload-integrity-verify.db";
process.env.STORAGE_PROVIDER = "s3";
process.env.STORAGE_BUCKET = "verify-media-bucket";
process.env.STORAGE_REGION = "ap-shanghai";
process.env.STORAGE_ACCESS_KEY_ID = "verify-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "verify-secret-key";
process.env.STORAGE_PUBLIC_BASE_URL = "https://media.verify.example";
process.env.STORAGE_KEY_PREFIX = "verify-media";
process.env.STORAGE_MAX_IMAGE_BYTES = "1024";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const {
  completeMediaUpload,
  expireStalePendingImageUploads,
  requestImageUpload,
} = await import("./media-upload-service.mjs");
const { setObjectStorageTestClient } = await import("./object-storage-service.mjs");

const RUN_PREFIX = "verify-media-upload";
const objectMetadata = new Map();
const deletedObjectKeys = [];

setObjectStorageTestClient({
  headObject({ objectKey }) {
    return objectMetadata.get(objectKey) ?? { exists: false };
  },
  deleteObject({ objectKey }) {
    deletedObjectKeys.push(objectKey);
    objectMetadata.delete(objectKey);
    return { deleted: true, missing: false };
  },
});

await cleanup();

try {
  const cat = await prisma.cat.create({
    data: {
      id: `${RUN_PREFIX}-cat`,
      name: "Media Verify Cat",
      lifecycle_status: "growing",
      visibility: "visible",
    },
  });
  const fixedPage = await prisma.fixedPage.create({
    data: {
      id: `${RUN_PREFIX}-fixed-page`,
      slug: `${RUN_PREFIX}-page`,
      title: "Media Verify Page",
      status: "published",
    },
  });

  await assert.rejects(
    () =>
      requestImageUpload({
        fileName: "too-large.jpg",
        mimeType: "image/jpeg",
        ownerId: cat.id,
        ownerType: "cat",
        sizeBytes: 1025,
        usage: "gallery",
      }),
    (error) => error?.statusCode === 400,
    "oversized upload should be rejected before presign",
  );
  assert.equal(await countRunMedia(), 0, "oversize rejection must not create pending media");

  await assert.rejects(
    () =>
      requestImageUpload({
        fileName: "not-image.txt",
        mimeType: "text/plain",
        ownerId: cat.id,
        ownerType: "cat",
        sizeBytes: 10,
        usage: "gallery",
      }),
    (error) => error?.statusCode === 400,
    "invalid MIME should be rejected before presign",
  );
  assert.equal(await countRunMedia(), 0, "invalid MIME rejection must not create pending media");

  await assert.rejects(
    () =>
      requestImageUpload({
        fileName: "../escape.jpg",
        mimeType: "image/jpeg",
        ownerId: cat.id,
        ownerType: "cat",
        sizeBytes: 10,
        usage: "gallery",
      }),
    (error) => error?.statusCode === 400,
    "file names with path traversal should be rejected before presign",
  );
  assert.equal(await countRunMedia(), 0, "unsafe file name rejection must not create pending media");

  const missingUpload = await requestImageUpload({
    fileName: "missing.jpg",
    mimeType: "image/jpeg",
    ownerId: cat.id,
    ownerType: "cat",
    sizeBytes: 128,
    usage: "gallery",
  });
  await assert.rejects(
    () => completeMediaUpload(missingUpload.media.id, { sizeBytes: 128 }),
    (error) => error?.statusCode === 400,
    "missing object cannot complete",
  );

  const oversizedActualUpload = await requestImageUpload({
    fileName: "actual-too-large.jpg",
    mimeType: "image/jpeg",
    ownerId: cat.id,
    ownerType: "cat",
    sizeBytes: 900,
    usage: "gallery",
  });
  objectMetadata.set(oversizedActualUpload.objectKey, {
    exists: true,
    contentLength: 2048,
    contentType: "image/jpeg",
  });
  await assert.rejects(
    () => completeMediaUpload(oversizedActualUpload.media.id, { sizeBytes: 900 }),
    (error) => error?.statusCode === 400,
    "actual oversized object cannot complete",
  );

  const goodUpload = await requestImageUpload({
    fileName: "good.jpg",
    mimeType: "image/jpeg",
    ownerId: cat.id,
    ownerType: "cat",
    sizeBytes: 128,
    usage: "cover",
  });
  objectMetadata.set(goodUpload.objectKey, {
    exists: true,
    contentLength: 128,
    contentType: "image/jpeg; charset=binary",
    etag: '"verify-good"',
  });
  const completed = await completeMediaUpload(goodUpload.media.id, { sizeBytes: 128 });
  assert.equal(completed.status, "active", "verified upload should become active");
  assert.equal(completed.sizeBytes, 128, "verified upload should store actual size");
  assert.equal(
    completed.metadataJson?.upload?.verifiedMimeType,
    "image/jpeg",
    "verified upload should persist HEAD content type",
  );
  const repeated = await completeMediaUpload(goodUpload.media.id, { sizeBytes: 128 });
  assert.equal(repeated.id, completed.id, "repeat completion should be idempotent");
  await assert.rejects(
    () => completeMediaUpload(goodUpload.media.id, { sizeBytes: 129 }),
    (error) => error?.statusCode === 400,
    "completed upload retry cannot mutate stored metadata",
  );

  const raceUpload = await requestImageUpload({
    fileName: "race.webp",
    mimeType: "image/webp",
    ownerId: cat.id,
    ownerType: "cat",
    sizeBytes: 256,
    usage: "gallery",
  });
  objectMetadata.set(raceUpload.objectKey, {
    exists: true,
    contentLength: 256,
    contentType: "image/webp",
  });
  const [raceA, raceB] = await Promise.all([
    completeMediaUpload(raceUpload.media.id, { sizeBytes: 256 }),
    completeMediaUpload(raceUpload.media.id, { sizeBytes: 256 }),
  ]);
  assert.equal(raceA.id, raceB.id, "concurrent completes should return the same media");
  assert.equal(
    await prisma.mediaBinding.count({ where: { media_id: raceUpload.media.id, deleted_at: null } }),
    1,
    "concurrent completes must not create duplicate bindings",
  );

  const fixedPageUpload = await requestImageUpload({
    fileName: "fixed-page.png",
    mimeType: "image/png",
    ownerId: fixedPage.id,
    ownerType: "fixed_page",
    sizeBytes: 64,
    usage: "gallery",
  });
  objectMetadata.set(fixedPageUpload.objectKey, {
    exists: true,
    contentLength: 64,
    contentType: "image/png",
  });
  const fixedPageCompleted = await completeMediaUpload(fixedPageUpload.media.id, { sizeBytes: 64 });
  assert.equal(fixedPageCompleted.status, "active", "fixed-page media path should still complete");
  assert.equal(
    fixedPageCompleted.bindings.some((binding) => binding.ownerId === fixedPage.id),
    true,
    "fixed-page media binding should remain attached",
  );

  const staleUpload = await requestImageUpload({
    fileName: "stale.jpg",
    mimeType: "image/jpeg",
    ownerId: cat.id,
    ownerType: "cat",
    sizeBytes: 100,
    usage: "gallery",
  });
  await prisma.mediaAsset.update({
    where: { id: staleUpload.media.id },
    data: { created_at: new Date("2026-01-01T00:00:00.000Z") },
  });
  const expired = await expireStalePendingImageUploads({
    now: new Date("2026-01-03T00:00:00.000Z"),
    staleAfterMs: 24 * 60 * 60 * 1000,
  });
  assert.equal(expired.expiredCount, 1, "stale pending upload should be marked rejected");
  const staleAfterExpire = await prisma.mediaAsset.findUnique({ where: { id: staleUpload.media.id } });
  assert.equal(staleAfterExpire?.status, "rejected", "stale pending media should not remain pending");
  assert.equal(deletedObjectKeys.length, 0, "stale pending cleanup must not broadly delete objects");

  const newCoverUpload = await requestImageUpload({
    fileName: "new-cover.jpg",
    mimeType: "image/jpeg",
    ownerId: cat.id,
    ownerType: "cat",
    sizeBytes: 300,
    usage: "cover",
  });
  objectMetadata.set(newCoverUpload.objectKey, {
    exists: true,
    contentLength: 300,
    contentType: "image/jpeg",
  });
  await completeMediaUpload(newCoverUpload.media.id, { sizeBytes: 300 });
  assert.equal(await countActiveVisibleCatCovers(cat.id), 1, "cat should have exactly one active visible cover");
  assert.equal(
    await countActiveVisibleCatGallery(cat.id),
    1,
    "non-cover cat gallery media should not be deleted by cover replacement",
  );

  console.info("Media upload integrity verification passed");
} finally {
  setObjectStorageTestClient(null);
  await cleanup();
  await prisma.$disconnect();
}

async function countRunMedia() {
  return prisma.mediaAsset.count({
    where: {
      source_url: { contains: "https://media.verify.example/verify-media/" },
    },
  });
}

async function countActiveVisibleCatCovers(catId) {
  return prisma.mediaBinding.count({
    where: {
      owner_type: "cat",
      owner_id: catId,
      usage: "cover",
      visibility: "visible",
      deleted_at: null,
      media: {
        status: "active",
        deleted_at: null,
      },
    },
  });
}

async function countActiveVisibleCatGallery(catId) {
  return prisma.mediaBinding.count({
    where: {
      owner_type: "cat",
      owner_id: catId,
      usage: "gallery",
      visibility: "visible",
      deleted_at: null,
      media: {
        status: "active",
        deleted_at: null,
      },
    },
  });
}

async function cleanup() {
  await prisma.mediaBinding.deleteMany({
    where: {
      OR: [{ owner_id: { startsWith: RUN_PREFIX } }, { media: { source_url: { contains: RUN_PREFIX } } }],
    },
  });
  await prisma.mediaAsset.deleteMany({
    where: { source_url: { contains: "https://media.verify.example/verify-media/" } },
  });
  await prisma.fixedPage.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
  await prisma.cat.deleteMany({ where: { id: { startsWith: RUN_PREFIX } } });
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
