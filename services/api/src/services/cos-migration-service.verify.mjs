import assert from "node:assert/strict";
import crypto from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:cos-migration-readiness-verify.db";
process.env.STORAGE_PROVIDER = "cos";
process.env.STORAGE_BUCKET = "verify-new-bucket";
process.env.STORAGE_REGION = "ap-chengdu";
process.env.STORAGE_ACCESS_KEY_ID = "verify-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "verify-secret-key";
process.env.STORAGE_LEGACY_BUCKET = "verify-old-bucket-1234567890";
process.env.STORAGE_LEGACY_ACCESS_KEY_ID = "verify-legacy-access-key";
process.env.STORAGE_LEGACY_ACCESS_KEY_SECRET = "verify-legacy-secret-key";
process.env.STORAGE_READ_BUCKETS_JSON = JSON.stringify([
  {
    bucket: "verify-old-bucket-1234567890",
    provider: "lightcos",
    region: "ap-chengdu",
    endpoint: "https://verify-old-bucket-1234567890.cos.ap-chengdu.myqcloud.com",
    publicBaseUrl: "https://verify-old-bucket-1234567890.cos.ap-chengdu.myqcloud.com",
    historicalBaseUrls: ["https://historical-media.example.test/archive"],
  },
]);

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const {
  applyStorageSwitchPlan,
  buildStorageRollbackPlan,
  buildStorageSwitchPlan,
  calculateCosMigrationInventorySha256,
  calculateStorageSwitchCoverageAcknowledgementSha256,
  calculateStorageSwitchExclusionsSha256,
  calculateStorageSwitchPlanSha256,
  calculateSupplementalObjectManifestSha256,
  createCosMigrationInventory,
  executeCosObjectCopies,
} = await import("./cos-migration-service.mjs");
const { calculateExternalEvidenceIndexSha256, verifyExternalCosCopyEvidence } =
  await import("./cos-migration-external-evidence.mjs");
const { assertMigrationWriteRuntime, databaseUrlFingerprint, verifyMigrationSqliteBackup } =
  await import("./cos-migration-runtime-guard.mjs");

const PREFIX = "verify-cos-migration";
const SOURCE_BUCKET = "verify-old-bucket-1234567890";
const TARGET_BUCKET = "verify-new-bucket";
const SOURCE_HOST = `${SOURCE_BUCKET}.cos.ap-chengdu.myqcloud.com`;
const TARGET_HOST = `${TARGET_BUCKET}.cos.ap-chengdu.myqcloud.com`;
const HISTORICAL_BASE_URL = "https://historical-media.example.test/archive";
const OBJECT_KEY = "media/images/shared.jpg";
const THUMBNAIL_KEY = "media/images/z-shared-thumb.jpg";
const MISSING_KEY = "media/images/missing.jpg";
const AVATAR_KEY = "media/images/user-avatar.jpg";
const BODY = Buffer.from("verified-cos-migration-object");
const CHECKSUM = crypto.createHash("sha256").update(BODY).digest("hex");
const BACKUP_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../prisma/cos-migration-backup-verify.db",
);
const INVALID_BACKUP_PATH = `${BACKUP_PATH}.invalid`;
const INCOMPLETE_BACKUP_PATH = `${BACKUP_PATH}.incomplete`;

await cleanup();

