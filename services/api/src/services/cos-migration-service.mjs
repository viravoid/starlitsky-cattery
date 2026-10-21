import crypto from "node:crypto";
import { prisma } from "../db/prisma.mjs";
import {
  getAllowedStorageBuckets,
  getObject,
  headObject,
  putObject,
} from "./object-storage-service.mjs";

const COPY_CONCURRENCY = 4;
const INVENTORY_HEAD_CONCURRENCY = 8;
const DEFAULT_MAX_OBJECT_BYTES = 10 * 1024 * 1024;

export class CosMigrationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "CosMigrationError";
    this.details = details;
  }
}

export async function createCosMigrationInventory({
  client = prisma,
  sourceBucket,
  targetBucket,
  maxObjectBytes = DEFAULT_MAX_OBJECT_BYTES,
  supplementalManifest = null,
  storage = { headObject },
} = {}) {
  const buckets = assertMigrationBuckets(sourceBucket, targetBucket);
  if (!Number.isSafeInteger(maxObjectBytes) || maxObjectBytes < 1) {
    throw new CosMigrationError("maxObjectBytes must be a positive safe integer");
  }
  const generatedAt = new Date().toISOString();
  const databaseRecords = await loadMigrationDatabaseRecordsConsistently(client);
  const {
    media,
    users,
    cats,
    fixedPages,
    parentApplications,
    kittenProfiles,
    litters,
    selectionApplications,
  } = databaseRecords;
  const databaseSnapshotSha256 = calculateMigrationDatabaseSnapshotSha256(databaseRecords);
  const sourceOrigins = storageOrigins(buckets.source);
  const targetOrigins = storageOrigins(buckets.target);
  const sourceBaseUrls = storageBaseUrls(buckets.source);
  const targetBaseUrls = storageBaseUrls(buckets.target);
  const jsonReferences = [
    ...collectJsonReferences(media, "media_asset", "metadata_json", sourceBaseUrls),
    ...collectJsonReferences(cats, "cat", "story_json", sourceBaseUrls),
    ...collectJsonReferences(fixedPages, "fixed_page", "content_json", sourceBaseUrls),
    ...collectJsonReferences(
      parentApplications,
      "parent_application",
      "existing_cat_claims_json",
      sourceBaseUrls,
    ),
    ...collectJsonReferences(
      parentApplications,
      "parent_application",
      "new_cats_json",
      sourceBaseUrls,
    ),
    ...collectJsonReferences(
      kittenProfiles.map((record) => ({ ...record, id: record.cat_id, updated_at: null })),
      "kitten_profile",
      "structure_rating_json",
      sourceBaseUrls,
    ),
    ...collectJsonReferences(litters, "litter", "possible_colors_json", sourceBaseUrls),
    ...[
      "cat_experience_json",
      "existing_pets_json",
      "living_environment_json",
      "preferences_json",
      "commitments_json",
    ].flatMap((field) =>
      collectJsonReferences(selectionApplications, "selection_application", field, sourceBaseUrls),
    ),
  ];
  const userAvatarReferences = collectScalarReferences(users, "user", "avatar_url", sourceBaseUrls);
  const supplementalObjects = normalizeSupplementalObjectManifest(supplementalManifest);
  const referencedObjectKeys = [
    ...new Set(
      [
        ...media.flatMap((item) => {
          const upload = readUploadMetadata(item.metadata_json);
          return [
            safeObjectKey(upload?.objectKey) ?? inferObjectKey(item.source_url, sourceBaseUrls),
            inferObjectKey(item.thumbnail_url, sourceBaseUrls),
          ];
        }),
        ...jsonReferences.map((reference) => reference.objectKey),
        ...userAvatarReferences.map((reference) => reference.objectKey),
        ...supplementalObjects.map((object) => object.objectKey),
      ].filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
  const [sourceObjects, targetObjects] = await Promise.all([
    headReferencedObjects(storage, sourceBucket, referencedObjectKeys),
    headReferencedObjects(storage, targetBucket, referencedObjectKeys),
  ]);
  const sourceObjectMap = new Map(sourceObjects.map((object) => [object.objectKey, object]));
  const targetObjectMap = new Map(targetObjects.map((object) => [object.objectKey, object]));
  const unresolvedLegacyUrlReferences = collectUnresolvedLegacyUrlReferences({
    cats,
    fixedPages,
    kittenProfiles,
    litters,
    media,
    parentApplications,
    selectionApplications,
    sourceBaseUrls,
    users,
  });
  const externalUrlReferences = collectExternalUrlReferences({
    cats,
    fixedPages,
    kittenProfiles,
    litters,
    media,
    parentApplications,
    selectionApplications,
    sourceBaseUrls,
    targetBaseUrls,
    users,
  });
  const records = media.map((item) => {
    const upload = readUploadMetadata(item.metadata_json);
    const objectKey =
      safeObjectKey(upload?.objectKey) ?? inferObjectKey(item.source_url, sourceBaseUrls);
    const sourceListed = objectKey ? (sourceObjectMap.get(objectKey) ?? null) : null;
    const targetListed = objectKey ? (targetObjectMap.get(objectKey) ?? null) : null;
    const thumbnailObjectKey = inferObjectKey(item.thumbnail_url, sourceBaseUrls);
    const thumbnailSourceListed = thumbnailObjectKey
      ? (sourceObjectMap.get(thumbnailObjectKey) ?? null)
      : null;
    const thumbnailTargetListed = thumbnailObjectKey
      ? (targetObjectMap.get(thumbnailObjectKey) ?? null)
      : null;
    const sourceUrlObjectKey = inferObjectKey(item.source_url, sourceBaseUrls);
    const thumbnailUrlObjectKey = inferObjectKey(item.thumbnail_url, sourceBaseUrls);
    const sourceUrlReferencesOldBucket = Boolean(sourceUrlObjectKey);
    const thumbnailUrlReferencesOldBucket = Boolean(thumbnailUrlObjectKey);
    const declaredBucket = stringOrNull(upload?.bucket);
    return {
      id: item.id,
      status: item.status,
      deletedAt: toIsoString(item.deleted_at),
      updatedAt: toIsoString(item.updated_at),
      objectKey,
      declaredBucket,
      actualBucket: classifyActualBucket(sourceListed, targetListed, sourceBucket, targetBucket),
      sourceUrl: item.source_url,
      thumbnailUrl: item.thumbnail_url,
      thumbnailObjectKey,
      thumbnailSourceObject: thumbnailSourceListed,
      thumbnailTargetObject: thumbnailTargetListed,
      sizeBytes: item.size_bytes,
      mimeType: item.mime_type,
      checksum: item.checksum,
      checksumVerification: inventoryChecksumVerification(item.checksum, sourceListed?.etag),
      sourceObject: sourceListed,
      targetObject: targetListed,
      bindings: item.bindings.map((binding) => ({
        id: binding.id,
        ownerType: binding.owner_type,
        ownerId: binding.owner_id,
        usage: binding.usage,
        sortOrder: binding.sort_order,
        visibility: binding.visibility,
        deletedAt: toIsoString(binding.deleted_at),
      })),
      metadataJson: item.metadata_json,
      sourceUrlObjectKey,
      thumbnailUrlObjectKey,
      sourceUrlReferencesOldBucket,
      thumbnailUrlReferencesOldBucket,
      requiresMigration: Boolean(
        declaredBucket === sourceBucket ||
        sourceListed ||
        sourceUrlReferencesOldBucket ||
        thumbnailUrlReferencesOldBucket ||
        jsonReferences.some(
          (reference) => reference.model === "media_asset" && reference.id === item.id,
        ),
      ),
    };
  });

  const duplicateKeys = [
    ...groupBy(
      records.filter((record) => record.objectKey),
      "objectKey",
    ),
  ]
    .filter(([, items]) => items.length > 1)
    .map(([objectKey, items]) => ({ objectKey, mediaIds: items.map((item) => item.id) }));
  const duplicateKeyConflicts = duplicateKeys
    .map((duplicate) => {
      const items = records.filter((record) => duplicate.mediaIds.includes(record.id));
      const conflictingFields = ["checksum", "mimeType", "sizeBytes"].filter(
        (field) =>
          new Set(items.map((item) => item[field]).filter((value) => value != null)).size > 1,
      );
      return conflictingFields.length > 0 ? { ...duplicate, conflictingFields } : null;
    })
    .filter(Boolean);
  const supplementalObjectConflicts = buildSupplementalObjectConflicts(
    supplementalObjects,
    records,
    sourceObjectMap,
  );
  const inventory = {
    schemaVersion: 3,
    generatedAt,
    sourceBucket,
    targetBucket,
    sourceOrigins,
    targetOrigins,
    sourceBaseUrls,
    targetBaseUrls,
    cutoff: {
      mediaCreatedAt: maxIso(media.map((item) => item.created_at)),
      mediaUpdatedAt: maxIso(media.map((item) => item.updated_at)),
    },
    databaseSnapshotSha256,
    limits: {
      copyConcurrency: COPY_CONCURRENCY,
      inventoryHeadConcurrency: INVENTORY_HEAD_CONCURRENCY,
      maxObjectBytes,
    },
    coverage: {
      strategy: "database-and-supplemental-reference-head",
      bucketListingAttempted: false,
      bucketListingSupported: false,
      fullBucketCoverage: "unknown",
      orphanObjectCoverage: "unknown",
      note: "Only object keys discoverable from the database snapshot or the supplemental manifest are included; unreferenced source objects cannot be enumerated.",
    },
    records,
    recordsRequiringMigration: records
      .filter((record) => record.requiresMigration)
      .map((record) => record.id),
    duplicateKeys,
    duplicateKeyConflicts,
    supplementalObjectConflicts,
    missingSourceRecords: records
      .filter(
        (record) =>
          record.objectKey &&
          !isConfirmedObject(record.sourceObject) &&
          !isConfirmedObject(record.targetObject),
      )
      .map((record) => record.id),
    missingThumbnailSourceRecords: records
      .filter(
        (record) =>
          record.thumbnailObjectKey &&
          !isConfirmedObject(record.thumbnailSourceObject) &&
          !isConfirmedObject(record.thumbnailTargetObject),
      )
      .map((record) => record.id),
    recordsWithoutObjectKey: records
      .filter((record) => record.requiresMigration && !record.objectKey)
      .map((record) => record.id),
    orphanSourceObjects: null,
    discoveredObjectKeys: referencedObjectKeys,
    missingSourceObjectKeys: referencedObjectKeys.filter(
      (objectKey) => !sourceObjectMap.has(objectKey),
    ),
    missingReferencedObjectKeys: referencedObjectKeys.filter(
      (objectKey) => !sourceObjectMap.has(objectKey) && !targetObjectMap.has(objectKey),
    ),
    oversizedSourceObjectKeys: sourceObjects
      .filter(
        (object) => Number.isSafeInteger(object.sizeBytes) && object.sizeBytes > maxObjectBytes,
      )
      .map((object) => object.objectKey),
    sourceObjects,
    targetObjects,
    supplementalObjects,
    jsonReferences,
    userAvatarReferences,
    unresolvedLegacyUrlReferences,
    externalUrlReferences,
    statusGroups: {
      pending: records.filter((record) => record.status === "pending").map((record) => record.id),
      rejected: records.filter((record) => record.status === "rejected").map((record) => record.id),
      archived: records
        .filter((record) => record.status === "archived" || record.deletedAt)
        .map((record) => record.id),
    },
  };
  return { ...inventory, inventorySha256: calculateCosMigrationInventorySha256(inventory) };
}

export function calculateCosMigrationInventorySha256(inventory) {
  const payload = { ...(inventory ?? {}) };
  delete payload.inventorySha256;
  return sha256(stableJson(payload));
}

function normalizeSupplementalObjectManifest(manifest) {
  if (manifest == null) return [];
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.objects)) {
    throw new CosMigrationError("A valid supplemental object manifest is required");
  }
  const seen = new Set();
  return manifest.objects
    .map((item, index) => {
      const objectKey = safeObjectKey(item?.objectKey);
      if (!objectKey) {
        throw new CosMigrationError("Supplemental manifest contains an invalid object key", {
          index,
        });
      }
      if (seen.has(objectKey)) {
        throw new CosMigrationError("Supplemental manifest contains a duplicate object key", {
          objectKey,
        });
      }
      seen.add(objectKey);
      const sizeBytes = item.sizeBytes == null ? null : Number(item.sizeBytes);
      if (sizeBytes != null && (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0)) {
        throw new CosMigrationError("Supplemental manifest contains an invalid size", {
          objectKey,
        });
      }
      return {
        objectKey,
        sizeBytes,
        mimeType: stringOrNull(item.mimeType),
        checksum: stringOrNull(item.checksum),
        evidence: stringOrNull(item.evidence),
      };
    })
    .sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

function buildSupplementalObjectConflicts(supplementalObjects, records, sourceObjectMap) {
  return supplementalObjects
    .map((supplemental) => {
      const source = sourceObjectMap.get(supplemental.objectKey);
      const media = records.filter((record) => record.objectKey === supplemental.objectKey);
      const conflictingFields = [];
      if (
        supplemental.sizeBytes != null &&
        source?.sizeBytes != null &&
        supplemental.sizeBytes !== source.sizeBytes
      ) {
        conflictingFields.push("sourceSizeBytes");
      }
      if (
        supplemental.mimeType &&
        source?.contentType &&
        supplemental.mimeType.toLowerCase() !==
          source.contentType.split(";")[0].trim().toLowerCase()
      ) {
        conflictingFields.push("sourceMimeType");
      }
      for (const field of ["checksum", "mimeType", "sizeBytes"]) {
        const values = [supplemental[field], ...media.map((record) => record[field])]
          .filter((value) => value != null)
          .map((value) => (typeof value === "string" ? value.toLowerCase() : value));
        if (new Set(values).size > 1) conflictingFields.push(`media:${field}`);
      }
      return conflictingFields.length > 0
        ? {
            objectKey: supplemental.objectKey,
            mediaIds: media.map((record) => record.id),
            conflictingFields: [...new Set(conflictingFields)],
          }
        : null;
    })
    .filter(Boolean);
}

function collectUnresolvedLegacyUrlReferences(records) {
  const baseUrls = records.sourceBaseUrls;
  const sourceOrigins = new Set(baseUrls.map(originOf).filter(Boolean));
  return collectDatabaseStringReferences(records)
    .filter((reference) => {
      if (parseStorageObjectReference(reference.value, baseUrls)) return false;
      return extractHttpUrls(reference.value).some((value) => {
        try {
          return sourceOrigins.has(new URL(value).origin);
        } catch {
          return false;
        }
      });
    })
    .map((reference) => ({
      ...reference,
      reason: "contains-configured-legacy-origin-but-is-not-an-exact-object-url",
    }));
}

function extractHttpUrls(value) {
  if (typeof value !== "string") return [];
  return value.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
}

function collectExternalUrlReferences(records) {
  const knownBaseUrls = [...records.sourceBaseUrls, ...records.targetBaseUrls];
  return collectDatabaseStringReferences(records).filter((reference) => {
    try {
      const url = new URL(reference.value);
      if (!new Set(["http:", "https:"]).has(url.protocol)) return false;
      return !parseStorageObjectReference(reference.value, knownBaseUrls);
    } catch {
      return false;
    }
  });
}

function collectDatabaseStringReferences({
  cats,
  fixedPages,
  kittenProfiles,
  litters,
  media,
  parentApplications,
  selectionApplications,
  users,
}) {
  const references = [];
  const addScalar = (records, model, field) => {
    for (const record of records) {
      if (typeof record[field] !== "string") continue;
      references.push({ model, id: record.id, field, path: null, value: record[field] });
    }
  };
  const addJson = (records, model, field) => {
    for (const record of records) {
      walkJson(record[field], [], (path, value) => {
        references.push({ model, id: record.id, field, path, value });
      });
    }
  };
  addScalar(media, "media_asset", "source_url");
  addScalar(media, "media_asset", "thumbnail_url");
  addScalar(users, "user", "avatar_url");
  addJson(media, "media_asset", "metadata_json");
  addJson(cats, "cat", "story_json");
  addJson(fixedPages, "fixed_page", "content_json");
  addJson(parentApplications, "parent_application", "existing_cat_claims_json");
  addJson(parentApplications, "parent_application", "new_cats_json");
  addJson(
    kittenProfiles.map((record) => ({ ...record, id: record.cat_id })),
    "kitten_profile",
    "structure_rating_json",
  );
  addJson(litters, "litter", "possible_colors_json");
  for (const field of [
    "cat_experience_json",
    "existing_pets_json",
    "living_environment_json",
    "preferences_json",
    "commitments_json",
  ]) {
    addJson(selectionApplications, "selection_application", field);
  }
  return references;
}

async function loadMigrationDatabaseRecords(client) {
  const [
    media,
    users,
    cats,
    fixedPages,
    parentApplications,
    kittenProfiles,
    litters,
    selectionApplications,
  ] = await Promise.all([
    client.mediaAsset.findMany({
      include: { bindings: { orderBy: [{ sort_order: "asc" }, { id: "asc" }] } },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
    }),
    client.user.findMany({
      select: { avatar_url: true, id: true, updated_at: true },
      orderBy: { id: "asc" },
    }),
    client.cat.findMany({
      select: { id: true, story_json: true, updated_at: true },
      orderBy: { id: "asc" },
    }),
    client.fixedPage.findMany({
      select: { content_json: true, id: true, updated_at: true },
      orderBy: { id: "asc" },
    }),
    client.parentApplication.findMany({
      select: {
        existing_cat_claims_json: true,
        id: true,
        new_cats_json: true,
        updated_at: true,
      },
      orderBy: { id: "asc" },
    }),
    client.kittenProfile.findMany({
      select: { cat_id: true, structure_rating_json: true },
      orderBy: { cat_id: "asc" },
    }),
    client.litter.findMany({
      select: { id: true, possible_colors_json: true, updated_at: true },
      orderBy: { id: "asc" },
    }),
    client.selectionApplication.findMany({
      select: {
        cat_experience_json: true,
        commitments_json: true,
        existing_pets_json: true,
        id: true,
        living_environment_json: true,
        preferences_json: true,
        updated_at: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);
  return {
    media,
    users,
    cats,
    fixedPages,
    parentApplications,
    kittenProfiles,
    litters,
    selectionApplications,
  };
}

async function loadMigrationDatabaseRecordsConsistently(client) {
  if (typeof client.$transaction !== "function") return loadMigrationDatabaseRecords(client);
  return client.$transaction((transaction) => loadMigrationDatabaseRecords(transaction));
}

function calculateMigrationDatabaseSnapshotSha256(records) {
  return sha256(stableJson(normalizeMigrationDatabaseRecords(records)));
}

function normalizeMigrationDatabaseRecords(records) {
  return normalizeSnapshotValue({
    media: records.media,
    users: records.users,
    cats: records.cats,
    fixedPages: records.fixedPages,
    parentApplications: records.parentApplications,
    kittenProfiles: records.kittenProfiles,
    litters: records.litters,
    selectionApplications: records.selectionApplications,
  });
}

function normalizeSnapshotValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeSnapshotValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeSnapshotValue(item)]),
    );
  }
  return value;
}

