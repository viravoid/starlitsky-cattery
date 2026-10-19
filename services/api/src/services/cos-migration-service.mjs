import crypto from "node:crypto";
import { prisma } from "../db/prisma.mjs";
import {
  getAllowedStorageBuckets,
  getObject,
  headObject,
  listObjects,
  putObject,
} from "./object-storage-service.mjs";

const COPY_CONCURRENCY = 4;

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
  storage = { headObject, listObjects },
} = {}) {
  const buckets = assertMigrationBuckets(sourceBucket, targetBucket);
  const generatedAt = new Date().toISOString();
  const [
    media,
    users,
    cats,
    fixedPages,
    parentApplications,
    kittenProfiles,
    litters,
    selectionApplications,
    sourceObjects,
    targetObjects,
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
    listAllObjects(storage, sourceBucket),
    listAllObjects(storage, targetBucket),
  ]);

  const sourceObjectMap = new Map(sourceObjects.map((object) => [object.objectKey, object]));
  const targetObjectMap = new Map(targetObjects.map((object) => [object.objectKey, object]));
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
      ].filter(Boolean),
    ),
  ];
  await mapLimit(referencedObjectKeys, 8, async (objectKey) => {
    await Promise.all([
      enrichListedObject(storage, sourceBucket, objectKey, sourceObjectMap),
      enrichListedObject(storage, targetBucket, objectKey, targetObjectMap),
    ]);
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

  const referencedKeys = new Set(
    [
      ...records.flatMap((record) => [record.objectKey, record.thumbnailObjectKey]),
      ...jsonReferences.map((reference) => reference.objectKey),
      ...userAvatarReferences.map((reference) => reference.objectKey),
    ].filter(Boolean),
  );
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
  const inventory = {
    schemaVersion: 2,
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
    records,
    recordsRequiringMigration: records
      .filter((record) => record.requiresMigration)
      .map((record) => record.id),
    duplicateKeys,
    duplicateKeyConflicts,
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
    orphanSourceObjects: sourceObjects.filter((object) => !referencedKeys.has(object.objectKey)),
    sourceObjects,
    targetObjects,
    jsonReferences,
    userAvatarReferences,
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

async function enrichListedObject(storage, bucket, objectKey, objectMap) {
  const listed = objectMap.get(objectKey);
  if (!listed) return;
  const metadata = await storage.headObject({ bucket, objectKey });
  if (!metadata?.exists) {
    listed.inventoryConsistency = "listed-but-head-missing";
    return;
  }
  listed.contentType = metadata.contentType ?? null;
  listed.contentLength = metadata.contentLength ?? listed.sizeBytes ?? null;
  listed.etag = metadata.etag ?? listed.etag ?? null;
  listed.inventoryConsistency = "listed-and-head-confirmed";
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
      const source = await storage.getObject({
        bucket: inventory.sourceBucket,
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
    sourceBucket: inventory.sourceBucket,
    targetBucket: inventory.targetBucket,
    mediaUpdates,
    jsonUpdates,
    userUpdates,
    integrity: {
      sourceObjectCount: inventory.sourceObjects?.length ?? 0,
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

  for (const reference of inventory.jsonReferences ?? []) {
    addReferenceFinding({ add, inventory, reference, verifiedKeys });
  }
  for (const reference of inventory.userAvatarReferences ?? []) {
    addReferenceFinding({ add, inventory, reference, verifiedKeys });
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

export function buildStorageRollbackPlan({ switchPlan, switchReport }) {
  assertSwitchPlan(switchPlan);
  if (
    !switchPlan?.switchPlanSha256 ||
    switchReport?.switchPlanSha256 !== switchPlan.switchPlanSha256 ||
    switchReport?.mode !== "apply" ||
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

    return {
      mode: "apply",
      switchPlanSha256: plan.switchPlanSha256,
      mediaUpdateCount: plan.mediaUpdates.length,
      jsonUpdateCount: plan.jsonUpdates.length,
      userUpdateCount: plan.userUpdates?.length ?? 0,
      mediaStates,
      jsonStates,
      userStates,
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

async function listAllObjects(storage, bucket) {
  const objects = [];
  let continuationToken = "";
  do {
    const page = await storage.listObjects({ bucket, continuationToken });
    objects.push(...page.objects);
    continuationToken = page.isTruncated ? page.nextContinuationToken : "";
    if (page.isTruncated && !continuationToken) {
      throw new CosMigrationError("Truncated object listing did not return a continuation token", {
        bucket,
      });
    }
  } while (continuationToken);
  return objects.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
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

async function verifyRemoteContent({ bucket, expectedSha256, objectKey, storage }) {
  const object = await storage.getObject({ bucket, objectKey });
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
    ...new Set([storage.publicBaseUrl, storage.endpoint].map(normalizeBaseUrl).filter(Boolean)),
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
    inventory?.schemaVersion !== 2 ||
    !inventory.inventorySha256 ||
    !Array.isArray(inventory.records) ||
    !Array.isArray(inventory.sourceObjects) ||
    !Array.isArray(inventory.jsonReferences) ||
    !Array.isArray(inventory.userAvatarReferences) ||
    calculateCosMigrationInventorySha256(inventory) !== inventory.inventorySha256
  ) {
    throw new CosMigrationError("A valid untampered migration inventory is required");
  }
}

function assertSwitchPlan(plan) {
  if (
    plan?.schemaVersion !== 2 ||
    !plan.switchPlanSha256 ||
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
