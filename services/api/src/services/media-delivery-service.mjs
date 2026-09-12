import { createPresignedGetUrl } from "./object-storage-service.mjs";

export function resolveMediaSourceUrl(media) {
  const objectKey = getManagedObjectKey(media);
  if (!objectKey) return media?.source_url ?? "";

  return createPresignedGetUrl({ objectKey }).url;
}

export function resolveMediaThumbnailUrl(media) {
  return media?.thumbnail_url ?? null;
}

export function getManagedObjectKey(media) {
  const upload = getManagedUploadMetadata(media);
  const objectKey = upload?.objectKey;
  if (!isSafeObjectKey(objectKey)) return null;
  return objectKey;
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
  return Boolean(trimmed) && !trimmed.includes("\0") && !trimmed.startsWith("/");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
