import { config } from "../config/env.mjs";
import { badRequest } from "../utils/errors.mjs";
import { createMedia, getMedia, updateMedia } from "./media-service.mjs";
import { buildObjectKey, createPresignedPutUpload } from "./object-storage-service.mjs";

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
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
  const mimeType = normalizeImageMimeType(input.mimeType);
  const sizeBytes = requiredPositiveInteger(input.sizeBytes, "sizeBytes");
  const width = optionalPositiveInteger(input.width, "width");
  const height = optionalPositiveInteger(input.height, "height");
  const checksum = optionalString(input.checksum, "checksum");
  const objectKey = buildObjectKey({ fileName, mimeType });
  const storageUpload = createPresignedPutUpload({ objectKey, mimeType });

  if (sizeBytes > config.storage.maxImageBytes) {
    throw badRequest("Image is larger than the configured upload limit", {
      maxImageBytes: config.storage.maxImageBytes,
    });
  }

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
  };

  copyOptionalField(mediaInput, input, "ownerType");
  copyOptionalField(mediaInput, input, "ownerId");
  copyOptionalField(mediaInput, input, "usage");
  copyOptionalField(mediaInput, input, "sortOrder");
  copyOptionalField(mediaInput, input, "bindingVisibility");

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

  const media = await getMedia(mediaId);
  if (media.status !== "pending") {
    throw badRequest("Only pending media uploads can be completed");
  }

  const metadataJson = mergeCompletedUploadMetadata(media.metadataJson);
  return updateMedia(mediaId, {
    status: "active",
    checksum: optionalString(input.checksum, "checksum") ?? media.checksum,
    sizeBytes: optionalPositiveInteger(input.sizeBytes, "sizeBytes") ?? media.sizeBytes,
    width: optionalPositiveInteger(input.width, "width") ?? media.width,
    height: optionalPositiveInteger(input.height, "height") ?? media.height,
    thumbnailUrl: optionalString(input.thumbnailUrl, "thumbnailUrl") ?? media.thumbnailUrl,
    metadataJson,
  });
}

function mergeCompletedUploadMetadata(value) {
  const metadata = isPlainObject(value) ? { ...value } : {};
  const upload = isPlainObject(metadata.upload) ? { ...metadata.upload } : {};
  metadata.upload = {
    ...upload,
    completedAt: new Date().toISOString(),
  };
  return metadata;
}

function normalizeImageMimeType(value) {
  const mimeType = requiredString(value, "mimeType").toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw badRequest("mimeType must be a supported raster image type");
  }
  return mimeType;
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

function copyOptionalField(target, source, fieldName) {
  if (Object.hasOwn(source, fieldName)) {
    target[fieldName] = source[fieldName];
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
