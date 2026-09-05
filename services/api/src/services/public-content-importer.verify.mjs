import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:public-content-import-verify.db";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { PUBLIC_CONTENT_MANIFEST } = await import("../content/public-content-manifest.mjs");
const { getCat, listCats } = await import("./cat-service.mjs");
const { getFixedPage } = await import("./fixed-page-service.mjs");
const { getBreedingProfile } = await import("./profile-service.mjs");
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

  const runtimeContext = assertPublicContentImporterRuntime();
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
    () =>
      validatePublicContentManifest({
        ...PUBLIC_CONTENT_MANIFEST,
        fixedPages: [
          {
            ...PUBLIC_CONTENT_MANIFEST.fixedPages[0],
            seoTitle: null,
          },
        ],
      }),
    PublicContentImportError,
    "explicit nullable SEO clears must not be accepted without schema semantics",
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

  await assertApplyRuntimeRejects(undefined, "normal apply entrypoint must require DATABASE_URL");
  await assertApplyRuntimeRejects(
    "postgresql://example.invalid/db",
    "normal apply entrypoint must reject non-SQLite targets",
  );
  await assertApplyRuntimeRejects(
    "file:/opt/starlitsky/data/starlitsky.sqlite",
    "normal apply entrypoint must reject production-like targets without confirmation",
  );
  await assert.rejects(
    () => runPublicContentImport({ apply: true, client: prisma, runtimeContext: {} }),
    PublicContentImportError,
    "normal apply entrypoint must reject forged runtime context",
  );
  process.env.DATABASE_URL = "file:public-content-import-verify.db";

  await assertCatIdentityConflicts();

  const existingEntry = PUBLIC_CONTENT_MANIFEST.breedingCats.find(
    (entry) => entry.cat.id === "public-content-cat-sanmingzhi",
  );
  assert.ok(existingEntry, "sanmingzhi manifest entry must exist");

  await prisma.fixedPage.update({
    where: { slug: "about" },
    data: {
      title: "Published About",
      status: "published",
      seo_title: "Admin SEO title",
      seo_description: "Admin SEO description",
      content_schema_version: 1,
      content_json: {
        body: "Admin old body",
        adminExtension: { keep: true },
      },
      published_at: new Date("2026-09-01T00:00:00.000Z"),
    },
  });
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
      id: existingEntry.cat.id,
      name: existingEntry.cat.name,
      birthday: new Date("2025-01-01T00:00:00.000Z"),
      color: "旧颜色",
      gender: "male",
      lifecycle_status: "growing",
      personality: "Do not clear omitted cat fields",
      story_json: {
        adminNote: "preserve top-level story key",
        source: {
          publicContentImportId: existingEntry.importId,
          adminSourceNote: "preserve nested source key",
        },
        story: ["旧介绍"],
      },
      visibility: "visible",
    },
  });
  await prisma.breedingCatProfile.create({
    data: {
      cat_id: existingEntry.cat.id,
      breeding_role: "candidate",
      reproductive_state: "observing",
      status_label: "旧状态",
      trait: "Admin trait",
      source: "Admin source",
      health_summary: "Admin health summary",
      sort_order: 999,
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
  const aboutDryRun = dryRunPlan.fixedPages.find((page) => page.slug === "about");
  assert.ok(aboutDryRun, "about fixed page must be planned");
  assert.equal(
    aboutDryRun.changes.some((change) => change.field === "seo_title"),
    false,
    "omitted seoTitle must not appear as a dry-run change",
  );
  assert.equal(
    aboutDryRun.changes.some((change) => change.field === "seo_description"),
    false,
    "omitted seoDescription must not appear as a dry-run change",
  );
  const sanmingzhiDryRun = dryRunPlan.breedingCats.find(
    (entry) => entry.importId === existingEntry.importId,
  );
  assert.ok(sanmingzhiDryRun, "matching import identity should be allowed");
  assert.equal(
    sanmingzhiDryRun.breedingProfileChanges.some((change) =>
      ["trait", "source", "health_summary"].includes(change.field),
    ),
    false,
    "profile fields omitted by source must not appear as dry-run changes",
  );

  const applyPlan = await runPublicContentImport({ apply: true, client: prisma, runtimeContext });
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

  const preservedFixedPage = await prisma.fixedPage.findUnique({ where: { slug: "about" } });
  assert.equal(
    preservedFixedPage?.seo_title,
    "Admin SEO title",
    "omitted fixed-page SEO title must not be cleared",
  );
  assert.equal(
    preservedFixedPage?.seo_description,
    "Admin SEO description",
    "omitted fixed-page SEO description must not be cleared",
  );
  assert.deepEqual(
    preservedFixedPage?.content_json?.adminExtension,
    { keep: true },
    "unrelated fixed-page content_json keys must be preserved",
  );
  assert.equal(preservedFixedPage?.status, "draft", "manifest fixed pages must remain draft");

  const preservedCat = await prisma.cat.findUnique({ where: { id: existingEntry.cat.id } });
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
  assert.equal(
    preservedCat?.story_json?.adminNote,
    "preserve top-level story key",
    "unrelated story_json key must be preserved",
  );
  assert.equal(
    preservedCat?.story_json?.source?.adminSourceNote,
    "preserve nested source key",
    "unrelated story_json.source key must be preserved",
  );
  assert.deepEqual(
    preservedCat?.story_json?.story,
    existingEntry.cat.storyJson.story,
    "manifest-owned story must update",
  );
  assert.equal(
    preservedCat?.story_json?.source?.publicContentImportId,
    existingEntry.importId,
    "manifest-owned provenance must be present",
  );

  const preservedProfile = await prisma.breedingCatProfile.findUnique({
    where: { cat_id: existingEntry.cat.id },
  });
  assert.equal(preservedProfile?.trait, "Admin trait", "profile trait must be preserved");
  assert.equal(preservedProfile?.source, "Admin source", "profile source must be preserved");
  assert.equal(
    preservedProfile?.health_summary,
    "Admin health summary",
    "profile health_summary must be preserved",
  );

  const publicAbout = await getFixedPage("about");
  assert.equal(publicAbout.status, "draft", "public fixed-page fallback remains draft");
  assert.deepEqual(publicAbout.contentJson, {}, "public read must not expose draft import body");
  const adminAbout = await getFixedPage("about", { includeHidden: true });
  assert.equal(adminAbout.contentJson.body, PUBLIC_CONTENT_MANIFEST.fixedPages[0].contentJson.body);
  const publicCatList = await listCats(new URLSearchParams());
  assert.equal(
    publicCatList.items.some((cat) => cat.id.startsWith("public-content-cat-")),
    false,
    "public cat list must not expose hidden breeding cats",
  );
  await assert.rejects(
    () => getCat(existingEntry.cat.id),
    { statusCode: 404 },
    "public cat detail must not expose hidden breeding cats",
  );
  const adminCatList = await listCats(new URLSearchParams(), { includeHidden: true });
  assert.equal(
    adminCatList.items.some((cat) => cat.id === existingEntry.cat.id),
    true,
    "admin/includeHidden cat list must expose imported hidden cats",
  );
  const adminCat = await getCat(existingEntry.cat.id, { includeHidden: true });
  assert.equal(adminCat.visibility, "hidden");
  const adminProfile = await getBreedingProfile(existingEntry.cat.id, { includeHidden: true });
  assert.equal(adminProfile.trait, "Admin trait");

  const unrelatedFixedPage = await prisma.fixedPage.findUnique({
    where: { id: "verify-unrelated-fixed-page" },
  });
  const unrelatedCat = await prisma.cat.findUnique({ where: { id: "verify-unrelated-cat" } });
  assert.equal(unrelatedFixedPage?.title, "Unrelated fixed page");
  assert.equal(unrelatedCat?.personality, "Keep this unrelated record");

  const afterFirstApplyCounts = await countTables(prisma);
  const secondApplyPlan = await runPublicContentImport({ apply: true, client: prisma, runtimeContext });
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
  await runPublicContentImport({ apply: true, client: prisma, manifest: changedManifest, runtimeContext });
  const updatedAbout = await prisma.fixedPage.findUnique({ where: { slug: "about" } });
  assert.equal(updatedAbout?.title, "猫舍介绍（验证更新）");

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
  rmLocalSqlite("file:public-content-import-verify.db");
}

async function assertApplyRuntimeRejects(databaseUrl, message) {
  if (databaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = databaseUrl;
  }
  await assert.rejects(
    () => runPublicContentImport({ apply: true, client: prisma }),
    PublicContentImportError,
    message,
  );
}

async function assertCatIdentityConflicts() {
  const entry = PUBLIC_CONTENT_MANIFEST.breedingCats[0];

  await prisma.cat.create({
    data: {
      id: entry.cat.id,
      name: entry.cat.name,
      lifecycle_status: "breeding",
      visibility: "hidden",
      story_json: { story: ["legacy row without provenance"] },
    },
  });
  const missingIdentityPlan = await createPublicContentImportPlan({ client: prisma });
  assert.equal(
    missingIdentityPlan.conflicts.some(
      (conflict) => conflict.kind === "breeding-cat-missing-import-identity",
    ),
    true,
    "same deterministic id without import identity must be planned as a conflict",
  );
  await assert.rejects(
    () => runPublicContentImport({ apply: true, client: prisma }),
    PublicContentImportError,
    "same deterministic id without import identity must fail closed on apply",
  );
  await prisma.cat.delete({ where: { id: entry.cat.id } });

  await prisma.cat.create({
    data: {
      id: entry.cat.id,
      name: entry.cat.name,
      lifecycle_status: "breeding",
      visibility: "hidden",
      story_json: {
        source: { publicContentImportId: "different-import-id" },
        story: ["legacy row with different provenance"],
      },
    },
  });
  const differentIdentityPlan = await createPublicContentImportPlan({ client: prisma });
  assert.equal(
    differentIdentityPlan.conflicts.some(
      (conflict) => conflict.kind === "breeding-cat-import-id-conflict",
    ),
    true,
    "same deterministic id with different import identity must be planned as a conflict",
  );
  await assert.rejects(
    () => runPublicContentImport({ apply: true, client: prisma }),
    PublicContentImportError,
    "same deterministic id with different import identity must fail closed on apply",
  );
  await prisma.cat.delete({ where: { id: entry.cat.id } });

  await prisma.cat.create({
    data: {
      id: "verify-conflicting-cat",
      name: entry.cat.name,
      lifecycle_status: "breeding",
      visibility: "hidden",
    },
  });
  const sameNamePlan = await createPublicContentImportPlan({ client: prisma });
  assert.equal(
    sameNamePlan.conflicts.some((conflict) => conflict.kind === "breeding-cat-name-conflict"),
    true,
    "same name with different id must be planned as a conflict",
  );
  await assert.rejects(
    () => runPublicContentImport({ apply: true, client: prisma }),
    PublicContentImportError,
    "same name with different id must fail closed on apply",
  );
  await prisma.cat.delete({ where: { id: "verify-conflicting-cat" } });
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
