import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:environment-media-batch-verify.db";
process.env.STORAGE_PROVIDER = "s3";
process.env.STORAGE_BUCKET = "verify-env-media-bucket";
process.env.STORAGE_REGION = "ap-shanghai";
process.env.STORAGE_ACCESS_KEY_ID = "verify-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "verify-storage-private-token";
process.env.STORAGE_PUBLIC_BASE_URL = "https://media.verify.example";
process.env.STORAGE_KEY_PREFIX = "verify-env-media";
process.env.STORAGE_MAX_IMAGE_BYTES = "10485760";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { setObjectStorageTestClient } = await import("./object-storage-service.mjs");
const { getFixedPage } = await import("./fixed-page-service.mjs");
const { createMedia, createMediaBinding } = await import("./media-service.mjs");
const {
  EnvironmentMediaBatchImportError,
  assertEnvironmentMediaBatchRuntime,
  createEnvironmentMediaBatchPlan,
  runEnvironmentMediaBatchImport,
  validateEnvironmentMediaSourceFiles,
  validateEnvironmentMediaSourceManifest,
} = await import("./environment-media-batch-importer.mjs");

const RUN_PREFIX = "verify-environment-media-batch";
const SOURCE_BATCH_ID = "environment-media-verify-batch";
const ENVIRONMENT_PAGE_ID = "fixed-page-environment";
const MATERNITY_SLOT = "environment:maternity";
const PUBLIC_SLOT = "environment:public-area";
const MEDICAL_SLOT = "environment:medical";
const sourceDir = mkdtempSync(join(tmpdir(), "starlitsky-env-media-"));
const objectMetadata = new Map();
const putObjectKeys = [];
const deletedObjectKeys = [];
let failPutForSourceItemId = "";

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

globalThis.fetch = async (url, options = {}) => {
  assert.equal(options.method, "PUT", "batch importer must only perform presigned PUT requests");
  const uploadUrl = new URL(url);
  const objectKey = decodeURIComponent(uploadUrl.pathname.replace(/^\/+/, ""));
  const body = Buffer.from(options.body);
  const sourceItemId = String(options.headers?.["x-verify-source-item-id"] ?? "");
  if (sourceItemId && sourceItemId === failPutForSourceItemId) {
    return new Response(null, { status: 503 });
  }
  putObjectKeys.push(objectKey);
  objectMetadata.set(objectKey, {
    contentLength: body.length,
    contentType: options.headers?.["content-type"] ?? "image/jpeg",
    etag: `"${createHash("md5").update(body).digest("hex")}"`,
    exists: true,
  });
  return new Response(null, { status: 200 });
};

