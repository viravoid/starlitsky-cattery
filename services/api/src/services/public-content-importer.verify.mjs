import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERIFY_DATABASE_URL = `file:${resolve(process.cwd(), "public-content-import-verify.db")}`;

process.env.DATABASE_URL = VERIFY_DATABASE_URL;
process.env.STORAGE_PROVIDER = "s3";
process.env.STORAGE_BUCKET = "verify-public-content-media-bucket";
process.env.STORAGE_REGION = "ap-shanghai";
process.env.STORAGE_ACCESS_KEY_ID = "verify-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "verify-storage-private-token";
process.env.STORAGE_PUBLIC_BASE_URL = "https://media.verify.example";
process.env.STORAGE_KEY_PREFIX = "verify-public-content-media";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { PUBLIC_CONTENT_MANIFEST } = await import("../content/public-content-manifest.mjs");
const { loadPublicContentManifest } = await import("../content/public-content-manifest-selector.mjs");
const {
  WEB_DEMO_BREEDING_PLAN_STUD_IDS,
  WEB_DEMO_FIXED_PAGE_MAPPING,
  WEB_DEMO_LEGACY_CAT_ID_ALIASES,
  WEB_DEMO_PUBLIC_CONTENT_MANIFEST,
  WEB_DEMO_SOURCE_CONTENT,
} = await import("../content/web-demo-content-transformer.mjs");
const { getCat, listCats } = await import("./cat-service.mjs");
const { getFixedPage } = await import("./fixed-page-service.mjs");
const { getBreedingProfile } = await import("./profile-service.mjs");
const { setObjectStorageTestClient } = await import("./object-storage-service.mjs");
const {
  PublicContentImportError,
  assertPublicContentImporterRuntime,
  countTables,
  createPublicContentImportPlan,
  runPublicContentImport,
  validatePublicContentManifest,
} = await import("./public-content-importer.mjs");

const objectMetadata = new Map();
const putObjectKeys = [];

