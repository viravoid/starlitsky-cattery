import crypto from "node:crypto";
import {
  createPresignedGetUrl,
  getAllowedStorageBuckets,
  getObject,
  headObject,
  listObjects,
} from "./object-storage-service.mjs";

const MAX_REQUESTS = 5;
const MAX_LIST_RESPONSE_BYTES = 128 * 1024;
const MAX_ALLOWED_DOWNLOAD_BYTES = 1024 * 1024;
const DEFAULT_DOWNLOAD_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

export class LightCosReadProbeError extends Error {
  constructor(message, report = null) {
    super(message);
    this.name = "LightCosReadProbeError";
    this.report = report;
  }
}

export async function runLightCosReadProbe({
  bucket,
  prefix,
  expectedFirstKey,
  expectedSecondKey,
  objectKey,
  confirmedEndpoint,
  confirmReadOnlyProbe = false,
  maxDownloadBytes = DEFAULT_DOWNLOAD_BYTES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImplementation = global.fetch,
} = {}) {
  if (!confirmReadOnlyProbe) {
    throw new LightCosReadProbeError("Probe requires the explicit read-only confirmation flag");
  }
  if (!Number.isSafeInteger(maxDownloadBytes) || maxDownloadBytes < 1) {
    throw new LightCosReadProbeError("Probe max download bytes must be a positive integer");
  }
  if (maxDownloadBytes > MAX_ALLOWED_DOWNLOAD_BYTES) {
    throw new LightCosReadProbeError(
      `Probe max download bytes cannot exceed ${MAX_ALLOWED_DOWNLOAD_BYTES}`,
    );
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
    throw new LightCosReadProbeError("Probe timeout must be an integer from 1 to 30000 ms");
  }
  assertNonEmptyString(bucket, "source bucket");
  assertNonEmptyString(prefix, "prefix");
  for (const [name, value] of [
    ["expected first key", expectedFirstKey],
    ["expected second key", expectedSecondKey],
    ["object key", objectKey],
  ]) {
    assertSafeObjectKey(value, name);
    if (!value.startsWith(prefix)) {
      throw new LightCosReadProbeError(`Probe ${name} must be inside the approved prefix`);
    }
  }
  if (expectedFirstKey === expectedSecondKey) {
    throw new LightCosReadProbeError("Probe requires two distinct expected object keys");
  }
  if (![expectedFirstKey, expectedSecondKey].includes(objectKey)) {
    throw new LightCosReadProbeError("Probe object key must be one of the two expected list keys");
  }

  const storage = getAllowedStorageBuckets().find((entry) => entry.bucket === bucket);
  if (!storage || storage.provider !== "lightcos") {
    throw new LightCosReadProbeError("Probe bucket must be an allowlisted LightCOS read bucket");
  }
  const endpoint = validateEndpoint(storage.endpoint);
  if (normalizeEndpoint(confirmedEndpoint) !== endpoint.toString()) {
    throw new LightCosReadProbeError(
      "Probe requires exact confirmation of the configured endpoint",
    );
  }
  if (typeof fetchImplementation !== "function") {
    throw new LightCosReadProbeError("Probe fetch implementation is unavailable");
  }

  const originalFetch = global.fetch;
  const http = [];
  let requestCount = 0;
  const endpointBasePath = endpoint.pathname.replace(/\/$/, "");
  global.fetch = async (input, init = {}) => {
    const requestUrl = new URL(input);
    const method = String(init.method || "GET").toUpperCase();
    if (!new Set(["GET", "HEAD"]).has(method) || init.body != null) {
      throw new LightCosReadProbeError("Probe blocked a non-read-only HTTP request", {
        http,
        requestCount,
      });
    }
    if (
      requestUrl.origin !== endpoint.origin ||
      (endpointBasePath &&
        requestUrl.pathname !== endpointBasePath &&
        !requestUrl.pathname.startsWith(`${endpointBasePath}/`))
    ) {
      throw new LightCosReadProbeError("Probe blocked a request outside the confirmed endpoint", {
        http,
        requestCount,
      });
    }
    requestCount += 1;
    if (requestCount > MAX_REQUESTS) {
      throw new LightCosReadProbeError("Probe exceeded the five-request limit", {
        http,
        requestCount,
      });
    }
    const response = await fetchImplementation(input, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const summary = {
      sequence: requestCount,
      method,
      status: response.status,
      requestId: readRequestId(response),
      errorCode: null,
    };
    if (!response.ok && method === "GET") {
      summary.errorCode = await readErrorCode(response.clone());
    }
    http.push(summary);
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => {});
      throw new LightCosReadProbeError("Probe refused an HTTP redirect", {
        http,
        requestCount,
      });
    }
    return response;
  };

  try {
    const firstPage = await listObjects({
      bucket,
      maxKeys: 1,
      maxResponseBytes: MAX_LIST_RESPONSE_BYTES,
      prefix,
    });
    assertExactPage(firstPage, expectedFirstKey, "first");
    if (!firstPage.isTruncated || !firstPage.nextContinuationToken) {
      throw new LightCosReadProbeError("Probe first page did not provide a second-page marker");
    }
    const secondPage = await listObjects({
      bucket,
      continuationToken: firstPage.nextContinuationToken,
      maxKeys: 1,
      maxResponseBytes: MAX_LIST_RESPONSE_BYTES,
      prefix,
    });
    assertExactPage(secondPage, expectedSecondKey, "second");

    const metadata = await headObject({ bucket, objectKey });
    if (!metadata.exists) throw new LightCosReadProbeError("Probe HEAD object was not found");
    if (!Number.isSafeInteger(metadata.contentLength)) {
      throw new LightCosReadProbeError("Probe HEAD did not return a usable Content-Length");
    }
    if (metadata.contentLength > maxDownloadBytes) {
      throw new LightCosReadProbeError("Probe object exceeds the approved download byte limit");
    }

    const authorizedObject = await getObject({ bucket, objectKey, maxBytes: maxDownloadBytes });
    if (!authorizedObject.exists) {
      throw new LightCosReadProbeError("Probe authorized GET object was not found");
    }
    const authorizedSha256 = sha256(authorizedObject.body);

    const presigned = createPresignedGetUrl({ bucket, objectKey });
    const presignedResponse = await global.fetch(presigned.url, { method: "GET" });
    if (!presignedResponse.ok) {
      throw new LightCosReadProbeError("Probe presigned GET failed");
    }
    const presignedBody = await readBodyLimited(presignedResponse, maxDownloadBytes);
    const presignedSha256 = sha256(presignedBody);
    if (presignedSha256 !== authorizedSha256) {
      throw new LightCosReadProbeError("Probe GET methods returned different object bytes");
    }
    if (requestCount !== MAX_REQUESTS) {
      throw new LightCosReadProbeError("Probe did not use the expected five HTTP requests");
    }

    return {
      status: "passed",
      requestCount,
      endpointOrigin: endpoint.origin,
      bucket,
      prefixSha256: sha256(prefix),
      expectedKeySha256: [expectedFirstKey, expectedSecondKey].map(sha256),
      testedObjectKeySha256: sha256(objectKey),
      firstPageTruncated: firstPage.isTruncated,
      secondPageTruncated: secondPage.isTruncated,
      object: {
        bytes: authorizedObject.body.length,
        contentLength: metadata.contentLength,
        contentType: metadata.contentType,
        etagPresent: Boolean(metadata.etag),
        sha256: authorizedSha256,
      },
      http,
    };
  } catch (error) {
    if (error instanceof LightCosReadProbeError) {
      if (!error.report) error.report = { http, requestCount };
      throw error;
    }
    throw new LightCosReadProbeError(error instanceof Error ? error.message : String(error), {
      http,
      requestCount,
    });
  } finally {
    global.fetch = originalFetch;
  }
}

