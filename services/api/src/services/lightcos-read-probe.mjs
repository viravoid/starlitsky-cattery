import crypto from "node:crypto";
import { getAllowedStorageBuckets, getObject, headObject } from "./object-storage-service.mjs";

const MAX_ALLOWED_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_DOWNLOAD_BYTES = 1024 * 1024;

export class LightCosReadProbeError extends Error {
  constructor(message, report = null) {
    super(message);
    this.name = "LightCosReadProbeError";
    this.report = report;
  }
}

export async function runLightCosReadProbe({
  bucket,
  objectKey,
  confirmedEndpoint,
  confirmReadOnlyProbe = false,
  expectedSizeBytes = null,
  expectedSha256 = "",
  maxDownloadBytes = DEFAULT_DOWNLOAD_BYTES,
  storage = { getObject, headObject },
} = {}) {
  if (!confirmReadOnlyProbe) {
    throw new LightCosReadProbeError("Probe requires the explicit read-only confirmation flag");
  }
  assertSafeObjectKey(objectKey, "object key");
  if (!Number.isSafeInteger(maxDownloadBytes) || maxDownloadBytes < 1) {
    throw new LightCosReadProbeError("Probe max download bytes must be a positive integer");
  }
  if (maxDownloadBytes > MAX_ALLOWED_DOWNLOAD_BYTES) {
    throw new LightCosReadProbeError(
      `Probe max download bytes cannot exceed ${MAX_ALLOWED_DOWNLOAD_BYTES}`,
    );
  }
  if (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes < 0) {
    throw new LightCosReadProbeError("Probe expected size must be a non-negative integer");
  }
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) {
    throw new LightCosReadProbeError("Probe expected SHA-256 must be 64 hexadecimal characters");
  }

  const configured = getAllowedStorageBuckets().find((entry) => entry.bucket === bucket);
  if (!configured || configured.provider !== "lightcos") {
    throw new LightCosReadProbeError("Probe bucket must be an allowlisted Lighthouse COS bucket");
  }
  const endpoint = normalizeEndpoint(configured.endpoint);
  if (!endpoint || normalizeEndpoint(confirmedEndpoint) !== endpoint) {
    throw new LightCosReadProbeError(
      "Probe requires exact confirmation of the configured standard COS endpoint",
    );
  }

  try {
    const metadata = await storage.headObject({ bucket, objectKey });
    if (!metadata?.exists) throw new LightCosReadProbeError("Probe HEAD object was not found");
    if (!Number.isSafeInteger(metadata.contentLength)) {
      throw new LightCosReadProbeError("Probe HEAD did not return a usable Content-Length");
    }
    if (metadata.contentLength > maxDownloadBytes) {
      throw new LightCosReadProbeError("Probe object exceeds the approved download byte limit");
    }
    if (metadata.contentLength !== expectedSizeBytes) {
      throw new LightCosReadProbeError("Probe HEAD size did not match the approved expected size");
    }

    const object = await storage.getObject({ bucket, objectKey, maxBytes: maxDownloadBytes });
    if (!object?.exists) throw new LightCosReadProbeError("Probe GET object was not found");
    const actualSha256 = sha256(object.body);
    if (object.body.length !== metadata.contentLength) {
      throw new LightCosReadProbeError("Probe HEAD and GET sizes differed");
    }
    if (actualSha256 !== expectedSha256.toLowerCase()) {
      throw new LightCosReadProbeError("Probe GET SHA-256 did not match the approved value");
    }

    return {
      status: "passed",
      requestCount: 2,
      endpointOrigin: new URL(endpoint).origin,
      bucket,
      testedObjectKeySha256: sha256(objectKey),
      object: {
        bytes: object.body.length,
        contentLength: metadata.contentLength,
        contentType: metadata.contentType,
        etagPresent: Boolean(metadata.etag),
        sha256: actualSha256,
      },
    };
  } catch (error) {
    if (error instanceof LightCosReadProbeError) throw error;
    throw new LightCosReadProbeError(error instanceof Error ? error.message : String(error));
  }
}

function normalizeEndpoint(value) {
  try {
    const endpoint = new URL(value);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      !/^.+\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(endpoint.host)
    ) {
      return "";
    }
    endpoint.pathname = endpoint.pathname.replace(/\/+$/, "") || "/";
    return endpoint.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function assertSafeObjectKey(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new LightCosReadProbeError(`Probe ${name} is required`);
  }
  const segments = value.split("/");
  if (
    value.startsWith("/") ||
    value.includes("\0") ||
    value.includes("\\") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new LightCosReadProbeError(`Probe ${name} is invalid`);
  }
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
