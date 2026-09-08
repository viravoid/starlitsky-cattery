import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma as defaultPrisma } from "../db/prisma.mjs";
import { completeMediaUpload, requestImageUpload } from "./media-upload-service.mjs";
import { headObject } from "./object-storage-service.mjs";

const IMPORTER_NAME = "environment-media-batch";
const IMPORTER_METADATA_KEY = "environmentMediaBatch";
const RUNTIME_VALIDATED = Symbol("environmentMediaBatchRuntimeValidated");
const MANIFEST_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../docs/media-source-manifests/environment-2026-09-05.json",
);
const PAGE_OWNER_TYPE = "fixed_page";
const ENVIRONMENT_PAGE_ID = "fixed-page-environment";
const MATERNITY_SLOT = "environment:maternity";
const APPEND_MODES = new Set(["append-or-manual-bind"]);
const REPLACEMENT_MODE = "replace-visible-slot-bindings";
const ALLOWED_MIME_TYPES = new Set(["image/jpeg"]);
const DISALLOWED_COUNT_MODELS = [
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

export class EnvironmentMediaBatchImportError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EnvironmentMediaBatchImportError";
    this.details = details;
  }
}

export function assertEnvironmentMediaBatchRuntime({
  confirmProduction = false,
  databaseUrl = process.env.DATABASE_URL,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new EnvironmentMediaBatchImportError("DATABASE_URL must be set explicitly.");
  }
  if (!databaseUrl.trim().startsWith("file:")) {
    throw new EnvironmentMediaBatchImportError(
      "Environment media batch importer only supports explicit SQLite file: DATABASE_URL values.",
      { databaseUrl: redactedDatabaseUrl(databaseUrl) },
    );
  }
  const productionTarget = isProductionTarget(databaseUrl, nodeEnv);
  if (productionTarget && !confirmProduction) {
    throw new EnvironmentMediaBatchImportError(
      "Production-like targets require --confirm-production even for dry-run.",
      { databaseUrl: redactedDatabaseUrl(databaseUrl), nodeEnv },
    );
  }

  return {
    [RUNTIME_VALIDATED]: true,
    databaseUrl,
    isProductionTarget: productionTarget,
  };
}

export function loadEnvironmentMediaSourceManifest({ manifestPath = MANIFEST_PATH } = {}) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  validateEnvironmentMediaSourceManifest(manifest);
  return manifest;
}

