import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import {
  resolveApprovedSupplementalObjectManifest,
  safeObjectKey,
  SupplementalManifestError,
} from "./cos-migration-manifest.mjs";

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".heic",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);
const REQUIRED_TABLES = ["cats", "fixed_pages", "media_assets", "media_bindings", "users"];
const EXCLUDED_SCAN_COLUMNS =
  /(^|_)(password|secret|token|hash|openid|unionid|phone|wechat|real_name|display_name|nickname)($|_)/i;
const REPOSITORY_IMAGE_DIRS = ["public/real-photos"];

export class OfflineImageInventoryError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "OfflineImageInventoryError";
    this.details = details;
  }
}

export function createOfflineImageInventory({
  databasePath,
  legacySourceMap,
  supplementalManifest = null,
  approvedSupplementalManifestSha256 = "",
  repositoryRoot = null,
} = {}) {
  const resolvedDatabasePath = validateDatabasePath(databasePath);
  const sources = normalizeLegacySourceMap(legacySourceMap);
  const before = fingerprintFile(resolvedDatabasePath);
  let supplemental;
  try {
    supplemental = resolveApprovedSupplementalObjectManifest({
      approvedSupplementalManifestSha256,
      manifest: supplementalManifest,
    });
  } catch (error) {
    if (error instanceof SupplementalManifestError) {
      throw new OfflineImageInventoryError(error.message, error.details);
    }
    throw error;
  }

  const database = new DatabaseSync(resolvedDatabasePath, {
    open: true,
    readOnly: true,
    timeout: 5_000,
  });

  let databaseEvidence;
  try {
    database.exec("PRAGMA query_only = ON; BEGIN DEFERRED");
    databaseEvidence = inspectDatabase(database, sources, supplemental);
    database.exec("ROLLBACK");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Closing the read-only connection below also releases an open read transaction.
    }
    throw asInventoryError(error);
  } finally {
    database.close();
  }

  const after = fingerprintFile(resolvedDatabasePath);
  if (before.sha256 !== after.sha256 || before.sizeBytes !== after.sizeBytes) {
    throw new OfflineImageInventoryError(
      "The input SQLite backup changed while the read-only inventory was running",
      { before, after },
    );
  }

  const repositoryEvidence = repositoryRoot
    ? collectRepositoryMediaEvidence(resolve(repositoryRoot))
    : null;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "offline-database-reference-inventory",
    safety: {
      databaseAccess: "read-only-node-sqlite",
      databaseModified: false,
      cosCredentialsRead: false,
      cosRequestsAttempted: false,
      objectValidationPerformed: false,
      objectCopyPerformed: false,
      productionDatabaseConnected: false,
    },
    coverage: {
      scope: "offline-sqlite-references-and-approved-supplemental-keys",
      fullLegacyBucketCoverage: "unknown",
      bucketListingAttempted: false,
      orphanObjectCoverage: "unknown",
      note: "This report inventories references discoverable in the supplied SQLite backup and separately approved supplemental Keys. It is not a complete legacy-bucket object listing.",
    },
    database: {
      fileName: basename(resolvedDatabasePath),
      sha256: before.sha256,
      sizeBytes: before.sizeBytes,
      integrityCheck: databaseEvidence.integrityCheck,
      foreignKeyViolationCount: databaseEvidence.foreignKeyViolations.length,
      inspectedTables: databaseEvidence.inspectedTables,
    },
    legacySources: sources.map((source) => ({
      id: source.id,
      bucket: source.bucket,
      baseUrls: source.baseUrls,
    })),
    summary: databaseEvidence.summary,
    knownLegacyObjectKeys: databaseEvidence.knownLegacyObjectKeys,
    duplicateKeys: databaseEvidence.duplicateKeys,
    urlStatistics: databaseEvidence.urlStatistics,
    unresolvedLegacyUrls: databaseEvidence.unresolvedLegacyUrls,
    externalUrls: databaseEvidence.externalUrls,
    unassignedExplicitObjectKeys: databaseEvidence.unassignedExplicitObjectKeys,
    relativeImagePaths: databaseEvidence.relativeImagePaths,
    invalidJsonFields: databaseEvidence.invalidJsonFields,
    mediaBindings: databaseEvidence.mediaBindings,
    missingMediaRecords: databaseEvidence.missingMediaRecords,
    missingBindingOwners: databaseEvidence.missingBindingOwners,
    potentialConflicts: databaseEvidence.potentialConflicts,
    manualReviewItems: databaseEvidence.manualReviewItems,
    supplementalManifestAudit: supplemental.audit,
    repositoryEvidence,
  };
  report.reportSha256 = sha256(stableJson({ ...report, reportSha256: undefined }));
  return report;
}