try {
  const manifest = createFixtureManifest(sourceDir);
  assert.equal(validateEnvironmentMediaSourceManifest(manifest), true);

  assert.throws(
    () => validateEnvironmentMediaSourceFiles({ manifest }),
    EnvironmentMediaBatchImportError,
    "source-dir missing should fail closed",
  );
  assertSourceValidationFailure(manifest, { filename: "missing-public-area.jpg" }, "filename mismatch");
  assertSourceValidationFailure(manifest, { sha256: "0".repeat(64) }, "SHA mismatch");
  assertSourceValidationFailure(manifest, { sizeBytes: manifest.items[0].sizeBytes + 1 }, "size mismatch");
  assertSourceValidationFailure(manifest, { width: manifest.items[0].width + 1 }, "dimension mismatch");

  assert.throws(
    () => assertEnvironmentMediaBatchRuntime({ databaseUrl: "" }),
    EnvironmentMediaBatchImportError,
    "missing DATABASE_URL must fail",
  );
  assert.throws(
    () => assertEnvironmentMediaBatchRuntime({ databaseUrl: "postgresql://example.invalid/db" }),
    EnvironmentMediaBatchImportError,
    "non-SQLite target must fail",
  );
  assert.throws(
    () =>
      assertEnvironmentMediaBatchRuntime({
        databaseUrl: "file:/opt/starlitsky/data/starlitsky.sqlite",
      }),
    EnvironmentMediaBatchImportError,
    "production-like target must require explicit confirmation",
  );
  assert.equal(
    assertEnvironmentMediaBatchRuntime({
      confirmProduction: true,
      databaseUrl: "file:/opt/starlitsky/data/starlitsky.sqlite",
    }).isProductionTarget,
    true,
    "confirmed production-like target should be classified",
  );
  await assert.rejects(
    () => runEnvironmentMediaBatchImport({ apply: true, client: prisma, manifest, sourceDir, runtimeContext: {} }),
    EnvironmentMediaBatchImportError,
    "apply must require a validated runtime context",
  );

  await cleanup();
  const beforeDryRun = await countAllTables();
  const dryRun = await runEnvironmentMediaBatchImport({
    client: prisma,
    manifest,
    runtimeContext: assertEnvironmentMediaBatchRuntime(),
    sourceDir,
  });
  assert.equal(dryRun.mode, "dry-run", "normal invocation must default to dry-run");
  assert.equal(dryRun.items.length, 5);
  assert.equal(dryRun.summary.objectsToUpload, 5);
  assert.equal(dryRun.summary.remoteDeletes, 0);
  assert.deepEqual(await countAllTables(), beforeDryRun, "dry-run must not mutate the DB");
  assert.equal(putObjectKeys.length, 0, "dry-run must not perform network PUT");
  assertNoSecretLikeOutput(dryRun);

  await seedExistingVisibleBindings();
  const beforeApply = await countAllTables();
  failPutForSourceItemId = "environment-maternity-03-verify";
  await assert.rejects(
    () =>
      runEnvironmentMediaBatchImport({
        apply: true,
        client: prisma,
        manifest,
        putObject: putWithSourceItemHeader,
        runtimeContext: assertEnvironmentMediaBatchRuntime(),
        sourceDir,
      }),
    EnvironmentMediaBatchImportError,
    "partial upload failure should fail closed",
  );
  failPutForSourceItemId = "";
  assert.equal(await countVisibleMaternityBindingsWithPrefix("legacy-maternity"), 1);
  assert.equal(await countImporterBindings(manifest, "hidden"), 2);
  assert.equal(await countImporterBindings(manifest, "visible"), 2);
  assert.equal(deletedObjectKeys.length, 0, "partial failure must not delete remote objects");

  const applyResult = await runEnvironmentMediaBatchImport({
    apply: true,
    client: prisma,
    manifest,
    putObject: putWithSourceItemHeader,
    runtimeContext: assertEnvironmentMediaBatchRuntime(),
    sourceDir,
  });
  assert.equal(applyResult.mode, "apply");
  assert.equal(applyResult.conflicts.length, 0);
  assert.equal(applyResult.applyResult.uploadedCount, 1, "rerun should upload only the missing item");
  assert.equal(applyResult.summary.remoteDeletes, 0);
  assert.equal(await countVisibleMaternityBindingsWithPrefix("legacy-maternity"), 0);
  assert.equal(await countArchivedMaternityBindingsWithPrefix("legacy-maternity"), 1);
  assert.equal(await countImporterBindings(manifest, "visible"), 5);
  assert.deepEqual(await listVisibleMaternitySortOrders(), [10, 20, 30]);
  assert.equal(await countActiveLegacyMaternityAssets(), 1, "old MediaAsset must remain active");
  assert.equal(await countVisibleAboutBindingsOnLegacySharedAsset(), 1);
  assert.equal(await countVisibleSlotBindings(PUBLIC_SLOT), 2, "public-area append semantics must preserve old bindings");
  assert.equal(await countVisibleSlotBindings(MEDICAL_SLOT), 2, "medical append semantics must preserve old bindings");
  assert.equal(deletedObjectKeys.length, 0, "successful switch must not delete remote objects");

  const afterFirstApply = await countAllTables();
  const secondApply = await runEnvironmentMediaBatchImport({
    apply: true,
    client: prisma,
    manifest,
    putObject: putWithSourceItemHeader,
    runtimeContext: assertEnvironmentMediaBatchRuntime(),
    sourceDir,
  });
  assert.equal(secondApply.applyResult.uploadedCount, 0, "second apply must be idempotent");
  assert.deepEqual(await countAllTables(), afterFirstApply, "second apply must not duplicate rows");
  assert.equal(
    secondApply.items.every((item) => item.action === "noop"),
    true,
    "matching active importer identities should become noop",
  );

  const sampleImported = await prisma.mediaAsset.findFirst({
    where: { checksum: manifest.items[0].sha256, deleted_at: null },
  });
  assert.equal(
    sampleImported?.metadata_json?.environmentMediaBatch?.sourceItemId,
    manifest.items[0].id,
    "item provenance metadata must be persisted",
  );
  assert.equal(
    sampleImported?.metadata_json?.upload?.completedAt ? true : false,
    true,
    "upload must complete through pending upload metadata",
  );

  await createConflictingImporterAsset(manifest.items[0]);
  const conflictPlan = await createEnvironmentMediaBatchPlan({ client: prisma, manifest, sourceDir });
  assert.equal(
    conflictPlan.conflicts.some((conflict) => conflict.kind === "same-source-item-different-sha"),
    true,
    "same source item with different SHA must conflict",
  );
  await prisma.mediaAsset.deleteMany({ where: { source_url: "verify-conflict://different-sha" } });

  const environmentPage = await getFixedPage("environment", { includeHidden: true });
  const mapped = mapFixedPageMediaForVerify("environment", environmentPage.mediaAssets);
  assert.equal(mapped.environmentSlots.publicArea.length, 2);
  assert.equal(mapped.environmentSlots.medical.length, 2);
  assert.deepEqual(
    mapped.environmentSlots.maternity.map((item) => item.sortOrder),
    [10, 20, 30],
    "fixed-page public DTO should keep environment slots sorted",
  );
  assert.equal(
    mapped.galleryMedia.some((item) => item.usage === MATERNITY_SLOT),
    false,
    "ordinary gallery behavior must not duplicate slotted environment media",
  );
  assertNoDisallowedMutation(beforeApply, await countAllTables());
  assertNoSecretLikeOutput(secondApply);

  console.info("Environment media batch verification passed");
} finally {
  setObjectStorageTestClient(null);
  await cleanup();
  await prisma.$disconnect();
  rmLocalSqlite("file:environment-media-batch-verify.db");
  rmSync(sourceDir, { recursive: true, force: true });
}

