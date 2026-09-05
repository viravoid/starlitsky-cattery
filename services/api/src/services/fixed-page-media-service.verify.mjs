import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import ts from "typescript";

process.env.DATABASE_URL = "file:fixed-page-media-verify.db";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { createMedia, createMediaBinding, deleteMediaBinding, getMedia } =
  await import("./media-service.mjs");
const { getFixedPage } = await import("./fixed-page-service.mjs");
const { setObjectStorageTestClient } = await import("./object-storage-service.mjs");
const { ENVIRONMENT_MEDIA_USAGES, mapFixedPageMedia } =
  await importTranspiledSharedFixedPageMedia();

const RUN_PREFIX = "verify-fixed-page-media";
const deletedObjectKeys = [];

setObjectStorageTestClient({
  headObject() {
    throw new Error("fixed-page media verification must not read object storage");
  },
  deleteObject({ objectKey }) {
    deletedObjectKeys.push(objectKey);
    return { deleted: true, missing: false };
  },
});

try {
  globalThis.fetch = () => {
    throw new Error("fixed-page media verification must not perform network operations");
  };

  await cleanup();

  const publicArea = await createFixedPageImage({
    id: "public-area",
    ownerId: "fixed-page-environment",
    sortOrder: 10,
    usage: ENVIRONMENT_MEDIA_USAGES.publicArea,
  });
  const medical = await createFixedPageImage({
    id: "medical",
    ownerId: "fixed-page-environment",
    sortOrder: 10,
    usage: ENVIRONMENT_MEDIA_USAGES.medical,
  });
  const maternityLate = await createFixedPageImage({
    id: "maternity-late",
    ownerId: "fixed-page-environment",
    sortOrder: 30,
    usage: ENVIRONMENT_MEDIA_USAGES.maternity,
  });
  const maternityEarly = await createFixedPageImage({
    id: "maternity-early",
    ownerId: "fixed-page-environment",
    sortOrder: 10,
    usage: ENVIRONMENT_MEDIA_USAGES.maternity,
  });
  const unknownUsage = await createFixedPageImage({
    id: "unknown",
    ownerId: "fixed-page-environment",
    sortOrder: 40,
    usage: "legacy-environment-photo",
  });
  const cover = await createFixedPageImage({
    id: "cover",
    ownerId: "fixed-page-environment",
    sortOrder: 0,
    usage: "cover",
  });

  const environmentPage = await getFixedPage("environment", { includeHidden: true });
  assert.equal(environmentPage.id, "fixed-page-environment");
  assert.deepEqual(
    environmentPage.mediaAssets.map((item) => [item.usage, item.sortOrder]),
    [
      ["cover", 0],
      [ENVIRONMENT_MEDIA_USAGES.maternity, 10],
      [ENVIRONMENT_MEDIA_USAGES.medical, 10],
      [ENVIRONMENT_MEDIA_USAGES.publicArea, 10],
      [ENVIRONMENT_MEDIA_USAGES.maternity, 30],
      ["legacy-environment-photo", 40],
    ],
    "FixedPage media DTO must preserve usage and deterministic sortOrder",
  );

  const mappedEnvironment = mapFixedPageMedia("environment", environmentPage.mediaAssets);
  assert.equal(mappedEnvironment.coverMedia?.id, cover.id, "environment cover must stay explicit");
  assert.deepEqual(
    mappedEnvironment.environmentSlots.maternity.map((item) => item.id),
    [maternityEarly.id, maternityLate.id],
    "environment:maternity must support multiple visible images in sort order",
  );
  assert.deepEqual(
    mappedEnvironment.environmentSlots.publicArea.map((item) => item.id),
    [publicArea.id],
    "environment:public-area must map to its slot",
  );
  assert.deepEqual(
    mappedEnvironment.environmentSlots.medical.map((item) => item.id),
    [medical.id],
    "environment:medical must map to its slot",
  );
  assert.deepEqual(
    mappedEnvironment.galleryMedia.map((item) => item.id),
    [unknownUsage.id],
    "unknown environment usage must fall back to the generic gallery",
  );

  const duplicateSlotAsset = await createFixedPageImage({
    id: "duplicate-slot",
    ownerId: "fixed-page-environment",
    sortOrder: 20,
    usage: ENVIRONMENT_MEDIA_USAGES.maternity,
  });
  await createMediaBinding(duplicateSlotAsset.id, {
    ownerId: "fixed-page-environment",
    ownerType: "fixed_page",
    sortOrder: 20,
    usage: "gallery",
    visibility: "visible",
  });
  const environmentWithDuplicate = await getFixedPage("environment", { includeHidden: true });
  const mappedDuplicate = mapFixedPageMedia("environment", environmentWithDuplicate.mediaAssets);
  assert.equal(
    mappedDuplicate.galleryMedia.some((item) => item.id === duplicateSlotAsset.id),
    false,
    "section slot media must not duplicate into generic gallery",
  );

  const sharedAsset = await createFixedPageImage({
    id: "shared-asset",
    ownerId: "fixed-page-environment",
    sortOrder: 50,
    usage: ENVIRONMENT_MEDIA_USAGES.maternity,
  });
  const sharedEnvironmentBinding = sharedAsset.bindings.find(
    (binding) => binding.ownerId === "fixed-page-environment",
  );
  assert.ok(sharedEnvironmentBinding, "shared asset must have an environment binding");
  const aboutBinding = await createMediaBinding(sharedAsset.id, {
    ownerId: "fixed-page-about",
    ownerType: "fixed_page",
    sortOrder: 10,
    usage: "gallery",
    visibility: "visible",
  });
  await deleteMediaBinding(sharedAsset.id, sharedEnvironmentBinding.id);
  const sharedAfterArchive = await getMedia(sharedAsset.id);
  assert.equal(
    sharedAfterArchive.status,
    "active",
    "archiving a binding must not archive MediaAsset",
  );
  assert.equal(
    sharedAfterArchive.deletedAt,
    null,
    "archiving a binding must not delete MediaAsset",
  );
  assert.equal(
    sharedAfterArchive.bindings.some(
      (binding) => binding.id === aboutBinding.id && binding.visibility === "visible",
    ),
    true,
    "archiving one fixed-page binding must not archive another binding on the same MediaAsset",
  );

  const aboutCover = await createFixedPageImage({
    id: "about-cover",
    ownerId: "fixed-page-about",
    sortOrder: 20,
    usage: "cover",
  });
  const aboutGallery = await createFixedPageImage({
    id: "about-gallery",
    ownerId: "fixed-page-about",
    sortOrder: 30,
    usage: "gallery",
  });
  const aboutPage = await getFixedPage("about", { includeHidden: true });
  const mappedAbout = mapFixedPageMedia("about", aboutPage.mediaAssets);
  assert.equal(
    mappedAbout.coverMedia?.id,
    aboutCover.id,
    "ordinary fixed-page cover behavior must remain",
  );
  assert.equal(
    mappedAbout.galleryMedia.some((item) => item.id === aboutGallery.id),
    true,
    "ordinary fixed-page gallery behavior must remain",
  );

  const manifest = JSON.parse(
    readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../docs/media-source-manifests/environment-2026-09-05.json",
      ),
      "utf8",
    ),
  );
  assert.equal(
    manifest.binaryCommittedToGit,
    false,
    "source manifest must not claim binary commit",
  );
  assert.equal(manifest.uploadedToCos, false, "source manifest must not claim COS upload");
  assert.equal(
    manifest.items.filter((item) => item.businessSlot === ENVIRONMENT_MEDIA_USAGES.maternity)
      .length,
    3,
    "source manifest must include three maternity replacement images",
  );
  assert.equal(
    manifest.items
      .filter((item) => item.businessSlot === ENVIRONMENT_MEDIA_USAGES.maternity)
      .every(
        (item) =>
          item.replacementSet === true && item.replacementMode === "replace-visible-slot-bindings",
      ),
    true,
    "maternity source manifest entries must record replacement intent",
  );

  assert.equal(
    deletedObjectKeys.length,
    0,
    "fixed-page media verification must not delete remote objects",
  );
  console.info("Fixed-page media verification passed");
} finally {
  setObjectStorageTestClient(null);
  await cleanup();
  await prisma.$disconnect();
  rmLocalSqlite(process.env.DATABASE_URL);
}

async function createFixedPageImage({ id, ownerId, sortOrder, usage }) {
  return createMedia({
    altText: `${id} alt`,
    kind: "image",
    ownerId,
    ownerType: "fixed_page",
    sourceUrl: `verify-fixed-page-media://${id}`,
    sortOrder,
    status: "active",
    title: `${id} title`,
    usage,
  });
}

async function cleanup() {
  await prisma.mediaBinding.deleteMany({
    where: {
      OR: [
        { media: { source_url: { startsWith: "verify-fixed-page-media://" } } },
        { owner_id: { in: ["fixed-page-environment", "fixed-page-about"] } },
      ],
    },
  });
  await prisma.mediaAsset.deleteMany({
    where: { source_url: { startsWith: "verify-fixed-page-media://" } },
  });
}

async function importTranspiledSharedFixedPageMedia() {
  const sourcePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../packages/shared/src/fixed-page-media.ts",
  );
  const outputPath = resolve(tmpdir(), `starlitsky-fixed-page-media-${process.pid}.mjs`);
  const source = readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  writeFileSync(outputPath, transpiled.outputText);
  try {
    return await import(`${pathToFileURL(outputPath).href}?t=${Date.now()}`);
  } finally {
    rmSync(outputPath, { force: true });
  }
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