export function validateEnvironmentMediaSourceManifest(manifest) {
  const errors = [];
  if (!isPlainObject(manifest)) errors.push("manifest must be an object");
  if (!Number.isInteger(manifest?.version) || manifest.version <= 0) {
    errors.push("manifest.version must be a positive integer");
  }
  requiredString(manifest?.sourceBatchId, "manifest.sourceBatchId", errors);
  if (manifest?.page?.ownerType !== PAGE_OWNER_TYPE) {
    errors.push("manifest.page.ownerType must be fixed_page");
  }
  if (manifest?.page?.ownerId !== ENVIRONMENT_PAGE_ID) {
    errors.push("manifest.page.ownerId must be fixed-page-environment");
  }
  if (manifest?.page?.slug !== "environment") {
    errors.push("manifest.page.slug must be environment");
  }
  if (manifest?.binaryCommittedToGit !== false) {
    errors.push("manifest.binaryCommittedToGit must stay false");
  }
  if (manifest?.uploadedToCos !== false) {
    errors.push("manifest.uploadedToCos must stay false until a real target apply completes");
  }
  if (!Array.isArray(manifest?.items) || manifest.items.length !== 5) {
    errors.push("manifest.items must contain exactly 5 entries");
  }

  const seenIds = new Set();
  const seenFilenames = new Set();
  const expectedMaternitySortOrders = [10, 20, 30];
  const maternityItems = [];
  for (const item of Array.isArray(manifest?.items) ? manifest.items : []) {
    requiredString(item.id, "item.id", errors);
    requiredString(item.filename, `item ${item.id}.filename`, errors);
    requiredString(item.sha256, `item ${item.id}.sha256`, errors);
    requiredString(item.businessSlot, `item ${item.id}.businessSlot`, errors);
    if (seenIds.has(item.id)) errors.push(`duplicate item id: ${item.id}`);
    if (seenFilenames.has(item.filename)) errors.push(`duplicate filename: ${item.filename}`);
    seenIds.add(item.id);
    seenFilenames.add(item.filename);
    if (!/^[a-f0-9]{64}$/.test(String(item.sha256))) {
      errors.push(`item ${item.id}.sha256 must be a lowercase SHA256 hex digest`);
    }
    if (!Number.isInteger(item.sizeBytes) || item.sizeBytes <= 0) {
      errors.push(`item ${item.id}.sizeBytes must be a positive integer`);
    }
    if (!Number.isInteger(item.width) || item.width <= 0) {
      errors.push(`item ${item.id}.width must be a positive integer`);
    }
    if (!Number.isInteger(item.height) || item.height <= 0) {
      errors.push(`item ${item.id}.height must be a positive integer`);
    }
    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
      errors.push(`item ${item.id}.sortOrder must be a non-negative integer`);
    }
    if (item.binaryCommittedToGit !== false) {
      errors.push(`item ${item.id}.binaryCommittedToGit must stay false`);
    }
    if (item.uploadedToCos !== false) {
      errors.push(`item ${item.id}.uploadedToCos must stay false until a real target apply completes`);
    }

    if (item.businessSlot === MATERNITY_SLOT) {
      maternityItems.push(item);
      if (item.replacementSet !== true) {
        errors.push(`item ${item.id} must be marked as maternity replacementSet`);
      }
      if (item.replacementMode !== REPLACEMENT_MODE) {
        errors.push(`item ${item.id} must use ${REPLACEMENT_MODE}`);
      }
    } else {
      if (!["environment:public-area", "environment:medical"].includes(item.businessSlot)) {
        errors.push(`item ${item.id}.businessSlot is unsupported: ${item.businessSlot}`);
      }
      if (!APPEND_MODES.has(item.replacementMode)) {
        errors.push(`item ${item.id} must use append-or-manual-bind`);
      }
      if (item.replacementSet !== false) {
        errors.push(`item ${item.id}.replacementSet must be false`);
      }
      if (item.sortOrder !== 10) {
        errors.push(`item ${item.id}.sortOrder must be 10`);
      }
    }
  }
  if (
    maternityItems.length !== 3 ||
    maternityItems.map((item) => item.sortOrder).join(",") !== expectedMaternitySortOrders.join(",")
  ) {
    errors.push("maternity replacement entries must be exactly three items sorted 10, 20, 30");
  }

  if (errors.length > 0) {
    throw new EnvironmentMediaBatchImportError("Environment media source manifest is invalid.", {
      errors,
    });
  }
  return true;
}

export function validateEnvironmentMediaSourceFiles({
  sourceDir,
  manifest = loadEnvironmentMediaSourceManifest(),
} = {}) {
  const resolvedSourceDir = resolveExplicitSourceDir(sourceDir);
  validateEnvironmentMediaSourceManifest(manifest);
  const files = [];
  const errors = [];

  for (const item of manifest.items) {
    const filePath = resolve(resolvedSourceDir, item.filename);
    if (basename(filePath) !== item.filename || dirname(filePath) !== resolvedSourceDir) {
      errors.push(`${item.id}: filename must resolve directly under source-dir`);
      continue;
    }
    if (!existsSync(filePath)) {
      errors.push(`${item.id}: missing file ${item.filename}`);
      continue;
    }

    const buffer = readFileSync(filePath);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const imageInfo = readJpegImageInfo(buffer);
    if (sha256 !== item.sha256) {
      errors.push(`${item.id}: SHA256 mismatch`);
    }
    if (buffer.length !== item.sizeBytes) {
      errors.push(`${item.id}: byte size mismatch`);
    }
    if (!imageInfo || !ALLOWED_MIME_TYPES.has(imageInfo.mimeType)) {
      errors.push(`${item.id}: MIME type is not a supported image type`);
    } else {
      if (imageInfo.width !== item.width || imageInfo.height !== item.height) {
        errors.push(`${item.id}: dimensions mismatch`);
      }
    }
    files.push({
      ...item,
      filePath,
      sourceBatchId: manifest.sourceBatchId,
      actual: {
        mimeType: imageInfo?.mimeType ?? "unknown",
        sha256,
        sizeBytes: buffer.length,
        width: imageInfo?.width ?? null,
        height: imageInfo?.height ?? null,
      },
    });
  }

  if (errors.length > 0) {
    throw new EnvironmentMediaBatchImportError(
      "Environment media source files failed validation before any upload or DB write.",
      { errors },
    );
  }
  return { sourceDir: resolvedSourceDir, files };
}