try {
  setObjectStorageTestClient({
    headObject({ objectKey }) {
      return objectMetadata.get(objectKey) ?? { exists: false };
    },
  });
  globalThis.fetch = async (url, options = {}) => {
    if (options.method !== "PUT") {
      throw new Error("public content importer must only perform mocked object-storage PUT requests");
    }
    const uploadUrl = new URL(url);
    const objectKey = decodeURIComponent(uploadUrl.pathname.replace(/^\/+/, ""));
    const body = Buffer.from(options.body);
    putObjectKeys.push(objectKey);
    objectMetadata.set(objectKey, {
      contentLength: body.length,
      contentType: options.headers?.["content-type"] ?? "image/jpeg",
      etag: `"verify-${body.length}"`,
      exists: true,
      lastModified: new Date("2026-10-03T00:00:00.000Z").toUTCString(),
    });
    return new Response(null, { status: 200 });
  };

  const runtimeContext = assertPublicContentImporterRuntime();
  assert.equal(validatePublicContentManifest(PUBLIC_CONTENT_MANIFEST), true);
  assert.equal(validatePublicContentManifest(WEB_DEMO_PUBLIC_CONTENT_MANIFEST), true);
  assert.notEqual(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.manifestId,
    PUBLIC_CONTENT_MANIFEST.manifestId,
    "Demo manifest must be independent from the legacy pinned-copy manifest",
  );
  assert.equal(
    (await loadPublicContentManifest("legacy")).manifestId,
    PUBLIC_CONTENT_MANIFEST.manifestId,
    "legacy manifest selection must keep using the pinned-copy source",
  );
  assert.equal(
    (await loadPublicContentManifest("demo")).manifestId,
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.manifestId,
    "demo manifest selection must load the Web Demo source",
  );
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
  process.env.DATABASE_URL = VERIFY_DATABASE_URL;

  await assertWebDemoManifestMapping();
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
  setObjectStorageTestClient(null);
  await prisma.$disconnect();
  rmLocalSqlite(VERIFY_DATABASE_URL);
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

async function assertWebDemoManifestMapping() {
  const demoPagesBySlug = new Map(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPages.map((page) => [page.slug, page]),
  );

  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPages.length,
    WEB_DEMO_FIXED_PAGE_MAPPING.length,
    "Demo fixed-page manifest must include every requested page",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.breedingCats.length,
    14,
    "Demo manifest must import exactly the 14 breeding-plan referenced cats",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageContentJsonMode,
    "replace",
    "Demo manifest must replace fixed-page content JSON",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.length > 0,
    true,
    "Demo manifest must include fixed-page media mappings",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.some((item) => item.slug === "environment"),
    true,
    "Demo manifest must map environment media",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.some((item) => item.slug === "feeding"),
    true,
    "Demo manifest must map feeding media",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.some((item) => item.slug === "about"),
    false,
    "About has no canonical hero imageId in this PR head",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.some((item) => item.slug === "aftercare"),
    false,
    "Aftercare has no canonical contract assetId in this PR head",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.catMedia.length,
    40,
    "Demo manifest must include available referenced stud media and no invented yunyue media",
  );
  assert.equal(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.catMedia.some((item) => item.publicContentId === "yunyue"),
    false,
    "Yunyue must remain a valid zero-media cat",
  );
  assert.deepEqual(
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.breedingCats.map((entry) => entry.cat.publicContentId).sort(),
    WEB_DEMO_BREEDING_PLAN_STUD_IDS,
    "Demo breeding cat publicContentIds must exactly match the breeding-plan references",
  );

  for (const { slug } of WEB_DEMO_FIXED_PAGE_MAPPING) {
    const page = demoPagesBySlug.get(slug);
    assert.ok(page, `Demo manifest must include ${slug}`);
    assert.equal(page.status, "published", `${slug} must be publishable`);
    assert.deepEqual(
      page.contentJson,
      WEB_DEMO_SOURCE_CONTENT[slug],
      `${slug} content JSON must match Web Demo source verbatim`,
    );
  }

  const philosophy = demoPagesBySlug.get("philosophy").contentJson;
  assert.deepEqual(
    philosophy,
    WEB_DEMO_SOURCE_CONTENT.philosophy,
    "philosophy full structured copy must survive",
  );
  assert.ok(
    Object.keys(philosophy).includes("closingAftercareParagraph"),
    "philosophy closing structured copy must not be dropped",
  );

  const environment = demoPagesBySlug.get("environment").contentJson;
  const environmentRoomCount = environment.sections.flatMap((section) => section.rooms).length;
  assert.equal(
    environmentRoomCount,
    WEB_DEMO_SOURCE_CONTENT.environment.sections.flatMap((section) => section.rooms).length,
    "environment rooms must survive",
  );
  assert.ok(environmentRoomCount > 0, "environment must contain rooms");

  const feeding = demoPagesBySlug.get("feeding").contentJson;
  assert.deepEqual(
    feeding.modules,
    WEB_DEMO_SOURCE_CONTENT.feeding.modules,
    "feeding modules must survive",
  );
  assert.ok(feeding.modules.length > 0, "feeding must contain modules");

  const process = demoPagesBySlug.get("process").contentJson;
  assert.deepEqual(
    {
      priceCards: process.priceCards,
      breedingCards: process.breedingCards,
      returningBenefits: process.returningBenefits,
      steps: process.steps,
      welcomeKitItems: process.welcomeKitItems,
    },
    {
      priceCards: WEB_DEMO_SOURCE_CONTENT.process.priceCards,
      breedingCards: WEB_DEMO_SOURCE_CONTENT.process.breedingCards,
      returningBenefits: WEB_DEMO_SOURCE_CONTENT.process.returningBenefits,
      steps: WEB_DEMO_SOURCE_CONTENT.process.steps,
      welcomeKitItems: WEB_DEMO_SOURCE_CONTENT.process.welcomeKitItems,
    },
    "process cards, steps, and kit items must survive",
  );

  const aftercare = demoPagesBySlug.get("aftercare").contentJson;
  assert.deepEqual(
    {
      promises: aftercare.promises,
      healthItems: aftercare.healthItems,
      contractNotice: aftercare.contractNotice,
      contractFile: aftercare.contractFile,
    },
    {
      promises: WEB_DEMO_SOURCE_CONTENT.aftercare.promises,
      healthItems: WEB_DEMO_SOURCE_CONTENT.aftercare.healthItems,
      contractNotice: WEB_DEMO_SOURCE_CONTENT.aftercare.contractNotice,
      contractFile: WEB_DEMO_SOURCE_CONTENT.aftercare.contractFile,
    },
    "aftercare structured content must survive",
  );

  const contact = demoPagesBySlug.get("contact").contentJson;
  assert.equal(
    contact.introduction,
    WEB_DEMO_SOURCE_CONTENT.contact.introduction,
    "contact introduction must survive",
  );

  await assertWebDemoPublicContentIdConflict();

  const beforeDryRun = await countTables(prisma);
  const dryRunPlan = await runPublicContentImport({
    client: prisma,
    manifest: WEB_DEMO_PUBLIC_CONTENT_MANIFEST,
  });
  assert.equal(dryRunPlan.mode, "dry-run", "Demo import must dry-run by default");
  assert.equal(dryRunPlan.fixedPages.length, WEB_DEMO_FIXED_PAGE_MAPPING.length);
  assert.equal(dryRunPlan.breedingCats.length, 14);
  assert.equal(
    dryRunPlan.fixedPageMedia.length,
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.length,
    "Demo dry-run must include every fixed-page media item",
  );
  assert.equal(
    dryRunPlan.catMedia.length,
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.catMedia.length,
    "Demo dry-run must include every available stud media item",
  );
  assert.equal(
    dryRunPlan.fixedPageMedia.every((item) => item.action === "upload" && item.requiresCosUpload),
    true,
    "Demo dry-run must plan first-time fixed-page media uploads",
  );
  assert.equal(
    dryRunPlan.catMedia.every((item) => item.action === "upload" && item.requiresCosUpload),
    true,
    "Demo dry-run must plan first-time cat media uploads",
  );
  assert.deepEqual(await countTables(prisma), beforeDryRun, "Demo dry-run must not mutate the DB");

  await seedWebDemoRowsWithStaleLegacyKeys();
  const staleKeyPlan = await runPublicContentImport({
    client: prisma,
    manifest: WEB_DEMO_PUBLIC_CONTENT_MANIFEST,
  });
  assert.equal(
    staleKeyPlan.fixedPages.every((entry) => entry.action === "update"),
    true,
    "stale legacy fixed-page keys must be planned as updates",
  );

  const firstDemoApply = await runPublicContentImport({
    apply: true,
    client: prisma,
    manifest: WEB_DEMO_PUBLIC_CONTENT_MANIFEST,
    runtimeContext: assertPublicContentImporterRuntime(),
  });
  assert.equal(
    firstDemoApply.applyResult.fixedPageMedia.uploadedCount,
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.length,
    "first Demo apply must upload every mapped fixed-page media item",
  );
  assert.equal(
    firstDemoApply.applyResult.catMedia.uploadedCount,
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.catMedia.length,
    "first Demo apply must upload every mapped cat media item",
  );
  await assertWebDemoRowsMatchCanonical();
  await assertWebDemoMediaResolves();
  await assertWebDemoBreedingCatsResolve();

  const afterFirstDemoApplyCounts = await countTables(prisma);
  const secondDemoApplyPlan = await runPublicContentImport({
    apply: true,
    client: prisma,
    manifest: WEB_DEMO_PUBLIC_CONTENT_MANIFEST,
    runtimeContext: assertPublicContentImporterRuntime(),
  });
  assert.deepEqual(
    await countTables(prisma),
    afterFirstDemoApplyCounts,
    "second Demo apply must not create or delete records",
  );
  assert.equal(
    secondDemoApplyPlan.fixedPages.every((entry) => entry.action === "noop"),
    true,
    "second Demo apply must report all fixed pages as noop",
  );
  assert.equal(
    secondDemoApplyPlan.fixedPageMedia.every((entry) => entry.action === "noop"),
    true,
    "second Demo apply must report all fixed-page media as noop",
  );
  assert.equal(
    secondDemoApplyPlan.breedingCats.every(
      (entry) =>
        entry.catChanges.length === 0 &&
        entry.breedingProfileAction === "noop" &&
        entry.breedingProfileChanges.length === 0,
    ),
    true,
    "second Demo apply must report all breeding cats as noop",
  );
  assert.equal(
    secondDemoApplyPlan.catMedia.every((entry) => entry.action === "noop"),
    true,
    "second Demo apply must report all cat media as noop",
  );
  await assertWebDemoRowsMatchCanonical();
  await assertWebDemoMediaResolves();
  await assertWebDemoBreedingCatsResolve();
  await cleanupWebDemoFixedPageMedia();
  await cleanupWebDemoBreedingContent();
}