export function summarizeOfflineImageInventory(report) {
  return {
    schemaVersion: report.schemaVersion,
    mode: report.mode,
    databaseSha256: report.database.sha256,
    reportSha256: report.reportSha256,
    coverage: report.coverage,
    summary: report.summary,
    repositoryEvidence: report.repositoryEvidence
      ? {
          provenHistoricalObjectKeyCount:
            report.repositoryEvidence.provenHistoricalObjectKeys.length,
          manualMappingCandidateCount: report.repositoryEvidence.manualMappingCandidates.length,
          localMediaFileCount: report.repositoryEvidence.localMediaFiles.length,
        }
      : null,
    nextStep:
      "Review unresolved/external/conflict items and complete evidence-backed Key mappings before any online COS inventory command is considered.",
  };
}

function inspectDatabase(database, sources, supplemental) {
  const integrityRows = database.prepare("PRAGMA integrity_check").all();
  const integrityCheck = integrityRows.map(firstValue);
  if (integrityCheck.length !== 1 || integrityCheck[0] !== "ok") {
    throw new OfflineImageInventoryError("SQLite integrity_check failed", { integrityCheck });
  }
  const foreignKeyViolations = database.prepare("PRAGMA foreign_key_check").all();
  const tables = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => row.name);
  const missingTables = REQUIRED_TABLES.filter((table) => !tables.includes(table));
  if (missingTables.length > 0) {
    throw new OfflineImageInventoryError("SQLite backup is missing required application tables", {
      missingTables,
    });
  }

  const references = [];
  for (const table of tables.filter(isApplicationTable)) {
    const columns = database.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all();
    const scanColumns = columns.filter(isScannableColumn);
    if (scanColumns.length === 0) continue;
    const identityColumns = recordIdentityColumns(columns);
    const selectedColumns = unique([
      ...identityColumns,
      ...scanColumns.map((column) => column.name),
    ]);
    const rows = database
      .prepare(
        `SELECT ${selectedColumns.map(quoteIdentifier).join(", ")} FROM ${quoteIdentifier(table)} ORDER BY ${identityColumns.map(quoteIdentifier).join(", ")}`,
      )
      .all();
    for (const row of rows) {
      const recordId = buildRecordId(row, identityColumns);
      for (const column of scanColumns) {
        collectColumnReferences({
          column: column.name,
          recordId,
          references,
          table,
          value: row[column.name],
        });
      }
    }
  }

  const classified = references.map((reference) => classifyReference(reference, sources));
  const mediaRows = database
    .prepare(
      "SELECT id, source_url, thumbnail_url, metadata_json, checksum, mime_type, size_bytes FROM media_assets ORDER BY id",
    )
    .all();
  const bindings = loadMediaBindings(database, tables);
  const mediaById = new Map(mediaRows.map((row) => [String(row.id), row]));
  const missingMediaRecords = bindings
    .filter((binding) => !mediaById.has(String(binding.media_id)))
    .map(sanitizeBinding);
  const mediaBindings = bindings.map(sanitizeBinding);
  const missingBindingOwners = findMissingBindingOwners(database, tables, bindings);

  const keyEvidence = new Map();
  for (const item of classified.filter((item) => item.classification === "mapped-legacy-url")) {
    addKeyEvidence(keyEvidence, item.objectKey, {
      evidence: "configured-legacy-base-url",
      legacySourceId: item.legacySourceId,
      locator: item.locator,
      referenceId: item.referenceId,
      referenceKind: item.referenceKind,
    });
  }

  const unassignedExplicitObjectKeys = [];
  const metadataConflicts = [];
  for (const media of mediaRows) {
    const metadata = parseJson(media.metadata_json);
    const upload = isPlainObject(metadata?.upload) ? metadata.upload : null;
    const explicitKey = safeObjectKey(upload?.objectKey);
    const declaredBucket = stringOrNull(upload?.bucket);
    const locator = locatorFor("media_assets", media.id, "metadata_json", ["upload", "objectKey"]);
    const matchingSource = declaredBucket
      ? sources.find((source) => source.bucket === declaredBucket)
      : null;
    if (explicitKey && matchingSource) {
      addKeyEvidence(keyEvidence, explicitKey, {
        evidence: "media-upload-metadata-bucket",
        legacySourceId: matchingSource.id,
        locator,
        referenceId: referenceId(locator, explicitKey),
        referenceKind: "metadata-object-key",
      });
    } else if (explicitKey && !matchingSource) {
      unassignedExplicitObjectKeys.push({
        objectKey: explicitKey,
        declaredBucket,
        locator,
        reason: declaredBucket
          ? "declared-bucket-is-not-a-configured-legacy-source"
          : "metadata-object-key-has-no-declared-bucket",
      });
    }

    const sourceReference = classified.find(
      (item) =>
        item.locator.table === "media_assets" &&
        item.locator.recordId === String(media.id) &&
        item.locator.field === "source_url" &&
        item.classification === "mapped-legacy-url",
    );
    if (explicitKey && sourceReference && explicitKey !== sourceReference.objectKey) {
      metadataConflicts.push({
        code: "media-metadata-url-key-mismatch",
        locator,
        metadataObjectKey: explicitKey,
        urlObjectKey: sourceReference.objectKey,
      });
    }
    if (matchingSource && sourceReference && matchingSource.id !== sourceReference.legacySourceId) {
      metadataConflicts.push({
        code: "media-metadata-url-source-mismatch",
        locator,
        metadataLegacySourceId: matchingSource.id,
        urlLegacySourceId: sourceReference.legacySourceId,
      });
    }
  }

  for (const object of supplemental.objects) {
    addKeyEvidence(keyEvidence, object.objectKey, {
      checksum: object.checksum,
      evidence: "approved-supplemental-manifest",
      legacySourceId: null,
      locator: null,
      mimeType: object.mimeType,
      referenceId: `supplemental:${sha256(object.objectKey).slice(0, 16)}`,
      referenceKind: "supplemental-object",
      sizeBytes: object.sizeBytes,
    });
  }

  const mediaMetadataByKey = collectMediaMetadataByKey(mediaRows, classified, sources);
  const knownLegacyObjectKeys = [...keyEvidence.entries()]
    .map(([objectKey, evidence]) => ({
      objectKey,
      referenceCount: evidence.length,
      evidence,
    }))
    .sort((left, right) => left.objectKey.localeCompare(right.objectKey));
  const duplicateKeys = knownLegacyObjectKeys
    .map((item) => ({
      ...item,
      referenceOwners: unique(item.evidence.map(keyEvidenceOwner)),
    }))
    .filter((item) => item.referenceOwners.length > 1)
    .map((item) => ({
      objectKey: item.objectKey,
      referenceCount: item.referenceCount,
      distinctOwnerCount: item.referenceOwners.length,
      referenceIds: item.evidence.map((entry) => entry.referenceId),
    }));
  const metadataValueConflicts = buildMetadataValueConflicts(mediaMetadataByKey);
  const supplementalConflicts = buildSupplementalConflicts(
    supplemental.objects,
    mediaMetadataByKey,
  );
  const crossSourceKeyConflicts = knownLegacyObjectKeys
    .map((item) => ({
      objectKey: item.objectKey,
      legacySourceIds: unique(
        item.evidence.map((entry) => entry.legacySourceId).filter(Boolean),
      ).sort(),
    }))
    .filter((item) => item.legacySourceIds.length > 1)
    .map((item) => ({ code: "object-key-mapped-from-multiple-legacy-sources", ...item }));
  const potentialConflicts = [
    ...metadataConflicts,
    ...metadataValueConflicts,
    ...supplementalConflicts,
    ...crossSourceKeyConflicts,
  ];

  const unresolvedLegacyUrls = classified
    .filter((item) => item.classification === "unresolved-legacy-url")
    .map(sanitizeClassifiedReference);
  const externalUrls = classified
    .filter((item) => item.classification === "external-url")
    .map(sanitizeClassifiedReference);
  const relativeImagePaths = classified
    .filter((item) => item.classification === "relative-image-path")
    .map(sanitizeClassifiedReference);
  const invalidJsonFields = classified
    .filter((item) => item.classification === "invalid-json")
    .map((item) => ({ referenceId: item.referenceId, locator: item.locator }));
  const manualReviewItems = [
    ...unresolvedLegacyUrls.map((item) => manualItem("unresolved-legacy-url", item)),
    ...externalUrls.map((item) => manualItem("external-url-not-assumed-legacy", item)),
    ...relativeImagePaths.map((item) => manualItem("relative-image-path-needs-mapping", item)),
    ...invalidJsonFields.map((item) => ({
      code: "invalid-json-field",
      referenceId: item.referenceId,
      locator: item.locator,
    })),
    ...unassignedExplicitObjectKeys.map((item) => ({
      code: "metadata-object-key-source-unknown",
      locator: item.locator,
      reason: item.reason,
    })),
    ...missingMediaRecords.map((item) => ({
      code: "media-binding-references-missing-media",
      bindingId: item.id,
      mediaId: item.mediaId,
    })),
    ...missingBindingOwners.map((item) => ({
      code: "media-binding-references-missing-owner",
      bindingId: item.bindingId,
      ownerType: item.ownerType,
      ownerId: item.ownerId,
      reason: item.reason,
    })),
    ...potentialConflicts.map((item) => ({ code: item.code, objectKey: item.objectKey ?? null })),
  ];

  const urlStatistics = buildUrlStatistics(classified);
  const knownDatabaseKeys = knownLegacyObjectKeys.filter((item) =>
    item.evidence.some((entry) => entry.evidence !== "approved-supplemental-manifest"),
  );
  return {
    duplicateKeys,
    externalUrls,
    foreignKeyViolations,
    inspectedTables: tables.filter(isApplicationTable),
    invalidJsonFields,
    integrityCheck,
    knownLegacyObjectKeys,
    manualReviewItems,
    mediaBindings,
    missingBindingOwners,
    missingMediaRecords,
    potentialConflicts,
    relativeImagePaths,
    summary: {
      knownLegacyObjectKeyCount: knownLegacyObjectKeys.length,
      databaseKnownLegacyObjectKeyCount: knownDatabaseKeys.length,
      approvedSupplementalObjectKeyCount: supplemental.objects.length,
      referenceRelationshipCount: knownLegacyObjectKeys.reduce(
        (total, item) =>
          total +
          item.evidence.filter((entry) => entry.evidence !== "approved-supplemental-manifest")
            .length,
        0,
      ),
      mediaBindingCount: bindings.length,
      duplicateKeyCount: duplicateKeys.length,
      unresolvedLegacyUrlCount: unresolvedLegacyUrls.length,
      externalUrlCount: externalUrls.length,
      relativeImagePathCount: relativeImagePaths.length,
      invalidJsonFieldCount: invalidJsonFields.length,
      unassignedExplicitObjectKeyCount: unassignedExplicitObjectKeys.length,
      missingMediaRecordCount: missingMediaRecords.length,
      missingBindingOwnerCount: missingBindingOwners.length,
      potentialConflictCount: potentialConflicts.length,
      manualReviewItemCount: manualReviewItems.length,
    },
    unassignedExplicitObjectKeys,
    unresolvedLegacyUrls,
    urlStatistics,
  };
}