export async function createEnvironmentMediaBatchPlan({
  client = defaultPrisma,
  manifest = loadEnvironmentMediaSourceManifest(),
  sourceDir,
  verifyExistingObjects = false,
} = {}) {
  const validation = validateEnvironmentMediaSourceFiles({ sourceDir, manifest });
  const existingRecords = await loadExistingImporterRecords(client, manifest.sourceBatchId);
  const conflicts = [];
  const items = [];

  for (const sourceFile of validation.files) {
    const sourceItemConflicts = findIdentityConflicts(existingRecords, sourceFile);
    conflicts.push(...sourceItemConflicts);
    if (sourceItemConflicts.length > 0) {
      items.push(toPlanItem(sourceFile, { action: "conflict" }));
      continue;
    }

    const matchingActive = existingRecords.filter(
      (media) => media.status === "active" && identityMatches(media, sourceFile),
    );
    if (matchingActive.length > 1) {
      conflicts.push({
        kind: "duplicate-active-importer-identity",
        sourceItemId: sourceFile.id,
        mediaIds: matchingActive.map((media) => media.id),
      });
      items.push(toPlanItem(sourceFile, { action: "conflict" }));
      continue;
    }

    if (matchingActive.length === 0) {
      items.push(
        toPlanItem(sourceFile, {
          action: "upload",
          plannedBindingVisibility: plannedInitialVisibility(sourceFile),
        }),
      );
      continue;
    }

    const media = matchingActive[0];
    if (verifyExistingObjects) {
      const verificationConflict = await verifyExistingMediaObject(media, sourceFile);
      if (verificationConflict) {
        conflicts.push(verificationConflict);
        items.push(toPlanItem(sourceFile, { action: "conflict" }));
        continue;
      }
    }

    const bindingState = classifyExpectedBinding(media, sourceFile);
    if (bindingState.conflict) {
      conflicts.push(bindingState.conflict);
      items.push(toPlanItem(sourceFile, { action: "conflict" }));
      continue;
    }
    items.push(
      toPlanItem(sourceFile, {
        action: bindingState.needsBinding ? "reuse" : "noop",
        mediaId: media.id,
        bindingId: bindingState.binding?.id ?? null,
        plannedBindingVisibility: bindingState.plannedBindingVisibility,
      }),
    );
  }

  const summary = summarizePlan(items, await countEnvironmentMediaBatchTables(client));
  summary.bindingsToArchive =
    conflicts.length === 0 && hasCompleteMaternityPlan(items)
      ? await countExistingVisibleMaternityBindings(client, items)
      : 0;

  return {
    mode: "dry-run",
    sourceBatchId: manifest.sourceBatchId,
    sourceDir: validation.sourceDir,
    page: { ...manifest.page },
    items,
    conflicts,
    summary,
  };
}