async function assertWebDemoPublicContentIdConflict() {
  const publicContentId = WEB_DEMO_BREEDING_PLAN_STUD_IDS[0];
  await prisma.cat.create({
    data: {
      id: "verify-duplicate-public-content-id",
      name: "Duplicate Public Content Identity",
      lifecycle_status: "breeding",
      visibility: "hidden",
      story_json: {
        source: { publicContentId, publicContentImportId: "verify-unrelated-importer" },
        story: ["duplicate identity"],
      },
    },
  });
  const duplicateIdentityPlan = await createPublicContentImportPlan({
    client: prisma,
    manifest: WEB_DEMO_PUBLIC_CONTENT_MANIFEST,
  });
  assert.equal(
    duplicateIdentityPlan.conflicts.some(
      (conflict) => conflict.kind === "breeding-cat-public-content-id-ambiguous",
    ),
    true,
    "duplicate publicContentId must be planned as a conflict",
  );
  await assert.rejects(
    () =>
      runPublicContentImport({
        apply: true,
        client: prisma,
        manifest: WEB_DEMO_PUBLIC_CONTENT_MANIFEST,
        runtimeContext: assertPublicContentImporterRuntime(),
      }),
    PublicContentImportError,
    "duplicate publicContentId must fail closed on apply",
  );
  await prisma.cat.delete({ where: { id: "verify-duplicate-public-content-id" } });
}