function collectColumnReferences({ column, recordId, references, table, value }) {
  if (value == null) return;
  const jsonResult = column.toLowerCase().endsWith("_json")
    ? tryParseJson(value)
    : { ok: true, value };
  if (!jsonResult.ok) {
    references.push({
      locator: locatorFor(table, recordId, column, null),
      rawValue: "",
      referenceKind: "invalid-json-field",
      forcedClassification: "invalid-json",
    });
    return;
  }
  walkValue(jsonResult.value, [], (path, stringValue) => {
    if (
      table === "media_assets" &&
      column === "metadata_json" &&
      path.length === 2 &&
      path[0] === "upload" &&
      path[1] === "objectKey"
    ) {
      return;
    }
    for (const candidate of extractImageReferenceCandidates(stringValue)) {
      references.push({
        locator: locatorFor(table, recordId, column, path.length > 0 ? path : null),
        rawValue: candidate.value,
        referenceKind: referenceKindFor(table, column, path),
      });
    }
  });
}

function classifyReference(reference, sources) {
  const referenceHash = referenceId(reference.locator, reference.rawValue);
  if (reference.forcedClassification) {
    return {
      ...reference,
      classification: reference.forcedClassification,
      referenceId: referenceHash,
    };
  }
  if (!isHttpLike(reference.rawValue)) {
    return {
      ...reference,
      classification: "relative-image-path",
      referenceId: referenceHash,
      valueSha256: sha256(reference.rawValue),
    };
  }

  let url;
  try {
    url = new URL(reference.rawValue);
  } catch {
    return {
      ...reference,
      classification: "external-url",
      host: null,
      pathFormat: "malformed-http-url",
      reason: "malformed-http-url",
      referenceId: referenceHash,
      valueSha256: sha256(reference.rawValue),
    };
  }
  const matches = [];
  let sharesLegacyOrigin = false;
  let decodeFailed = false;
  for (const source of sources) {
    for (const base of source.normalizedBaseUrls) {
      if (base.origin !== url.origin) continue;
      sharesLegacyOrigin = true;
      const parsed = objectKeyFromUrl(url, base);
      if (parsed.decodeFailed) decodeFailed = true;
      if (parsed.objectKey) matches.push({ objectKey: parsed.objectKey, source, base });
    }
  }
  const distinct = unique(matches.map((item) => `${item.source.id}\0${item.objectKey}`));
  if (distinct.length === 1) {
    const matched = matches[0];
    return {
      ...reference,
      classification: "mapped-legacy-url",
      host: url.host,
      legacySourceId: matched.source.id,
      objectKey: matched.objectKey,
      pathFormat: describePathFormat(url.pathname),
      referenceId: referenceHash,
      valueSha256: sha256(reference.rawValue),
    };
  }
  if (distinct.length > 1) {
    return {
      ...reference,
      classification: "unresolved-legacy-url",
      host: url.host,
      pathFormat: describePathFormat(url.pathname),
      reason: "ambiguous-overlapping-base-url-mappings",
      referenceId: referenceHash,
      valueSha256: sha256(reference.rawValue),
    };
  }
  if (sharesLegacyOrigin) {
    return {
      ...reference,
      classification: "unresolved-legacy-url",
      host: url.host,
      pathFormat: describePathFormat(url.pathname),
      reason: decodeFailed
        ? "malformed-percent-encoded-path"
        : "known-origin-outside-mapped-base-or-invalid-object-key",
      referenceId: referenceHash,
      valueSha256: sha256(reference.rawValue),
    };
  }
  return {
    ...reference,
    classification: "external-url",
    host: url.host,
    pathFormat: describePathFormat(url.pathname),
    reason: "host-is-not-a-configured-legacy-source",
    referenceId: referenceHash,
    valueSha256: sha256(reference.rawValue),
  };
}