export async function runEnvironmentMediaBatchImport({
  apply = false,
  client = defaultPrisma,
  manifest = loadEnvironmentMediaSourceManifest(),
  putObject = putPresignedObject,
  runtimeContext,
  sourceDir,
} = {}) {
  if (apply) assertEnvironmentMediaBatchApplyRuntime(runtimeContext);
  const plan = await createEnvironmentMediaBatchPlan({
    client,
    manifest,
    sourceDir,
    verifyExistingObjects: apply,
  });
  plan.mode = apply ? "apply" : "dry-run";
  if (plan.conflicts.length > 0) {
    throw new EnvironmentMediaBatchImportError(
      "Environment media batch import has conflicts and will not continue.",
      { plan },
    );
  }
  if (!apply) return plan;

  const sourceFilesById = new Map(
    validateEnvironmentMediaSourceFiles({ sourceDir, manifest }).files.map((file) => [file.id, file]),
  );
  const completed = [];
  const reused = [];
  const createdBindings = [];

  for (const itemPlan of plan.items) {
    const sourceFile = sourceFilesById.get(itemPlan.sourceItemId);
    if (!sourceFile) throw new EnvironmentMediaBatchImportError(`Missing validated file for ${itemPlan.sourceItemId}`);

    if (itemPlan.action === "upload") {
      const uploaded = await uploadAndCompleteSourceFile({
        client,
        putObject,
        sourceFile,
      });
      completed.push(uploaded);
      itemPlan.mediaId = uploaded.media.id;
      itemPlan.bindingId = uploaded.bindingId;
      continue;
    }

    if (itemPlan.action === "reuse" || itemPlan.action === "noop") {
      const media = await findSingleActiveIdentity(client, manifest.sourceBatchId, sourceFile);
      if (!media) {
        throw new EnvironmentMediaBatchImportError("Importer identity disappeared before apply.", {
          sourceItemId: sourceFile.id,
        });
      }
      reused.push(media);
      itemPlan.mediaId = media.id;
      const bindingState = classifyExpectedBinding(media, sourceFile);
      if (bindingState.needsBinding) {
        const binding = await client.mediaBinding.create({
          data: {
            media_id: media.id,
            owner_type: PAGE_OWNER_TYPE,
            owner_id: ENVIRONMENT_PAGE_ID,
            usage: sourceFile.businessSlot,
            sort_order: sourceFile.sortOrder,
            visibility: plannedInitialVisibility(sourceFile),
          },
        });
        createdBindings.push(binding);
        itemPlan.bindingId = binding.id;
      }
    }
  }

  await switchMaternityReplacementSet({ client, manifest, itemPlans: plan.items });

  const finalPlan = await createEnvironmentMediaBatchPlan({
    client,
    manifest,
    sourceDir,
    verifyExistingObjects: true,
  });
  finalPlan.mode = "apply";
  finalPlan.applyResult = {
    uploadedCount: completed.length,
    reusedCount: reused.length,
    createdBindingCount: createdBindings.length,
    remoteDeletes: 0,
  };
  return finalPlan;
}

async function uploadAndCompleteSourceFile({ client, putObject, sourceFile }) {
  const requested = await requestImageUpload({
    altText: sourceFile.intendedAltLabel ?? sourceFile.filename,
    bindingVisibility: plannedInitialVisibility(sourceFile),
    checksum: sourceFile.sha256,
    fileName: sourceFile.filename,
    height: sourceFile.height,
    mimeType: sourceFile.actual.mimeType,
    ownerId: ENVIRONMENT_PAGE_ID,
    ownerType: PAGE_OWNER_TYPE,
    sizeBytes: sourceFile.sizeBytes,
    sortOrder: sourceFile.sortOrder,
    title: sourceFile.intendedTitle ?? sourceFile.filename,
    usage: sourceFile.businessSlot,
    width: sourceFile.width,
  });

  const metadataJson = mergeImporterMetadata(requested.media.metadataJson, sourceFile);
  await client.mediaAsset.update({
    where: { id: requested.media.id },
    data: { metadata_json: metadataJson },
  });

  await putObject({
    filePath: sourceFile.filePath,
    mimeType: sourceFile.actual.mimeType,
    upload: requested.upload,
  });

  const completed = await completeMediaUpload(requested.media.id, {
    checksum: sourceFile.sha256,
    height: sourceFile.height,
    sizeBytes: sourceFile.sizeBytes,
    width: sourceFile.width,
  });
  return {
    media: completed,
    bindingId: completed.bindings.find(
      (binding) =>
        binding.ownerId === ENVIRONMENT_PAGE_ID &&
        binding.ownerType === PAGE_OWNER_TYPE &&
        binding.usage === sourceFile.businessSlot,
    )?.id,
  };
}