async function seedWebDemoRowsWithStaleLegacyKeys() {
  for (const page of WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPages) {
    await prisma.fixedPage.upsert({
      where: { slug: page.slug },
      create: {
        id: `fixed-page-${page.slug}`,
        slug: page.slug,
        title: page.title,
        status: "published",
        content_schema_version: page.contentSchemaVersion,
        content_json: {
          ...WEB_DEMO_SOURCE_CONTENT[page.slug],
          body: "stale legacy body",
          facts: { stale: true },
          sections: page.slug === "environment" ? WEB_DEMO_SOURCE_CONTENT.environment.sections : [],
        },
        published_at: new Date("2026-10-02T00:00:00.000Z"),
      },
      update: {
        title: page.title,
        status: "published",
        content_schema_version: page.contentSchemaVersion,
        content_json: {
          ...WEB_DEMO_SOURCE_CONTENT[page.slug],
          body: "stale legacy body",
          facts: { stale: true },
          sections: page.slug === "environment" ? WEB_DEMO_SOURCE_CONTENT.environment.sections : [],
        },
        published_at: new Date("2026-10-02T00:00:00.000Z"),
      },
    });
  }
}

async function assertWebDemoRowsMatchCanonical() {
  for (const page of WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPages) {
    const row = await prisma.fixedPage.findUnique({ where: { slug: page.slug } });
    assert.ok(row, `${page.slug} fixed page must exist`);
    assert.equal(row.status, "published", `${page.slug} must be published`);
    assert.deepEqual(
      row.content_json,
      WEB_DEMO_SOURCE_CONTENT[page.slug],
      `${page.slug} content JSON must exactly match Web Demo source`,
    );
  }
}

async function assertWebDemoMediaResolves() {
  const mediaIds = new Set(WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.map((item) => item.id));
  const environmentPage = await getFixedPage("environment");
  const feedingPage = await getFixedPage("feeding");
  assert.equal(environmentPage.status, "published");
  assert.equal(feedingPage.status, "published");
  assert.equal(
    environmentPage.mediaAssets.every((item) => mediaIds.has(item.id) && item.sourceUrl),
    true,
    "environment public API must return usable mapped media",
  );
  assert.equal(
    feedingPage.mediaAssets.every((item) => mediaIds.has(item.id) && item.sourceUrl),
    true,
    "feeding public API must return usable mapped media",
  );

  const expectedEnvironmentIds = collectContentIds(WEB_DEMO_SOURCE_CONTENT.environment);
  const expectedFeedingIds = collectContentIds(WEB_DEMO_SOURCE_CONTENT.feeding);
  const returnedEnvironmentIds = new Set(environmentPage.mediaAssets.map((item) => item.id));
  const returnedFeedingIds = new Set(feedingPage.mediaAssets.map((item) => item.id));
  for (const id of expectedEnvironmentIds) {
    assert.equal(returnedEnvironmentIds.has(id), true, `environment media must include ${id}`);
  }
  for (const id of expectedFeedingIds) {
    assert.equal(returnedFeedingIds.has(id), true, `feeding media must include ${id}`);
  }
}

