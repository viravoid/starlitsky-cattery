import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { PUBLIC_CONTENT_MANIFEST } from "../content/public-content-manifest.mjs";
import { FIXED_PAGE_SLUGS } from "../content/fixed-page-definitions.mjs";
import { createPresignedPutUpload, headObject } from "./object-storage-service.mjs";

const FIXED_PAGE_OWNED_FIELDS = [
  "title",
  "status",
  "content_schema_version",
  "content_json",
  "published_at",
];
const CAT_OWNED_FIELDS = [
  "name",
  "gender",
  "color",
  "lifecycle_status",
  "visibility",
  "story_json",
];
const BREEDING_PROFILE_OWNED_FIELDS = [
  "breeding_role",
  "reproductive_state",
  "status_label",
  "sort_order",
];
const OPTIONAL_FIXED_PAGE_FIELD_MAP = {
  seoTitle: "seo_title",
  seoDescription: "seo_description",
};
const IMPORTER_SOURCE_KEYS = [
  "fileName",
  "publicContentImportId",
  "sourceGroup",
  "sourceParagraphs",
];
const UNSAFE_JSON_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const PUBLIC_CONTENT_IMPORT_RUNTIME_VALIDATED = Symbol("publicContentImportRuntimeValidated");
const ALLOWED_FIXED_PAGE_STATUS = new Set(["draft", "published", "hidden"]);
const ALLOWED_FIXED_PAGE_CONTENT_JSON_MODES = new Set(["merge", "replace"]);
const ALLOWED_CAT_VISIBILITY = new Set(["visible", "hidden", "archived"]);
const ALLOWED_GENDER = new Set(["male", "female", "unknown"]);
const ALLOWED_BREEDING_ROLE = new Set(["king", "queen", "candidate"]);
const ALLOWED_REPRODUCTIVE_STATE = new Set([
  "active",
  "observing",
  "paused",
  "retired",
  "semiRetired",
]);
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
  "mediaAsset",
  "mediaBinding",
];
const FIXED_PAGE_MEDIA_IMPORTER_NAME = "public-content-web-demo-fixed-page-media";
const FIXED_PAGE_MEDIA_METADATA_KEY = "publicContentFixedPageMedia";
const ALLOWED_MEDIA_KINDS = new Set(["image", "document"]);

export class PublicContentImportError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PublicContentImportError";
    this.details = details;
  }
}

export function assertPublicContentImporterRuntime({
  confirmProduction = false,
  databaseUrl = process.env.DATABASE_URL,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new PublicContentImportError("DATABASE_URL must be set explicitly.");
  }
  if (!isSqliteDatabaseUrl(databaseUrl)) {
    throw new PublicContentImportError("Public content importer only supports explicit SQLite file: DATABASE_URL values.", {
      databaseUrl: redactedDatabaseUrl(databaseUrl),
    });
  }
  if (isProductionTarget(databaseUrl, nodeEnv) && !confirmProduction) {
    throw new PublicContentImportError(
      "Production-like targets require --confirm-production even for dry-run.",
      {
        databaseUrl: redactedDatabaseUrl(databaseUrl),
        nodeEnv,
      },
    );
  }

  return {
    [PUBLIC_CONTENT_IMPORT_RUNTIME_VALIDATED]: true,
    databaseUrl,
    isProductionTarget: isProductionTarget(databaseUrl, nodeEnv),
  };
}

