import { config } from "../config/env.mjs";
import { badRequest } from "../utils/errors.mjs";
import {
  activatePendingMediaUpload,
  createMedia,
  ensureMediaOwnerExists,
  expirePendingMediaUploads,
  getMedia,
  getMediaUploadRecord,
} from "./media-service.mjs";
import { buildObjectKey, createPresignedPutUpload, headObject } from "./object-storage-service.mjs";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const DEFAULT_PENDING_UPLOAD_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PENDING_UPLOAD_EXPIRY_BATCH_SIZE = 100;
const IMAGE_UPLOAD_FIELDS = [
  "fileName",
  "mimeType",
  "sizeBytes",
  "title",
  "altText",
  "checksum",
  "width",
  "height",
  "ownerType",
  "ownerId",
  "usage",
  "sortOrder",
  "bindingVisibility",
];
const COMPLETE_UPLOAD_FIELDS = ["checksum", "sizeBytes", "width", "height", "thumbnailUrl"];

export async function requestImageUpload(input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, IMAGE_UPLOAD_FIELDS);

  const fileName = requiredString(input.fileName, "fileName");
  assertSafeFileName(fileName);
  const mimeType = normalizeImageMimeType(input.mimeType);
  const sizeBytes = requiredPositiveInteger(input.sizeBytes, "sizeBytes");
  if (sizeBytes > config.storage.maxImageBytes) {
    throw badRequest("Image is larger than the configured upload limit", {
      maxImageBytes: config.storage.maxImageBytes,
    });
  }
  const width = optionalPositiveInteger(input.width, "width");
  const height = optionalPositiveInteger(input.height, "height");
  const checksum = optionalString(input.checksum, "checksum");
  const ownerType = requiredString(input.ownerType, "ownerType");
  const ownerId = requiredString(input.ownerId, "ownerId");
  await ensureMediaOwnerExists(ownerType, ownerId);

  const objectKey = buildObjectKey({ fileName, mimeType });
  const storageUpload = createPresignedPutUpload({ objectKey, mimeType });

  const mediaInput = {
    kind: "image",
    sourceUrl: storageUpload.publicUrl,
    title: optionalString(input.title, "title") ?? null,
    altText: optionalString(input.altText, "altText") ?? null,
    mimeType,
    sizeBytes,
    width,
    height,
    checksum,
    status: "pending",
    metadataJson: {
      upload: {
        provider: storageUpload.provider,
        bucket: storageUpload.bucket,
        objectKey: storageUpload.objectKey,
        originalFileName: fileName,
        requestedMimeType: mimeType,
        requestedSizeBytes: sizeBytes,
        expiresAt: storageUpload.upload.expiresAt,
      },
    },
    ownerType,
    ownerId,
    usage: optionalString(input.usage, "usage") ?? "gallery",
    sortOrder: optionalNonNegativeInteger(input.sortOrder, "sortOrder") ?? 0,
    bindingVisibility: optionalString(input.bindingVisibility, "bindingVisibility") ?? "visible",
  };

  const media = await createMedia(mediaInput);

  return {
    media,
    upload: storageUpload.upload,
    objectKey: storageUpload.objectKey,
    publicUrl: storageUpload.publicUrl,
  };
}

export async function completeMediaUpload(mediaId, input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, COMPLETE_UPLOAD_FIELDS);

  const media = await getMediaUploadRecord(mediaId);
  if (media.status === "active" && getUploadMetadata(media)?.verifiedAt) {
    assertIdempotentCompletion(media, input);
    return getMedia(mediaId);
  }
  if (media.status !== "pending") {
    throw badRequest("Only pending media uploads can be completed");
  }

  const verification = await verifyUploadedObject(media, input);
  const metadataJson = mergeCompletedUploadMetadata(media.metadata_json, verification);
  return activatePendingMediaUpload(mediaId, {
    status: "active",
    checksum: optionalString(input.checksum, "checksum") ?? media.checksum,
    size_bytes: verification.contentLength,
    width: optionalPositiveInteger(input.width, "width") ?? media.width,
    height: optionalPositiveInteger(input.height, "height") ?? media.height,
    thumbnail_url: optionalString(input.thumbnailUrl, "thumbnailUrl") ?? media.thumbnail_url,
    metadata_json: metadataJson,
  });
}

export async function expireStalePendingImageUploads({
  now = new Date(),
  staleAfterMs = DEFAULT_PENDING_UPLOAD_STALE_AFTER_MS,
  batchSize = DEFAULT_PENDING_UPLOAD_EXPIRY_BATCH_SIZE,
  reason = "stale_pending_upload",
} = {}) {
  const staleBefore = new Date(now.getTime() - staleAfterMs);
  return expirePendingMediaUploads({ limit: batchSize, reason, staleBefore });
}