async function assertWebDemoBreedingCatsResolve() {
  const publicCatList = await listCats(new URLSearchParams("pageSize=100"));
  const expectedPublicContentIds = new Set(WEB_DEMO_BREEDING_PLAN_STUD_IDS);
  const returnedCanonicalCats = publicCatList.items.filter((cat) =>
    expectedPublicContentIds.has(cat.publicContentId),
  );
  assert.equal(returnedCanonicalCats.length, 14, "public API must expose 14 canonical breeding cats");
  assert.deepEqual(
    returnedCanonicalCats.map((cat) => cat.publicContentId).sort(),
    WEB_DEMO_BREEDING_PLAN_STUD_IDS,
    "public API must expose unique canonical publicContentIds",
  );

  for (const [publicContentId, legacySlug] of Object.entries(WEB_DEMO_LEGACY_CAT_ID_ALIASES)) {
    const cat = returnedCanonicalCats.find((item) => item.publicContentId === publicContentId);
    assert.ok(cat, `${publicContentId} must resolve through publicContentId`);
    assert.equal(
      cat.id,
      `public-content-cat-${legacySlug}`,
      `${publicContentId} must adopt the legacy production row id without renaming it`,
    );
  }

  const catsByPublicContentId = new Map(
    returnedCanonicalCats.map((cat) => [cat.publicContentId, cat]),
  );
  for (const entry of WEB_DEMO_PUBLIC_CONTENT_MANIFEST.breedingCats) {
    const cat = catsByPublicContentId.get(entry.cat.publicContentId);
    assert.ok(cat, `${entry.cat.publicContentId} must be returned by the public API`);
    assert.equal(cat.visibility, "visible", `${entry.cat.publicContentId} must be publishable`);
    assert.equal(cat.breedingProfile?.trait, entry.breedingProfile.trait);
    assert.equal(cat.breedingProfile?.source, entry.breedingProfile.source);
    assert.deepEqual(cat.storyJson.story, entry.cat.storyJson.story);
  }

  assert.equal(
    catsByPublicContentId.get("huqing")?.storyJson?.story?.[0],
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.breedingCats.find((entry) => entry.cat.publicContentId === "huqing")
      ?.cat.storyJson.story[0],
    "huqing placeholder story must be preserved exactly",
  );
  assert.equal(
    catsByPublicContentId.get("luoyiyi")?.storyJson?.story?.[0],
    WEB_DEMO_PUBLIC_CONTENT_MANIFEST.breedingCats.find((entry) => entry.cat.publicContentId === "luoyiyi")
      ?.cat.storyJson.story[0],
    "luoyiyi placeholder story must be preserved exactly",
  );
  assert.equal(
    catsByPublicContentId.get("yunyue")?.mediaAssets.length,
    0,
    "yunyue must render as a valid zero-media cat",
  );

  for (const cat of returnedCanonicalCats) {
    if (cat.publicContentId === "yunyue") continue;
    assert.ok(
      cat.mediaAssets.some((item) => item.usage === "cover" && item.sourceUrl),
      `${cat.publicContentId} must have a cover media binding`,
    );
  }
}

function collectContentIds(value, ids = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectContentIds(item, ids));
    return ids;
  }
  if (!value || typeof value !== "object") return ids;
  for (const [key, nestedValue] of Object.entries(value)) {
    if ((key === "imageId" || key === "coverImageId" || key === "assetId") && typeof nestedValue === "string") {
      ids.add(nestedValue);
    }
    collectContentIds(nestedValue, ids);
  }
  return ids;
}

async function cleanupWebDemoFixedPageMedia() {
  const mediaIds = WEB_DEMO_PUBLIC_CONTENT_MANIFEST.fixedPageMedia.map((item) => item.id);
  await prisma.mediaBinding.deleteMany({ where: { media_id: { in: mediaIds } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
}

async function cleanupWebDemoBreedingContent() {
  const mediaIds = WEB_DEMO_PUBLIC_CONTENT_MANIFEST.catMedia.map((item) => item.id);
  await prisma.mediaBinding.deleteMany({ where: { media_id: { in: mediaIds } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
  const catIds = WEB_DEMO_PUBLIC_CONTENT_MANIFEST.breedingCats.map((entry) => entry.cat.id);
  await prisma.breedingCatProfile.deleteMany({ where: { cat_id: { in: catIds } } });
  await prisma.cat.deleteMany({ where: { id: { in: catIds } } });
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

  return resolve(process.cwd(), normalized);
}