export function validatePublicContentManifest(
  manifest = PUBLIC_CONTENT_MANIFEST,
  { allowedFixedPageSlugs = FIXED_PAGE_SLUGS } = {},
) {
  const errors = [];

  if (!manifest || typeof manifest !== "object") errors.push("manifest must be an object");
  if (!Number.isInteger(manifest.version) || manifest.version <= 0) {
    errors.push("manifest.version must be a positive integer");
  }
  requiredString(manifest.manifestId, "manifest.manifestId", errors);
  requiredString(manifest.manifestDate, "manifest.manifestDate", errors);
  requiredString(manifest.source?.fileName, "manifest.source.fileName", errors);
  if (
    Object.hasOwn(manifest, "fixedPageContentJsonMode") &&
    !ALLOWED_FIXED_PAGE_CONTENT_JSON_MODES.has(manifest.fixedPageContentJsonMode)
  ) {
    errors.push(
      `manifest.fixedPageContentJsonMode must be one of: ${[
        ...ALLOWED_FIXED_PAGE_CONTENT_JSON_MODES,
      ].join(", ")}`,
    );
  }

  validateUniqueCollection({
    errors,
    items: manifest.fixedPages,
    label: "fixedPages",
    keyOf: (item) => item.importId,
  });
  validateUniqueCollection({
    errors,
    items: manifest.fixedPages,
    label: "fixedPages.slug",
    keyOf: (item) => item.slug,
  });
  for (const page of arrayOrEmpty(manifest.fixedPages)) {
    requiredString(page.importId, "fixedPage.importId", errors);
    requiredString(page.sourceHeading, "fixedPage.sourceHeading", errors);
    requiredString(page.slug, "fixedPage.slug", errors);
    requiredString(page.title, "fixedPage.title", errors);
    if (!allowedFixedPageSlugs.has(page.slug)) {
      errors.push(`fixedPage slug is not supported by current product: ${page.slug}`);
    }
    if (!ALLOWED_FIXED_PAGE_STATUS.has(page.status)) {
      errors.push(`fixedPage status is unsupported: ${page.status}`);
    }
    if (!Number.isInteger(page.contentSchemaVersion) || page.contentSchemaVersion <= 0) {
      errors.push(`fixedPage ${page.slug} contentSchemaVersion must be a positive integer`);
    }
    if (!isPlainObject(page.contentJson)) {
      errors.push(`fixedPage ${page.slug} contentJson must be an object`);
    } else {
      collectUnsafeJsonKeyErrors(page.contentJson, `fixedPage ${page.slug}.contentJson`, errors);
    }
    for (const inputField of Object.keys(OPTIONAL_FIXED_PAGE_FIELD_MAP)) {
      if (Object.hasOwn(page, inputField) && typeof page[inputField] !== "string") {
        errors.push(`fixedPage ${page.slug} ${inputField} must be a string when provided`);
      }
    }
  }

  validateUniqueCollection({
    errors,
    items: arrayOrEmpty(manifest.fixedPageMedia),
    label: "fixedPageMedia.id",
    keyOf: (item) => item.id,
    allowEmpty: true,
  });
  for (const item of arrayOrEmpty(manifest.fixedPageMedia)) {
    requiredString(item.id, "fixedPageMedia.id", errors);
    requiredString(item.slug, `fixedPageMedia ${item.id}.slug`, errors);
    if (!allowedFixedPageSlugs.has(item.slug)) {
      errors.push(`fixedPageMedia slug is not supported by current product: ${item.slug}`);
    }
    if (item.ownerType !== "fixed_page") {
      errors.push(`fixedPageMedia ${item.id}.ownerType must be fixed_page`);
    }
    if (item.ownerId !== `fixed-page-${item.slug}`) {
      errors.push(`fixedPageMedia ${item.id}.ownerId must be fixed-page-${item.slug}`);
    }
    if (!ALLOWED_MEDIA_KINDS.has(item.kind)) {
      errors.push(`fixedPageMedia ${item.id}.kind is unsupported: ${item.kind}`);
    }
    requiredString(item.usage, `fixedPageMedia ${item.id}.usage`, errors);
    requiredString(item.sourceLocalPath, `fixedPageMedia ${item.id}.sourceLocalPath`, errors);
    requiredString(item.sourcePublicPath, `fixedPageMedia ${item.id}.sourcePublicPath`, errors);
    requiredString(item.checksum, `fixedPageMedia ${item.id}.checksum`, errors);
    if (item.checksum && !/^[a-f0-9]{64}$/.test(String(item.checksum))) {
      errors.push(`fixedPageMedia ${item.id}.checksum must be a lowercase SHA256 hex digest`);
    }
    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0) {
      errors.push(`fixedPageMedia ${item.id}.sortOrder must be a non-negative integer`);
    }
    if (!Number.isInteger(item.sizeBytes) || item.sizeBytes <= 0) {
      errors.push(`fixedPageMedia ${item.id}.sizeBytes must be a positive integer`);
    }
    if (item.kind === "image") {
      if (!String(item.mimeType ?? "").startsWith("image/")) {
        errors.push(`fixedPageMedia ${item.id}.mimeType must be an image MIME type`);
      }
      if (!Number.isInteger(item.width) || item.width <= 0) {
        errors.push(`fixedPageMedia ${item.id}.width must be a positive integer`);
      }
      if (!Number.isInteger(item.height) || item.height <= 0) {
        errors.push(`fixedPageMedia ${item.id}.height must be a positive integer`);
      }
    }
    if (item.missingReason) {
      errors.push(`fixedPageMedia ${item.id} is unresolved: ${item.missingReason}`);
    }
  }

  validateUniqueCollection({
    errors,
    items: manifest.breedingCats,
    label: "breedingCats.importId",
    keyOf: (item) => item.importId,
    allowEmpty: true,
  });
  validateUniqueCollection({
    errors,
    items: manifest.breedingCats,
    label: "breedingCats.cat.id",
    keyOf: (item) => item.cat?.id,
    allowEmpty: true,
  });
  validateUniqueCollection({
    errors,
    items: manifest.breedingCats,
    label: "breedingCats.cat.name",
    keyOf: (item) => item.cat?.name,
    allowEmpty: true,
  });
  for (const entry of arrayOrEmpty(manifest.breedingCats)) {
    requiredString(entry.importId, "breedingCat.importId", errors);
    requiredString(entry.sourceGroup, "breedingCat.sourceGroup", errors);
    requiredString(entry.cat?.id, "breedingCat.cat.id", errors);
    requiredString(entry.cat?.name, "breedingCat.cat.name", errors);
    requiredString(entry.cat?.color, "breedingCat.cat.color", errors);
    if (!ALLOWED_GENDER.has(entry.cat?.gender)) {
      errors.push(`breedingCat ${entry.cat?.name} gender is unsupported: ${entry.cat?.gender}`);
    }
    if (!ALLOWED_CAT_VISIBILITY.has(entry.cat?.visibility)) {
      errors.push(`breedingCat ${entry.cat?.name} visibility is unsupported: ${entry.cat?.visibility}`);
    }
    if (entry.cat?.lifecycleStatus !== "breeding") {
      errors.push(`breedingCat ${entry.cat?.name} lifecycleStatus must be breeding`);
    }
    if (!isPlainObject(entry.cat?.storyJson) || !Array.isArray(entry.cat?.storyJson?.story)) {
      errors.push(`breedingCat ${entry.cat?.name} storyJson.story must be an array`);
    } else {
      collectUnsafeJsonKeyErrors(entry.cat.storyJson, `breedingCat ${entry.cat.name}.storyJson`, errors);
    }
    if (entry.cat?.storyJson?.source?.publicContentImportId !== entry.importId) {
      errors.push(`breedingCat ${entry.cat?.name} storyJson source import id must match importId`);
    }
    if (!ALLOWED_BREEDING_ROLE.has(entry.breedingProfile?.breedingRole)) {
      errors.push(
        `breedingCat ${entry.cat?.name} breedingRole is unsupported: ${entry.breedingProfile?.breedingRole}`,
      );
    }
    if (!ALLOWED_REPRODUCTIVE_STATE.has(entry.breedingProfile?.reproductiveState)) {
      errors.push(
        `breedingCat ${entry.cat?.name} reproductiveState is unsupported: ${entry.breedingProfile?.reproductiveState}`,
      );
    }
  }

  if (!Array.isArray(manifest.skippedSections) || manifest.skippedSections.length === 0) {
    errors.push("manifest.skippedSections must explicitly record skipped or unmapped source sections");
  }

  if (errors.length > 0) {
    throw new PublicContentImportError("Public content manifest is invalid.", { errors });
  }
  return true;
}