function normalizeLegacySourceMap(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.sources) || value.sources.length === 0) {
    throw new OfflineImageInventoryError(
      "A legacy source map with schemaVersion 1 and at least one source is required",
    );
  }
  const ids = new Set();
  return value.sources.map((item, index) => {
    const id = stringOrNull(item?.id);
    const bucket = stringOrNull(item?.bucket);
    if (
      !id ||
      !bucket ||
      ids.has(id) ||
      !Array.isArray(item?.baseUrls) ||
      item.baseUrls.length === 0
    ) {
      throw new OfflineImageInventoryError("Legacy source map contains an invalid source", {
        index,
      });
    }
    ids.add(id);
    const normalizedBaseUrls = item.baseUrls.map((baseUrl, baseIndex) => {
      try {
        const url = new URL(baseUrl);
        if (
          !new Set(["http:", "https:"]).has(url.protocol) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          throw new Error();
        url.pathname = url.pathname.replace(/\/+$/, "");
        return url;
      } catch {
        throw new OfflineImageInventoryError("Legacy source map contains an invalid base URL", {
          baseIndex,
          sourceId: id,
        });
      }
    });
    return {
      id,
      bucket,
      baseUrls: normalizedBaseUrls.map((url) => url.toString().replace(/\/$/, "")),
      normalizedBaseUrls,
    };
  });
}