try {
  const seeded = await seed();
  const backupEvidence = await createAndVerifyBackupEvidence();
  const sourceObjects = new Map([
    [OBJECT_KEY, storedObject(BODY, "image/jpeg")],
    [THUMBNAIL_KEY, storedObject(Buffer.from("thumbnail"), "image/jpeg")],
    ["media/images/orphan.jpg", storedObject(Buffer.from("orphan"), "image/jpeg")],
    [AVATAR_KEY, storedObject(Buffer.from("avatar"), "image/jpeg")],
  ]);
  const targetObjects = new Map();
  let failObjectKey = "";
  let readCount = 0;
  let writeCount = 0;
  let unprotectedWriteCount = 0;
  const storage = createFakeStorage({
    failNextPut: (objectKey) => objectKey === failObjectKey,
    onFailedPut: () => {
      failObjectKey = "";
    },
    onRead: () => {
      readCount += 1;
    },
    onWrite: () => {
      writeCount += 1;
    },
    onUnprotectedWrite: () => {
      unprotectedWriteCount += 1;
    },
    sourceObjects,
    targetObjects,
  });

  const supplementalManifest = {
    schemaVersion: 1,
    approvalReference: "VERIFY-SUPPLEMENTAL-1",
    objects: [
      {
        objectKey: "media/images/orphan.jpg",
        checksum: crypto.createHash("sha256").update(Buffer.from("orphan")).digest("hex"),
        evidence: "synthetic operator-reviewed manifest",
      },
    ],
  };
  await assert.rejects(
    () =>
      createCosMigrationInventory({
        client: prisma,
        sourceBucket: SOURCE_BUCKET,
        targetBucket: TARGET_BUCKET,
        supplementalManifest: {
          ...supplementalManifest,
          objects: [{ objectKey: "media/images/orphan.jpg" }],
        },
        storage,
      }),
    /non-empty source evidence/,
    "an unproven supplemental Key must be rejected",
  );
  await assert.rejects(
    () =>
      createCosMigrationInventory({
        client: prisma,
        sourceBucket: SOURCE_BUCKET,
        targetBucket: TARGET_BUCKET,
        supplementalManifest: { ...supplementalManifest, approvalReference: " " },
        storage,
      }),
    /valid supplemental object manifest/,
    "a supplemental manifest must carry an approval reference",
  );
  await assert.rejects(
    () =>
      createCosMigrationInventory({
        client: prisma,
        sourceBucket: SOURCE_BUCKET,
        targetBucket: TARGET_BUCKET,
        supplementalManifest,
        storage,
      }),
    /separate approval using the exact manifest SHA-256/,
    "supplemental evidence must be bound to a separately approved digest",
  );
  const approvedSupplementalManifestSha256 =
    calculateSupplementalObjectManifestSha256(supplementalManifest);
  const inventory = await createCosMigrationInventory({
    client: prisma,
    sourceBucket: SOURCE_BUCKET,
    targetBucket: TARGET_BUCKET,
    supplementalManifest,
    approvedSupplementalManifestSha256,
    storage,
  });
  assert.equal(inventory.records.length, 3);
  assert.deepEqual(inventory.duplicateKeys, [
    { objectKey: OBJECT_KEY, mediaIds: [seeded.primary.id, seeded.archivedDuplicate.id] },
  ]);
  assert.deepEqual(inventory.missingSourceRecords, [seeded.missing.id]);
  assert.equal(inventory.orphanSourceObjects, null);
  assert.equal(inventory.coverage.fullBucketCoverage, "unknown");
  assert.equal(inventory.coverage.bucketListingAttempted, false);
  assert.ok(inventory.sourceBaseUrls.includes(HISTORICAL_BASE_URL));
  assert.ok(inventory.discoveredObjectKeys.includes(THUMBNAIL_KEY));
  assert.ok(inventory.discoveredObjectKeys.includes(AVATAR_KEY));
  assert.ok(inventory.missingSourceObjectKeys.includes(MISSING_KEY));
  assert.deepEqual(
    inventory.supplementalObjects.map((item) => item.objectKey),
    ["media/images/orphan.jpg"],
  );
  assert.equal(
    inventory.supplementalManifestAudit.approvedManifestSha256,
    approvedSupplementalManifestSha256,
  );
  assert.deepEqual(inventory.statusGroups.archived, [seeded.archivedDuplicate.id]);
  assert.equal(inventory.jsonReferences.length, 2);
  assert.equal(inventory.userAvatarReferences.length, 1);
  assert.equal(inventory.userAvatarReferences[0].objectKey, AVATAR_KEY);
  assert.equal(inventory.records[0].bindings.length, 3);
  assert.equal(inventory.records[0].bindings[0].usage, "cover");
  assert.equal(inventory.jsonReferences[0].objectKey, OBJECT_KEY);

  const dryRun = await executeCosObjectCopies({ inventory, storage });
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(
    dryRun.actions.length,
    4,
    "all source objects, including the orphan and referenced avatar/thumbnail, must be planned",
  );
  assert.equal(readCount, 0, "dry-run must not read object bodies");
  assert.equal(writeCount, 0, "dry-run must not write objects");
  assert.equal(targetObjects.size, 0);
  assert.throws(
    () => buildStorageSwitchPlan({ inventory, copyReport: dryRun }),
    /matching applied copy report/,
    "a dry-run copy report cannot authorize switch planning",
  );
  await assert.rejects(
    () =>
      executeCosObjectCopies({
        inventory: { ...inventory, sourceBucket: "tampered-source-bucket" },
        storage,
      }),
    /untampered migration inventory/,
    "inventory contents must remain bound to their SHA-256",
  );

  targetObjects.set(OBJECT_KEY, storedObject(Buffer.alloc(BODY.length, "x"), "image/jpeg"));
  const conflictingTarget = await executeCosObjectCopies({
    inventory,
    apply: true,
    confirmObjectWrite: true,
    storage,
  });
  const contentConflict = conflictingTarget.results.find(
    (result) => result.objectKey === OBJECT_KEY,
  );
  assert.equal(contentConflict.status, "conflict");
  assert.equal(contentConflict.verification.ok, true, "size and MIME intentionally match");
  assert.equal(contentConflict.byteVerification.status, "mismatch");
  targetObjects.delete(OBJECT_KEY);

  failObjectKey = OBJECT_KEY;
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
    3,
    "independently verified objects may survive a partial failure",
  );
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory,
        copyReport: failedCopy,
      }),
    /integrity findings block/,
    "a partial copy must hard-block switch planning",
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
  assert.equal(primaryCopy.byteVerification.status, "match");
  assert.equal(primaryCopy.byteVerification.actual, CHECKSUM);
  assert.equal(targetObjects.get(OBJECT_KEY).body.equals(BODY), true);
  assert.equal(unprotectedWriteCount, 0, "migration PUTs must forbid overwriting target objects");
  const thumbnailCopy = copied.results.find((result) => result.objectKey === THUMBNAIL_KEY);
  assert.equal(thumbnailCopy.status, "verified-existing");
  assert.equal(thumbnailCopy.checksumVerification.status, "unavailable");
  assert.equal(
    thumbnailCopy.byteVerification.status,
    "match",
    "a checksum-less independent thumbnail must still receive byte-level verification",
  );
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory,
        copyReport: { ...copied, results: [...copied.results, copied.results[0]] },
      }),
    /duplicate object results/,
    "duplicate copy conclusions must not be accepted",
  );
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory,
        copyReport: {
          ...copied,
          results: [
            ...copied.results,
            {
              ...copied.results[0],
              objectKey: "media/images/not-in-inventory.jpg",
            },
          ],
        },
      }),
    /outside the bound inventory/,
    "copy conclusions for objects outside the inventory must not be accepted",
  );

  const mismatchedSourceUrlFixture = rebindInventoryAndCopyReport(inventory, copied, {
    records: inventory.records.map((record) =>
      record.id === seeded.primary.id
        ? { ...record, sourceUrlObjectKey: AVATAR_KEY, sourceUrlReferencesOldBucket: true }
        : record,
    ),
  });
  assert.throws(
    () => buildStorageSwitchPlan(mismatchedSourceUrlFixture),
    (error) =>
      error?.details?.findings?.some(
        (finding) => finding.code === "media-source-url-object-key-mismatch",
      ),
    "a legacy source URL that disagrees with upload metadata must hard-block",
  );

  for (const [mutate, expectedCode, label] of [
    [
      (report) => {
        report.results = report.results.filter((result) => result.objectKey !== OBJECT_KEY);
      },
      "media-object-not-byte-verified",
      "missing copy result",
    ],
    [
      (report) => {
        report.results.find((result) => result.objectKey === OBJECT_KEY).byteVerification.status =
          "mismatch";
      },
      "media-object-not-byte-verified",
      "SHA-256 mismatch",
    ],
    [
      (report) => {
        report.results.find((result) => result.objectKey === THUMBNAIL_KEY).status = "failed";
      },
      "thumbnail-not-byte-verified",
      "thumbnail copy failure",
    ],
    [
      (report) => {
        report.results = report.results.filter(
          (result) => result.objectKey !== "media/images/orphan.jpg",
        );
      },
      "source-object-not-byte-verified",
      "unhandled orphan",
    ],
  ]) {
    const unsafeReport = structuredClone(copied);
    mutate(unsafeReport);
    assert.throws(
      () => buildStorageSwitchPlan({ inventory, copyReport: unsafeReport }),
      (error) => error?.details?.findings?.some((finding) => finding.code === expectedCode),
      `${label} must hard-block switch planning`,
    );
  }

  const unsupportedReferenceFixture = rebindInventoryAndCopyReport(inventory, copied, {
    jsonReferences: [
      ...inventory.jsonReferences,
      {
        ...inventory.jsonReferences[0],
        model: "parent_application",
        id: "unsupported-reference",
        objectKey: OBJECT_KEY,
      },
    ],
  });
  assert.throws(
    () => buildStorageSwitchPlan(unsupportedReferenceFixture),
    (error) =>
      error?.details?.findings?.some(
        (finding) => finding.code === "reference-has-no-automatic-switch-path",
      ),
    "a legacy reference without an audited automatic path must block",
  );

  const unresolvedLegacyUrlFixture = rebindInventoryAndCopyReport(inventory, copied, {
    unresolvedLegacyUrlReferences: [
      {
        model: "fixed_page",
        id: seeded.page.id,
        field: "content_json",
        path: ["legacyMarkup"],
        value: `image: https://${SOURCE_HOST}/${OBJECT_KEY}`,
        reason: "contains-configured-legacy-origin-but-is-not-an-exact-object-url",
      },
    ],
  });
  assert.throws(
    () => buildStorageSwitchPlan(unresolvedLegacyUrlFixture),
    (error) =>
      error?.details?.findings?.some(
        (finding) => finding.code === "legacy-url-reference-unresolved",
      ),
    "an embedded or otherwise unresolved legacy URL must block",
  );

  const externalUrlFixture = rebindInventoryAndCopyReport(inventory, copied, {
    externalUrlReferences: [
      {
        model: "media_asset",
        id: seeded.primary.id,
        field: "thumbnail_url",
        path: null,
        value: "https://unmapped-media.example.invalid/history.jpg",
      },
    ],
  });
  assert.throws(
    () => buildStorageSwitchPlan(externalUrlFixture),
    (error) =>
      error?.details?.findings?.some(
        (finding) => finding.code === "external-url-reference-requires-review",
      ),
    "an unmapped external URL must require an explicit review conclusion",
  );

  const duplicateConflictFixture = rebindInventoryAndCopyReport(inventory, copied, {
    duplicateKeyConflicts: [
      {
        objectKey: OBJECT_KEY,
        mediaIds: [seeded.primary.id, seeded.archivedDuplicate.id],
        conflictingFields: ["checksum"],
      },
    ],
  });
  assert.throws(
    () => buildStorageSwitchPlan(duplicateConflictFixture),
    (error) =>
      error?.details?.findings?.some(
        (finding) => finding.code === "duplicate-key-metadata-conflict",
      ),
    "duplicate-key metadata conflicts must block",
  );

  const supplementalConflictFixture = rebindInventoryAndCopyReport(inventory, copied, {
    supplementalObjectConflicts: [
      {
        objectKey: OBJECT_KEY,
        mediaIds: [seeded.primary.id],
        conflictingFields: ["media:checksum"],
      },
    ],
  });
  assert.throws(
    () => buildStorageSwitchPlan(supplementalConflictFixture),
    (error) =>
      error?.details?.findings?.some(
        (finding) => finding.code === "supplemental-object-metadata-conflict",
      ),
    "a supplemental/database Key conflict must block",
  );

  const oversizedFixture = rebindInventoryAndCopyReport(inventory, copied, {
    limits: { ...inventory.limits, maxObjectBytes: 1 },
    oversizedSourceObjectKeys: [OBJECT_KEY],
  });
  assert.throws(
    () => buildStorageSwitchPlan(oversizedFixture),
    (error) =>
      error?.details?.findings?.some(
        (finding) => finding.code === "source-object-exceeds-read-limit",
      ),
    "an object beyond the inventory read limit must block even with stale copy evidence",
  );

  const repeated = await executeCosObjectCopies({
    inventory,
    apply: true,
    confirmObjectWrite: true,
    storage,
  });
  assert.ok(repeated.results.every((result) => result.status === "verified-existing"));
  assert.ok(repeated.results.every((result) => result.byteVerification.status === "match"));
  assert.equal(writeCount, 4, "verified target objects must not be copied again");

  await verifyChecksumlessHistoricalMedia();

  const statusOnlyReport = structuredClone(copied);
  statusOnlyReport.results = statusOnlyReport.results.map(
    ({ byteVerification, ...result }) => result,
  );
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory,
        copyReport: statusOnlyReport,
      }),
    /integrity findings block/,
    "success labels without SHA-256 evidence must never authorize switching",
  );

  for (const [objectKey, label] of [[MISSING_KEY, "uncopied object"]]) {
    const missingReferenceFixture = rebindInventoryAndCopyReport(inventory, copied, {
      jsonReferences: [
        ...inventory.jsonReferences,
        {
          ...inventory.jsonReferences[0],
          objectKey,
          value: `https://${SOURCE_HOST}/${objectKey}?variant=original`,
        },
      ],
    });
    assert.throws(
      () => buildStorageSwitchPlan(missingReferenceFixture),
      (error) =>
        error?.details?.findings?.some(
          (finding) =>
            finding.objectKey === objectKey &&
            finding.code === "reference-object-not-byte-verified",
        ),
      `${label} must block switch-plan generation`,
    );
  }

  assert.throws(
    () => buildStorageSwitchPlan({ inventory, copyReport: copied }),
    (error) =>
      error?.details?.findings?.some(
        (finding) => finding.exclusionKey === `media:${seeded.missing.id}`,
      ),
    "an unhandled media record must block instead of being silently skipped",
  );
  const exclusions = {
    schemaVersion: 1,
    inventorySha256: inventory.inventorySha256,
    exclusions: [
      {
        key: `media:${seeded.missing.id}`,
        reason: "synthetic fixture intentionally has no source object",
        approvalReference: "VERIFY-EXCLUSION-1",
      },
    ],
  };
  const approvedExclusionsSha256 = calculateStorageSwitchExclusionsSha256(exclusions);
  assert.throws(
    () => buildStorageSwitchPlan({ inventory, copyReport: copied, exclusions }),
    /separate approval using the exact manifest SHA-256/,
  );
  const unknownExclusions = {
    ...exclusions,
    exclusions: [
      {
        key: "media:not-in-the-bound-inventory",
        reason: "synthetic unknown subject",
        approvalReference: "VERIFY-EXCLUSION-UNKNOWN",
      },
    ],
  };
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory,
        copyReport: copied,
        exclusions: unknownExclusions,
        approvedExclusionsSha256: calculateStorageSwitchExclusionsSha256(unknownExclusions),
      }),
    /unknown subjects/,
    "an approved digest cannot introduce an exclusion outside the bound inventory",
  );
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory,
        copyReport: copied,
        exclusions,
        approvedExclusionsSha256,
      }),
    /Unknown full-bucket coverage requires.*known-reference switch acknowledgement/,
    "unknown bucket coverage must never be silently treated as completed migration",
  );
  const coverageAcknowledgement = {
    schemaVersion: 1,
    inventorySha256: inventory.inventorySha256,
    switchScope: "known-referenced-objects-only",
    fullBucketCoverage: "unknown",
    approvalReference: "VERIFY-LIMITED-COVERAGE-1",
  };
  const approvedCoverageAcknowledgementSha256 =
    calculateStorageSwitchCoverageAcknowledgementSha256(coverageAcknowledgement);
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory,
        copyReport: copied,
        exclusions,
        approvedExclusionsSha256,
        coverageAcknowledgement,
        approvedCoverageAcknowledgementSha256: "0".repeat(64),
      }),
    /separate approval using the exact acknowledgement SHA-256/,
    "the limited-coverage decision must be bound to the exact acknowledgement",
  );
  const nativePlan = buildStorageSwitchPlan({
    inventory,
    copyReport: copied,
    exclusions,
    approvedExclusionsSha256,
    coverageAcknowledgement,
    approvedCoverageAcknowledgementSha256,
  });
  const externalInventory = structuredClone(inventory);
  externalInventory.targetObjects = copied.results.map((result) => ({
    objectKey: result.objectKey,
    sizeBytes: result.sizeBytes,
    contentType: result.mimeType,
    inventoryConsistency: "head-confirmed",
  }));
  externalInventory.inventorySha256 = calculateCosMigrationInventorySha256(externalInventory);
  const externalExclusions = { ...exclusions, inventorySha256: externalInventory.inventorySha256 };
  const externalCoverageAcknowledgement = {
    ...coverageAcknowledgement,
    inventorySha256: externalInventory.inventorySha256,
  };
  const externalEvidence = syntheticExternalEvidence(externalInventory, copied);
  const unboundEvidence = structuredClone(externalEvidence);
  unboundEvidence.index = {
    schemaVersion: 2,
    sourceBucket: externalInventory.sourceBucket,
    targetBucket: externalInventory.targetBucket,
    bundles: externalEvidence.index.bundles,
  };
  unboundEvidence.index.indexSha256 = calculateExternalEvidenceIndexSha256(unboundEvidence.index);
  assert.equal(
    verifyExternalCosCopyEvidence({
      inventory: null,
      ...unboundEvidence,
      approvedIndexSha256: unboundEvidence.index.indexSha256,
    }).verifiedKeys.length,
    copied.results.length,
    "version 2 copy evidence must be independently verifiable before production inventory",
  );
  const missingTargetInventory = {
    ...externalInventory,
    targetObjects: externalInventory.targetObjects.slice(1),
  };
  assert.throws(
    () =>
      verifyExternalCosCopyEvidence({
        inventory: missingTargetInventory,
        ...unboundEvidence,
        approvedIndexSha256: unboundEvidence.index.indexSha256,
      }),
    /target HEAD inventory mismatch/,
    "standalone evidence must never waive fresh target HEAD verification during switching",
  );
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory: externalInventory,
        externalEvidence,
        approvedExternalEvidenceSha256: "0".repeat(64),
        exclusions: externalExclusions,
        approvedExclusionsSha256: calculateStorageSwitchExclusionsSha256(externalExclusions),
        coverageAcknowledgement: externalCoverageAcknowledgement,
        approvedCoverageAcknowledgementSha256: calculateStorageSwitchCoverageAcknowledgementSha256(
          externalCoverageAcknowledgement,
        ),
      }),
    /index approval\/hash mismatch/,
  );
  const externalPlan = buildStorageSwitchPlan({
    inventory: externalInventory,
    externalEvidence,
    approvedExternalEvidenceSha256: externalEvidence.index.indexSha256,
    exclusions: externalExclusions,
    approvedExclusionsSha256: calculateStorageSwitchExclusionsSha256(externalExclusions),
    coverageAcknowledgement: externalCoverageAcknowledgement,
    approvedCoverageAcknowledgementSha256: calculateStorageSwitchCoverageAcknowledgementSha256(
      externalCoverageAcknowledgement,
    ),
  });
  const unboundPlan = buildStorageSwitchPlan({
    inventory: externalInventory,
    externalEvidence: unboundEvidence,
    approvedExternalEvidenceSha256: unboundEvidence.index.indexSha256,
    exclusions: externalExclusions,
    approvedExclusionsSha256: calculateStorageSwitchExclusionsSha256(externalExclusions),
    coverageAcknowledgement: externalCoverageAcknowledgement,
    approvedCoverageAcknowledgementSha256: calculateStorageSwitchCoverageAcknowledgementSha256(
      externalCoverageAcknowledgement,
    ),
  });
  assert.deepEqual(unboundPlan.mediaUpdates, externalPlan.mediaUpdates);
  assert.deepEqual(unboundPlan.jsonUpdates, externalPlan.jsonUpdates);
  assert.deepEqual(externalPlan.mediaUpdates, nativePlan.mediaUpdates);
  assert.equal(
    externalPlan.integrity.externalEvidenceIndexSha256,
    externalEvidence.index.indexSha256,
  );
  const plan = externalPlan;
  const tampered = structuredClone(externalEvidence);
  tampered.bundles[0].copyJournal.objects[
    copied.results[0].objectKey
  ].result.byteVerification.actual = "0".repeat(64);
  assert.throws(
    () =>
      buildStorageSwitchPlan({
        inventory: externalInventory,
        externalEvidence: tampered,
        approvedExternalEvidenceSha256: externalEvidence.index.indexSha256,
        exclusions: externalExclusions,
        approvedExclusionsSha256: calculateStorageSwitchExclusionsSha256(externalExclusions),
        coverageAcknowledgement: externalCoverageAcknowledgement,
        approvedCoverageAcknowledgementSha256: calculateStorageSwitchCoverageAcknowledgementSha256(
          externalCoverageAcknowledgement,
        ),
      }),
    /digest mismatch/,
  );
  assert.equal(plan.mediaUpdates.length, 2, "approved exclusions must be explicit and audited");
  assert.equal(plan.userUpdates.length, 1, "User.avatar_url must have an exact switch update");
  assert.equal(
    plan.integrity.approvedExclusionsSha256,
    calculateStorageSwitchExclusionsSha256(externalExclusions),
  );
  assert.equal(plan.integrity.switchScope, "known-referenced-objects-only");
  assert.equal(plan.integrity.fullBucketMigrationComplete, false);
  assert.equal(
    plan.integrity.approvedCoverageAcknowledgementSha256,
    calculateStorageSwitchCoverageAcknowledgementSha256(externalCoverageAcknowledgement),
  );
  const unacknowledgedPlan = {
    ...plan,
    integrity: {
      ...plan.integrity,
      coverageAcknowledgement: null,
      approvedCoverageAcknowledgementSha256: null,
    },
  };
  unacknowledgedPlan.switchPlanSha256 = calculateStorageSwitchPlanSha256(unacknowledgedPlan);
  await assert.rejects(
    () => applyStorageSwitchPlan({ client: prisma, plan: unacknowledgedPlan }),
    /valid untampered storage switch plan/,
    "re-hashing a plan cannot remove its limited-coverage approval evidence",
  );
  const changedReference = plan.jsonUpdates[0];
  const changedReferencePlan = {
    ...plan,
    jsonUpdates: [changedReference],
    mediaUpdates: [],
    userUpdates: [],
  };
  changedReferencePlan.switchPlanSha256 = calculateStorageSwitchPlanSha256(changedReferencePlan);
  await assert.rejects(
    () =>
      applyStorageSwitchPlan({
        client: {
          $transaction: async (task) =>
            task({
              cat: {
                findUnique: async () => ({
                  [changedReference.field]: { imagePresentation: { url: "changed-after-plan" } },
                  id: changedReference.id,
                  updated_at: new Date(changedReference.expectedUpdatedAt),
                }),
              },
              fixedPage: { findUnique: async () => null },
            }),
        },
        plan: changedReferencePlan,
        apply: true,
        backupEvidence,
        confirmDatabaseWrite: true,
      }),
    /JSON reference changed after inventory/,
    "a JSON value changed after planning must abort instead of rewriting a stale path",
  );
  const drySwitch = await applyStorageSwitchPlan({ client: prisma, plan });
  assert.equal(drySwitch.mode, "dry-run");
  await assert.rejects(
    () =>
      applyStorageSwitchPlan({
        client: prisma,
        plan: { ...plan, mediaUpdates: [] },
      }),
    /untampered storage switch plan/,
    "switch plan contents must remain bound to their SHA-256",
  );
  assert.equal(
    (await prisma.mediaAsset.findUnique({ where: { id: seeded.primary.id } })).metadata_json.upload
      .bucket,
    SOURCE_BUCKET,
    "dry-run must not change media metadata",
  );
  await assert.rejects(
    () =>
      applyStorageSwitchPlan({
        client: prisma,
        plan,
        apply: true,
        confirmDatabaseWrite: true,
      }),
    /verified SQLite backup evidence/,
  );

  const lateLegacyMedia = await prisma.mediaAsset.create({
    data: {
      id: `${PREFIX}-late-legacy-media`,
      kind: "image",
      source_url: `https://${SOURCE_HOST}/media/images/late-legacy.jpg`,
      status: "active",
      metadata_json: {
        upload: {
          bucket: SOURCE_BUCKET,
          objectKey: "media/images/late-legacy.jpg",
          provider: "lightcos",
        },
      },
    },
  });
  await assert.rejects(
    () =>
      applyStorageSwitchPlan({
        client: prisma,
        plan,
        apply: true,
        backupEvidence,
        confirmDatabaseWrite: true,
      }),
    /database state changed after inventory/,
    "a media row created after inventory must abort the entire switch transaction",
  );
  await prisma.mediaAsset.delete({ where: { id: lateLegacyMedia.id } });

  const beforeBindings = await prisma.mediaBinding.findMany({
    where: { media_id: seeded.primary.id },
    orderBy: { id: "asc" },
  });
  const appliedSwitch = await applyStorageSwitchPlan({
    client: prisma,
    plan,
    apply: true,
    backupEvidence,
    confirmDatabaseWrite: true,
  });
  const primaryAfter = await prisma.mediaAsset.findUnique({ where: { id: seeded.primary.id } });
  const missingAfter = await prisma.mediaAsset.findUnique({ where: { id: seeded.missing.id } });
  const catAfter = await prisma.cat.findUnique({ where: { id: seeded.cat.id } });
  const pageAfter = await prisma.fixedPage.findUnique({ where: { id: seeded.page.id } });
  const authorAfter = await prisma.user.findUnique({ where: { id: seeded.author.id } });
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
  assert.equal(new URL(pageAfter.content_json.hero.imageUrl).search, "?width=128");
  assert.equal(new URL(authorAfter.avatar_url).host, TARGET_HOST);
  assert.equal(
    catAfter.story_json.note,
    `Do not rewrite https://${SOURCE_HOST}.example.invalid/${OBJECT_KEY}`,
  );

  const repeatedSwitch = await applyStorageSwitchPlan({
    client: prisma,
    plan,
    apply: true,
    backupEvidence,
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
  assert.throws(
    () =>
      buildStorageRollbackPlan({
        switchPlan: plan,
        switchReport: { ...repeatedSwitch, userStates: [] },
      }),
    /missing a rollback user state/,
  );
  await applyStorageSwitchPlan({
    client: prisma,
    plan: rollbackPlan,
    apply: true,
    backupEvidence,
    confirmDatabaseWrite: true,
  });
  const primaryRolledBack = await prisma.mediaAsset.findUnique({
    where: { id: seeded.primary.id },
  });
  const catRolledBack = await prisma.cat.findUnique({ where: { id: seeded.cat.id } });
  const authorRolledBack = await prisma.user.findUnique({ where: { id: seeded.author.id } });
  assert.equal(primaryRolledBack.metadata_json.upload.bucket, SOURCE_BUCKET);
  assert.equal(new URL(primaryRolledBack.source_url).host, SOURCE_HOST);
  assert.equal(new URL(catRolledBack.story_json.imagePresentation.url).host, SOURCE_HOST);
  assert.equal(new URL(authorRolledBack.avatar_url).host, SOURCE_HOST);
  assert.equal(
    (await prisma.fixedPage.findUnique({ where: { id: seeded.page.id } })).content_json.hero
      .imageUrl,
    `${HISTORICAL_BASE_URL}/media/images/%73hared.jpg?width=128`,
    "rollback must restore the exact encoded source URL and query",
  );
  assert.ok(
    await prisma.mediaAsset.findUnique({ where: { id: postCutover.id } }),
    "per-record rollback must preserve post-cutover media",
  );

  verifyRuntimeGuard();

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
        note: `Do not rewrite https://${SOURCE_HOST}.example.invalid/${OBJECT_KEY}`,
      },
    },
  });
  const page = await prisma.fixedPage.create({
    data: {
      id: `${PREFIX}-page`,
      slug: `${PREFIX}-page`,
      title: "Migration Page",
      content_json: {
        hero: {
          imageUrl: `${HISTORICAL_BASE_URL}/media/images/%73hared.jpg?width=128`,
        },
      },
    },
  });
  const author = await prisma.user.create({
    data: {
      id: `${PREFIX}-author`,
      nickname: "Migration Author",
      avatar_url: `https://${SOURCE_HOST}/${AVATAR_KEY}`,
      status: "active",
    },
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

function verifyRuntimeGuard() {
  const productionDatabaseUrl = "file:/srv/starlitsky/production.db";
  const fingerprint = databaseUrlFingerprint(productionDatabaseUrl);
  assert.equal(fingerprint.length, 64);

  const base = {
    apply: true,
    configuredEnvironment: "production",
    operation: "Database switch",
    operationConfirmed: true,
    exactTargetConfirmed: true,
    nodeEnvironment: undefined,
  };
  assert.throws(
    () => assertMigrationWriteRuntime({ ...base, configuredEnvironment: undefined }),
    /requires COS_MIGRATION_RUNTIME_ENVIRONMENT=staging or production/,
    "an unclassified host must default to denying writes",
  );
  assert.throws(
    () => assertMigrationWriteRuntime(base),
    /requires --write-environment staging or production/,
    "NODE_ENV being unset must not select a writable default",
  );
  assert.throws(
    () => assertMigrationWriteRuntime({ ...base, runtimeEnvironment: "production" }),
    /requires --confirm-production/,
  );
  assert.throws(
    () =>
      assertMigrationWriteRuntime({
        ...base,
        confirmProduction: true,
        exactTargetConfirmed: false,
        runtimeEnvironment: "production",
      }),
    /exact target confirmation/,
  );
  assert.throws(
    () =>
      assertMigrationWriteRuntime({
        ...base,
        confirmProduction: true,
        operationConfirmed: false,
        runtimeEnvironment: "production",
      }),
    /operation-specific confirmation/,
  );
  assert.doesNotThrow(() =>
    assertMigrationWriteRuntime({
      ...base,
      confirmProduction: true,
      runtimeEnvironment: "production",
    }),
  );
  assert.throws(
    () =>
      assertMigrationWriteRuntime({
        ...base,
        configuredEnvironment: "staging",
        nodeEnvironment: "production",
        runtimeEnvironment: "staging",
      }),
    /cannot classify.*as staging/,
  );
  assert.doesNotThrow(() =>
    assertMigrationWriteRuntime({
      apply: false,
      exactTargetConfirmed: false,
      operation: "Object copy",
      operationConfirmed: false,
    }),
  );
}

async function verifyChecksumlessHistoricalMedia() {
  const objectKey = "media/images/checksumless-history.jpg";
  const body = Buffer.from("historical-media-without-checksum");
  const sourceObjects = new Map([[objectKey, storedObject(body, "image/jpeg")]]);
  const targetObjects = new Map();
  const storage = createFakeStorage({
    failNextPut: () => false,
    onFailedPut: () => {},
    onRead: () => {},
    onWrite: () => {},
    sourceObjects,
    targetObjects,
  });
  const inventory = {
    schemaVersion: 4,
    databaseSnapshotSha256: "0".repeat(64),
    sourceBucket: SOURCE_BUCKET,
    targetBucket: TARGET_BUCKET,
    sourceObjects: [],
    discoveredObjectKeys: [objectKey],
    jsonReferences: [],
    userAvatarReferences: [],
    unresolvedLegacyUrlReferences: [],
    externalUrlReferences: [],
    supplementalObjects: [],
    supplementalManifestAudit: null,
    supplementalObjectConflicts: [],
    coverage: {
      fullBucketCoverage: "unknown",
    },
    limits: {
      maxObjectBytes: 1024,
    },
    records: [
      {
        checksum: null,
        id: "checksumless-history",
        mimeType: "image/jpeg",
        objectKey,
        sizeBytes: body.length,
        sourceObject: {
          ...sourceObjects.get(objectKey),
          inventoryConsistency: "head-confirmed",
          sizeBytes: body.length,
        },
      },
    ],
  };
  inventory.inventorySha256 = calculateCosMigrationInventorySha256(inventory);
  const report = await executeCosObjectCopies({
    inventory,
    apply: true,
    confirmObjectWrite: true,
    storage,
  });
  assert.equal(report.results[0].status, "copied-and-verified");
  assert.equal(report.results[0].checksumVerification.status, "unavailable");
  assert.equal(report.results[0].byteVerification.status, "match");
  assert.equal(targetObjects.get(objectKey).body.equals(body), true);
}

function rebindInventoryAndCopyReport(inventory, copyReport, overrides) {
  const reboundInventory = { ...inventory, ...overrides };
  reboundInventory.inventorySha256 = calculateCosMigrationInventorySha256(reboundInventory);
  return {
    inventory: reboundInventory,
    copyReport: { ...copyReport, inventorySha256: reboundInventory.inventorySha256 },
  };
}

async function createAndVerifyBackupEvidence() {
  rmSync(BACKUP_PATH, { force: true });
  rmSync(INVALID_BACKUP_PATH, { force: true });
  rmSync(INCOMPLETE_BACKUP_PATH, { force: true });
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(BACKUP_PATH);
  database.exec(
    `
      CREATE TABLE _prisma_migrations (id TEXT PRIMARY KEY);
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE media_assets (id TEXT PRIMARY KEY, user_id TEXT, FOREIGN KEY (user_id) REFERENCES users(id));
      INSERT INTO users VALUES ('backup-user');
      INSERT INTO media_assets VALUES ('backup-media', 'backup-user');
    `,
  );
  database.close();
  const expectedSha256 = crypto
    .createHash("sha256")
    .update(readFileSync(BACKUP_PATH))
    .digest("hex");
  await assert.rejects(
    () =>
      verifyMigrationSqliteBackup({
        backupPath: BACKUP_PATH,
        databaseUrl: process.env.DATABASE_URL,
        expectedSha256: "0".repeat(64),
      }),
    /SHA-256 does not match/,
  );
  writeFileSync(INVALID_BACKUP_PATH, "not sqlite", "utf8");
  const invalidSha256 = crypto
    .createHash("sha256")
    .update(readFileSync(INVALID_BACKUP_PATH))
    .digest("hex");
  await assert.rejects(
    () =>
      verifyMigrationSqliteBackup({
        backupPath: INVALID_BACKUP_PATH,
        databaseUrl: process.env.DATABASE_URL,
        expectedSha256: invalidSha256,
      }),
    /not a readable SQLite database/,
  );
  const incompleteDatabase = new DatabaseSync(INCOMPLETE_BACKUP_PATH);
  incompleteDatabase.exec("CREATE TABLE unrelated_data (id TEXT PRIMARY KEY)");
  incompleteDatabase.close();
  const incompleteSha256 = crypto
    .createHash("sha256")
    .update(readFileSync(INCOMPLETE_BACKUP_PATH))
    .digest("hex");
  await assert.rejects(
    () =>
      verifyMigrationSqliteBackup({
        backupPath: INCOMPLETE_BACKUP_PATH,
        databaseUrl: process.env.DATABASE_URL,
        expectedSha256: incompleteSha256,
      }),
    /missing required application tables/,
  );
  return verifyMigrationSqliteBackup({
    backupPath: BACKUP_PATH,
    databaseUrl: process.env.DATABASE_URL,
    expectedSha256,
  });
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
  onUnprotectedWrite,
  sourceObjects,
  targetObjects,
}) {
  const bucketMap = (bucket) => (bucket === SOURCE_BUCKET ? sourceObjects : targetObjects);
  return {
    async listObjects() {
      throw new Error("inventory must not call bucket listing");
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
    async putObject({ bucket, objectKey, body, contentType, forbidOverwrite }) {
      if (forbidOverwrite !== true) onUnprotectedWrite();
      if (failNextPut(objectKey)) {
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
  rmSync(BACKUP_PATH, { force: true });
  rmSync(INVALID_BACKUP_PATH, { force: true });
  rmSync(INCOMPLETE_BACKUP_PATH, { force: true });
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

function syntheticExternalEvidence(inventory, copied) {
  const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
  const stable = (value) => JSON.stringify(sort(value));
  const sort = (value) =>
    Array.isArray(value)
      ? value.map(sort)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, sort(value[key])]),
          )
        : value;
  const objects = copied.results.map((result) => ({
    objectKey: result.objectKey,
    objectKeySha256: hash(result.objectKey),
    sizeBytes: result.sizeBytes,
    mimeType: result.mimeType,
    sha256: result.sourceContentSha256,
  }));
  const bytes = objects.reduce((sum, item) => sum + item.sizeBytes, 0);
  const sourceReport = {
    status: "completed",
    stopReason: null,
    sourceBucket: inventory.sourceBucket,
    candidateKeysetSha256: "c".repeat(64),
    bytesRead: bytes,
    requests: { head: objects.length, get: objects.length, total: 2 * objects.length },
    transport: { actualHttpRequests: 2 * objects.length, blockedRetryAttempts: 0 },
    requestLedger: objects.flatMap((item) => [
      {
        objectKeySha256: item.objectKeySha256,
        method: "HEAD",
        status: "completed",
        statusCode: 200,
        bytesRead: 0,
      },
      {
        objectKeySha256: item.objectKeySha256,
        method: "GET",
        status: "completed",
        statusCode: 206,
        bytesRead: item.sizeBytes,
      },
    ]),
    summary: { processed: objects.length, unprocessed: 0 },
    results: objects.map((item) => ({
      objectKey: item.objectKey,
      objectKeySha256: item.objectKeySha256,
      expectedSizeBytes: item.sizeBytes,
      expectedSha256: item.sha256,
      status: "current-exists-complete-read-trusted-hash-match",
      head: { exists: true, contentLength: item.sizeBytes },
      get: { exists: true, bytesRead: item.sizeBytes, sha256: item.sha256 },
    })),
  };
  const sourceEvidenceIndex = {
    reportStatus: "completed",
    reportSha256: hash(JSON.stringify(sourceReport)),
    candidateKeysetSha256: sourceReport.candidateKeysetSha256,
    requestCounts: sourceReport.requests,
    bytesRead: bytes,
  };
  const manifestCore = {
    sourceBucket: inventory.sourceBucket,
    targetBucket: inventory.targetBucket,
    sourceReportCanonicalSha256: hash(JSON.stringify(sourceReport)),
    candidateKeysetSha256: sourceReport.candidateKeysetSha256,
    objects,
  };
  const copyManifest = { ...manifestCore, copyManifestSha256: hash(stable(manifestCore)) };
  const planCore = {
    copyManifestSha256: copyManifest.copyManifestSha256,
    targetPolicySetSha256: "d".repeat(64),
    sourceEvidence: { reportCanonicalSha256: hash(JSON.stringify(sourceReport)) },
    scope: {
      objectCount: objects.length,
      totalBytes: bytes,
      sourceBucket: inventory.sourceBucket,
      targetBucket: inventory.targetBucket,
    },
    execution: {
      automaticNetworkRetries: 0,
      stopOnAnyNonSuccessStatus: true,
      preserveConflictingTarget: true,
      deleteSource: false,
      modifyDatabase: false,
      switchUrls: false,
    },
  };
  const copyPlan = { ...planCore, planSha256: hash(stable(planCore)) };
  const copyJournal = {
    status: `completed-${objects.length}-byte-verified`,
    planSha256: copyPlan.planSha256,
    targetPolicySetSha256: copyPlan.targetPolicySetSha256,
    actualRequests: {
      sourceGet: objects.length,
      targetHead: copied.results.reduce(
        (sum, result) => sum + (result.status === "copied-and-verified" ? 2 : 1),
        0,
      ),
      targetGet: objects.length,
      targetPut: copied.results.filter((result) => result.status === "copied-and-verified").length,
      downloadBytes: bytes * 2,
      uploadBytes: copied.results
        .filter((result) => result.status === "copied-and-verified")
        .reduce((sum, result) => sum + result.sizeBytes, 0),
    },
    objects: Object.fromEntries(
      copied.results.map((result) => [
        result.objectKey,
        {
          status: "verified",
          attempts: 1,
          objectKeySha256: hash(result.objectKey),
          result,
          counters: {
            sourceGet: 1,
            targetGet: 1,
            targetHead: result.status === "copied-and-verified" ? 2 : 1,
            targetPut: result.status === "copied-and-verified" ? 1 : 0,
            downloadBytes: result.sizeBytes * 2,
            uploadBytes: result.status === "copied-and-verified" ? result.sizeBytes : 0,
          },
        },
      ]),
    ),
  };
  const bundle = { sourceReport, sourceEvidenceIndex, copyManifest, copyPlan, copyJournal };
  const artifacts = Object.fromEntries(
    Object.entries(bundle).map(([name, value]) => [
      name,
      {
        canonicalSha256: hash(JSON.stringify(value)),
        rawSha256: hash(JSON.stringify(value)),
        path: `synthetic/${name}.json`,
      },
    ]),
  );
  const core = {
    schemaVersion: 1,
    inventorySha256: inventory.inventorySha256,
    databaseSnapshotSha256: inventory.databaseSnapshotSha256,
    sourceBucket: inventory.sourceBucket,
    targetBucket: inventory.targetBucket,
    bundles: [{ id: "synthetic-only", artifacts }],
  };
  return {
    index: { ...core, indexSha256: calculateExternalEvidenceIndexSha256(core) },
    bundles: [bundle],
  };
}
