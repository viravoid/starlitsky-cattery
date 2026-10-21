import assert from "node:assert/strict";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { calculateSupplementalObjectManifestSha256 } from "./cos-migration-manifest.mjs";
import {
  createOfflineImageInventory,
  OfflineImageInventoryError,
  summarizeOfflineImageInventory,
} from "./offline-image-inventory.mjs";

const serviceDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(serviceDirectory, "../../../..");
const fixtureRoot = mkdtempSync(resolve(tmpdir(), "starlitsky-offline-image-inventory-"));
const databasePath = resolve(fixtureRoot, "consistent-backup.sqlite");
const incompleteDatabasePath = resolve(fixtureRoot, "incomplete-backup.sqlite");
const sourceMapPath = resolve(fixtureRoot, "legacy-source-map.json");
const supplementalPath = resolve(fixtureRoot, "supplemental.json");
const reportPath = resolve(fixtureRoot, "report.json");
const syntheticRepo = resolve(fixtureRoot, "repository");

try {
  createFixtureDatabase(databasePath);
  createIncompleteDatabase(incompleteDatabasePath);
  createRepositoryEvidenceFixture(syntheticRepo);

  const legacySourceMap = {
    schemaVersion: 1,
    sources: [
      {
        id: "legacy-lightcos",
        bucket: "legacy-bucket-1234567890",
        baseUrls: ["https://old.example.test", "https://legacy-alias.example.test/archive"],
      },
      {
        id: "legacy-secondary",
        bucket: "legacy-bucket-secondary-1234567890",
        baseUrls: ["https://other-old.example.test"],
      },
    ],
  };
  const supplementalManifest = {
    schemaVersion: 1,
    approvalReference: "TEST-APPROVAL-1",
    objects: [
      {
        objectKey: "media/cat one.jpg",
        checksum: "f".repeat(64),
        mimeType: "image/jpeg",
        sizeBytes: 999,
        evidence: "synthetic approved key evidence",
      },
      {
        objectKey: "supplemental/proven.jpg",
        checksum: "a".repeat(64),
        evidence: "synthetic approved orphan evidence",
      },
    ],
  };
  const supplementalSha256 = calculateSupplementalObjectManifestSha256(supplementalManifest);
  writeFileSync(sourceMapPath, JSON.stringify(legacySourceMap));
  writeFileSync(supplementalPath, JSON.stringify(supplementalManifest));

  for (const name of [
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_ACCESS_KEY_SECRET",
    "STORAGE_LEGACY_ACCESS_KEY_ID",
    "STORAGE_LEGACY_ACCESS_KEY_SECRET",
    "STORAGE_READ_BUCKETS_JSON",
  ]) {
    delete process.env[name];
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("network access is forbidden in offline inventory verification");
  };

  const beforeHash = fileSha256(databasePath);
  const beforeMtime = statSync(databasePath).mtimeMs;
  const report = createOfflineImageInventory({
    databasePath,
    legacySourceMap,
    supplementalManifest,
    approvedSupplementalManifestSha256: supplementalSha256,
    repositoryRoot: syntheticRepo,
  });
  globalThis.fetch = originalFetch;

  assert.equal(fileSha256(databasePath), beforeHash, "the input database bytes must not change");
  assert.equal(
    statSync(databasePath).mtimeMs,
    beforeMtime,
    "the input database mtime must not change",
  );
  assert.equal(existsSync(`${databasePath}-wal`), false, "read-only inventory must not create WAL");
  assert.equal(existsSync(`${databasePath}-shm`), false, "read-only inventory must not create SHM");
  assert.equal(report.safety.databaseModified, false);
  assert.equal(report.safety.cosCredentialsRead, false);
  assert.equal(report.safety.cosRequestsAttempted, false);
  assert.equal(report.safety.objectValidationPerformed, false);
  assert.equal(report.coverage.fullLegacyBucketCoverage, "unknown");
  assert.equal(report.coverage.bucketListingAttempted, false);
  assert.ok(report.summary.knownLegacyObjectKeyCount >= 3);
  assert.ok(report.summary.referenceRelationshipCount >= 6);
  assert.ok(
    report.knownLegacyObjectKeys.some((item) => item.objectKey === "media/cat one.jpg"),
    "percent-decoded normal references must become exact Keys",
  );
  assert.ok(
    report.knownLegacyObjectKeys.some((item) => item.objectKey === "thumbs/cat-thumb.jpg"),
    "historical aliases with a base path must be supported",
  );
  assert.ok(
    report.knownLegacyObjectKeys.some((item) => item.objectKey === "cats/nested.jpg"),
    "nested JSON URLs must be discovered",
  );
  assert.ok(
    report.duplicateKeys.some((item) => item.objectKey === "media/cat one.jpg"),
    "duplicate Keys must be reported",
  );
  assert.ok(report.unresolvedLegacyUrls.some((item) => item.host === "old.example.test"));
  assert.ok(report.externalUrls.some((item) => item.host === "wechat.example.test"));
  assert.ok(report.relativeImagePaths.length >= 1);
  assert.equal(report.missingMediaRecords.length, 1);
  assert.equal(report.missingMediaRecords[0].mediaId, "missing-media");
  assert.equal(report.missingBindingOwners.length, 1);
  assert.equal(report.missingBindingOwners[0].ownerId, "missing-cat");
  assert.ok(
    report.potentialConflicts.some((item) => item.code === "duplicate-key-media-metadata-conflict"),
  );
  assert.ok(
    report.potentialConflicts.some(
      (item) => item.code === "supplemental-database-metadata-conflict",
    ),
  );
  assert.ok(
    report.potentialConflicts.some(
      (item) => item.code === "object-key-mapped-from-multiple-legacy-sources",
    ),
  );
  assert.ok(report.invalidJsonFields.length >= 1);
  assert.equal(
    report.invalidJsonFields.some((item) => item.locator.recordId === "selection-2"),
    false,
    "a valid JSON null value must not be reported as invalid JSON",
  );
  assert.equal(report.repositoryEvidence.provenHistoricalObjectKeys.length, 0);
  assert.equal(report.repositoryEvidence.sourceManifestItems.length, 1);
  assert.equal(
    report.repositoryEvidence.sourceManifestItems[0].matchingLocalRepositoryPath,
    "public/real-photos/example.jpg",
  );
  assert.equal(
    report.repositoryEvidence.sourceManifestItems[0].mappingStatus,
    "manual-cos-key-mapping-required",
  );

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /private-query-token/);
  assert.doesNotMatch(serialized, /sensitive-person-name/);
  assert.doesNotMatch(serialized, /https:\/\/wechat\.example\.test\/avatar\/private\.jpg/);
  assert.doesNotMatch(serialized, /synthetic approved key evidence/);
  assert.match(report.database.sha256, /^[a-f0-9]{64}$/);
  assert.match(report.reportSha256, /^[a-f0-9]{64}$/);

  const summary = summarizeOfflineImageInventory(report);
  assert.equal(summary.summary.knownLegacyObjectKeyCount, report.summary.knownLegacyObjectKeyCount);
  assert.equal("knownLegacyObjectKeys" in summary, false, "default summary must remain concise");

  assert.throws(
    () =>
      createOfflineImageInventory({
        databasePath,
        legacySourceMap,
        supplementalManifest,
        repositoryRoot: syntheticRepo,
      }),
    /separate approval using the exact manifest SHA-256/,
    "unapproved supplemental Keys must fail closed",
  );

  const incompleteBeforeHash = fileSha256(incompleteDatabasePath);
  assert.throws(
    () =>
      createOfflineImageInventory({
        databasePath: incompleteDatabasePath,
        legacySourceMap,
        repositoryRoot: syntheticRepo,
      }),
    /missing required application tables/,
    "an incomplete backup must fail with an actionable error",
  );
  assert.equal(
    fileSha256(incompleteDatabasePath),
    incompleteBeforeHash,
    "a failed inventory must not modify the input database",
  );
  assert.equal(existsSync(`${incompleteDatabasePath}-wal`), false);
  assert.equal(existsSync(`${incompleteDatabasePath}-shm`), false);

  const cli = spawnSync(
    process.execPath,
    [
      resolve(repositoryRoot, "services/api/src/cli/offline-image-inventory.mjs"),
      "--database",
      databasePath,
      "--legacy-source-map",
      sourceMapPath,
      "--supplemental-manifest",
      supplementalPath,
      "--approve-supplemental-manifest-sha256",
      supplementalSha256,
      "--repository-root",
      syntheticRepo,
      "--output",
      reportPath,
    ],
    {
      encoding: "utf8",
      env: Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith("STORAGE_")),
      ),
    },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(existsSync(reportPath), true);
  const cliStdout = JSON.parse(cli.stdout);
  assert.equal(cliStdout.mode, "offline-database-reference-inventory");
  assert.equal("knownLegacyObjectKeys" in cliStdout, false);
  const cliReport = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.equal(cliReport.safety.cosRequestsAttempted, false);
  assert.equal(fileSha256(databasePath), beforeHash);

  const serviceSource = readFileSync(
    resolve(serviceDirectory, "offline-image-inventory.mjs"),
    "utf8",
  );
  const cliSource = readFileSync(
    resolve(repositoryRoot, "services/api/src/cli/offline-image-inventory.mjs"),
    "utf8",
  );
  assert.match(serviceSource, /readOnly:\s*true/);
  assert.doesNotMatch(
    serviceSource,
    /object-storage|cos-nodejs|\bfetch\s*\(|node:https|node:http|node:net/,
  );
  assert.doesNotMatch(cliSource, /prisma|object-storage|cos-nodejs|STORAGE_/);
  assert.doesNotMatch(
    serviceSource,
    /\.(?:exec|prepare)\(\s*["'`](?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER)\b/i,
  );

  process.stdout.write("Offline image inventory verification passed.\n");
} finally {
  rmSync(fixtureRoot, { force: true, recursive: true });
}

function createFixtureDatabase(path) {
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, nickname TEXT, avatar_url TEXT);
    CREATE TABLE cats (id TEXT PRIMARY KEY, story_json TEXT);
    CREATE TABLE fixed_pages (id TEXT PRIMARY KEY, content_json TEXT);
    CREATE TABLE media_assets (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      thumbnail_url TEXT,
      title TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      checksum TEXT,
      metadata_json TEXT
    );
    CREATE TABLE media_bindings (
      id TEXT PRIMARY KEY,
      media_id TEXT NOT NULL,
      owner_type TEXT,
      owner_id TEXT,
      usage TEXT,
      sort_order INTEGER,
      visibility TEXT,
      deleted_at TEXT
    );
    CREATE TABLE parent_applications (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      existing_cat_claims_json TEXT,
      new_cats_json TEXT
    );
    CREATE TABLE kitten_profiles (cat_id TEXT PRIMARY KEY, structure_rating_json TEXT);
    CREATE TABLE litters (id TEXT PRIMARY KEY, possible_colors_json TEXT);
    CREATE TABLE selection_applications (
      id TEXT PRIMARY KEY,
      contact_name TEXT,
      preferences_json TEXT
    );
    CREATE TABLE posts (id TEXT PRIMARY KEY, content TEXT);
  `);

  const insertMedia = database.prepare(
    "INSERT INTO media_assets (id, source_url, thumbnail_url, title, mime_type, size_bytes, checksum, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insertMedia.run(
    "media-1",
    "https://old.example.test/media/cat%20one.jpg?signature=private-query-token",
    "https://legacy-alias.example.test/archive/thumbs/cat-thumb.jpg",
    "sensitive-person-name",
    "image/jpeg",
    100,
    "1".repeat(64),
    JSON.stringify({
      upload: { bucket: "legacy-bucket-1234567890", objectKey: "media/cat one.jpg" },
    }),
  );
  insertMedia.run(
    "media-2",
    "https://legacy-alias.example.test/archive/media/cat%20one.jpg",
    null,
    null,
    "image/png",
    101,
    "2".repeat(64),
    JSON.stringify({
      upload: { bucket: "legacy-bucket-1234567890", objectKey: "media/cat one.jpg" },
    }),
  );
  insertMedia.run(
    "media-3",
    "https://old.example.test/%ZZ.jpg",
    null,
    null,
    "image/jpeg",
    20,
    null,
    JSON.stringify({ upload: { objectKey: "unknown/source.jpg" } }),
  );

  database
    .prepare("INSERT INTO media_bindings VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run("binding-1", "media-1", "cat", "cat-1", "cover", 10, "visible", null);
  database
    .prepare("INSERT INTO media_bindings VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run("binding-missing", "missing-media", "cat", "cat-1", "gallery", 20, "visible", null);
  database
    .prepare("INSERT INTO media_bindings VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run("binding-owner-missing", "media-1", "cat", "missing-cat", "gallery", 30, "visible", null);
  database
    .prepare("INSERT INTO users VALUES (?, ?, ?)")
    .run(
      "user-1",
      "sensitive-person-name",
      "https://wechat.example.test/avatar/private.jpg?token=private-query-token",
    );
  database.prepare("INSERT INTO cats VALUES (?, ?)").run(
    "cat-1",
    JSON.stringify({
      gallery: [{ image: "https://old.example.test/cats/nested.jpg" }],
      local: "/uploads/local.jpg",
    }),
  );
  database.prepare("INSERT INTO fixed_pages VALUES (?, ?)").run(
    "page-1",
    JSON.stringify({
      hero: { image: "https://legacy-alias.example.test/archive/pages/hero.webp" },
    }),
  );
  database
    .prepare("INSERT INTO parent_applications VALUES (?, ?, ?, ?)")
    .run(
      "application-1",
      "sensitive-person-name",
      JSON.stringify({ proof: "https://old.example.test/applications/proof.jpg" }),
      null,
    );
  database
    .prepare("INSERT INTO kitten_profiles VALUES (?, ?)")
    .run("cat-1", JSON.stringify({ photo: "https://old.example.test/ratings/photo.png" }));
  database
    .prepare("INSERT INTO litters VALUES (?, ?)")
    .run("litter-1", JSON.stringify({ swatch: "https://external.example/colors/a.png" }));
  database
    .prepare("INSERT INTO selection_applications VALUES (?, ?, ?)")
    .run("selection-1", "sensitive-person-name", "{invalid json");
  database
    .prepare("INSERT INTO selection_applications VALUES (?, ?, ?)")
    .run("selection-2", "sensitive-person-name", "null");
  database
    .prepare("INSERT INTO posts VALUES (?, ?)")
    .run("post-1", "Photo https://old.example.test/posts/in-content.jpg and private words");
  database
    .prepare("INSERT INTO posts VALUES (?, ?)")
    .run("post-2", "Photo https://other-old.example.test/cats/nested.jpg");
  database.close();
}

function createIncompleteDatabase(path) {
  const database = new DatabaseSync(path);
  database.exec("CREATE TABLE users (id TEXT PRIMARY KEY, avatar_url TEXT)");
  database.close();
}

function createRepositoryEvidenceFixture(root) {
  const mediaPath = resolve(root, "public/real-photos/example.jpg");
  const media = Buffer.from("synthetic repository image");
  mkdirSync(dirname(mediaPath), { recursive: true });
  writeFileSync(mediaPath, media);
  const manifestPath = resolve(root, "docs/media-source-manifests/example.json");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify({
      sourceBatchId: "synthetic-source-batch",
      items: [
        {
          id: "source-item-1",
          filename: "example.jpg",
          sha256: crypto.createHash("sha256").update(media).digest("hex"),
          sizeBytes: media.length,
          businessSlot: "environment:test",
        },
      ],
    }),
  );
  const lovablePath = resolve(root, "src/assets/demo.png.asset.json");
  mkdirSync(dirname(lovablePath), { recursive: true });
  writeFileSync(
    lovablePath,
    JSON.stringify({ original_filename: "demo.png", r2_key: "r2/not-cos/demo.png" }),
  );
}

function fileSha256(path) {
  return crypto.createHash("sha256").update(readFileSync(path)).digest("hex");
}