function collectMediaMetadataByKey(mediaRows, classified, sources) {
  const result = new Map();
  for (const media of mediaRows) {
    const metadata = parseJson(media.metadata_json);
    const upload = isPlainObject(metadata?.upload) ? metadata.upload : null;
    const explicitKey = safeObjectKey(upload?.objectKey);
    const declaredBucket = stringOrNull(upload?.bucket);
    const mapped = classified.find(
      (item) =>
        item.locator.table === "media_assets" &&
        item.locator.recordId === String(media.id) &&
        item.locator.field === "source_url" &&
        item.classification === "mapped-legacy-url",
    );
    const key =
      mapped?.objectKey ??
      (sources.some((source) => source.bucket === declaredBucket) ? explicitKey : null);
    if (!key) continue;
    const items = result.get(key) ?? [];
    items.push({
      mediaId: String(media.id),
      checksum: stringOrNull(media.checksum),
      mimeType: stringOrNull(media.mime_type),
      sizeBytes: integerOrNull(media.size_bytes),
    });
    result.set(key, items);
  }
  return result;
}

function buildMetadataValueConflicts(metadataByKey) {
  const conflicts = [];
  for (const [objectKey, items] of metadataByKey) {
    const conflictingFields = ["checksum", "mimeType", "sizeBytes"].filter(
      (field) =>
        new Set(
          items.map((item) => normalizeComparable(item[field])).filter((item) => item != null),
        ).size > 1,
    );
    if (conflictingFields.length > 0) {
      conflicts.push({
        code: "duplicate-key-media-metadata-conflict",
        objectKey,
        mediaIds: items.map((item) => item.mediaId),
        conflictingFields,
      });
    }
  }
  return conflicts;
}