function calculateNormalizedPlanDatabaseSnapshotSha256(records, plan) {
  const snapshot = normalizeMigrationDatabaseRecords(records);
  const mediaById = new Map(snapshot.media.map((record) => [record.id, record]));
  for (const update of plan.mediaUpdates) {
    const record = mediaById.get(update.id);
    if (!record) {
      throw new CosMigrationError("Migration media disappeared after inventory", {
        mediaId: update.id,
      });
    }
    const current = {
      metadataJson: record.metadata_json,
      sourceUrl: record.source_url,
      thumbnailUrl: record.thumbnail_url,
    };
    if (matchesStorageValues(current, update)) {
      record.metadata_json = update.previous.metadataJson;
      record.source_url = update.previous.sourceUrl;
      record.thumbnail_url = update.previous.thumbnailUrl;
      record.updated_at = update.expectedUpdatedAt;
    } else if (
      !matchesStorageValues(current, update.previous) ||
      record.updated_at !== update.expectedUpdatedAt
    ) {
      throw new CosMigrationError("Media changed after inventory; switch aborted", {
        mediaId: update.id,
      });
    }
  }

  const groupedJsonUpdates = groupJsonUpdates(plan.jsonUpdates);
  for (const update of groupedJsonUpdates) {
    const recordsForModel = update.model === "cat" ? snapshot.cats : snapshot.fixedPages;
    const record = recordsForModel.find((item) => item.id === update.id);
    if (!record) {
      throw new CosMigrationError("Migration JSON record disappeared after inventory", {
        id: update.id,
        model: update.model,
      });
    }
    if (jsonReferencesAlreadyApplied(record[update.field], update.references)) {
      record[update.field] = applyExactJsonReplacements(
        record[update.field],
        update.references.map((reference) => ({
          ...reference,
          value: reference.replacementValue,
          replacementValue: reference.value,
        })),
      );
      record.updated_at = update.expectedUpdatedAt;
    } else if (
      !jsonReferencesMatchOriginal(record[update.field], update.references) ||
      record.updated_at !== update.expectedUpdatedAt
    ) {
      throw new CosMigrationError("JSON document changed after inventory; switch aborted", {
        id: update.id,
        model: update.model,
      });
    }
  }

  const usersById = new Map(snapshot.users.map((record) => [record.id, record]));
  for (const update of plan.userUpdates ?? []) {
    const user = usersById.get(update.id);
    if (!user) {
      throw new CosMigrationError("Migration user disappeared after inventory", {
        userId: update.id,
      });
    }
    if (user.avatar_url === update.avatarUrl) {
      user.avatar_url = update.previousAvatarUrl;
      user.updated_at = update.expectedUpdatedAt;
    } else if (
      user.avatar_url !== update.previousAvatarUrl ||
      user.updated_at !== update.expectedUpdatedAt
    ) {
      throw new CosMigrationError("User avatar changed after inventory; switch aborted", {
        userId: update.id,
      });
    }
  }

  return sha256(stableJson(snapshot));
}

