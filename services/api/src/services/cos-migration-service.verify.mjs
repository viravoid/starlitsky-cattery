import assert from "node:assert/strict";
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:cos-migration-readiness-verify.db";
process.env.STORAGE_PROVIDER = "cos";
process.env.STORAGE_BUCKET = "verify-new-bucket";
process.env.STORAGE_REGION = "ap-chengdu";
process.env.STORAGE_ACCESS_KEY_ID = "verify-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "verify-secret-key";
process.env.STORAGE_LEGACY_BUCKET = "verify-old-bucket";
process.env.STORAGE_READ_BUCKETS_JSON = JSON.stringify([
  { bucket: "verify-old-bucket", provider: "cos", region: "ap-chengdu" },
]);

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const {
  applyStorageSwitchPlan,
  buildStorageRollbackPlan,
  buildStorageSwitchPlan,
  createCosMigrationInventory,
  executeCosObjectCopies,
} = await import("./cos-migration-service.mjs");

const PREFIX = "verify-cos-migration";
const SOURCE_BUCKET = "verify-old-bucket";
const TARGET_BUCKET = "verify-new-bucket";
const SOURCE_HOST = `${SOURCE_BUCKET}.cos.ap-chengdu.myqcloud.com`;
const TARGET_HOST = `${TARGET_BUCKET}.cos.ap-chengdu.myqcloud.com`;
const OBJECT_KEY = "media/images/shared.jpg";
const THUMBNAIL_KEY = "media/images/z-shared-thumb.jpg";
const MISSING_KEY = "media/images/missing.jpg";
const BODY = Buffer.from("verified-cos-migration-object");
const CHECKSUM = crypto.createHash("sha256").update(BODY).digest("hex");

await cleanup();

