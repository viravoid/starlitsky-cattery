import { config } from "../config/env.mjs";
import { createPresignedGetUrl, getAllowedStorageBuckets } from "./object-storage-service.mjs";

export function resolveMediaSourceUrl(media) {
  const objectKey = getManagedObjectKey(media);
  if (!objectKey) return media?.source_url ?? "";

  const bucket = getManagedStorageBucket(media);
  if (!bucket) return media?.source_url ?? "";

  return createPresignedGetUrl({ bucket, objectKey }).url;
}

export function resolveMediaThumbnailUrl(media) {
  const thumbnailUrl = media?.thumbnail_url;
  if (!thumbnailUrl) return null;
  if (thumbnailUrl === media?.source_url) return resolveMediaSourceUrl(media);

  const reference = inferManagedStorageReference(thumbnailUrl);
  return reference ? createPresignedGetUrl(reference).url : thumbnailUrl;
}

export function getManagedObjectKey(media) {
  const upload = getManagedUploadMetadata(media);
  const objectKey = upload?.objectKey;
  if (!isSafeObjectKey(objectKey)) return null;
  return objectKey;
}

export function getManagedStorageBucket(media) {
  const upload = getManagedUploadMetadata(media);
  if (typeof upload?.bucket === "string" && upload.bucket.trim()) {
    return upload.bucket.trim();
  }

  const sourceReference = inferManagedStorageReference(media?.source_url);
  if (sourceReference) return sourceReference.bucket;

  const legacyBucket = config.storage.legacyBucket.trim();
  return legacyBucket || null;
}

export function isPresignedStorageUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return (
      url.searchParams.has("X-Amz-Signature") ||
      url.searchParams.has("X-Amz-Credential") ||
      url.searchParams.has("X-Amz-Algorithm")
    );
  } catch {
    return false;
  }
}

function getManagedUploadMetadata(media) {
  const metadata = media?.metadata_json;
  if (!isPlainObject(metadata) || !isPlainObject(metadata.upload)) return null;
  return metadata.upload;
}

function isSafeObjectKey(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  const segments = trimmed.split("/");
  return (
    Boolean(trimmed) &&
    !trimmed.includes("\0") &&
    !trimmed.includes("\\") &&
    !trimmed.startsWith("/") &&
    segments.every((segment) => segment && segment !== "." && segment !== "..")
  );
}

function inferManagedStorageReference(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let sourceUrl;
  try {
    sourceUrl = new URL(value);
  } catch {
    return null;
  }

  for (const storage of getAllowedStorageBuckets()) {
    for (const configuredUrl of [storage.endpoint, storage.publicBaseUrl]) {
      try {
        const baseUrl = new URL(configuredUrl);
        if (baseUrl.origin !== sourceUrl.origin) continue;
        const basePath = baseUrl.pathname.replace(/^\/+|\/+$/g, "");
        const sourcePath = decodeURIComponent(sourceUrl.pathname).replace(/^\/+/, "");
        if (basePath && !sourcePath.startsWith(`${basePath}/`)) continue;
        const objectKey = basePath ? sourcePath.replace(`${basePath}/`, "") : sourcePath;
        if (isSafeObjectKey(objectKey)) return { bucket: storage.bucket, objectKey };
      } catch {
        // Invalid server-side storage config is rejected when a signature is requested.
      }
    }
  }
  return null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