async function putPresignedObject({ filePath, mimeType, upload }) {
  const response = await fetch(upload.url, {
    body: readFileSync(filePath),
    headers: upload.headers ?? { "content-type": mimeType },
    method: upload.method,
  });
  if (!response.ok) {
    throw new EnvironmentMediaBatchImportError("Object storage PUT failed.", {
      statusCode: response.status,
    });
  }
}

async function switchMaternityReplacementSet({ client, manifest, itemPlans }) {
  const maternityItems = manifest.items.filter((item) => item.businessSlot === MATERNITY_SLOT);
  const newMediaIds = itemPlans
    .filter((item) => item.slot === MATERNITY_SLOT)
    .map((item) => item.mediaId)
    .filter(Boolean);
  if (maternityItems.length !== 3 || newMediaIds.length !== 3) {
    throw new EnvironmentMediaBatchImportError(
      "Maternity replacement set is incomplete; old visible bindings remain untouched.",
    );
  }

  await client.$transaction(async (transaction) => {
    await transaction.mediaBinding.updateMany({
      where: {
        deleted_at: null,
        media_id: { notIn: newMediaIds },
        owner_id: ENVIRONMENT_PAGE_ID,
        owner_type: PAGE_OWNER_TYPE,
        usage: MATERNITY_SLOT,
        visibility: "visible",
      },
      data: {
        deleted_at: new Date(),
        visibility: "archived",
      },
    });

    for (const sourceItem of maternityItems) {
      const mediaId = itemPlans.find((item) => item.sourceItemId === sourceItem.id)?.mediaId;
      if (!mediaId) throw new EnvironmentMediaBatchImportError(`Missing staged media for ${sourceItem.id}`);
      const updated = await transaction.mediaBinding.updateMany({
        where: {
          deleted_at: null,
          media_id: mediaId,
          owner_id: ENVIRONMENT_PAGE_ID,
          owner_type: PAGE_OWNER_TYPE,
          usage: MATERNITY_SLOT,
        },
        data: {
          sort_order: sourceItem.sortOrder,
          visibility: "visible",
        },
      });
      if (updated.count !== 1) {
        throw new EnvironmentMediaBatchImportError("Maternity staged binding is missing or ambiguous.", {
          mediaId,
          sourceItemId: sourceItem.id,
        });
      }
    }
  });
}

async function loadExistingImporterRecords(client, sourceBatchId) {
  const media = await client.mediaAsset.findMany({
    where: { deleted_at: null },
    include: {
      bindings: {
        where: { deleted_at: null },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }, { id: "asc" }],
      },
    },
  });
  return media.filter((item) => readImporterMetadata(item)?.sourceBatchId === sourceBatchId);
}

async function findSingleActiveIdentity(client, sourceBatchId, sourceFile) {
  const records = await loadExistingImporterRecords(client, sourceBatchId);
  const matching = records.filter((media) => media.status === "active" && identityMatches(media, sourceFile));
  return matching.length === 1 ? matching[0] : null;
}

function findIdentityConflicts(records, sourceFile) {
  const conflicts = [];
  const sameSourceDifferentSha = records.filter((media) => {
    const metadata = readImporterMetadata(media);
    return (
      media.status === "active" &&
      metadata?.sourceItemId === sourceFile.id &&
      metadata?.sha256 !== sourceFile.sha256
    );
  });
  if (sameSourceDifferentSha.length > 0) {
    conflicts.push({
      kind: "same-source-item-different-sha",
      sourceItemId: sourceFile.id,
      mediaIds: sameSourceDifferentSha.map((media) => media.id),
    });
  }
  return conflicts;
}