async function verifyUploadedObject(media, input) {
  const upload = getUploadMetadata(media);
  if (!upload?.objectKey) {
    throw badRequest("Media upload metadata is missing its storage object key");
  }

  const metadata = await headObject({ objectKey: upload.objectKey });
  if (!metadata.exists) {
    throw badRequest("Uploaded object was not found in object storage");
  }

  const contentLength = metadata.contentLength;
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw badRequest("Uploaded object has an invalid or empty content length");
  }
  if (contentLength > config.storage.maxImageBytes) {
    throw badRequest("Uploaded object is larger than the configured upload limit", {
      maxImageBytes: config.storage.maxImageBytes,
    });
  }

  const requestedSizeBytes = normalizeOptionalStoredInteger(upload.requestedSizeBytes);
  if (requestedSizeBytes != null && requestedSizeBytes !== contentLength) {
    throw badRequest("Uploaded object size does not match the declared upload size");
  }

  const completionSizeBytes = optionalPositiveInteger(input.sizeBytes, "sizeBytes");
  if (completionSizeBytes != null && completionSizeBytes !== contentLength) {
    throw badRequest("Completed upload size does not match object storage metadata");
  }

  const requestedMimeType = normalizeStoredMimeType(upload.requestedMimeType ?? media.mime_type);
  const actualMimeType = normalizeReturnedContentType(metadata.contentType);
  if (!requestedMimeType) {
    throw badRequest("Media upload metadata is missing the requested MIME type");
  }
  if (!actualMimeType) {
    throw badRequest("Uploaded object content type could not be verified");
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(actualMimeType)) {
    throw badRequest("Uploaded object content type is not an allowed image MIME type");
  }
  if (requestedMimeType !== actualMimeType) {
    throw badRequest("Uploaded object content type does not match the requested MIME type");
  }

  return {
    contentLength,
    contentType: actualMimeType,
    etag: metadata.etag ?? null,
    lastModified: metadata.lastModified ?? null,
    objectKey: upload.objectKey,
  };
}

function assertIdempotentCompletion(media, input) {
  const requestedSizeBytes = optionalPositiveInteger(input.sizeBytes, "sizeBytes");
  if (requestedSizeBytes != null && media.size_bytes != null && requestedSizeBytes !== media.size_bytes) {
    throw badRequest("Completed upload size does not match the existing media asset");
  }
}

function mergeCompletedUploadMetadata(value, verification) {
  const metadata = isPlainObject(value) ? { ...value } : {};
  const upload = isPlainObject(metadata.upload) ? { ...metadata.upload } : {};
  metadata.upload = {
    ...upload,
    verifiedAt: new Date().toISOString(),
    verifiedSizeBytes: verification.contentLength,
    verifiedMimeType: verification.contentType,
    verifiedEtag: verification.etag,
    verifiedLastModified: verification.lastModified,
    completedAt: new Date().toISOString(),
  };
  return metadata;
}

function getUploadMetadata(media) {
  const metadata = media?.metadata_json;
  if (!isPlainObject(metadata) || !isPlainObject(metadata.upload)) return null;
  return metadata.upload;
}

function normalizeImageMimeType(value) {
  const mimeType = requiredString(value, "mimeType").toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw badRequest("mimeType must be a supported raster image type");
  }
  return mimeType;
}

function normalizeStoredMimeType(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim().toLowerCase();
}

function normalizeReturnedContentType(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.split(";")[0].trim().toLowerCase() || null;
}

function assertPlainObject(value) {
  if (!isPlainObject(value)) {
    throw badRequest("Request body must be a JSON object");
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertNoUnknownFields(input, allowedFields) {
  const allowed = new Set(allowedFields);
  const unknownFields = Object.keys(input).filter((field) => !allowed.has(field));
  if (unknownFields.length > 0) {
    throw badRequest("Request body contains unsupported fields", {
      fields: unknownFields,
    });
  }
}

function requiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest(`${fieldName} is required`);
  }
  return value.trim();
}

function optionalString(value, fieldName) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
  return value.trim();
}

function requiredPositiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function optionalPositiveInteger(value, fieldName) {
  if (value == null || value === "") return null;
  return requiredPositiveInteger(value, fieldName);
}

function optionalNonNegativeInteger(value, fieldName) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw badRequest(`${fieldName} must be a non-negative integer`);
  }
  return parsed;
}

function normalizeOptionalStoredInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function assertSafeFileName(fileName) {
  if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("\0")) {
    throw badRequest("fileName must not contain path separators");
  }
}