try {
  const seeded = await seed();
  const sourceObjects = new Map([
    [OBJECT_KEY, storedObject(BODY, "image/jpeg")],
    [THUMBNAIL_KEY, storedObject(Buffer.from("thumbnail"), "image/jpeg")],
    ["media/images/orphan.jpg", storedObject(Buffer.from("orphan"), "image/jpeg")],
  ]);
  const targetObjects = new Map();
  let failNextPut = false;
  let readCount = 0;
  let writeCount = 0;
  const storage = createFakeStorage({
    failNextPut: () => failNextPut,
    onFailedPut: () => {
      failNextPut = false;
    },
    onRead: () => {
      readCount += 1;
    },
    onWrite: () => {
      writeCount += 1;
    },
    sourceObjects,
    targetObjects,
  });

  const inventory = await createCosMigrationInventory({
    client: prisma,
    sourceBucket: SOURCE_BUCKET,
    targetBucket: TARGET_BUCKET,
    storage,
  });
  assert.equal(inventory.records.length, 3);
  assert.deepEqual(inventory.duplicateKeys, [
    { objectKey: OBJECT_KEY, mediaIds: [seeded.primary.id, seeded.archivedDuplicate.id] },
  ]);
  assert.deepEqual(inventory.missingSourceRecords, [seeded.missing.id]);
  assert.deepEqual(
    inventory.orphanSourceObjects.map((item) => item.objectKey),
    ["media/images/orphan.jpg"],
  );
  assert.deepEqual(inventory.statusGroups.archived, [seeded.archivedDuplicate.id]);
  assert.equal(inventory.jsonReferences.length, 2);
  assert.equal(inventory.records[0].bindings.length, 3);
  assert.equal(inventory.records[0].bindings[0].usage, "cover");

  const dryRun = await executeCosObjectCopies({ inventory, storage });
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(
    dryRun.actions.length,
    2,
    "duplicate primary keys must copy once while a distinct thumbnail is retained",
  );
  assert.equal(readCount, 0, "dry-run must not read object bodies");
  assert.equal(writeCount, 0, "dry-run must not write objects");
  assert.equal(targetObjects.size, 0);

  failNextPut = true;
  const failedCopy = await executeCosObjectCopies({
    inventory,
    apply: true,
    confirmObjectWrite: true,
    storage,
  });
  assert.equal(
    failedCopy.results.find((result) => result.objectKey === OBJECT_KEY).status,
    "failed",
  );
  assert.equal(
    targetObjects.size,
    1,
    "independently verified objects may survive a partial failure",
  );
  assert.equal(
    buildStorageSwitchPlan({ inventory, copyReport: failedCopy }).mediaUpdates.length,
    0,
  );

  const copied = await executeCosObjectCopies({
    inventory,
    apply: true,
    confirmObjectWrite: true,
    storage,
  });
  const primaryCopy = copied.results.find((result) => result.objectKey === OBJECT_KEY);
  assert.equal(primaryCopy.status, "copied-and-verified");
  assert.equal(primaryCopy.checksumVerification.status, "match");
  assert.equal(primaryCopy.targetChecksumVerification.status, "match");
  assert.equal(targetObjects.get(OBJECT_KEY).body.equals(BODY), true);

  const repeated = await executeCosObjectCopies({
    inventory,
    apply: true,
    confirmObjectWrite: true,
    storage,
  });
  assert.ok(repeated.results.every((result) => result.status === "verified-existing"));
  assert.equal(writeCount, 2, "verified target objects must not be copied again");

  const plan = buildStorageSwitchPlan({ inventory, copyReport: copied });
  assert.equal(plan.mediaUpdates.length, 2, "only records backed by verified objects may switch");
  const drySwitch = await applyStorageSwitchPlan({ client: prisma, plan });
  assert.equal(drySwitch.mode, "dry-run");
  assert.equal(
    (await prisma.mediaAsset.findUnique({ where: { id: seeded.primary.id } })).metadata_json.upload
      .bucket,
    SOURCE_BUCKET,
    "dry-run must not change media metadata",
  );

  const beforeBindings = await prisma.mediaBinding.findMany({
    where: { media_id: seeded.primary.id },
    orderBy: { id: "asc" },
  });
  const appliedSwitch = await applyStorageSwitchPlan({
    client: prisma,
    plan,
    apply: true,
    confirmDatabaseWrite: true,
  });
  const primaryAfter = await prisma.mediaAsset.findUnique({ where: { id: seeded.primary.id } });
  const missingAfter = await prisma.mediaAsset.findUnique({ where: { id: seeded.missing.id } });
  const catAfter = await prisma.cat.findUnique({ where: { id: seeded.cat.id } });
  const pageAfter = await prisma.fixedPage.findUnique({ where: { id: seeded.page.id } });
  const afterBindings = await prisma.mediaBinding.findMany({
    where: { media_id: seeded.primary.id },
    orderBy: { id: "asc" },
  });

  assert.equal(primaryAfter.metadata_json.upload.bucket, TARGET_BUCKET);
  assert.equal(new URL(primaryAfter.source_url).host, TARGET_HOST);
  assert.equal(new URL(primaryAfter.thumbnail_url).host, TARGET_HOST);
  assert.equal(new URL(primaryAfter.thumbnail_url).pathname, `/${THUMBNAIL_KEY}`);
  assert.equal(
    missingAfter.metadata_json.upload.bucket,
    SOURCE_BUCKET,
    "unverified records must remain on the source bucket",
  );
  assert.deepEqual(afterBindings, beforeBindings, "bindings and their ordering must be preserved");
  assert.equal(catAfter.story_json.imagePresentation.crop.x, 0.25);
  assert.equal(new URL(catAfter.story_json.imagePresentation.url).host, TARGET_HOST);
  assert.equal(new URL(pageAfter.content_json.hero.imageUrl).host, TARGET_HOST);

  const repeatedSwitch = await applyStorageSwitchPlan({
    client: prisma,
    plan,
    apply: true,
    confirmDatabaseWrite: true,
  });
  assert.equal(repeatedSwitch.mediaUpdateCount, 2, "an applied switch must be safely repeatable");
  assert.equal(appliedSwitch.switchPlanSha256, repeatedSwitch.switchPlanSha256);

  const postCutover = await prisma.mediaAsset.create({
    data: {
      id: `${PREFIX}-post-cutover`,
      kind: "image",
      source_url: `https://${TARGET_HOST}/media/images/post-cutover.jpg`,
      status: "active",
      metadata_json: {
        upload: {
          bucket: TARGET_BUCKET,
          objectKey: "media/images/post-cutover.jpg",
          provider: "cos",
        },
      },
    },
  });
  const rollbackPlan = buildStorageRollbackPlan({
    switchPlan: plan,
    switchReport: repeatedSwitch,
  });
  await applyStorageSwitchPlan({
    client: prisma,
    plan: rollbackPlan,
    apply: true,
    confirmDatabaseWrite: true,
  });
  const primaryRolledBack = await prisma.mediaAsset.findUnique({
    where: { id: seeded.primary.id },
  });
  const catRolledBack = await prisma.cat.findUnique({ where: { id: seeded.cat.id } });
  assert.equal(primaryRolledBack.metadata_json.upload.bucket, SOURCE_BUCKET);
  assert.equal(new URL(primaryRolledBack.source_url).host, SOURCE_HOST);
  assert.equal(new URL(catRolledBack.story_json.imagePresentation.url).host, SOURCE_HOST);
  assert.ok(
    await prisma.mediaAsset.findUnique({ where: { id: postCutover.id } }),
    "per-record rollback must preserve post-cutover media",
  );

  console.info("COS migration readiness verification passed");
} finally {
  await cleanup();
  await prisma.$disconnect();
  rmLocalSqlite(process.env.DATABASE_URL);
}