function createFixtureManifest(dir) {
  const entries = [
    ["environment-public-area-verify", "environment_public_area.jpg", PUBLIC_SLOT, 10, false, "append-or-manual-bind", 1279, 1706, 11],
    ["environment-medical-room-verify", "environment_medical_room.jpg", MEDICAL_SLOT, 10, false, "append-or-manual-bind", 1279, 1706, 12],
    ["environment-maternity-01-verify", "environment_maternity_01.jpg", MATERNITY_SLOT, 10, true, "replace-visible-slot-bindings", 2048, 1536, 13],
    ["environment-maternity-02-verify", "environment_maternity_02.jpg", MATERNITY_SLOT, 20, true, "replace-visible-slot-bindings", 2048, 1536, 14],
    ["environment-maternity-03-verify", "environment_maternity_03.jpg", MATERNITY_SLOT, 30, true, "replace-visible-slot-bindings", 1536, 2048, 15],
  ];
  const items = entries.map(
    ([id, filename, businessSlot, sortOrder, replacementSet, replacementMode, width, height, pad]) => {
      const buffer = createMinimalJpeg({ height, pad, width });
      writeFileSync(join(dir, filename), buffer);
      return {
        binaryCommittedToGit: false,
        businessSlot,
        filename,
        height,
        id,
        intendedAltLabel: `${id} alt`,
        intendedTitle: `${id} title`,
        replacementMode,
        replacementSet,
        sha256: createHash("sha256").update(buffer).digest("hex"),
        sizeBytes: buffer.length,
        sortOrder,
        uploadedToCos: false,
        width,
      };
    },
  );
  return {
    binaryCommittedToGit: false,
    items,
    page: { ownerId: ENVIRONMENT_PAGE_ID, ownerType: "fixed_page", slug: "environment" },
    sourceBatchId: SOURCE_BATCH_ID,
    uploadedToCos: false,
    version: 1,
  };
}

function createMinimalJpeg({ height, pad, width }) {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00,
    0x48, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff,
    width & 0xff, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, pad,
    0xff, 0xd9,
  ]);
}

function assertSourceValidationFailure(manifest, patch, label) {
  const changed = structuredClone(manifest);
  Object.assign(changed.items[0], patch);
  assert.throws(
    () => validateEnvironmentMediaSourceFiles({ manifest: changed, sourceDir }),
    EnvironmentMediaBatchImportError,
    `${label} should fail before mutation`,
  );
}

async function seedExistingVisibleBindings() {
  const legacyPublic = await createLegacyImage("legacy-public", PUBLIC_SLOT, 10);
  const legacyMedical = await createLegacyImage("legacy-medical", MEDICAL_SLOT, 10);
  const legacyMaternity = await createLegacyImage("legacy-maternity", MATERNITY_SLOT, 5);
  await createMediaBinding(legacyMaternity.id, {
    ownerId: "fixed-page-about",
    ownerType: "fixed_page",
    sortOrder: 10,
    usage: "gallery",
    visibility: "visible",
  });
  assert.ok(legacyPublic.id && legacyMedical.id);
}