export async function createPublicContentImportPlan({
  client,
  manifest = PUBLIC_CONTENT_MANIFEST,
} = {}) {
  if (!client) throw new PublicContentImportError("A Prisma client is required.");
  validatePublicContentManifest(manifest);

  const breedingCats = manifest.breedingCats;
  const [fixedPages, cats, profiles, beforeCounts] = await Promise.all([
    client.fixedPage.findMany({
      where: { slug: { in: manifest.fixedPages.map((page) => page.slug) } },
    }),
    breedingCats.length
      ? client.cat.findMany({
          where: {
            OR: [
              { id: { in: breedingCats.map((entry) => entry.cat.id) } },
              { name: { in: breedingCats.map((entry) => entry.cat.name) } },
            ],
          },
        })
      : [],
    breedingCats.length
      ? client.breedingCatProfile.findMany({
          where: { cat_id: { in: breedingCats.map((entry) => entry.cat.id) } },
        })
      : [],
    countTables(client),
  ]);

  const fixedPagesBySlug = new Map(fixedPages.map((page) => [page.slug, page]));
  const catsById = new Map(cats.map((cat) => [cat.id, cat]));
  const profilesByCatId = new Map(profiles.map((profile) => [profile.cat_id, profile]));
  const plan = {
    manifestId: manifest.manifestId,
    manifestVersion: manifest.version,
    mode: "dry-run",
    fixedPages: [],
    breedingCats: [],
    skippedSections: manifest.skippedSections.map((section) => ({ ...section })),
    fixedPageMedia: [],
    conflicts: [],
    beforeCounts,
  };

  const fixedPageContentJsonMode = getFixedPageContentJsonMode(manifest);
  for (const page of manifest.fixedPages) {
    const existing = fixedPagesBySlug.get(page.slug);
    if (existing?.deleted_at) {
      plan.conflicts.push({
        kind: "fixed-page-deleted",
        slug: page.slug,
        message: "A deleted fixed page with this slug already exists; importer will not restore it.",
      });
      continue;
    }
    const data = toFixedPageData(page, existing, fixedPageContentJsonMode);
    const ownedFields = getFixedPageOwnedFields(page);
    plan.fixedPages.push({
      importId: page.importId,
      sourceHeading: page.sourceHeading,
      slug: page.slug,
      action: existing ? diffAction(existing, data, ownedFields) : "create",
      ownedFields,
      changes: existing ? diffFields(existing, data, ownedFields) : data,
    });
  }

  for (const entry of manifest.breedingCats) {
    const existingById = catsById.get(entry.cat.id);
    const sameNameCats = cats.filter((cat) => cat.name === entry.cat.name && cat.id !== entry.cat.id);
    if (sameNameCats.length > 0) {
      plan.conflicts.push({
        kind: "breeding-cat-name-conflict",
        importId: entry.importId,
        catId: entry.cat.id,
        name: entry.cat.name,
        conflictingIds: sameNameCats.map((cat) => cat.id),
        message: "A cat with the same name exists without the manifest import identity.",
      });
      continue;
    }
    if (existingById?.deleted_at) {
      plan.conflicts.push({
        kind: "breeding-cat-deleted",
        importId: entry.importId,
        catId: entry.cat.id,
        name: entry.cat.name,
        message: "A deleted cat with the manifest id already exists; importer will not restore it.",
      });
      continue;
    }
    const existingImportId = readPublicContentImportId(existingById);
    if (existingById && existingImportId !== entry.importId) {
      plan.conflicts.push({
        kind: existingImportId
          ? "breeding-cat-import-id-conflict"
          : "breeding-cat-missing-import-identity",
        importId: entry.importId,
        catId: entry.cat.id,
        name: entry.cat.name,
        existingImportId,
        message: existingImportId
          ? "The existing cat has a different public content import identity."
          : "The existing cat has the manifest id but no matching public content import identity.",
      });
      continue;
    }

    const catData = toCatData(entry, existingById);
    const profileData = toBreedingProfileData(entry);
    const profile = profilesByCatId.get(entry.cat.id);
    plan.breedingCats.push({
      importId: entry.importId,
      sourceGroup: entry.sourceGroup,
      name: entry.cat.name,
      action: existingById ? diffAction(existingById, catData, CAT_OWNED_FIELDS) : "create",
      catOwnedFields: CAT_OWNED_FIELDS,
      breedingProfileOwnedFields: BREEDING_PROFILE_OWNED_FIELDS,
      catChanges: existingById ? diffFields(existingById, catData, CAT_OWNED_FIELDS) : catData,
      breedingProfileAction: profile ? diffAction(profile, profileData, BREEDING_PROFILE_OWNED_FIELDS) : "create",
      breedingProfileChanges: profile
        ? diffFields(profile, profileData, BREEDING_PROFILE_OWNED_FIELDS)
        : profileData,
    });
  }

  const mediaPlan = await createFixedPageMediaPlan({ client, manifest });
  plan.fixedPageMedia = mediaPlan.items;
  plan.conflicts.push(...mediaPlan.conflicts);

  return plan;
}

