import crypto from "node:crypto";

export class SupplementalManifestError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "SupplementalManifestError";
    this.details = details;
  }
}

export function calculateSupplementalObjectManifestSha256(manifest) {
  return sha256(stableJson(normalizeSupplementalObjectManifest(manifest)));
}

export function normalizeSupplementalObjectManifest(manifest) {
  const approvalReference = stringOrNull(manifest?.approvalReference);
  if (
    manifest?.schemaVersion !== 1 ||
    !approvalReference ||
    !Array.isArray(manifest.objects) ||
    manifest.objects.length === 0
  ) {
    throw new SupplementalManifestError("A valid supplemental object manifest is required");
  }

  const seen = new Set();
  const objects = manifest.objects
    .map((item, index) => {
      const objectKey = safeObjectKey(item?.objectKey);
      if (!objectKey) {
        throw new SupplementalManifestError(
          "Supplemental manifest contains an invalid object key",
          { index },
        );
      }
      if (seen.has(objectKey)) {
        throw new SupplementalManifestError(
          "Supplemental manifest contains a duplicate object key",
          { objectKey },
        );
      }
      seen.add(objectKey);

      const sizeBytes = item.sizeBytes == null ? null : Number(item.sizeBytes);
      if (sizeBytes != null && (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0)) {
        throw new SupplementalManifestError("Supplemental manifest contains an invalid size", {
          objectKey,
        });
      }
      const evidence = stringOrNull(item.evidence);
      if (!evidence) {
        throw new SupplementalManifestError(
          "Every supplemental object requires non-empty source evidence",
          { objectKey },
        );
      }
      return {
        objectKey,
        sizeBytes,
        mimeType: stringOrNull(item.mimeType),
        checksum: stringOrNull(item.checksum),
        evidence,
      };
    })
    .sort((left, right) => left.objectKey.localeCompare(right.objectKey));

  return { schemaVersion: 1, approvalReference, objects };
}

export function resolveApprovedSupplementalObjectManifest({
  approvedSupplementalManifestSha256,
  manifest,
}) {
  if (manifest == null) {
    if (approvedSupplementalManifestSha256) {
      throw new SupplementalManifestError(
        "A supplemental manifest approval hash was provided without a manifest",
      );
    }
    return { audit: null, objects: [] };
  }

  const normalized = normalizeSupplementalObjectManifest(manifest);
  const manifestSha256 = sha256(stableJson(normalized));
  if (approvedSupplementalManifestSha256 !== manifestSha256) {
    throw new SupplementalManifestError(
      "Supplemental objects require a separate approval using the exact manifest SHA-256",
      { calculatedSupplementalManifestSha256: manifestSha256 },
    );
  }
  return {
    audit: {
      approvalReference: normalized.approvalReference,
      approvedManifestSha256: approvedSupplementalManifestSha256,
      manifestSha256,
    },
    objects: normalized.objects,
  };
}

export function safeObjectKey(value) {
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

function stringOrNull(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function stableJson(value) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