function buildSupplementalConflicts(objects, metadataByKey) {
  const conflicts = [];
  for (const object of objects) {
    const media = metadataByKey.get(object.objectKey) ?? [];
    const conflictingFields = ["checksum", "mimeType", "sizeBytes"].filter((field) => {
      const values = [object[field], ...media.map((item) => item[field])]
        .map(normalizeComparable)
        .filter((item) => item != null);
      return new Set(values).size > 1;
    });
    if (conflictingFields.length > 0) {
      conflicts.push({
        code: "supplemental-database-metadata-conflict",
        objectKey: object.objectKey,
        mediaIds: media.map((item) => item.mediaId),
        conflictingFields,
      });
    }
  }
  return conflicts;
}

function loadMediaBindings(database, tables) {
  if (!tables.includes("media_bindings")) return [];
  return database
    .prepare(
      "SELECT id, media_id, owner_type, owner_id, usage, sort_order, visibility, deleted_at FROM media_bindings ORDER BY media_id, sort_order, id",
    )
    .all();
}

function sanitizeBinding(binding) {
  return {
    id: String(binding.id),
    mediaId: String(binding.media_id),
    ownerType: stringOrNull(binding.owner_type),
    ownerId: stringOrNull(binding.owner_id),
    usage: stringOrNull(binding.usage),
    sortOrder: integerOrNull(binding.sort_order),
    visibility: stringOrNull(binding.visibility),
    deleted: binding.deleted_at != null,
  };
}

function findMissingBindingOwners(database, tables, bindings) {
  const ownerTables = {
    cat: "cats",
    fixed_page: "fixed_pages",
    litter: "litters",
    parent_profile: "parent_profiles",
    post: "posts",
  };
  const existingIds = new Map();
  for (const table of unique(Object.values(ownerTables))) {
    if (!tables.includes(table)) continue;
    existingIds.set(
      table,
      new Set(
        database
          .prepare(`SELECT id FROM ${quoteIdentifier(table)} ORDER BY id`)
          .all()
          .map((row) => String(row.id)),
      ),
    );
  }
  return bindings
    .map((binding) => {
      const ownerType = stringOrNull(binding.owner_type);
      const ownerId = stringOrNull(binding.owner_id);
      const table = ownerTables[ownerType];
      if (!table) {
        return {
          bindingId: String(binding.id),
          ownerType,
          ownerId,
          reason: "unsupported-owner-type",
        };
      }
      if (!existingIds.has(table)) {
        return {
          bindingId: String(binding.id),
          ownerType,
          ownerId,
          reason: "owner-table-missing-from-backup",
        };
      }
      if (!ownerId || !existingIds.get(table).has(ownerId)) {
        return {
          bindingId: String(binding.id),
          ownerType,
          ownerId,
          reason: "owner-record-missing",
        };
      }
      return null;
    })
    .filter(Boolean);
}

function buildUrlStatistics(classified) {
  const stats = new Map();
  for (const item of classified.filter((entry) => entry.host)) {
    const key = `${item.host}\0${item.pathFormat}`;
    const current = stats.get(key) ?? {
      host: item.host,
      pathFormat: item.pathFormat,
      mappedLegacyCount: 0,
      unresolvedLegacyCount: 0,
      externalCount: 0,
    };
    if (item.classification === "mapped-legacy-url") current.mappedLegacyCount += 1;
    else if (item.classification === "unresolved-legacy-url") current.unresolvedLegacyCount += 1;
    else current.externalCount += 1;
    stats.set(key, current);
  }
  return [...stats.values()].sort(
    (left, right) =>
      left.host.localeCompare(right.host) || left.pathFormat.localeCompare(right.pathFormat),
  );
}

function sanitizeClassifiedReference(item) {
  return {
    referenceId: item.referenceId,
    locator: item.locator,
    host: item.host ?? null,
    pathFormat: item.pathFormat ?? null,
    valueSha256: item.valueSha256,
    reason: item.reason ?? null,
  };
}

function manualItem(code, item) {
  return { code, referenceId: item.referenceId, locator: item.locator, reason: item.reason };
}

function addKeyEvidence(map, objectKey, evidence) {
  const items = map.get(objectKey) ?? [];
  const dedupeKey = stableJson({
    evidence: evidence.evidence,
    legacySourceId: evidence.legacySourceId,
    locator: evidence.locator,
    referenceId: evidence.referenceId,
  });
  if (
    !items.some(
      (item) =>
        stableJson({
          evidence: item.evidence,
          legacySourceId: item.legacySourceId,
          locator: item.locator,
          referenceId: item.referenceId,
        }) === dedupeKey,
    )
  ) {
    items.push(evidence);
  }
  map.set(objectKey, items);
}

function keyEvidenceOwner(evidence) {
  return evidence.locator
    ? `${evidence.locator.table}:${evidence.locator.recordId}`
    : `${evidence.evidence}:${evidence.referenceId}`;
}