export async function runPublicContentImport({
  apply = false,
  client,
  manifest = PUBLIC_CONTENT_MANIFEST,
  putObject = putPresignedObject,
  runtimeContext,
} = {}) {
  const applyRuntimeContext = apply ? assertPublicContentApplyRuntime(runtimeContext) : null;
  const plan = await createPublicContentImportPlan({ client, manifest });
  plan.mode = apply ? "apply" : "dry-run";
  if (plan.conflicts.length > 0) {
    throw new PublicContentImportError("Public content import has conflicts and will not continue.", {
      plan,
    });
  }
  if (!apply) return plan;

  const productionBackupPath = createProductionSqliteBackup(applyRuntimeContext);
  await client.$transaction(async (transaction) => {
    const fixedPageContentJsonMode = getFixedPageContentJsonMode(manifest);
    for (const page of manifest.fixedPages) {
      const existing = await transaction.fixedPage.findUnique({ where: { slug: page.slug } });
      const data = toFixedPageData(page, existing, fixedPageContentJsonMode);
      await transaction.fixedPage.upsert({
        where: { slug: page.slug },
        create: {
          id: `fixed-page-${page.slug}`,
          slug: page.slug,
          ...data,
        },
        update: data,
      });
    }

    for (const entry of manifest.breedingCats) {
      const existingCat = await transaction.cat.findUnique({ where: { id: entry.cat.id } });
      const catData = toCatData(entry, existingCat);
      await transaction.cat.upsert({
        where: { id: entry.cat.id },
        create: {
          id: entry.cat.id,
          ...catData,
        },
        update: catData,
      });
      await transaction.breedingCatProfile.upsert({
        where: { cat_id: entry.cat.id },
        create: {
          cat_id: entry.cat.id,
          ...toBreedingProfileData(entry),
        },
        update: toBreedingProfileData(entry),
      });
    }
  });

  const mediaApplyResult = await applyFixedPageMediaPlan({
    client,
    manifest,
    plan,
    putObject,
  });

  return {
    ...plan,
    applyResult: {
      fixedPageMedia: mediaApplyResult,
      productionBackupPath,
    },
    afterCounts: await countTables(client),
  };
}