async function seed() {
  const cat = await prisma.cat.create({
    data: {
      id: `${PREFIX}-cat`,
      name: "Migration Cat",
      lifecycle_status: "growing",
      visibility: "visible",
      story_json: {
        imagePresentation: {
          crop: { x: 0.25, y: 0.1, zoom: 1.4 },
          url: `https://${SOURCE_HOST}/${OBJECT_KEY}`,
        },
      },
    },
  });
  const page = await prisma.fixedPage.create({
    data: {
      id: `${PREFIX}-page`,
      slug: `${PREFIX}-page`,
      title: "Migration Page",
      content_json: { hero: { imageUrl: `https://${SOURCE_HOST}/${OBJECT_KEY}` } },
    },
  });
  const author = await prisma.user.create({
    data: { id: `${PREFIX}-author`, nickname: "Migration Author", status: "active" },
  });
  const post = await prisma.post.create({
    data: {
      id: `${PREFIX}-post`,
      author_user_id: author.id,
      author_role_snapshot: "keeper",
      author_name_snapshot: "Migration Author",
      category: "cattery_daily",
      content: "Migration post",
      visibility: "visible",
    },
  });
  const primary = await prisma.mediaAsset.create({
    data: {
      id: `${PREFIX}-primary`,
      kind: "image",
      source_url: `https://${SOURCE_HOST}/${OBJECT_KEY}`,
      thumbnail_url: `https://${SOURCE_HOST}/${THUMBNAIL_KEY}`,
      mime_type: "image/jpeg",
      size_bytes: BODY.length,
      checksum: CHECKSUM,
      status: "active",
      metadata_json: { upload: { bucket: SOURCE_BUCKET, objectKey: OBJECT_KEY, provider: "cos" } },
      bindings: {
        create: [
          binding("cat", cat.id, "cover", 0),
          binding("fixed_page", page.id, "carousel", 1),
          binding("post", post.id, "gallery", 2),
        ],
      },
    },
  });
  const archivedDuplicate = await prisma.mediaAsset.create({
    data: {
      id: `${PREFIX}-archived`,
      kind: "image",
      source_url: `https://${SOURCE_HOST}/${OBJECT_KEY}`,
      mime_type: "image/jpeg",
      size_bytes: BODY.length,
      status: "archived",
      deleted_at: new Date("2026-01-01T00:00:00.000Z"),
      metadata_json: { upload: { bucket: SOURCE_BUCKET, objectKey: OBJECT_KEY, provider: "cos" } },
    },
  });
  const missing = await prisma.mediaAsset.create({
    data: {
      id: `${PREFIX}-missing`,
      kind: "image",
      source_url: `https://${SOURCE_HOST}/${MISSING_KEY}`,
      status: "pending",
      metadata_json: { upload: { bucket: SOURCE_BUCKET, objectKey: MISSING_KEY, provider: "cos" } },
    },
  });
  return { archivedDuplicate, author, cat, missing, page, post, primary };
}

function binding(ownerType, ownerId, usage, sortOrder) {
  return {
    owner_type: ownerType,
    owner_id: ownerId,
    usage,
    sort_order: sortOrder,
    visibility: "visible",
  };
}

function createFakeStorage({
  failNextPut,
  onFailedPut,
  onRead,
  onWrite,
  sourceObjects,
  targetObjects,
}) {
  const bucketMap = (bucket) => (bucket === SOURCE_BUCKET ? sourceObjects : targetObjects);
  return {
    async listObjects({ bucket }) {
      return {
        objects: [...bucketMap(bucket)].map(([objectKey, value]) => ({
          objectKey,
          sizeBytes: value.body.length,
          etag: value.etag,
          lastModified: "2026-10-18T00:00:00.000Z",
        })),
        isTruncated: false,
        nextContinuationToken: null,
      };
    },
    async headObject({ bucket, objectKey }) {
      const value = bucketMap(bucket).get(objectKey);
      return value
        ? {
            exists: true,
            contentLength: value.body.length,
            contentType: value.contentType,
            etag: value.etag,
          }
        : { exists: false };
    },
    async getObject({ bucket, objectKey }) {
      onRead();
      const value = bucketMap(bucket).get(objectKey);
      return value ? { exists: true, ...value } : { exists: false };
    },
    async putObject({ bucket, objectKey, body, contentType }) {
      if (failNextPut()) {
        onFailedPut();
        throw new Error("simulated object write failure");
      }
      onWrite();
      bucketMap(bucket).set(objectKey, storedObject(Buffer.from(body), contentType));
      return { written: true };
    },
  };
}

function storedObject(body, contentType) {
  return {
    body,
    contentType,
    etag: `"${crypto.createHash("md5").update(body).digest("hex")}"`,
  };
}

async function cleanup() {
  await prisma.mediaBinding.deleteMany({
    where: { OR: [{ media_id: { startsWith: PREFIX } }, { owner_id: { startsWith: PREFIX } }] },
  });
  await prisma.mediaAsset.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.post.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.fixedPage.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.cat.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
}

async function ensureLocalSqliteSchema(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) return;
  const { DatabaseSync } = await import("node:sqlite");
  const sqlitePath = resolveSqlitePath(databaseUrl.slice("file:".length));
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const database = new DatabaseSync(sqlitePath);
  try {
    const migrationsDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../prisma/migrations",
    );
    for (const folder of readdirSync(migrationsDir).sort()) {
      const migrationPath = resolve(migrationsDir, folder, "migration.sql");
      if (existsSync(migrationPath)) database.exec(readFileSync(migrationPath, "utf8"));
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
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma", normalized);
}