function collectRepositoryMediaEvidence(repositoryRoot) {
  if (!existsSync(repositoryRoot) || !statSync(repositoryRoot).isDirectory()) {
    throw new OfflineImageInventoryError("Repository root does not exist or is not a directory");
  }
  const localMediaFiles = [];
  for (const directory of REPOSITORY_IMAGE_DIRS) {
    const absolute = resolve(repositoryRoot, directory);
    if (!existsSync(absolute)) continue;
    for (const path of listFilesRecursively(absolute).filter(isImagePath)) {
      const file = readFileSync(path);
      localMediaFiles.push({
        repositoryPath: slash(relative(repositoryRoot, path)),
        fileName: basename(path),
        sizeBytes: file.length,
        sha256: sha256(file),
        mappingStatus: "manual-cos-key-mapping-required",
      });
    }
  }
  const localBySha256 = new Map(localMediaFiles.map((item) => [item.sha256, item.repositoryPath]));
  const sourceManifestItems = [];
  const manifestDirectory = resolve(repositoryRoot, "docs/media-source-manifests");
  if (existsSync(manifestDirectory)) {
    for (const path of listFilesRecursively(manifestDirectory).filter(
      (item) => extname(item) === ".json",
    )) {
      const manifest = parseJson(readFileSync(path, "utf8"));
      if (!Array.isArray(manifest?.items)) continue;
      for (const item of manifest.items) {
        sourceManifestItems.push({
          sourceManifest: slash(relative(repositoryRoot, path)),
          sourceBatchId: stringOrNull(manifest.sourceBatchId),
          itemId: stringOrNull(item.id),
          fileName: stringOrNull(item.filename),
          sha256: stringOrNull(item.sha256),
          sizeBytes: integerOrNull(item.sizeBytes),
          businessSlot: stringOrNull(item.businessSlot),
          matchingLocalRepositoryPath: localBySha256.get(item.sha256) ?? null,
          mappingStatus: "manual-cos-key-mapping-required",
          reason: "filename-hash-and-business-slot-do-not-prove-a-cos-object-key",
        });
      }
    }
  }
  const lovableAssetMetadata = [];
  const assetsDirectory = resolve(repositoryRoot, "src/assets");
  if (existsSync(assetsDirectory)) {
    for (const path of listFilesRecursively(assetsDirectory).filter((item) =>
      item.endsWith(".asset.json"),
    )) {
      const value = parseJson(readFileSync(path, "utf8"));
      lovableAssetMetadata.push({
        repositoryPath: slash(relative(repositoryRoot, path)),
        originalFileName: stringOrNull(value?.original_filename),
        mappingStatus: "not-a-cos-key",
        reason: value?.r2_key
          ? "metadata-identifies-a-Lovable-R2-key-not-a-historical-COS-key"
          : "asset-metadata-does-not-prove-a-historical-COS-key",
      });
    }
  }
  return {
    provenHistoricalObjectKeys: [],
    manualMappingCandidates: [...sourceManifestItems, ...localMediaFiles],
    sourceManifestItems,
    localMediaFiles,
    lovableAssetMetadata,
    publicContentImageStatus:
      "public-content-manifest defers original images; no historical COS Key is proven there",
    webDemoMediaStatus:
      "the Web Demo real-photo manifest resolves checked-in /real-photos paths and source filenames, not historical COS Keys",
  };
}

function objectKeyFromUrl(sourceUrl, baseUrl) {
  let basePath;
  let sourcePath;
  try {
    basePath = decodeURIComponent(baseUrl.pathname).replace(/^\/+|\/+$/g, "");
    sourcePath = decodeURIComponent(sourceUrl.pathname).replace(/^\/+/, "");
  } catch {
    return { objectKey: null, decodeFailed: true };
  }
  if (basePath && !sourcePath.startsWith(`${basePath}/`)) {
    return { objectKey: null, decodeFailed: false };
  }
  const objectKey = safeObjectKey(basePath ? sourcePath.slice(basePath.length + 1) : sourcePath);
  return { objectKey, decodeFailed: false };
}

function extractImageReferenceCandidates(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  const found = [];
  const httpMatches = value.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const match of httpMatches) {
    const cleaned = match.replace(/[),.;，。；）\]]+$/u, "");
    found.push({ value: cleaned });
  }
  if (found.length === 0) {
    const trimmed = value.trim();
    if (isLikelyRelativeImagePath(trimmed)) found.push({ value: trimmed });
    for (const match of trimmed.matchAll(
      /(?:^|[\s"'(=])((?:\.\.\/|\.\/|\/)[^\s"'<>()[\]]+\.(?:avif|gif|heic|jpeg|jpg|png|svg|webp)(?:[?#][^\s"'<>()[\]]*)?)/giu,
    )) {
      found.push({ value: match[1] });
    }
  }
  return uniqueBy(found, (item) => item.value);
}