async function createFixedPageMediaPlan({ client, manifest }) {
  const mediaItems = arrayOrEmpty(manifest.fixedPageMedia);
  if (mediaItems.length === 0) return { items: [], conflicts: [] };

  const existingMedia = await client.mediaAsset.findMany({
    where: { id: { in: mediaItems.map((item) => item.id) } },
    include: {
      bindings: {
        where: { deleted_at: null },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }, { id: "asc" }],
      },
    },
  });
  const mediaById = new Map(existingMedia.map((media) => [media.id, media]));
  const items = [];
  const conflicts = [];

  for (const sourceItem of mediaItems) {
    const itemConflicts = validateFixedPageMediaSourceFile(sourceItem);
    const media = mediaById.get(sourceItem.id) ?? null;
    const base = toFixedPageMediaPlanItem(sourceItem, { action: "upload" });

    if (itemConflicts.length > 0) {
      conflicts.push(...itemConflicts);
      items.push({ ...base, action: "conflict" });
      continue;
    }
    if (!media) {
      items.push(base);
      continue;
    }
    if (media.deleted_at || media.status !== "active") {
      conflicts.push({
        kind: "fixed-page-media-existing-inactive",
        mediaId: sourceItem.id,
        status: media.status,
      });
      items.push({ ...base, action: "conflict", mediaId: media.id });
      continue;
    }
    if (!fixedPageMediaIdentityMatches(media, sourceItem, manifest)) {
      conflicts.push({
        kind: "fixed-page-media-identity-conflict",
        mediaId: sourceItem.id,
        message:
          "A MediaAsset already exists for this canonical content id without matching importer provenance/checksum.",
      });
      items.push({ ...base, action: "conflict", mediaId: media.id });
      continue;
    }

    const bindingState = classifyFixedPageMediaBinding(media, sourceItem);
    if (bindingState.conflict) {
      conflicts.push(bindingState.conflict);
      items.push({ ...base, action: "conflict", mediaId: media.id });
      continue;
    }
    items.push(
      toFixedPageMediaPlanItem(sourceItem, {
        action: bindingState.needsBinding ? "bind" : "noop",
        bindingId: bindingState.binding?.id ?? null,
        mediaId: media.id,
      }),
    );
  }

  return { items, conflicts };
}

async function applyFixedPageMediaPlan({ client, manifest, plan, putObject }) {
  const sourceItemsById = new Map(arrayOrEmpty(manifest.fixedPageMedia).map((item) => [item.id, item]));
  const result = {
    uploadedCount: 0,
    createdBindingCount: 0,
    reusedCount: 0,
    objectsUploaded: 0,
  };

  for (const itemPlan of plan.fixedPageMedia) {
    const sourceItem = sourceItemsById.get(itemPlan.id);
    if (!sourceItem) {
      throw new PublicContentImportError(`Missing fixed-page media source item: ${itemPlan.id}`);
    }

    if (itemPlan.action === "upload") {
      const upload = await uploadFixedPageMediaSource({ putObject, sourceItem });
      await client.$transaction(async (transaction) => {
        await transaction.mediaAsset.create({
          data: toFixedPageMediaAssetCreateData(sourceItem, manifest, upload),
        });
        await transaction.mediaBinding.create({
          data: toFixedPageMediaBindingCreateData(sourceItem),
        });
      });
      result.uploadedCount += 1;
      result.createdBindingCount += 1;
      result.objectsUploaded += 1;
      continue;
    }

    if (itemPlan.action === "bind") {
      await client.mediaBinding.create({
        data: toFixedPageMediaBindingCreateData(sourceItem),
      });
      result.createdBindingCount += 1;
      result.reusedCount += 1;
      continue;
    }

    if (itemPlan.action === "noop") {
      await verifyExistingFixedPageMediaObject(sourceItem);
      result.reusedCount += 1;
    }
  }

  return result;
}

async function uploadFixedPageMediaSource({ putObject, sourceItem }) {
  const objectKey = buildFixedPageMediaObjectKey(sourceItem);
  const storageUpload = createPresignedPutUpload({
    objectKey,
    mimeType: sourceItem.mimeType,
  });
  await putObject({
    filePath: sourceItem.sourceLocalPath,
    mimeType: sourceItem.mimeType,
    upload: storageUpload.upload,
  });

  const metadata = await headObject({ objectKey });
  if (!metadata.exists) {
    throw new PublicContentImportError("Uploaded fixed-page media object was not found.", {
      id: sourceItem.id,
      objectKey,
    });
  }
  if (metadata.contentLength !== sourceItem.sizeBytes) {
    throw new PublicContentImportError("Uploaded fixed-page media object size mismatch.", {
      id: sourceItem.id,
      objectKey,
    });
  }

  return {
    bucket: storageUpload.bucket,
    objectKey,
    provider: storageUpload.provider,
    publicUrl: storageUpload.publicUrl,
    verifiedAt: new Date().toISOString(),
    verifiedContentType: normalizeContentType(metadata.contentType) || sourceItem.mimeType,
    verifiedEtag: metadata.etag ?? null,
    verifiedLastModified: metadata.lastModified ?? null,
  };
}