function classifyExpectedBinding(media, sourceFile) {
  const matchingBindings = media.bindings.filter(
    (binding) =>
      binding.owner_type === PAGE_OWNER_TYPE &&
      binding.owner_id === ENVIRONMENT_PAGE_ID &&
      binding.usage === sourceFile.businessSlot,
  );
  if (matchingBindings.length > 1) {
    return {
      conflict: {
        kind: "ambiguous-importer-binding",
        sourceItemId: sourceFile.id,
        mediaId: media.id,
        bindingIds: matchingBindings.map((binding) => binding.id),
      },
    };
  }
  if (matchingBindings.length === 0) {
    return {
      needsBinding: true,
      plannedBindingVisibility: plannedInitialVisibility(sourceFile),
    };
  }

  const binding = matchingBindings[0];
  if (binding.sort_order !== sourceFile.sortOrder) {
    return {
      conflict: {
        kind: "importer-binding-sort-conflict",
        sourceItemId: sourceFile.id,
        mediaId: media.id,
        bindingId: binding.id,
      },
    };
  }
  if (sourceFile.businessSlot === MATERNITY_SLOT) {
    if (!["hidden", "visible"].includes(binding.visibility)) {
      return {
        conflict: {
          kind: "importer-binding-visibility-conflict",
          sourceItemId: sourceFile.id,
          mediaId: media.id,
          bindingId: binding.id,
        },
      };
    }
    return {
      binding,
      needsBinding: false,
      plannedBindingVisibility:
        binding.visibility === "visible" ? "visible" : "hidden -> visible-after-complete-set",
    };
  }
  if (binding.visibility !== "visible") {
    return {
      conflict: {
        kind: "importer-binding-visibility-conflict",
        sourceItemId: sourceFile.id,
        mediaId: media.id,
        bindingId: binding.id,
      },
    };
  }
  return { binding, needsBinding: false, plannedBindingVisibility: "visible" };
}

async function verifyExistingMediaObject(media, sourceFile) {
  const objectKey = readUploadObjectKey(media);
  if (!objectKey) {
    return { kind: "missing-upload-object-key", sourceItemId: sourceFile.id, mediaId: media.id };
  }
  const metadata = await headObject({ objectKey });
  if (!metadata.exists) {
    return { kind: "missing-storage-object", sourceItemId: sourceFile.id, mediaId: media.id };
  }
  if (metadata.contentLength !== sourceFile.sizeBytes) {
    return { kind: "storage-object-size-conflict", sourceItemId: sourceFile.id, mediaId: media.id };
  }
  const contentType = normalizeContentType(metadata.contentType);
  if (contentType !== sourceFile.actual.mimeType) {
    return { kind: "storage-object-mime-conflict", sourceItemId: sourceFile.id, mediaId: media.id };
  }
  if (media.checksum !== sourceFile.sha256) {
    return { kind: "media-checksum-conflict", sourceItemId: sourceFile.id, mediaId: media.id };
  }
  return null;
}

function summarizePlan(items, beforeCounts) {
  return {
    assetsToCreate: items.filter((item) => item.action === "upload").length,
    assetsToReuse: items.filter((item) => item.action === "reuse" || item.action === "noop").length,
    bindingsToArchive: 0,
    bindingsToCreate: items.filter(
      (item) => item.action === "upload" || item.action === "reuse",
    ).length,
    bindingsToUpdate: items.filter(
      (item) => item.plannedBindingVisibility === "hidden -> visible-after-complete-set",
    ).length,
    objectsToUpload: items.filter((item) => item.action === "upload").length,
    remoteDeletes: 0,
    beforeCounts,
  };
}

function hasCompleteMaternityPlan(items) {
  const maternityItems = items.filter((item) => item.slot === MATERNITY_SLOT);
  return maternityItems.length === 3 && maternityItems.every((item) => item.action !== "conflict");
}

async function countExistingVisibleMaternityBindings(client, items) {
  const newMediaIds = items
    .filter((item) => item.slot === MATERNITY_SLOT)
    .map((item) => item.mediaId)
    .filter(Boolean);
  return client.mediaBinding.count({
    where: {
      deleted_at: null,
      media_id: newMediaIds.length > 0 ? { notIn: newMediaIds } : undefined,
      owner_id: ENVIRONMENT_PAGE_ID,
      owner_type: PAGE_OWNER_TYPE,
      usage: MATERNITY_SLOT,
      visibility: "visible",
    },
  });
}

async function countEnvironmentMediaBatchTables(client) {
  const pairs = await Promise.all([
    ["mediaAsset", client.mediaAsset.count()],
    ["mediaBinding", client.mediaBinding.count()],
    ...DISALLOWED_COUNT_MODELS.map((model) => [model, client[model].count()]),
  ]);
  return Object.fromEntries(pairs);
}