function createLegacyImage(id, usage, sortOrder) {
  return createMedia({
    altText: `${id} alt`,
    kind: "image",
    ownerId: ENVIRONMENT_PAGE_ID,
    ownerType: "fixed_page",
    sourceUrl: `verify-legacy://${id}`,
    sortOrder,
    status: "active",
    title: `${id} title`,
    usage,
  });
}

async function putWithSourceItemHeader({ filePath, mimeType, upload }) {
  const sourceItemId = inferSourceItemId(filePath);
  const response = await fetch(upload.url, {
    body: readFileSync(filePath),
    headers: { ...upload.headers, "content-type": mimeType, "x-verify-source-item-id": sourceItemId },
    method: upload.method,
  });
  if (!response.ok) {
    throw new EnvironmentMediaBatchImportError("Object storage PUT failed.", {
      statusCode: response.status,
    });
  }
}

function inferSourceItemId(filePath) {
  if (filePath.endsWith("environment_maternity_03.jpg")) return "environment-maternity-03-verify";
  if (filePath.endsWith("environment_maternity_02.jpg")) return "environment-maternity-02-verify";
  if (filePath.endsWith("environment_maternity_01.jpg")) return "environment-maternity-01-verify";
  if (filePath.endsWith("environment_medical_room.jpg")) return "environment-medical-room-verify";
  return "environment-public-area-verify";
}

async function createConflictingImporterAsset(sourceItem) {
  await createMedia({
    checksum: "f".repeat(64),
    kind: "image",
    metadataJson: {
      environmentMediaBatch: {
        businessSlot: sourceItem.businessSlot,
        importer: "environment-media-batch",
        sha256: "f".repeat(64),
        sourceBatchId: SOURCE_BATCH_ID,
        sourceFilename: sourceItem.filename,
        sourceItemId: sourceItem.id,
      },
      upload: {
        objectKey: "verify-env-media/conflict.jpg",
        verifiedAt: new Date().toISOString(),
      },
    },
    mimeType: "image/jpeg",
    ownerId: ENVIRONMENT_PAGE_ID,
    ownerType: "fixed_page",
    sourceUrl: "verify-conflict://different-sha",
    status: "active",
    usage: sourceItem.businessSlot,
  });
}

async function countVisibleSlotBindings(usage) {
  return prisma.mediaBinding.count({
    where: {
      deleted_at: null,
      owner_id: ENVIRONMENT_PAGE_ID,
      owner_type: "fixed_page",
      usage,
      visibility: "visible",
    },
  });
}

async function countImporterBindings(manifest, visibility) {
  const sourceItemIds = manifest.items.map((item) => item.id);
  const assets = await prisma.mediaAsset.findMany({
    where: { deleted_at: null },
    include: { bindings: true },
  });
  return assets.filter((asset) => {
    const sourceItemId = asset.metadata_json?.environmentMediaBatch?.sourceItemId;
    return (
      asset.status === "active" &&
      sourceItemIds.includes(sourceItemId) &&
      asset.bindings.some(
        (binding) =>
          binding.owner_id === ENVIRONMENT_PAGE_ID &&
          binding.visibility === visibility &&
          binding.deleted_at == null,
      )
    );
  }).length;
}

function countVisibleMaternityBindingsWithPrefix(prefix) {
  return prisma.mediaBinding.count({
    where: {
      deleted_at: null,
      owner_id: ENVIRONMENT_PAGE_ID,
      owner_type: "fixed_page",
      usage: MATERNITY_SLOT,
      visibility: "visible",
      media: { source_url: { startsWith: `verify-legacy://${prefix}` } },
    },
  });
}

function countArchivedMaternityBindingsWithPrefix(prefix) {
  return prisma.mediaBinding.count({
    where: {
      deleted_at: { not: null },
      owner_id: ENVIRONMENT_PAGE_ID,
      owner_type: "fixed_page",
      usage: MATERNITY_SLOT,
      visibility: "archived",
      media: { source_url: { startsWith: `verify-legacy://${prefix}` } },
    },
  });
}

function countActiveLegacyMaternityAssets() {
  return prisma.mediaAsset.count({
    where: {
      deleted_at: null,
      source_url: "verify-legacy://legacy-maternity",
      status: "active",
    },
  });
}