async function putPresignedObject({ filePath, mimeType, upload }) {
  const response = await fetch(upload.url, {
    body: readFileSync(filePath),
    headers: upload.headers ?? { "content-type": mimeType },
    method: upload.method,
  });
  if (!response.ok) {
    throw new PublicContentImportError("Fixed-page media object storage PUT failed.", {
      statusCode: response.status,
    });
  }
}

function toFixedPageMediaAssetCreateData(sourceItem, manifest, upload) {
  return {
    id: sourceItem.id,
    kind: sourceItem.kind,
    source_url: upload.publicUrl,
    title: sourceItem.title ?? null,
    alt_text: sourceItem.altText ?? null,
    mime_type: sourceItem.mimeType ?? null,
    size_bytes: sourceItem.sizeBytes,
    width: sourceItem.width ?? null,
    height: sourceItem.height ?? null,
    checksum: sourceItem.checksum,
    status: "active",
    metadata_json: {
      upload: {
        bucket: upload.bucket,
        completedAt: upload.verifiedAt,
        objectKey: upload.objectKey,
        originalFileName: sourceItem.sourcePublicPath?.split("/").pop() ?? sourceItem.id,
        provider: upload.provider,
        requestedMimeType: sourceItem.mimeType,
        requestedSizeBytes: sourceItem.sizeBytes,
        verifiedAt: upload.verifiedAt,
        verifiedEtag: upload.verifiedEtag,
        verifiedLastModified: upload.verifiedLastModified,
        verifiedMimeType: upload.verifiedContentType,
        verifiedSizeBytes: sourceItem.sizeBytes,
      },
      [FIXED_PAGE_MEDIA_METADATA_KEY]: toFixedPageMediaMetadata(sourceItem, manifest),
    },
  };
}

function toFixedPageMediaBindingCreateData(sourceItem) {
  return {
    media_id: sourceItem.id,
    owner_type: sourceItem.ownerType,
    owner_id: sourceItem.ownerId,
    usage: sourceItem.usage,
    sort_order: sourceItem.sortOrder,
    visibility: "visible",
  };
}

function toFixedPageMediaMetadata(sourceItem, manifest) {
  return {
    canonicalPath: sourceItem.canonicalPath,
    checksum: sourceItem.checksum,
    id: sourceItem.id,
    importer: FIXED_PAGE_MEDIA_IMPORTER_NAME,
    manifestId: manifest.manifestId,
    sourcePublicPath: sourceItem.sourcePublicPath,
    sourceRelativePath: sourceItem.sourceRelativePath ?? null,
  };
}

function toFixedPageMediaPlanItem(sourceItem, { action, bindingId = null, mediaId = null }) {
  return {
    action,
    altText: sourceItem.altText ?? null,
    bindingId,
    canonicalPath: sourceItem.canonicalPath,
    id: sourceItem.id,
    kind: sourceItem.kind,
    mediaId,
    ownerId: sourceItem.ownerId,
    ownerType: sourceItem.ownerType,
    requiresCosUpload: action === "upload",
    slug: sourceItem.slug,
    sortOrder: sourceItem.sortOrder,
    sourceLocalPath: sourceItem.sourceLocalPath,
    sourcePublicPath: sourceItem.sourcePublicPath,
    targetMediaAssetId: sourceItem.id,
    title: sourceItem.title ?? null,
    usage: sourceItem.usage,
  };
}

function validateFixedPageMediaSourceFile(sourceItem) {
  const conflicts = [];
  if (!existsSync(sourceItem.sourceLocalPath)) {
    conflicts.push({
      kind: "fixed-page-media-source-missing",
      mediaId: sourceItem.id,
      sourceLocalPath: sourceItem.sourceLocalPath,
    });
  }
  return conflicts;
}

function fixedPageMediaIdentityMatches(media, sourceItem, manifest) {
  const metadata = readFixedPageMediaMetadata(media);
  return (
    metadata?.importer === FIXED_PAGE_MEDIA_IMPORTER_NAME &&
    metadata?.manifestId === manifest.manifestId &&
    metadata?.id === sourceItem.id &&
    metadata?.checksum === sourceItem.checksum &&
    media.checksum === sourceItem.checksum
  );
}

