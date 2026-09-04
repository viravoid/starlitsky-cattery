import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:public-content-import-verify.db";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { PUBLIC_CONTENT_MANIFEST } = await import("../content/public-content-manifest.mjs");
const {
  PublicContentImportError,
  assertPublicContentImporterRuntime,
  countTables,
  createPublicContentImportPlan,
  runPublicContentImport,
  validatePublicContentManifest,
} = await import("./public-content-importer.mjs");

try {
  globalThis.fetch = () => {
    throw new Error("public content importer must not perform network operations");
  };

  assert.equal(validatePublicContentManifest(PUBLIC_CONTENT_MANIFEST), true);
  assert.throws(
    () =>
      validatePublicContentManifest({
        ...PUBLIC_CONTENT_MANIFEST,
        fixedPages: [
          ...PUBLIC_CONTENT_MANIFEST.fixedPages,
          {
            ...PUBLIC_CONTENT_MANIFEST.fixedPages[0],
            importId: "fixed-page-unknown-slug",
            slug: "unknown-slug",
          },
        ],
      }),
    PublicContentImportError,
    "unknown fixed-page slugs must fail manifest validation",
  );
  assert.throws(
    () => assertPublicContentImporterRuntime({ databaseUrl: "" }),
    PublicContentImportError,
    "DATABASE_URL must be explicit",
  );
  assert.throws(
    () => assertPublicContentImporterRuntime({ databaseUrl: "postgresql://example.invalid/db" }),
    PublicContentImportError,
    "non-SQLite DATABASE_URL must fail closed",
  );
  assert.throws(
    () =>
      assertPublicContentImporterRuntime({
        databaseUrl: "file:/opt/starlitsky/data/starlitsky.sqlite",
      }),
    PublicContentImportError,
    "production-like SQLite paths require an extra confirmation guard",
  );
  assert.equal(
    assertPublicContentImporterRuntime({
      confirmProduction: true,
      databaseUrl: "file:/opt/starlitsky/data/starlitsky.sqlite",
    }).isProductionTarget,
    true,
    "explicit production confirmation should be recognized",
  );

  await prisma.fixedPage.create({
    data: {
      id: "verify-unrelated-fixed-page",
      slug: "verify-unrelated-fixed-page",
      title: "Unrelated fixed page",
      status: "published",
      content_json: { keep: true },
    },
  });
  await prisma.cat.create({
    data: {
      id: "verify-unrelated-cat",
      name: "Unrelated Cat",
      birthday: new Date("2020-01-02T00:00:00.000Z"),
      lifecycle_status: "growing",
      personality: "Keep this unrelated record",
      visibility: "visible",
    },
  });
  await prisma.cat.create({
    data: {
      id: "public-content-cat-sanmingzhi",
      name: "三明治",
      birthday: new Date("2025-01-01T00:00:00.000Z"),
      color: "旧颜色",
      gender: "male",
      lifecycle_status: "growing",
      personality: "Do not clear omitted cat fields",
      story_json: {
        source: {
          publicContentImportId: "breeding-cat-sanmingzhi-from-pinned-copy",
        },
        story: ["旧介绍"],
      },
      visibility: "visible",
    },
  });

  const beforeDryRun = await countTables(prisma);
  const dryRunPlan = await runPublicContentImport({ client: prisma });
  assert.equal(dryRunPlan.mode, "dry-run", "normal invocation must default to dry-run");
  assert.deepEqual(await countTables(prisma), beforeDryRun, "dry-run must not mutate the DB");
  assert.equal(dryRunPlan.fixedPages.length, PUBLIC_CONTENT_MANIFEST.fixedPages.length);
  assert.equal(dryRunPlan.breedingCats.length, PUBLIC_CONTENT_MANIFEST.breedingCats.length);
  assert.equal(
    dryRunPlan.skippedSections.length,
    PUBLIC_CONTENT_MANIFEST.skippedSections.length,
    "skipped/unmapped sections must be explicit",
  );
  assert.equal(dryRunPlan.conflicts.length, 0, "valid initial state should not conflict");

  const applyPlan = await runPublicContentImport({ apply: true, client: prisma });
  assert.equal(applyPlan.mode, "apply");
  assert.equal(
    await prisma.fixedPage.count({
      where: { slug: { in: PUBLIC_CONTENT_MANIFEST.fixedPages.map((page) => page.slug) } },
    }),
    PUBLIC_CONTENT_MANIFEST.fixedPages.length,
    "apply should create expected fixed-page records",
  );
  assert.equal(
    await prisma.breedingCatProfile.count({
      where: { cat_id: { in: PUBLIC_CONTENT_MANIFEST.breedingCats.map((entry) => entry.cat.id) } },
    }),
    PUBLIC_CONTENT_MANIFEST.breedingCats.length,
    "apply should create only safely mappable breeding profiles",
  );

  const preservedCat = await prisma.cat.findUnique({
    where: { id: "public-content-cat-sanmingzhi" },
  });
  assert.equal(
    preservedCat?.birthday?.toISOString(),
    "2025-01-01T00:00:00.000Z",
    "omitted birthday must not be cleared",
  );
  assert.equal(
    preservedCat?.personality,
    "Do not clear omitted cat fields",
    "omitted personality must not be cleared",
  );
  assert.equal(preservedCat?.visibility, "hidden", "manifest-owned visibility should update");

  const unrelatedFixedPage = await prisma.fixedPage.findUnique({
    where: { id: "verify-unrelated-fixed-page" },
  });
  const unrelatedCat = await prisma.cat.findUnique({ where: { id: "verify-unrelated-cat" } });
  assert.equal(unrelatedFixedPage?.title, "Unrelated fixed page");
  assert.equal(unrelatedCat?.personality, "Keep this unrelated record");

  const afterFirstApplyCounts = await countTables(prisma);
  const secondApplyPlan = await runPublicContentImport({ apply: true, client: prisma });
  const afterSecondApplyCounts = await countTables(prisma);
  assert.deepEqual(afterSecondApplyCounts, afterFirstApplyCounts, "second apply must be idempotent");
  assert.equal(
    secondApplyPlan.fixedPages.every((entry) => entry.action === "noop"),
    true,
    "second apply should report fixed pages as noop",
  );
  assert.equal(
    secondApplyPlan.breedingCats.every(
      (entry) =>
        entry.catChanges.length === 0 &&
        entry.breedingProfileAction === "noop" &&
        entry.breedingProfileChanges.length === 0,
    ),
    true,
    "second apply should report breeding cats as noop",
  );

  const changedManifest = structuredClone(PUBLIC_CONTENT_MANIFEST);
  changedManifest.fixedPages[0].title = "猫舍介绍（验证更新）";
  const updatePlan = await createPublicContentImportPlan({
    client: prisma,
    manifest: changedManifest,
  });
  assert.equal(updatePlan.fixedPages[0].action, "update");
  assert.deepEqual(updatePlan.fixedPages[0].changes.map((change) => change.field), ["title"]);
  await runPublicContentImport({ apply: true, client: prisma, manifest: changedManifest });
  const updatedAbout = await prisma.fixedPage.findUnique({ where: { slug: "about" } });
  assert.equal(updatedAbout?.title, "猫舍介绍（验证更新）");

  await prisma.cat.create({
    data: {
      id: "verify-conflicting-cat",
      name: PUBLIC_CONTENT_MANIFEST.breedingCats[0].cat.name,
      lifecycle_status: "breeding",
      visibility: "hidden",
    },
  });
  await assert.rejects(
    () => runPublicContentImport({ apply: true, client: prisma }),
    PublicContentImportError,
    "ambiguous existing same-name cats must fail closed",
  );
  await prisma.cat.delete({ where: { id: "verify-conflicting-cat" } });

  const finalCounts = await countTables(prisma);
  for (const model of [
    "user",
    "userRole",
    "userSession",
    "adminLoginChallenge",
    "parentProfile",
    "parentInvite",
    "parentApplication",
    "parentCatLink",
    "post",
    "postCat",
    "postLitter",
    "comment",
    "postLike",
    "selectionApplication",
    "mediaAsset",
    "mediaBinding",
  ]) {
    assert.equal(finalCounts[model], 0, `${model} must not be mutated`);
  }

  console.info("Public content import verification passed");
} finally {
  await prisma.$disconnect();
  rmLocalSqlite(process.env.DATABASE_URL);
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