function toPlanItem(
  sourceFile,
  {
    action,
    bindingId = null,
    mediaId = null,
    plannedBindingVisibility = plannedFinalVisibility(sourceFile),
  } = {},
) {
  return {
    action,
    bindingId,
    filename: sourceFile.filename,
    mediaId,
    plannedBindingVisibility,
    replacementMembership: sourceFile.replacementSet ? "maternity-replacement-set" : "none",
    sha256Short: sourceFile.sha256.slice(0, 12),
    slot: sourceFile.businessSlot,
    sortOrder: sourceFile.sortOrder,
    sourceItemId: sourceFile.id,
  };
}

function plannedInitialVisibility(sourceFile) {
  return sourceFile.businessSlot === MATERNITY_SLOT ? "hidden" : "visible";
}

function plannedFinalVisibility(sourceFile) {
  return sourceFile.businessSlot === MATERNITY_SLOT
    ? "hidden -> visible-after-complete-set"
    : "visible";
}

function mergeImporterMetadata(value, sourceFile) {
  const metadata = isPlainObject(value) ? { ...value } : {};
  metadata[IMPORTER_METADATA_KEY] = {
    businessSlot: sourceFile.businessSlot,
    importer: IMPORTER_NAME,
    sha256: sourceFile.sha256,
    sourceBatchId: sourceFile.sourceBatchId,
    sourceFilename: sourceFile.filename,
    sourceItemId: sourceFile.id,
  };
  return metadata;
}

function identityMatches(media, sourceFile) {
  const metadata = readImporterMetadata(media);
  return (
    metadata?.importer === IMPORTER_NAME &&
    metadata?.sourceBatchId === sourceFile.sourceBatchId &&
    metadata?.sourceItemId === sourceFile.id &&
    metadata?.sha256 === sourceFile.sha256
  );
}

function readImporterMetadata(media) {
  const metadata = media?.metadata_json;
  if (!isPlainObject(metadata)) return null;
  const importerMetadata = metadata[IMPORTER_METADATA_KEY];
  return isPlainObject(importerMetadata) ? importerMetadata : null;
}

function readUploadObjectKey(media) {
  const metadata = media?.metadata_json;
  if (!isPlainObject(metadata) || !isPlainObject(metadata.upload)) return "";
  return typeof metadata.upload.objectKey === "string" ? metadata.upload.objectKey : "";
}

function readJpegImageInfo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 1 >= buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (isJpegStartOfFrame(marker)) {
      if (length < 7) return null;
      return {
        height: buffer.readUInt16BE(offset + 3),
        mimeType: "image/jpeg",
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  return null;
}

function isJpegStartOfFrame(marker) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function resolveExplicitSourceDir(sourceDir) {
  if (typeof sourceDir !== "string" || sourceDir.trim() === "") {
    throw new EnvironmentMediaBatchImportError("--source-dir is required.");
  }
  const resolved = isAbsolute(sourceDir) ? resolve(sourceDir) : resolve(process.cwd(), sourceDir);
  if (!existsSync(resolved)) {
    throw new EnvironmentMediaBatchImportError("--source-dir does not exist.", {
      sourceDir: resolved,
    });
  }
  return resolved;
}

function assertEnvironmentMediaBatchApplyRuntime(runtimeContext) {
  if (!runtimeContext) return assertEnvironmentMediaBatchRuntime();
  if (runtimeContext[RUNTIME_VALIDATED] !== true) {
    throw new EnvironmentMediaBatchImportError(
      "Environment media batch apply requires validated runtime context.",
    );
  }
  return runtimeContext;
}

function requiredString(value, fieldName, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${fieldName} must be a non-empty string`);
  }
}

function normalizeContentType(value) {
  if (typeof value !== "string") return "";
  return value.split(";")[0].trim().toLowerCase();
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isProductionTarget(databaseUrl, nodeEnv) {
  const normalized = databaseUrl.replaceAll("\\", "/").toLowerCase();
  return nodeEnv === "production" || normalized.includes("/opt/starlitsky/data/");
}

function redactedDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return "";
  if (databaseUrl.startsWith("file:")) return databaseUrl;
  return "<non-sqlite-database-url>";
}