function classifyFixedPageMediaBinding(media, sourceItem) {
  const matchingOwnerBindings = media.bindings.filter(
    (binding) =>
      binding.owner_type === sourceItem.ownerType &&
      binding.owner_id === sourceItem.ownerId &&
      binding.deleted_at == null,
  );
  if (matchingOwnerBindings.length > 1) {
    return {
      conflict: {
        kind: "fixed-page-media-ambiguous-binding",
        mediaId: sourceItem.id,
        bindingIds: matchingOwnerBindings.map((binding) => binding.id),
      },
    };
  }
  if (matchingOwnerBindings.length === 0) return { needsBinding: true };

  const binding = matchingOwnerBindings[0];
  if (
    binding.usage !== sourceItem.usage ||
    binding.sort_order !== sourceItem.sortOrder ||
    binding.visibility !== "visible"
  ) {
    return {
      conflict: {
        kind: "fixed-page-media-binding-conflict",
        mediaId: sourceItem.id,
        bindingId: binding.id,
      },
    };
  }
  return { binding, needsBinding: false };
}

async function verifyExistingFixedPageMediaObject(sourceItem) {
  const objectKey = buildFixedPageMediaObjectKey(sourceItem);
  const metadata = await headObject({ objectKey });
  if (!metadata.exists) {
    throw new PublicContentImportError("Existing fixed-page media object is missing.", {
      id: sourceItem.id,
      objectKey,
    });
  }
  if (metadata.contentLength !== sourceItem.sizeBytes) {
    throw new PublicContentImportError("Existing fixed-page media object size mismatch.", {
      id: sourceItem.id,
      objectKey,
    });
  }
}

function readFixedPageMediaMetadata(media) {
  const metadata = media?.metadata_json;
  if (!isPlainObject(metadata)) return null;
  const importerMetadata = metadata[FIXED_PAGE_MEDIA_METADATA_KEY];
  return isPlainObject(importerMetadata) ? importerMetadata : null;
}

function buildFixedPageMediaObjectKey(sourceItem) {
  const extension =
    extname(sourceItem.sourcePublicPath || sourceItem.sourceLocalPath || ".bin")
      .replace(/^\./, "")
      .toLowerCase() || "bin";
  const safeId = sourceItem.id
    .replace(/^static:/, "")
    .replace(/[^a-zA-Z0-9/_-]+/g, "-")
    .replace(/^\/+|\/+$/g, "");
  return [
    "public-content",
    "web-demo",
    "fixed-pages",
    safeId,
    `${sourceItem.checksum.slice(0, 16)}.${extension}`,
  ].join("/");
}