function validateEndpoint(value) {
  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    throw new LightCosReadProbeError("Probe LightCOS endpoint is invalid");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new LightCosReadProbeError("Probe LightCOS endpoint must be a plain HTTPS endpoint");
  }
  endpoint.pathname = endpoint.pathname.endsWith("/") ? endpoint.pathname : `${endpoint.pathname}/`;
  return endpoint;
}

function normalizeEndpoint(value) {
  try {
    return validateEndpoint(value).toString();
  } catch {
    return "";
  }
}

function assertExactPage(page, expectedKey, label) {
  if (page.objects.length !== 1 || page.objects[0]?.objectKey !== expectedKey) {
    throw new LightCosReadProbeError(`Probe ${label} list page did not match the approved key`);
  }
}

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new LightCosReadProbeError(`Probe ${name} is required`);
  }
}

function assertSafeObjectKey(value, name) {
  assertNonEmptyString(value, name);
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

function readRequestId(response) {
  return (
    response.headers.get("x-cos-request-id") ||
    response.headers.get("x-ci-request-id") ||
    response.headers.get("x-cos-trace-id") ||
    null
  );
}

async function readErrorCode(response) {
  try {
    const body = (await readBodyLimited(response, 64 * 1024)).toString("utf8");
    return body.match(/<Code>([^<]{1,128})<\/Code>/)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function readBodyLimited(response, maxBytes) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isSafeInteger(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new LightCosReadProbeError("Probe response exceeds the approved byte limit");
  }
  if (!response.body) return Buffer.alloc(0);
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      await response.body.cancel().catch(() => {});
      throw new LightCosReadProbeError("Probe response exceeds the approved byte limit");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, totalBytes);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