function matchesStorageValues(current, expected) {
  return (
    current?.sourceUrl === expected?.sourceUrl &&
    current?.thumbnailUrl === expected?.thumbnailUrl &&
    stableJson(current?.metadataJson) === stableJson(expected?.metadataJson)
  );
}

function jsonReferencesMatchOriginal(value, references) {
  return references.every((reference) => {
    let cursor = value;
    for (const part of reference.path) cursor = cursor?.[part];
    return cursor === reference.value;
  });
}

async function headReferencedObjects(storage, bucket, objectKeys) {
  const objects = await mapLimit(objectKeys, INVENTORY_HEAD_CONCURRENCY, async (objectKey) => {
    const metadata = await storage.headObject({ bucket, objectKey });
    if (!metadata?.exists) return null;
    return {
      objectKey,
      sizeBytes: metadata.contentLength ?? null,
      contentType: metadata.contentType ?? null,
      contentLength: metadata.contentLength ?? null,
      etag: metadata.etag ?? null,
      lastModified: metadata.lastModified ?? null,
      inventoryConsistency: "head-confirmed",
    };
  });
  return objects
    .filter(Boolean)
    .sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

export async function executeCosObjectCopies({
  inventory,
  apply = false,
  confirmObjectWrite = false,
  storage = { getObject, headObject, putObject },
} = {}) {
  assertInventory(inventory);
  if (apply && !confirmObjectWrite) {
    throw new CosMigrationError("Object writes require both apply and confirmObjectWrite");
  }

  const actions = buildCopyActions(inventory);
  if (!apply) {
    return {
      mode: "dry-run",
      inventorySha256: inventory.inventorySha256,
      sourceBucket: inventory.sourceBucket,
      targetBucket: inventory.targetBucket,
      actions,
      results: [],
    };
  }

  const results = await mapLimit(actions, COPY_CONCURRENCY, async (action) => {
    try {
      if (
        Number.isSafeInteger(action.sizeBytes) &&
        action.sizeBytes > inventory.limits.maxObjectBytes
      ) {
        return { ...action, status: "source-too-large" };
      }
      const source = await storage.getObject({
        bucket: inventory.sourceBucket,
        maxBytes: inventory.limits.maxObjectBytes,
        objectKey: action.objectKey,
      });
      if (!source.exists) return { ...action, status: "missing-source" };
      const body = Buffer.from(source.body);
      const sourceVerification = verifySourceObject(action, source, body);
      if (!sourceVerification.ok) {
        return { ...action, status: "source-changed", sourceVerification };
      }
      const checksumVerification = verifyChecksum(action.checksum, body, source.etag);
      if (checksumVerification.status === "mismatch") {
        return { ...action, status: "checksum-mismatch", checksumVerification };
      }
      const sourceContentSha256 = sha256(body);

      const existing = await storage.headObject({
        bucket: inventory.targetBucket,
        objectKey: action.objectKey,
      });
      if (existing.exists) {
        const verification = verifyObjectMetadata(action, existing);
        const byteVerification = verification.ok
          ? await verifyRemoteContent({
              bucket: inventory.targetBucket,
              expectedSha256: sourceContentSha256,
              maxBytes: inventory.limits.maxObjectBytes,
              objectKey: action.objectKey,
              storage,
            })
          : { algorithm: "sha256", status: "not-checked" };
        return {
          ...action,
          status:
            verification.ok && byteVerification.status === "match"
              ? "verified-existing"
              : "conflict",
          byteVerification,
          checksumVerification,
          sourceContentSha256,
          sourceVerification,
          verification,
        };
      }

      await storage.putObject({
        body,
        bucket: inventory.targetBucket,
        contentType: source.contentType || action.mimeType || "application/octet-stream",
        objectKey: action.objectKey,
      });
      const target = await storage.headObject({
        bucket: inventory.targetBucket,
        objectKey: action.objectKey,
      });
      const verification = verifyObjectMetadata(action, target);
      const byteVerification = verification.ok
        ? await verifyRemoteContent({
            bucket: inventory.targetBucket,
            expectedSha256: sourceContentSha256,
            maxBytes: inventory.limits.maxObjectBytes,
            objectKey: action.objectKey,
            storage,
          })
        : { algorithm: "sha256", status: "not-checked" };
      return {
        ...action,
        status:
          verification.ok && byteVerification.status === "match"
            ? "copied-and-verified"
            : "copy-verification-failed",
        byteVerification,
        checksumVerification,
        sourceContentSha256,
        sourceVerification,
        verification,
      };
    } catch (error) {
      return {
        ...action,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  return {
    mode: "apply",
    inventorySha256: inventory.inventorySha256,
    sourceBucket: inventory.sourceBucket,
    targetBucket: inventory.targetBucket,
    actions,
    results,
  };
}

export function buildStorageSwitchPlan({
  inventory,
  copyReport,
  exclusions = null,
  approvedExclusionsSha256 = "",
}) {
  assertInventory(inventory);
  if (copyReport?.inventorySha256 !== inventory.inventorySha256) {
    throw new CosMigrationError("Copy report does not belong to this inventory");
  }
  if (
    copyReport?.mode !== "apply" ||
    copyReport.sourceBucket !== inventory.sourceBucket ||
    copyReport.targetBucket !== inventory.targetBucket ||
    !Array.isArray(copyReport.results)
  ) {
    throw new CosMigrationError("A matching applied copy report is required for switch planning");
  }
  const duplicateCopyResultKeys = [...groupBy(copyReport.results, "objectKey")]
    .filter(([, results]) => results.length !== 1)
    .map(([objectKey]) => objectKey);
  if (duplicateCopyResultKeys.length > 0) {
    throw new CosMigrationError("Copy report contains duplicate object results", {
      objectKeys: duplicateCopyResultKeys,
    });
  }
  const expectedCopyKeys = new Set(buildCopyActions(inventory).map((action) => action.objectKey));
  const unexpectedCopyResultKeys = copyReport.results
    .map((result) => result.objectKey)
    .filter((objectKey) => !expectedCopyKeys.has(objectKey));
  if (unexpectedCopyResultKeys.length > 0) {
    throw new CosMigrationError("Copy report contains results outside the bound inventory", {
      objectKeys: unexpectedCopyResultKeys,
    });
  }
  const verifiedKeys = new Set(
    copyReport.results.filter(isByteVerifiedCopyResult).map((result) => result.objectKey),
  );
  const targetBaseUrl = inventory.targetBaseUrls?.[0] ?? inventory.targetOrigins[0];
  if (!targetBaseUrl) throw new CosMigrationError("Target bucket has no configured stable origin");
  const findings = buildSwitchIntegrityFindings({ inventory, copyReport, verifiedKeys });
  const approvedExclusions = resolveApprovedExclusions({
    approvedExclusionsSha256,
    exclusions,
    findings,
    inventory,
    inventorySha256: inventory.inventorySha256,
  });
  const approvedExclusionKeys = new Set(approvedExclusions.map((item) => item.key));
  const blockingFindings = findings.filter(
    (finding) => !approvedExclusionKeys.has(finding.exclusionKey),
  );
  if (blockingFindings.length > 0) {
    throw new CosMigrationError("Migration integrity findings block switch-plan generation", {
      findings: blockingFindings,
      exclusionManifestSchema: {
        schemaVersion: 1,
        inventorySha256: inventory.inventorySha256,
        exclusions: [
          {
            key: blockingFindings[0].exclusionKey,
            reason: "document why this data is intentionally excluded",
            approvalReference: "separate approval/change reference",
          },
        ],
      },
    });
  }

  const mediaUpdates = inventory.records
    .filter(
      (record) =>
        record.requiresMigration !== false && !approvedExclusionKeys.has(`media:${record.id}`),
    )
    .map((record) => {
      const metadataReferences = (inventory.jsonReferences ?? [])
        .filter(
          (reference) =>
            reference.model === "media_asset" &&
            reference.id === record.id &&
            !approvedExclusionKeys.has(referenceExclusionKey(reference)),
        )
        .map((reference) => ({
          ...reference,
          replacementValue: rewriteExactStorageObjectUrl(reference, targetBaseUrl),
        }));
      const rewrittenMetadata =
        metadataReferences.length > 0
          ? applyExactJsonReplacements(record.metadataJson, metadataReferences)
          : record.metadataJson;
      return {
        id: record.id,
        expectedUpdatedAt: record.updatedAt,
        objectKey: record.objectKey,
        previous: {
          metadataJson: record.metadataJson,
          sourceUrl: record.sourceUrl,
          thumbnailUrl: record.thumbnailUrl,
        },
        metadataJson: withUploadBucket(rewrittenMetadata, inventory.targetBucket),
        sourceUrl: rewriteStableObjectUrl(
          record.sourceUrl,
          record.objectKey,
          inventory.sourceBaseUrls ?? inventory.sourceOrigins,
          targetBaseUrl,
        ),
        thumbnailUrl: rewriteStableObjectUrl(
          record.thumbnailUrl,
          record.thumbnailObjectKey ?? record.objectKey,
          inventory.sourceBaseUrls ?? inventory.sourceOrigins,
          targetBaseUrl,
        ),
      };
    });
  const jsonUpdates = inventory.jsonReferences
    .filter(
      (reference) =>
        ["cat", "fixed_page"].includes(reference.model) &&
        !approvedExclusionKeys.has(referenceExclusionKey(reference)),
    )
    .map((reference) => ({
      ...reference,
      replacementValue: rewriteExactStorageObjectUrl(reference, targetBaseUrl),
    }));
  const userUpdates = (inventory.userAvatarReferences ?? [])
    .filter((reference) => !approvedExclusionKeys.has(referenceExclusionKey(reference)))
    .map((reference) => ({
      id: reference.id,
      expectedUpdatedAt: reference.expectedUpdatedAt,
      objectKey: reference.objectKey,
      previousAvatarUrl: reference.value,
      avatarUrl: rewriteExactStorageObjectUrl(reference, targetBaseUrl),
    }));
  const plan = {
    schemaVersion: 2,
    inventorySha256: inventory.inventorySha256,
    databaseSnapshotSha256: inventory.databaseSnapshotSha256,
    sourceBucket: inventory.sourceBucket,
    targetBucket: inventory.targetBucket,
    mediaUpdates,
    jsonUpdates,
    userUpdates,
    integrity: {
      sourceObjectCount: inventory.sourceObjects?.length ?? 0,
      coverage: inventory.coverage,
      migratingMediaCount: inventory.records.filter((record) => record.requiresMigration !== false)
        .length,
      duplicateKeys: inventory.duplicateKeys ?? [],
      orphanSourceObjectKeys: (inventory.orphanSourceObjects ?? []).map(
        (object) => object.objectKey,
      ),
      verifiedObjectKeys: [...verifiedKeys].sort(),
      findings,
      approvedExclusions,
      approvedExclusionsSha256: approvedExclusions.length ? approvedExclusionsSha256 : null,
    },
  };
  return { ...plan, switchPlanSha256: calculateStorageSwitchPlanSha256(plan) };
}

export function calculateStorageSwitchExclusionsSha256(exclusions) {
  return sha256(stableJson(normalizeExclusionManifest(exclusions)));
}

export function calculateStorageSwitchPlanSha256(plan) {
  const payload = { ...(plan ?? {}) };
  delete payload.switchPlanSha256;
  return sha256(stableJson(payload));
}

function buildSwitchIntegrityFindings({ inventory, copyReport, verifiedKeys }) {
  const findings = new Map();
  const copyResults = new Map(copyReport.results.map((result) => [result.objectKey, result]));
  const add = (finding) => {
    const key = [finding.code, finding.exclusionKey, finding.objectKey ?? ""].join("|");
    findings.set(key, finding);
  };

  for (const object of inventory.sourceObjects ?? []) {
    if ((inventory.oversizedSourceObjectKeys ?? []).includes(object.objectKey)) {
      add({
        code: "source-object-exceeds-read-limit",
        exclusionKey: `source-object:${object.objectKey}`,
        objectKey: object.objectKey,
        maxObjectBytes: inventory.limits.maxObjectBytes,
        sizeBytes: object.sizeBytes,
      });
      continue;
    }
    if (verifiedKeys.has(object.objectKey)) continue;
    const result = copyResults.get(object.objectKey);
    add({
      code: "source-object-not-byte-verified",
      exclusionKey: `source-object:${object.objectKey}`,
      objectKey: object.objectKey,
      copyStatus: result?.status ?? "not-processed",
      byteVerificationStatus: result?.byteVerification?.status ?? "not-checked",
    });
  }

  for (const record of inventory.records) {
    if (record.requiresMigration === false) continue;
    const exclusionKey = `media:${record.id}`;
    if (!record.objectKey) {
      add({ code: "media-object-key-missing", exclusionKey, mediaId: record.id });
    } else if (
      record.sourceUrlReferencesOldBucket &&
      record.sourceUrlObjectKey !== record.objectKey
    ) {
      add({
        code: "media-source-url-object-key-mismatch",
        exclusionKey,
        mediaId: record.id,
        objectKey: record.objectKey,
        sourceUrlObjectKey: record.sourceUrlObjectKey,
      });
    } else if (!isConfirmedObject(record.sourceObject)) {
      add({
        code: "media-source-object-missing",
        exclusionKey,
        mediaId: record.id,
        objectKey: record.objectKey,
      });
    } else if (!verifiedKeys.has(record.objectKey)) {
      const result = copyResults.get(record.objectKey);
      add({
        code: "media-object-not-byte-verified",
        exclusionKey,
        mediaId: record.id,
        objectKey: record.objectKey,
        copyStatus: result?.status ?? "not-processed",
        byteVerificationStatus: result?.byteVerification?.status ?? "not-checked",
      });
    }
    if (record.thumbnailUrlReferencesOldBucket && !record.thumbnailObjectKey) {
      add({ code: "thumbnail-object-key-missing", exclusionKey, mediaId: record.id });
    } else if (record.thumbnailObjectKey) {
      if (!isConfirmedObject(record.thumbnailSourceObject)) {
        add({
          code: "thumbnail-source-object-missing",
          exclusionKey,
          mediaId: record.id,
          objectKey: record.thumbnailObjectKey,
        });
      } else if (!verifiedKeys.has(record.thumbnailObjectKey)) {
        const result = copyResults.get(record.thumbnailObjectKey);
        add({
          code: "thumbnail-not-byte-verified",
          exclusionKey,
          mediaId: record.id,
          objectKey: record.thumbnailObjectKey,
          copyStatus: result?.status ?? "not-processed",
          byteVerificationStatus: result?.byteVerification?.status ?? "not-checked",
        });
      }
    }
  }

  for (const conflict of inventory.duplicateKeyConflicts ?? []) {
    for (const mediaId of conflict.mediaIds) {
      add({
        code: "duplicate-key-metadata-conflict",
        exclusionKey: `media:${mediaId}`,
        objectKey: conflict.objectKey,
        mediaId,
        mediaIds: conflict.mediaIds,
        conflictingFields: conflict.conflictingFields,
      });
    }
  }
  for (const conflict of inventory.supplementalObjectConflicts ?? []) {
    add({
      code: "supplemental-object-metadata-conflict",
      exclusionKey: `supplemental-object:${conflict.objectKey}`,
      objectKey: conflict.objectKey,
      mediaIds: conflict.mediaIds,
      conflictingFields: conflict.conflictingFields,
    });
  }

  for (const reference of inventory.jsonReferences ?? []) {
    addReferenceFinding({ add, inventory, reference, verifiedKeys });
  }
  for (const reference of inventory.userAvatarReferences ?? []) {
    addReferenceFinding({ add, inventory, reference, verifiedKeys });
  }
  for (const reference of inventory.unresolvedLegacyUrlReferences ?? []) {
    add({
      code: "legacy-url-reference-unresolved",
      exclusionKey: unresolvedReferenceExclusionKey(reference),
      reference,
    });
  }
  for (const reference of inventory.externalUrlReferences ?? []) {
    add({
      code: "external-url-reference-requires-review",
      exclusionKey: externalReferenceExclusionKey(reference),
      reference,
    });
  }
  for (const object of inventory.supplementalObjects ?? []) {
    if ((inventory.sourceObjects ?? []).some((item) => item.objectKey === object.objectKey))
      continue;
    add({
      code: "supplemental-source-object-missing",
      exclusionKey: `supplemental-object:${object.objectKey}`,
      objectKey: object.objectKey,
    });
  }
  return [...findings.values()].sort((left, right) =>
    `${left.exclusionKey}:${left.code}`.localeCompare(`${right.exclusionKey}:${right.code}`),
  );
}

function addReferenceFinding({ add, inventory, reference, verifiedKeys }) {
  const exclusionKey = referenceExclusionKey(reference);
  const supported = ["cat", "fixed_page", "media_asset", "user"].includes(reference.model);
  if (!supported) {
    add({
      code: "reference-has-no-automatic-switch-path",
      exclusionKey,
      reference,
    });
    return;
  }
  const parsed = parseStorageObjectReference(
    reference.value,
    inventory.sourceBaseUrls ?? inventory.sourceOrigins,
  );
  if (!parsed || parsed.objectKey !== reference.objectKey) {
    add({ code: "reference-is-not-safely-resolvable", exclusionKey, reference });
  } else if (!verifiedKeys.has(parsed.objectKey)) {
    add({
      code: "reference-object-not-byte-verified",
      exclusionKey,
      objectKey: parsed.objectKey,
      reference,
    });
  }
}

function resolveApprovedExclusions({
  approvedExclusionsSha256,
  exclusions,
  findings,
  inventory,
  inventorySha256,
}) {
  if (!exclusions) {
    if (approvedExclusionsSha256) {
      throw new CosMigrationError("An exclusion approval hash was provided without a manifest");
    }
    return [];
  }
  const normalized = normalizeExclusionManifest(exclusions);
  if (normalized.inventorySha256 !== inventorySha256) {
    throw new CosMigrationError("Exclusion manifest does not belong to this inventory");
  }
  const calculatedSha256 = sha256(stableJson(normalized));
  if (approvedExclusionsSha256 !== calculatedSha256) {
    throw new CosMigrationError(
      "Exclusions require a separate approval using the exact manifest SHA-256",
      { calculatedExclusionsSha256: calculatedSha256 },
    );
  }
  const validKeys = new Set([
    ...findings.map((finding) => finding.exclusionKey),
    ...inventory.records
      .filter((record) => record.requiresMigration !== false)
      .map((record) => `media:${record.id}`),
    ...(inventory.sourceObjects ?? []).map((object) => `source-object:${object.objectKey}`),
    ...(inventory.jsonReferences ?? []).map(referenceExclusionKey),
    ...(inventory.userAvatarReferences ?? []).map(referenceExclusionKey),
    ...(inventory.unresolvedLegacyUrlReferences ?? []).map(unresolvedReferenceExclusionKey),
    ...(inventory.externalUrlReferences ?? []).map(externalReferenceExclusionKey),
    ...(inventory.supplementalObjects ?? []).map(
      (object) => `supplemental-object:${object.objectKey}`,
    ),
  ]);
  const unknownKeys = normalized.exclusions
    .map((item) => item.key)
    .filter((key) => !validKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new CosMigrationError("Exclusion manifest contains unknown subjects", {
      keys: unknownKeys,
    });
  }
  return normalized.exclusions;
}

function normalizeExclusionManifest(value) {
  if (value?.schemaVersion !== 1 || !value.inventorySha256 || !Array.isArray(value.exclusions)) {
    throw new CosMigrationError("A valid storage-switch exclusion manifest is required");
  }
  const seen = new Set();
  const exclusions = value.exclusions.map((item) => {
    const key = stringOrNull(item?.key);
    const reason = stringOrNull(item?.reason);
    const approvalReference = stringOrNull(item?.approvalReference);
    if (!key || !reason || !approvalReference) {
      throw new CosMigrationError("Every exclusion requires key, reason, and approvalReference");
    }
    if (seen.has(key)) throw new CosMigrationError(`Duplicate exclusion subject: ${key}`);
    seen.add(key);
    return { key, reason, approvalReference };
  });
  exclusions.sort((left, right) => left.key.localeCompare(right.key));
  return {
    schemaVersion: 1,
    inventorySha256: value.inventorySha256,
    exclusions,
  };
}

function referenceExclusionKey(reference) {
  return `reference:${reference.model}:${reference.id}:${reference.field}:${JSON.stringify(reference.path ?? [])}`;
}

function unresolvedReferenceExclusionKey(reference) {
  return `unresolved-reference:${reference.model}:${reference.id}:${reference.field}:${JSON.stringify(reference.path ?? [])}`;
}

function externalReferenceExclusionKey(reference) {
  return `external-reference:${reference.model}:${reference.id}:${reference.field}:${JSON.stringify(reference.path ?? [])}`;
}

export function buildStorageRollbackPlan({ switchPlan, switchReport }) {
  assertSwitchPlan(switchPlan);
  if (
    !switchPlan?.switchPlanSha256 ||
    switchReport?.switchPlanSha256 !== switchPlan.switchPlanSha256 ||
    switchReport?.mode !== "apply" ||
    !/^[a-f0-9]{64}$/.test(switchReport?.postSwitchDatabaseSnapshotSha256 ?? "") ||
    !Array.isArray(switchReport.mediaStates) ||
    !Array.isArray(switchReport.jsonStates) ||
    !Array.isArray(switchReport.userStates)
  ) {
    throw new CosMigrationError("A matching applied switch report is required for rollback");
  }
  const mediaStates = new Map(switchReport.mediaStates.map((state) => [state.id, state]));
  const jsonStates = new Map(
    switchReport.jsonStates.map((state) => [`${state.model}:${state.id}:${state.field}`, state]),
  );
  const userStates = new Map((switchReport.userStates ?? []).map((state) => [state.id, state]));
  const mediaUpdates = switchPlan.mediaUpdates.map((update) => {
    const state = mediaStates.get(update.id);
    if (!state || !update.previous) {
      throw new CosMigrationError("Switch report is missing a rollback media state", {
        mediaId: update.id,
      });
    }
    return {
      id: update.id,
      expectedUpdatedAt: state.updatedAt,
      objectKey: update.objectKey,
      previous: {
        metadataJson: update.metadataJson,
        sourceUrl: update.sourceUrl,
        thumbnailUrl: update.thumbnailUrl,
      },
      metadataJson: update.previous.metadataJson,
      sourceUrl: update.previous.sourceUrl,
      thumbnailUrl: update.previous.thumbnailUrl,
    };
  });
  const jsonUpdates = switchPlan.jsonUpdates.map((update) => {
    const state = jsonStates.get(`${update.model}:${update.id}:${update.field}`);
    if (!state) {
      throw new CosMigrationError("Switch report is missing a rollback JSON state", {
        id: update.id,
        model: update.model,
      });
    }
    return {
      ...update,
      expectedUpdatedAt: state.updatedAt,
      value: update.replacementValue,
      replacementValue: update.value,
    };
  });
  const userUpdates = (switchPlan.userUpdates ?? []).map((update) => {
    const state = userStates.get(update.id);
    if (!state) {
      throw new CosMigrationError("Switch report is missing a rollback user state", {
        userId: update.id,
      });
    }
    return {
      id: update.id,
      expectedUpdatedAt: state.updatedAt,
      objectKey: update.objectKey,
      previousAvatarUrl: update.avatarUrl,
      avatarUrl: update.previousAvatarUrl,
    };
  });
  const plan = {
    schemaVersion: 2,
    inventorySha256: switchPlan.inventorySha256,
    databaseSnapshotSha256: switchReport.postSwitchDatabaseSnapshotSha256,
    sourceBucket: switchPlan.targetBucket,
    targetBucket: switchPlan.sourceBucket,
    mediaUpdates,
    jsonUpdates,
    userUpdates,
    rollbackOf: switchPlan.switchPlanSha256,
  };
  return { ...plan, switchPlanSha256: calculateStorageSwitchPlanSha256(plan) };
}

export async function applyStorageSwitchPlan({
  client = prisma,
  plan,
  apply = false,
  backupEvidence = null,
  confirmDatabaseWrite = false,
} = {}) {
  assertSwitchPlan(plan);
  if (!apply) {
    return {
      mode: "dry-run",
      switchPlanSha256: plan.switchPlanSha256,
      mediaUpdateCount: plan.mediaUpdates.length,
      jsonUpdateCount: plan.jsonUpdates.length,
      userUpdateCount: plan.userUpdates?.length ?? 0,
    };
  }
  if (!confirmDatabaseWrite) {
    throw new CosMigrationError("Database writes require both apply and confirmDatabaseWrite");
  }
  if (
    backupEvidence?.status !== "verified" ||
    !/^[a-f0-9]{64}$/.test(backupEvidence.backupSha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(backupEvidence.databaseUrlSha256 ?? "")
  ) {
    throw new CosMigrationError("Database writes require verified SQLite backup evidence");
  }

  return client.$transaction(async (transaction) => {
    const mediaStates = [];
    for (const update of plan.mediaUpdates) {
      const result = await transaction.mediaAsset.updateMany({
        where: { id: update.id, updated_at: new Date(update.expectedUpdatedAt) },
        data: {
          metadata_json: update.metadataJson,
          source_url: update.sourceUrl,
          thumbnail_url: update.thumbnailUrl,
        },
      });
      if (result.count !== 1) {
        const current = await transaction.mediaAsset.findUnique({ where: { id: update.id } });
        if (!matchesMediaUpdate(current, update)) {
          throw new CosMigrationError("Media changed after inventory; switch aborted", {
            mediaId: update.id,
          });
        }
      }
      const current = await transaction.mediaAsset.findUnique({ where: { id: update.id } });
      mediaStates.push({ id: update.id, updatedAt: toIsoString(current.updated_at) });
    }

    const groupedJsonUpdates = groupJsonUpdates(plan.jsonUpdates);
    const jsonStates = [];
    for (const update of groupedJsonUpdates) {
      const model = update.model === "cat" ? transaction.cat : transaction.fixedPage;
      const record = await model.findUnique({ where: { id: update.id } });
      if (record && jsonReferencesAlreadyApplied(record[update.field], update.references)) {
        jsonStates.push({
          field: update.field,
          id: update.id,
          model: update.model,
          updatedAt: toIsoString(record.updated_at),
        });
        continue;
      }
      if (!record || toIsoString(record.updated_at) !== update.expectedUpdatedAt) {
        throw new CosMigrationError("JSON document changed after inventory; switch aborted", {
          id: update.id,
          model: update.model,
        });
      }
      const current = record[update.field];
      const next = applyExactJsonReplacements(current, update.references);
      const updated = await model.update({
        where: { id: update.id },
        data: { [update.field]: next },
      });
      jsonStates.push({
        field: update.field,
        id: update.id,
        model: update.model,
        updatedAt: toIsoString(updated.updated_at),
      });
    }

    const userStates = [];
    for (const update of plan.userUpdates ?? []) {
      const result = await transaction.user.updateMany({
        where: { id: update.id, updated_at: new Date(update.expectedUpdatedAt) },
        data: { avatar_url: update.avatarUrl },
      });
      if (result.count !== 1) {
        const current = await transaction.user.findUnique({ where: { id: update.id } });
        if (!matchesUserUpdate(current, update)) {
          throw new CosMigrationError("User avatar changed after inventory; switch aborted", {
            userId: update.id,
          });
        }
      }
      const current = await transaction.user.findUnique({ where: { id: update.id } });
      userStates.push({ id: update.id, updatedAt: toIsoString(current.updated_at) });
    }

    const postSwitchDatabaseRecords = await loadMigrationDatabaseRecords(transaction);
    const normalizedSnapshotSha256 = calculateNormalizedPlanDatabaseSnapshotSha256(
      postSwitchDatabaseRecords,
      plan,
    );
    if (!plan.rollbackOf && normalizedSnapshotSha256 !== plan.databaseSnapshotSha256) {
      throw new CosMigrationError(
        "Migration-relevant database state changed after inventory; switch aborted",
        {
          actualSha256: normalizedSnapshotSha256,
          expectedSha256: plan.databaseSnapshotSha256,
        },
      );
    }
    const postSwitchDatabaseSnapshotSha256 =
      calculateMigrationDatabaseSnapshotSha256(postSwitchDatabaseRecords);
    return {
      mode: "apply",
      switchPlanSha256: plan.switchPlanSha256,
      mediaUpdateCount: plan.mediaUpdates.length,
      jsonUpdateCount: plan.jsonUpdates.length,
      userUpdateCount: plan.userUpdates?.length ?? 0,
      mediaStates,
      jsonStates,
      userStates,
      postSwitchDatabaseSnapshotSha256,
      backupEvidence,
    };
  });
}

function assertMigrationBuckets(sourceBucket, targetBucket) {
  if (!sourceBucket || !targetBucket || sourceBucket === targetBucket) {
    throw new CosMigrationError("Distinct source and target buckets are required");
  }
  const allowed = new Map(getAllowedStorageBuckets().map((bucket) => [bucket.bucket, bucket]));
  if (!allowed.has(sourceBucket) || !allowed.has(targetBucket)) {
    throw new CosMigrationError("Both migration buckets must be in the server allowlist", {
      allowedBuckets: [...allowed.keys()],
    });
  }
  return { source: allowed.get(sourceBucket), target: allowed.get(targetBucket) };
}

function buildCopyActions(inventory) {
  const actions = new Map();
  for (const object of inventory.sourceObjects ?? []) {
    addCopyAction(actions, {
      checksum: null,
      mediaId: null,
      mimeType: object.contentType ?? null,
      object,
      objectKey: object.objectKey,
      sizeBytes: object.sizeBytes,
    });
  }
  for (const object of inventory.supplementalObjects ?? []) {
    addCopyAction(actions, {
      checksum: object.checksum,
      mediaId: null,
      mimeType: object.mimeType,
      object: (inventory.sourceObjects ?? []).find(
        (sourceObject) => sourceObject.objectKey === object.objectKey,
      ),
      objectKey: object.objectKey,
      sizeBytes: object.sizeBytes,
    });
  }
  for (const record of inventory.records) {
    addCopyAction(actions, {
      checksum: record.checksum,
      mediaId: record.id,
      mimeType: record.mimeType,
      object: record.sourceObject,
      objectKey: record.objectKey,
      sizeBytes: record.sizeBytes,
    });
    addCopyAction(actions, {
      checksum: null,
      mediaId: record.id,
      mimeType: null,
      object: record.thumbnailSourceObject,
      objectKey: record.thumbnailObjectKey,
      sizeBytes: record.thumbnailSourceObject?.sizeBytes,
    });
  }
  return [...actions.values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey));
}

function addCopyAction(actions, { checksum, mediaId, mimeType, object, objectKey, sizeBytes }) {
  if (!objectKey || !isConfirmedObject(object)) return;
  const existing = actions.get(objectKey);
  actions.set(objectKey, {
    objectKey,
    mediaIds: [...new Set([...(existing?.mediaIds ?? []), mediaId].filter(Boolean))],
    sizeBytes: existing?.sizeBytes ?? object.sizeBytes ?? sizeBytes,
    mimeType: existing?.mimeType ?? object.contentType ?? mimeType,
    checksum: existing?.checksum ?? checksum,
    sourceEtag: existing?.sourceEtag ?? object.etag ?? null,
  });
}

function verifySourceObject(action, source, body) {
  if (Number.isSafeInteger(action.sizeBytes) && body.length !== action.sizeBytes) {
    return { ok: false, reason: "size-changed" };
  }
  if (action.mimeType) {
    if (!source.contentType) return { ok: false, reason: "mime-unavailable" };
    const actual = source.contentType.split(";")[0].trim().toLowerCase();
    if (actual !== action.mimeType.toLowerCase()) return { ok: false, reason: "mime-changed" };
  }
  const expectedEtag = stringOrNull(action.sourceEtag)?.replaceAll('"', "");
  const actualEtag = stringOrNull(source.etag)?.replaceAll('"', "");
  if (expectedEtag && actualEtag && expectedEtag !== actualEtag) {
    return { ok: false, reason: "etag-changed" };
  }
  return { ok: true, reason: "inventory-source-match" };
}

function verifyObjectMetadata(action, metadata) {
  if (!metadata?.exists) return { ok: false, reason: "missing" };
  if (Number.isSafeInteger(action.sizeBytes)) {
    if (!Number.isSafeInteger(metadata.contentLength)) {
      return { ok: false, reason: "size-unavailable" };
    }
    if (action.sizeBytes !== metadata.contentLength) {
      return { ok: false, reason: "size-mismatch" };
    }
  }
  if (action.mimeType) {
    if (!metadata.contentType) return { ok: false, reason: "mime-unavailable" };
    const actual = metadata.contentType.split(";")[0].trim().toLowerCase();
    if (actual !== action.mimeType.toLowerCase()) return { ok: false, reason: "mime-mismatch" };
  }
  return { ok: true, reason: "size-and-mime-match" };
}

function verifyChecksum(checksum, body, etag) {
  const normalized = stringOrNull(checksum)?.toLowerCase();
  if (!normalized) return { status: "unavailable" };
  const sha256Value = normalized.replace(/^sha256:/, "");
  if (/^[a-f0-9]{64}$/.test(sha256Value)) {
    const actual = sha256(body);
    return {
      algorithm: "sha256",
      actual,
      expected: sha256Value,
      status: actual === sha256Value ? "match" : "mismatch",
    };
  }
  const md5Value = normalized.replace(/^md5:/, "");
  if (/^[a-f0-9]{32}$/.test(md5Value)) {
    const actual = crypto.createHash("md5").update(body).digest("hex");
    return {
      algorithm: "md5",
      actual,
      expected: md5Value,
      status: actual === md5Value ? "match" : "mismatch",
    };
  }
  const normalizedEtag = stringOrNull(etag)?.replaceAll('"', "").toLowerCase();
  return normalizedEtag === normalized
    ? { algorithm: "etag", actual: normalizedEtag, expected: normalized, status: "match" }
    : { status: "unsupported-format" };
}

async function verifyRemoteContent({ bucket, expectedSha256, maxBytes, objectKey, storage }) {
  const object = await storage.getObject({ bucket, maxBytes, objectKey });
  if (!object.exists) {
    return {
      algorithm: "sha256",
      expected: expectedSha256,
      status: "unavailable",
      reason: "missing-after-head",
    };
  }
  const actual = sha256(Buffer.from(object.body));
  return {
    algorithm: "sha256",
    actual,
    expected: expectedSha256,
    status: actual === expectedSha256 ? "match" : "mismatch",
  };
}

function inventoryChecksumVerification(checksum, etag) {
  const expected = stringOrNull(checksum)?.toLowerCase().replace(/^md5:/, "");
  const actual = stringOrNull(etag)?.toLowerCase().replaceAll('"', "");
  if (!expected) return { status: "unavailable" };
  if (/^[a-f0-9]{32}$/.test(expected) && actual && !actual.includes("-")) {
    return {
      algorithm: "md5-etag",
      actual,
      expected,
      status: actual === expected ? "match" : "mismatch",
    };
  }
  return { status: "requires-body-verification" };
}

function collectJsonReferences(records, model, field, sourceBaseUrls) {
  const references = [];
  for (const record of records) {
    walkJson(record[field], [], (path, value) => {
      const parsed = parseStorageObjectReference(value, sourceBaseUrls);
      if (parsed) {
        references.push({
          model,
          id: record.id,
          field,
          path,
          value,
          objectKey: parsed.objectKey,
          expectedUpdatedAt: toIsoString(record.updated_at),
          switchHandling: ["cat", "fixed_page"].includes(model)
            ? "exact-path-update"
            : model === "media_asset"
              ? "media-metadata-update"
              : "manual-review",
        });
      }
    });
  }
  return references;
}

function collectScalarReferences(records, model, field, sourceBaseUrls) {
  return records
    .map((record) => {
      const parsed = parseStorageObjectReference(record[field], sourceBaseUrls);
      if (!parsed) return null;
      return {
        model,
        id: record.id,
        field,
        value: record[field],
        objectKey: parsed.objectKey,
        expectedUpdatedAt: toIsoString(record.updated_at),
        switchHandling: "scalar-update",
      };
    })
    .filter(Boolean);
}

function walkJson(value, path, visit) {
  if (typeof value === "string") return visit(path, value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, [...path, index], visit));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walkJson(item, [...path, key], visit));
  }
}

function groupJsonUpdates(references) {
  const grouped = new Map();
  for (const reference of references) {
    const key = `${reference.model}:${reference.id}:${reference.field}`;
    const group = grouped.get(key) ?? {
      model: reference.model,
      id: reference.id,
      field: reference.field,
      expectedUpdatedAt: reference.expectedUpdatedAt,
      references: [],
    };
    group.references.push(reference);
    grouped.set(key, group);
  }
  return [...grouped.values()];
}

function applyExactJsonReplacements(value, references) {
  const clone = structuredClone(value);
  for (const reference of references) {
    let cursor = clone;
    for (let index = 0; index < reference.path.length - 1; index += 1) {
      cursor = cursor?.[reference.path[index]];
    }
    const key = reference.path.at(-1);
    if (key == null || cursor?.[key] !== reference.value) {
      throw new CosMigrationError("JSON reference changed after inventory", {
        id: reference.id,
        path: reference.path,
      });
    }
    cursor[key] = reference.replacementValue;
  }
  return clone;
}

function jsonReferencesAlreadyApplied(value, references) {
  return references.every((reference) => {
    let cursor = value;
    for (const part of reference.path) cursor = cursor?.[part];
    return cursor === reference.replacementValue;
  });
}

function matchesMediaUpdate(media, update) {
  return (
    media &&
    media.source_url === update.sourceUrl &&
    media.thumbnail_url === update.thumbnailUrl &&
    stableJson(media.metadata_json) === stableJson(update.metadataJson)
  );
}

function matchesUserUpdate(user, update) {
  return user && user.avatar_url === update.avatarUrl;
}

function withUploadBucket(value, bucket) {
  const metadata =
    value && typeof value === "object" && !Array.isArray(value) ? structuredClone(value) : {};
  const upload =
    metadata.upload && typeof metadata.upload === "object" && !Array.isArray(metadata.upload)
      ? metadata.upload
      : {};
  metadata.upload = { ...upload, bucket };
  return metadata;
}

function rewriteStableObjectUrl(value, objectKey, sourceBaseUrls, targetBaseUrl) {
  try {
    const sourceUrl = new URL(value);
    const parsed = parseStorageObjectReference(value, sourceBaseUrls);
    if (!parsed || parsed.objectKey !== objectKey) return value;
    const targetUrl = new URL(targetBaseUrl);
    targetUrl.pathname = [
      targetUrl.pathname.replace(/^\/+|\/+$/g, ""),
      objectKey
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/"),
    ]
      .filter(Boolean)
      .join("/");
    targetUrl.search = sourceUrl.search;
    targetUrl.hash = sourceUrl.hash;
    return targetUrl.toString();
  } catch {
    return value;
  }
}

function rewriteExactStorageObjectUrl(reference, targetBaseUrl) {
  const targetUrl = new URL(targetBaseUrl);
  const sourceUrl = new URL(reference.value);
  targetUrl.pathname = [
    targetUrl.pathname.replace(/^\/+|\/+$/g, ""),
    reference.objectKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/"),
  ]
    .filter(Boolean)
    .join("/");
  targetUrl.search = sourceUrl.search;
  targetUrl.hash = sourceUrl.hash;
  return targetUrl.toString();
}

function storageOrigins(storage) {
  return [...new Set([storage.endpoint, storage.publicBaseUrl].map(originOf).filter(Boolean))];
}

function storageBaseUrls(storage) {
  return [
    ...new Set(
      [storage.publicBaseUrl, storage.endpoint, ...(storage.historicalBaseUrls ?? [])]
        .map(normalizeBaseUrl)
        .filter(Boolean),
    ),
  ];
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function inferObjectKey(value, baseUrls) {
  return parseStorageObjectReference(value, baseUrls)?.objectKey ?? null;
}

function parseStorageObjectReference(value, baseUrls) {
  if (typeof value !== "string") return null;
  try {
    const sourceUrl = new URL(value);
    for (const baseUrlValue of baseUrls) {
      const baseUrl = new URL(baseUrlValue);
      if (baseUrl.origin !== sourceUrl.origin) continue;
      const basePath = decodeURIComponent(baseUrl.pathname).replace(/^\/+|\/+$/g, "");
      const sourcePath = decodeURIComponent(sourceUrl.pathname).replace(/^\/+/, "");
      if (basePath && !sourcePath.startsWith(`${basePath}/`)) continue;
      const objectKey = safeObjectKey(
        basePath ? sourcePath.slice(basePath.length + 1) : sourcePath,
      );
      if (!objectKey) return null;
      return { objectKey };
    }
    return null;
  } catch {
    return null;
  }
}

function isByteVerifiedCopyResult(result) {
  return (
    ["copied-and-verified", "verified-existing"].includes(result?.status) &&
    result.sourceVerification?.ok === true &&
    result.checksumVerification?.status !== "mismatch" &&
    result.byteVerification?.algorithm === "sha256" &&
    result.byteVerification.status === "match" &&
    /^[a-f0-9]{64}$/.test(result.byteVerification.actual ?? "") &&
    result.byteVerification.actual === result.byteVerification.expected &&
    result.byteVerification.actual === result.sourceContentSha256
  );
}

function readUploadMetadata(value) {
  return value?.upload && typeof value.upload === "object" && !Array.isArray(value.upload)
    ? value.upload
    : null;
}

function safeObjectKey(value) {
  const normalized = stringOrNull(value);
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("\0") ||
    normalized.includes("\\") ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }
  return normalized;
}

function classifyActualBucket(sourceObject, targetObject, sourceBucket, targetBucket) {
  const sourceExists = isConfirmedObject(sourceObject);
  const targetExists = isConfirmedObject(targetObject);
  if (sourceExists && targetExists) return `${sourceBucket}+${targetBucket}`;
  if (sourceExists) return sourceBucket;
  if (targetExists) return targetBucket;
  return null;
}

function isConfirmedObject(object) {
  return Boolean(object) && object.inventoryConsistency !== "listed-but-head-missing";
}

function assertInventory(inventory) {
  if (
    inventory?.schemaVersion !== 3 ||
    !inventory.inventorySha256 ||
    !/^[a-f0-9]{64}$/.test(inventory.databaseSnapshotSha256 ?? "") ||
    !Array.isArray(inventory.records) ||
    !Array.isArray(inventory.sourceObjects) ||
    !Array.isArray(inventory.discoveredObjectKeys) ||
    !Array.isArray(inventory.jsonReferences) ||
    !Array.isArray(inventory.userAvatarReferences) ||
    !Array.isArray(inventory.unresolvedLegacyUrlReferences) ||
    !Array.isArray(inventory.externalUrlReferences) ||
    !Array.isArray(inventory.supplementalObjects) ||
    !Array.isArray(inventory.supplementalObjectConflicts) ||
    inventory.coverage?.fullBucketCoverage !== "unknown" ||
    !Number.isSafeInteger(inventory.limits?.maxObjectBytes) ||
    calculateCosMigrationInventorySha256(inventory) !== inventory.inventorySha256
  ) {
    throw new CosMigrationError("A valid untampered migration inventory is required");
  }
}

function assertSwitchPlan(plan) {
  if (
    plan?.schemaVersion !== 2 ||
    !plan.switchPlanSha256 ||
    !/^[a-f0-9]{64}$/.test(plan.databaseSnapshotSha256 ?? "") ||
    !Array.isArray(plan.mediaUpdates) ||
    !Array.isArray(plan.jsonUpdates) ||
    !Array.isArray(plan.userUpdates) ||
    calculateStorageSwitchPlanSha256(plan) !== plan.switchPlanSha256
  ) {
    throw new CosMigrationError("A valid untampered storage switch plan is required");
  }
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return groups;
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await task(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function maxIso(values) {
  const timestamps = values.filter(Boolean).map((value) => new Date(value).getTime());
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : value ? new Date(value).toISOString() : null;
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