function isLikelyRelativeImagePath(value) {
  if (/^data:image\//i.test(value)) return true;
  const withoutQuery = value.split(/[?#]/, 1)[0];
  return IMAGE_EXTENSIONS.has(extname(withoutQuery).toLowerCase());
}

function isHttpLike(value) {
  return /^https?:\/\//i.test(value);
}

function describePathFormat(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const extension = extname(segments.at(-1) ?? "").toLowerCase() || "[no-extension]";
  return `${segments.length}-segments/${extension}`;
}

function isScannableColumn(column) {
  const name = String(column.name);
  if (EXCLUDED_SCAN_COLUMNS.test(name)) return false;
  const type = String(column.type ?? "").toUpperCase();
  return (
    name.endsWith("_json") ||
    name.endsWith("_url") ||
    type.includes("TEXT") ||
    type.includes("JSON") ||
    type.includes("CHAR") ||
    type.includes("CLOB")
  );
}

function recordIdentityColumns(columns) {
  if (columns.some((column) => column.name === "id")) return ["id"];
  const primary = columns
    .filter((column) => Number(column.pk) > 0)
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map((column) => column.name);
  return primary.length > 0 ? primary : [columns[0].name];
}

function buildRecordId(row, columns) {
  return columns.map((column) => String(row[column])).join(":");
}

function referenceKindFor(table, column, path) {
  if (table === "media_assets" && column === "source_url") return "media-source";
  if (table === "media_assets" && column === "thumbnail_url") return "media-thumbnail";
  if (table === "users" && column === "avatar_url") return "user-avatar";
  return path.length > 0 ? "nested-json" : "scalar-text";
}

function locatorFor(table, recordId, field, jsonPath) {
  return { table, recordId: String(recordId), field, jsonPath };
}

function referenceId(locator, value) {
  return sha256(stableJson({ locator, value })).slice(0, 24);
}

function walkValue(value, path, visit) {
  if (typeof value === "string") visit(path, value);
  else if (Array.isArray(value))
    value.forEach((item, index) => walkValue(item, [...path, index], visit));
  else if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) walkValue(item, [...path, key], visit);
  }
}

function validateDatabasePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new OfflineImageInventoryError("--database is required");
  }
  const path = resolve(value);
  if (path.toLowerCase().endsWith(".gz")) {
    throw new OfflineImageInventoryError(
      "The offline inventory requires an uncompressed SQLite backup; decompress the .gz into a protected working copy first",
    );
  }
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new OfflineImageInventoryError("SQLite backup file does not exist", {
      fileName: basename(path),
    });
  }
  const header = readFilePrefix(path, 16).toString("utf8");
  if (header !== "SQLite format 3\0") {
    throw new OfflineImageInventoryError("Input is not a SQLite 3 database file");
  }
  return path;
}

function fingerprintFile(path) {
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const file = openSync(path, "r");
  let sizeBytes = 0;
  try {
    while (true) {
      const bytesRead = readSync(file, buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      sizeBytes += bytesRead;
    }
  } finally {
    closeSync(file);
  }
  return { sha256: hash.digest("hex"), sizeBytes };
}

function readFilePrefix(path, length) {
  const buffer = Buffer.alloc(length);
  const file = openSync(path, "r");
  try {
    const bytesRead = readSync(file, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(file);
  }
}

function parseJson(value) {
  if (value == null || typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function tryParseJson(value) {
  if (value != null && typeof value === "object") return { ok: true, value };
  if (typeof value !== "string") return { ok: false, value: null };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value: null };
  }
}

function firstValue(row) {
  return Object.values(row)[0];
}

function isApplicationTable(table) {
  return !table.startsWith("_prisma_") && table !== "user_sessions";
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function listFilesRecursively(root) {
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) result.push(...listFilesRecursively(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

function isImagePath(path) {
  return IMAGE_EXTENSIONS.has(extname(path).toLowerCase());
}

function asInventoryError(error) {
  if (error instanceof OfflineImageInventoryError) return error;
  return new OfflineImageInventoryError(
    `Failed to read the offline SQLite backup: ${error instanceof Error ? error.message : String(error)}`,
  );
}

function normalizeComparable(value) {
  return typeof value === "string" ? value.trim().toLowerCase() || null : (value ?? null);
}

function integerOrNull(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function stringOrNull(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(items) {
  return [...new Set(items)];
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function slash(value) {
  return value.replaceAll("\\", "/");
}

function stableJson(value) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