function countVisibleAboutBindingsOnLegacySharedAsset() {
  return prisma.mediaBinding.count({
    where: {
      deleted_at: null,
      owner_id: "fixed-page-about",
      owner_type: "fixed_page",
      usage: "gallery",
      visibility: "visible",
      media: { source_url: "verify-legacy://legacy-maternity" },
    },
  });
}

async function listVisibleMaternitySortOrders() {
  const assets = await prisma.mediaAsset.findMany({
    where: { deleted_at: null },
    include: {
      bindings: {
        where: {
          deleted_at: null,
          owner_id: ENVIRONMENT_PAGE_ID,
          owner_type: "fixed_page",
          usage: MATERNITY_SLOT,
          visibility: "visible",
        },
      },
    },
  });
  return assets
    .filter((asset) => asset.metadata_json?.environmentMediaBatch?.sourceBatchId === SOURCE_BATCH_ID)
    .flatMap((asset) => asset.bindings)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((binding) => binding.sort_order);
}

async function countAllTables() {
  const models = [
    "mediaAsset",
    "mediaBinding",
    "user",
    "userRole",
    "userSession",
    "adminLoginChallenge",
    "parentProfile",
    "parentInvite",
    "parentApplication",
    "parentCatLink",
    "selectionApplication",
    "post",
    "postCat",
    "postLitter",
    "comment",
    "postLike",
    "cat",
    "breedingCatProfile",
    "kittenProfile",
    "litter",
    "fixedPage",
  ];
  return Object.fromEntries(await Promise.all(models.map(async (model) => [model, await prisma[model].count()])));
}

function assertNoDisallowedMutation(before, after) {
  for (const model of [
    "user",
    "userRole",
    "userSession",
    "adminLoginChallenge",
    "parentProfile",
    "parentInvite",
    "parentApplication",
    "parentCatLink",
    "selectionApplication",
    "post",
    "postCat",
    "postLitter",
    "comment",
    "postLike",
    "cat",
    "breedingCatProfile",
    "kittenProfile",
    "litter",
  ]) {
    assert.equal(after[model], before[model], `${model} must not be mutated`);
  }
}

function assertNoSecretLikeOutput(value) {
  const text = JSON.stringify(value);
  assert.equal(text.includes("verify-storage-private-token"), false, "secret key must not appear in plan output");
  assert.equal(text.includes("X-Amz-Signature"), false, "signed URL data must not appear in plan output");
  assert.equal(text.includes("Authorization"), false, "authorization headers must not appear in plan output");
  assert.equal(text.includes("verify-access-key"), false, "access key must not appear in plan output");
}

async function cleanup() {
  await prisma.mediaBinding.deleteMany({
    where: {
      OR: [
        { owner_id: ENVIRONMENT_PAGE_ID },
        { owner_id: "fixed-page-about" },
        { media: { source_url: { startsWith: "verify-legacy://" } } },
        { media: { source_url: { startsWith: "https://media.verify.example/verify-env-media/" } } },
        { media: { source_url: "verify-conflict://different-sha" } },
      ],
    },
  });
  await prisma.mediaAsset.deleteMany({
    where: {
      OR: [
        { source_url: { startsWith: "verify-legacy://" } },
        { source_url: { startsWith: "https://media.verify.example/verify-env-media/" } },
        { source_url: "verify-conflict://different-sha" },
      ],
    },
  });
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

function mapFixedPageMediaForVerify(slug, mediaAssets = []) {
  const images = mediaAssets
    .filter((item) => item.kind === "image" && (item.sourceUrl || item.thumbnailUrl))
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.usage.localeCompare(right.usage) ||
        left.id.localeCompare(right.id),
    );
  const coverMedia = images.find((item) => item.usage === "cover") ?? null;
  const environmentSlots = {
    maternity: images.filter((item) => item.usage === MATERNITY_SLOT),
    publicArea: images.filter((item) => item.usage === PUBLIC_SLOT),
    medical: images.filter((item) => item.usage === MEDICAL_SLOT),
  };
  const slottedIds = new Set(Object.values(environmentSlots).flat().map((item) => item.id));
  return {
    coverMedia,
    environmentSlots,
    galleryMedia: images.filter((item) => {
      if (coverMedia && item.id === coverMedia.id && item.usage === coverMedia.usage) return false;
      if (slug === "environment" && slottedIds.has(item.id)) return false;
      return ![MATERNITY_SLOT, PUBLIC_SLOT, MEDICAL_SLOT].includes(item.usage);
    }),
  };
}