function createProductionSqliteBackup(runtimeContext) {
  if (!runtimeContext?.isProductionTarget) return null;
  const sqlitePath = resolveSqlitePath(runtimeContext.databaseUrl);
  if (!existsSync(sqlitePath)) {
    throw new PublicContentImportError("Production database backup source does not exist.", {
      databaseUrl: redactedDatabaseUrl(runtimeContext.databaseUrl),
    });
  }
  const backupPath = `${sqlitePath}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(sqlitePath, backupPath);
  return backupPath;
}

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) return "";
  const rawPath = databaseUrl.slice("file:".length).trim().replace(/^"|"$/g, "");
  if (isAbsolute(rawPath) || /^[A-Za-z]:[\\/]/.test(rawPath)) return rawPath;
  return resolve(process.cwd(), rawPath);
}

export async function countTables(client) {
  const entries = await Promise.all([
    ["fixedPage", countRequiredModel(client, "fixedPage")],
    ["cat", countRequiredModel(client, "cat")],
    ["breedingCatProfile", countRequiredModel(client, "breedingCatProfile")],
    ["kittenProfile", countOptionalModel(client, "kittenProfile")],
    ["litter", countOptionalModel(client, "litter")],
    ...DISALLOWED_COUNT_MODELS.map((model) => [model, countOptionalModel(client, model)]),
  ]);
  return Object.fromEntries(
    await Promise.all(entries.map(async ([name, value]) => [name, await value])),
  );
}

async function countRequiredModel(client, model) {
  const delegate = client[model];
  if (!delegate || typeof delegate.count !== "function") {
    throw new PublicContentImportError(`Prisma client is missing required model delegate: ${model}`);
  }
  return delegate.count();
}

async function countOptionalModel(client, model) {
  const delegate = client[model];
  if (!delegate || typeof delegate.count !== "function") return 0;
  try {
    return await delegate.count();
  } catch (error) {
    if (error && typeof error === "object" && error.code === "P2021") return 0;
    throw error;
  }
}

function toFixedPageData(page, existing, contentJsonMode = "merge") {
  const data = {
    title: page.title,
    status: page.status,
    content_schema_version: page.contentSchemaVersion,
    content_json: resolveFixedPageContentJson(
      existing?.content_json,
      page.contentJson,
      contentJsonMode,
    ),
    published_at:
      page.status === "published"
        ? existing?.status === "published" && existing.published_at
          ? existing.published_at
          : new Date()
        : null,
  };
  for (const [inputField, dataField] of Object.entries(OPTIONAL_FIXED_PAGE_FIELD_MAP)) {
    if (Object.hasOwn(page, inputField)) data[dataField] = page[inputField];
  }
  return data;
}

function toCatData(entry, existing) {
  return {
    name: entry.cat.name,
    gender: entry.cat.gender,
    color: entry.cat.color,
    lifecycle_status: entry.cat.lifecycleStatus,
    visibility: entry.cat.visibility,
    story_json: mergeCatStoryJson(existing?.story_json, entry.cat.storyJson),
  };
}

function toBreedingProfileData(entry) {
  return {
    breeding_role: entry.breedingProfile.breedingRole,
    reproductive_state: entry.breedingProfile.reproductiveState,
    status_label: entry.breedingProfile.statusLabel,
    sort_order: entry.breedingProfile.sortOrder,
  };
}

function getFixedPageOwnedFields(page) {
  const fields = [...FIXED_PAGE_OWNED_FIELDS];
  for (const [inputField, dataField] of Object.entries(OPTIONAL_FIXED_PAGE_FIELD_MAP)) {
    if (Object.hasOwn(page, inputField)) fields.push(dataField);
  }
  return fields;
}

function readPublicContentImportId(cat) {
  if (!cat) return null;
  const storyJson = cat.story_json;
  if (!isPlainObject(storyJson) || !isPlainObject(storyJson.source)) return null;
  const importId = storyJson.source.publicContentImportId;
  return typeof importId === "string" && importId.trim() ? importId : null;
}

function getFixedPageContentJsonMode(manifest) {
  return manifest.fixedPageContentJsonMode ?? "merge";
}

function resolveFixedPageContentJson(existing, manifestContentJson, mode) {
  if (mode === "replace") return mergePlainJsonObjects(null, manifestContentJson);
  return mergePlainJsonObjects(existing, manifestContentJson);
}

function mergeCatStoryJson(existing, manifestStoryJson) {
  const merged = mergePlainJsonObjects(existing, manifestStoryJson);
  merged.story = manifestStoryJson.story;
  merged.source = mergePlainJsonObjects(existing?.source, pickImporterSource(manifestStoryJson.source));
  return merged;
}

function pickImporterSource(source) {
  const picked = {};
  if (!isPlainObject(source)) return picked;
  for (const key of IMPORTER_SOURCE_KEYS) {
    if (Object.hasOwn(source, key)) picked[key] = source[key];
  }
  return picked;
}

function mergePlainJsonObjects(existing, next) {
  const merged = {};
  copySafeJsonEntries(merged, existing);
  copySafeJsonEntries(merged, next);
  return merged;
}

function copySafeJsonEntries(target, source) {
  if (!isPlainObject(source)) return;
  for (const [key, value] of Object.entries(source)) {
    if (UNSAFE_JSON_KEYS.has(key)) continue;
    target[key] = value;
  }
}

function assertPublicContentApplyRuntime(runtimeContext) {
  if (!runtimeContext) return assertPublicContentImporterRuntime();
  if (runtimeContext[PUBLIC_CONTENT_IMPORT_RUNTIME_VALIDATED] !== true) {
    throw new PublicContentImportError("Public content apply requires validated runtime context.");
  }
  return runtimeContext;
}

function diffAction(existing, next, fields) {
  return diffFields(existing, next, fields).length === 0 ? "noop" : "update";
}

function diffFields(existing, next, fields) {
  const changes = [];
  for (const field of fields) {
    if (!jsonEqual(existing[field] ?? null, next[field] ?? null)) {
      changes.push({
        field,
        from: existing[field] ?? null,
        to: next[field] ?? null,
      });
    }
  }
  return changes;
}

function validateUniqueCollection({ errors, items, keyOf, label, allowEmpty = false }) {
  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (!allowEmpty && items.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return;
  }
  const seen = new Set();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    if (seen.has(key)) errors.push(`${label} contains duplicate value: ${key}`);
    seen.add(key);
  }
}

function requiredString(value, fieldName, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${fieldName} must be a non-empty string`);
  }
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function collectUnsafeJsonKeyErrors(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUnsafeJsonKeyErrors(item, `${path}[${index}]`, errors));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, nestedValue] of Object.entries(value)) {
    if (UNSAFE_JSON_KEYS.has(key)) errors.push(`${path}.${key} is not allowed`);
    collectUnsafeJsonKeyErrors(nestedValue, `${path}.${key}`, errors);
  }
}

function jsonEqual(left, right) {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortJson(nestedValue)]),
  );
}

function isSqliteDatabaseUrl(databaseUrl) {
  return databaseUrl.trim().startsWith("file:");
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

function normalizeContentType(value) {
  if (typeof value !== "string") return "";
  return value.split(";")[0].trim().toLowerCase();
}
