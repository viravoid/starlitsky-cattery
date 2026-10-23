import crypto from "node:crypto";
import COS from "cos-nodejs-sdk-v5";
import { config } from "../config/env.mjs";
import { serviceUnavailable } from "../utils/errors.mjs";

const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";
const SIGNING_SERVICE = "s3";
const LIGHTCOS_PROVIDER = "lightcos";
let testObjectStorageClient = null;
let testCosSdkClientFactory = null;

export function setObjectStorageTestClient(client) {
  testObjectStorageClient = client;
}

export function setCosSdkTestClientFactory(factory) {
  testCosSdkClientFactory = factory;
}

export function createPresignedPutUpload({ objectKey, mimeType }) {
  assertStorageObjectKey(objectKey);
  const storage = getStorageConfig();
  const now = new Date();
  const expiresSeconds = Math.min(storage.uploadExpiresSeconds, 3600);
  const signedHeaders = "content-type;host";
  const uploadUrl = createPresignedObjectUrl({
    method: "PUT",
    objectKey,
    storage,
    now,
    expiresSeconds,
    signedHeaders,
    canonicalHeaders: (url) => `content-type:${mimeType}\nhost:${url.host}\n`,
  });

  return {
    provider: storage.provider,
    bucket: storage.bucket,
    objectKey,
    publicUrl: buildPublicUrl(storage, objectKey),
    upload: {
      method: "PUT",
      url: uploadUrl.toString(),
      headers: {
        "content-type": mimeType,
      },
      expiresAt: new Date(now.getTime() + expiresSeconds * 1000).toISOString(),
      expiresInSeconds: expiresSeconds,
    },
  };
}

export function createPresignedGetUrl({ objectKey, bucket }) {
  assertStorageObjectKey(objectKey);
  const storage = getStorageConfig({ bucket });
  const now = new Date();
  const expiresSeconds = Math.min(storage.readExpiresSeconds, 3600);

  const url =
    storage.provider === LIGHTCOS_PROVIDER
      ? new URL(
          createCosSdkClient(storage).getObjectUrl({
            Bucket: storage.bucket,
            Expires: expiresSeconds,
            Key: objectKey,
            Method: "GET",
            Region: storage.region,
            Sign: true,
          }),
        )
      : createPresignedObjectUrl({
          method: "GET",
          objectKey,
          storage,
          now,
          expiresSeconds,
          signedHeaders: "host",
          canonicalHeaders: (requestUrl) => `host:${requestUrl.host}\n`,
        });

  return {
    provider: storage.provider,
    bucket: storage.bucket,
    objectKey,
    method: "GET",
    url: url.toString(),
    expiresAt: new Date(now.getTime() + expiresSeconds * 1000).toISOString(),
    expiresInSeconds: expiresSeconds,
  };
}

export async function headObject({ objectKey, bucket }) {
  assertStorageObjectKey(objectKey);
  const storage = getStorageConfig({ bucket });
  if (testObjectStorageClient?.headObject) {
    return testObjectStorageClient.headObject({ bucket: storage.bucket, objectKey, storage });
  }

  if (storage.provider === LIGHTCOS_PROVIDER) {
    return headObjectWithCosSdk({ objectKey, storage });
  }

  const response = await fetchSignedStorageRequest({ method: "HEAD", objectKey, storage });
  if (response.status === 404) return { exists: false };
  if (!response.ok) {
    throwStorageReadFailure("Object storage metadata check failed", response, storage);
  }

  return {
    exists: true,
    contentLength: parseNullableInteger(response.headers.get("content-length")),
    contentType: response.headers.get("content-type") || null,
    etag: response.headers.get("etag") || null,
    lastModified: response.headers.get("last-modified") || null,
  };
}

export async function listObjects({
  bucket,
  prefix = "",
  continuationToken = "",
  maxKeys = 1000,
  maxResponseBytes = null,
}) {
  const storage = getStorageConfig({ bucket });
  if (storage.provider === LIGHTCOS_PROVIDER) {
    throw serviceUnavailable("Lighthouse source bucket listing is unsupported", {
      bucket: storage.bucket,
      provider: storage.provider,
    });
  }
  if (!Number.isInteger(maxKeys) || maxKeys < 1 || maxKeys > 1000) {
    throw serviceUnavailable("Object storage list maxKeys must be an integer from 1 to 1000");
  }
  assertOptionalMaxBytes(maxResponseBytes);
  if (testObjectStorageClient?.listObjects) {
    return testObjectStorageClient.listObjects({
      bucket: storage.bucket,
      continuationToken,
      maxKeys,
      maxResponseBytes,
      prefix,
      storage,
    });
  }

  const queryParams = [["max-keys", String(maxKeys)]];
  queryParams.unshift(["list-type", "2"]);
  if (prefix) queryParams.push(["prefix", prefix]);
  if (continuationToken) {
    queryParams.push(["continuation-token", continuationToken]);
  }
  const response = await fetchSignedStorageRequest({
    method: "GET",
    objectKey: "",
    queryParams,
    storage,
  });
  if (!response.ok) {
    throwStorageReadFailure("Object storage inventory listing failed", response, storage);
  }

  const contentLength = parseNullableInteger(response.headers.get("content-length"));
  if (maxResponseBytes != null && contentLength != null && contentLength > maxResponseBytes) {
    await response.body?.cancel();
    throw serviceUnavailable("Object storage listing exceeds the configured byte limit", {
      bucket: storage.bucket,
      contentLength,
      maxResponseBytes,
      provider: storage.provider,
    });
  }
  const body = await readResponseBodyLimited(response, maxResponseBytes);
  return parseListObjectsResponse(body.toString("utf8"));
}

export async function getObject({ bucket, objectKey, maxBytes = null }) {
  assertStorageObjectKey(objectKey);
  assertOptionalMaxBytes(maxBytes);
  const storage = getStorageConfig({ bucket });
  if (testObjectStorageClient?.getObject) {
    return testObjectStorageClient.getObject({
      bucket: storage.bucket,
      maxBytes,
      objectKey,
      storage,
    });
  }

  if (storage.provider === LIGHTCOS_PROVIDER) {
    return getObjectWithCosSdk({ maxBytes, objectKey, storage });
  }

  const response = await fetchSignedStorageRequest({ method: "GET", objectKey, storage });
  if (response.status === 404) return { exists: false };
  if (!response.ok) {
    throwStorageReadFailure("Object storage read failed", response, storage);
  }
  const contentLength = parseNullableInteger(response.headers.get("content-length"));
  if (maxBytes != null && contentLength != null && contentLength > maxBytes) {
    await response.body?.cancel();
    throw serviceUnavailable("Object storage read exceeds the configured byte limit", {
      bucket: storage.bucket,
      contentLength,
      maxBytes,
      provider: storage.provider,
    });
  }
  return {
    exists: true,
    body: await readResponseBodyLimited(response, maxBytes),
    contentLength,
    contentType: response.headers.get("content-type") || null,
    etag: response.headers.get("etag") || null,
  };
}

function createCosSdkClient(storage) {
  const options = {
    ChunkRetryTimes: 0,
    SecretId: storage.accessKeyId,
    SecretKey: storage.accessKeySecret,
    SecurityToken: storage.sessionToken || undefined,
    Timeout: 10_000,
  };
  return testCosSdkClientFactory ? testCosSdkClientFactory(options, storage) : new COS(options);
}

async function headObjectWithCosSdk({ objectKey, storage }) {
  try {
    const data = await callCosSdk(createCosSdkClient(storage), "headObject", {
      Bucket: storage.bucket,
      Key: objectKey,
      Region: storage.region,
    });
    return {
      exists: true,
      contentLength: parseNullableInteger(readHeader(data?.headers, "content-length")),
      contentType: readHeader(data?.headers, "content-type") || null,
      etag: data?.ETag || readHeader(data?.headers, "etag") || null,
      lastModified: readHeader(data?.headers, "last-modified") || null,
    };
  } catch (error) {
    if (Number(error?.statusCode) === 404) return { exists: false };
    throwCosSdkReadFailure("Object storage metadata check failed", error, storage);
  }
}

async function getObjectWithCosSdk({ maxBytes, objectKey, storage }) {
  const client = createCosSdkClient(storage);
  let stream;
  const metadataPromise = new Promise((resolve, reject) => {
    stream = client.getObjectStream(
      { Bucket: storage.bucket, Key: objectKey, Region: storage.region },
      (error, data) => (error ? reject(error) : resolve(data)),
    );
  });
  try {
    const [body, data] = await Promise.all([
      readNodeStreamLimited(stream, maxBytes),
      metadataPromise,
    ]);
    const contentLength = parseNullableInteger(readHeader(data?.headers, "content-length"));
    if (maxBytes != null && contentLength != null && contentLength > maxBytes) {
      throw serviceUnavailable("Object storage read exceeds the configured byte limit", {
        bucket: storage.bucket,
        contentLength,
        maxBytes,
        provider: storage.provider,
      });
    }
    return {
      exists: true,
      body,
      contentLength,
      contentType: readHeader(data?.headers, "content-type") || null,
      etag: data?.ETag || readHeader(data?.headers, "etag") || null,
    };
  } catch (error) {
    if (Number(error?.statusCode) === 404) return { exists: false };
    if (error?.code === "SERVICE_UNAVAILABLE" && error?.details?.maxBytes) throw error;
    throwCosSdkReadFailure("Object storage read failed", error, storage);
  }
}

function callCosSdk(client, method, params) {
  return new Promise((resolve, reject) => {
    client[method](params, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

function readHeader(headers, name) {
  if (!headers || typeof headers !== "object") return "";
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1] == null ? "" : String(entry[1]);
}

async function readNodeStreamLimited(stream, maxBytes) {
  if (!stream || typeof stream[Symbol.asyncIterator] !== "function") {
    throw serviceUnavailable("COS SDK did not return a readable object stream");
  }
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (maxBytes != null && totalBytes > maxBytes) {
      stream.destroy?.();
      throw serviceUnavailable("Object storage read exceeds the configured byte limit", {
        maxBytes,
      });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, totalBytes);
}

function throwCosSdkReadFailure(message, error, storage) {
  const statusCode = Number(error?.statusCode) || null;
  const permissionDenied = statusCode === 401 || statusCode === 403;
  throw serviceUnavailable(permissionDenied ? `${message}: permission denied` : message, {
    bucket: storage.bucket,
    provider: storage.provider,
    statusCode,
  });
}

export async function putObject({
  bucket,
  objectKey,
  body,
  contentType,
  forbidOverwrite = false,
}) {
  assertStorageObjectKey(objectKey);
  const storage = getStorageConfig({ bucket });
  assertStorageWriteSupported(storage);
  if (testObjectStorageClient?.putObject) {
    return testObjectStorageClient.putObject({
      body,
      bucket: storage.bucket,
      contentType,
      forbidOverwrite,
      objectKey,
      storage,
    });
  }

  const response = await fetchSignedStorageRequest({
    body,
    contentType,
    forbidOverwrite,
    method: "PUT",
    objectKey,
    storage,
  });
  if (!response.ok) {
    throw serviceUnavailable("Object storage write failed", {
      bucket: storage.bucket,
      statusCode: response.status,
    });
  }
  return { etag: response.headers.get("etag") || null, written: true };
}

export async function deleteObject({ objectKey, bucket }) {
  assertStorageObjectKey(objectKey);
  const storage = getStorageConfig({ bucket });
  assertStorageWriteSupported(storage);
  if (testObjectStorageClient?.deleteObject) {
    return testObjectStorageClient.deleteObject({ bucket: storage.bucket, objectKey, storage });
  }

  const response = await fetchSignedStorageRequest({ method: "DELETE", objectKey, storage });
  if (response.status === 404) return { deleted: false, missing: true };
  if (!response.ok) {
    throw serviceUnavailable("Object storage delete failed", {
      statusCode: response.status,
    });
  }
  return { deleted: true, missing: false };
}

export function buildObjectKey({ fileName, mimeType }) {
  const prefix = trimSlashes(config.storage.keyPrefix || "media");
  const date = new Date();
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const extension = inferExtension(fileName, mimeType);
  const randomName = crypto.randomBytes(16).toString("hex");

  return [prefix, "images", yyyy, mm, dd, `${randomName}.${extension}`].filter(Boolean).join("/");
}

function createPresignedObjectUrl({
  method,
  objectKey,
  storage,
  now,
  expiresSeconds,
  signedHeaders,
  canonicalHeaders,
}) {
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const requestUrl = buildStorageUrl(storage, objectKey);
  const credentialScope = `${dateStamp}/${storage.region}/${SIGNING_SERVICE}/aws4_request`;
  const presignParams = [
    ["X-Amz-Algorithm", SIGNING_ALGORITHM],
    ["X-Amz-Credential", `${storage.accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];
  if (storage.sessionToken) {
    presignParams.push(["X-Amz-Security-Token", storage.sessionToken]);
  }
  const canonicalQuery = canonicalizeQuery(presignParams);
  const canonicalRequest = [
    method,
    requestUrl.pathname,
    canonicalQuery,
    canonicalHeaders(requestUrl),
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    SIGNING_ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = createSigningKey(storage.accessKeySecret, dateStamp, storage.region);
  const signature = hmacHex(signingKey, stringToSign);

  requestUrl.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return requestUrl;
}

async function fetchSignedStorageRequest({
  method,
  objectKey,
  storage,
  queryParams = [],
  body = null,
  contentType = null,
  forbidOverwrite = false,
}) {
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const requestUrl = buildStorageUrl(storage, objectKey);
  const credentialScope = `${dateStamp}/${storage.region}/${SIGNING_SERVICE}/aws4_request`;
  const payloadHash = body == null ? "UNSIGNED-PAYLOAD" : hashPayload(body);
  const headerEntries = [
    ["host", requestUrl.host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", amzDate],
  ];
  if (storage.sessionToken) {
    headerEntries.push(["x-amz-security-token", storage.sessionToken]);
  }
  if (contentType) headerEntries.push(["content-type", contentType]);
  if (forbidOverwrite) headerEntries.push(["x-cos-forbid-overwrite", "true"]);
  headerEntries.sort(([left], [right]) => left.localeCompare(right));
  const signedHeaders = headerEntries.map(([name]) => name).join(";");
  const canonicalHeaders = headerEntries.map(([name, value]) => `${name}:${value}`).join("\n");
  const canonicalQuery = canonicalizeQuery(queryParams);
  requestUrl.search = canonicalQuery;
  const canonicalRequest = [
    method,
    requestUrl.pathname,
    canonicalQuery,
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    SIGNING_ALGORITHM,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = createSigningKey(storage.accessKeySecret, dateStamp, storage.region);
  const signature = hmacHex(signingKey, stringToSign);

  const headers = {
    Authorization: `${SIGNING_ALGORITHM} Credential=${storage.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (storage.sessionToken) headers["x-amz-security-token"] = storage.sessionToken;
  if (contentType) headers["content-type"] = contentType;
  if (forbidOverwrite) headers["x-cos-forbid-overwrite"] = "true";
  return fetch(requestUrl, {
    body,
    method,
    headers,
    redirect: "manual",
  });
}

export function getAllowedStorageBuckets() {
  const primary = getStorageConfig();
  return [primary, ...config.storage.readBuckets.map((entry) => hydrateStorageConfig(entry))]
    .map((storage) => assertStorageConfigured(storage))
    .map((storage) => ({
      bucket: storage.bucket,
      endpoint: storage.endpoint,
      historicalBaseUrls: storage.historicalBaseUrls,
      provider: storage.provider,
      publicBaseUrl: storage.publicBaseUrl,
      region: storage.region,
    }));
}

function getStorageConfig({ bucket } = {}) {
  const primary = hydrateStorageConfig(config.storage);
  if (!bucket || bucket === primary.bucket) return assertStorageConfigured(primary);

  const entry = config.storage.readBuckets.find((candidate) => candidate.bucket === bucket);
  if (!entry) {
    throw serviceUnavailable("Object storage bucket is not in the server allowlist", { bucket });
  }
  return assertStorageConfigured(hydrateStorageConfig(entry));
}

function hydrateStorageConfig(entry) {
  const isLegacyBucket = entry.bucket === config.storage.legacyBucket;
  const useLegacyCredentials =
    entry.provider === LIGHTCOS_PROVIDER ||
    (isLegacyBucket &&
      Boolean(config.storage.legacyAccessKeyId) &&
      Boolean(config.storage.legacyAccessKeySecret));
  const storage = {
    ...config.storage,
    ...entry,
    provider: entry.provider || config.storage.provider,
    region: entry.region || config.storage.region,
    endpoint: entry.endpoint || "",
    publicBaseUrl: entry.publicBaseUrl || "",
    accessKeyId: useLegacyCredentials
      ? config.storage.legacyAccessKeyId
      : config.storage.accessKeyId,
    accessKeySecret: useLegacyCredentials
      ? config.storage.legacyAccessKeySecret
      : config.storage.accessKeySecret,
    sessionToken: useLegacyCredentials
      ? config.storage.legacySessionToken
      : config.storage.sessionToken,
    historicalBaseUrls: entry.historicalBaseUrls ?? [],
  };
  storage.endpoint = storage.endpoint || deriveEndpoint(storage);
  storage.publicBaseUrl = storage.publicBaseUrl || storage.endpoint;
  return storage;
}

function assertStorageConfigured(storage) {
  const missing = [];
  if (!storage.bucket) missing.push("STORAGE_BUCKET");
  if (!storage.region) missing.push("STORAGE_REGION");
  if (!storage.accessKeyId) {
    missing.push(
      storage.provider === LIGHTCOS_PROVIDER
        ? "STORAGE_LEGACY_ACCESS_KEY_ID"
        : "STORAGE_ACCESS_KEY_ID",
    );
  }
  if (!storage.accessKeySecret) {
    missing.push(
      storage.provider === LIGHTCOS_PROVIDER
        ? "STORAGE_LEGACY_ACCESS_KEY_SECRET"
        : "STORAGE_ACCESS_KEY_SECRET",
    );
  }

  if (!storage.endpoint) missing.push("STORAGE_ENDPOINT");
  if (missing.length > 0) {
    throw serviceUnavailable("Object storage is not configured", { missing });
  }
  if (storage.provider === LIGHTCOS_PROVIDER) assertLightCosReadConfig(storage);

  return storage;
}

function assertLightCosReadConfig(storage) {
  if (!/^[a-z0-9][a-z0-9-]*-\d+$/.test(storage.bucket)) {
    throw serviceUnavailable("LightCOS bucket must include its numeric APPID suffix", {
      bucket: storage.bucket,
    });
  }
  if (storage.forcePathStyle) {
    throw serviceUnavailable("Lighthouse COS reads require virtual-hosted requests", {
      bucket: storage.bucket,
    });
  }
  let endpoint;
  try {
    endpoint = new URL(storage.endpoint);
  } catch {
    throw serviceUnavailable("LightCOS endpoint is invalid", { bucket: storage.bucket });
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw serviceUnavailable("Lighthouse COS endpoint must be a plain HTTPS URL", {
      bucket: storage.bucket,
    });
  }
  const expectedHost = `${storage.bucket}.cos.${storage.region}.myqcloud.com`;
  if (endpoint.host !== expectedHost || endpoint.pathname !== "/") {
    throw serviceUnavailable("Lighthouse COS reads require the standard regional COS endpoint", {
      bucket: storage.bucket,
      expectedEndpoint: `https://${expectedHost}`,
    });
  }
}

function deriveEndpoint(storage) {
  if (!storage.bucket) return "";

  if (storage.provider === LIGHTCOS_PROVIDER) {
    if (!storage.region) return "";
    return `https://${storage.bucket}.cos.${storage.region}.myqcloud.com`;
  }

  if (!storage.region) return "";

  if (storage.provider === "cos") {
    return `https://${storage.bucket}.cos.${storage.region}.myqcloud.com`;
  }

  if (storage.provider === "s3") {
    return `https://${storage.bucket}.s3.${storage.region}.amazonaws.com`;
  }

  return "";
}

function assertStorageWriteSupported(storage) {
  if (storage.provider === LIGHTCOS_PROVIDER) {
    throw serviceUnavailable("LightCOS compatibility is read-only", {
      bucket: storage.bucket,
      provider: storage.provider,
    });
  }
}

function throwStorageReadFailure(message, response, storage) {
  const permissionDenied = response.status === 401 || response.status === 403;
  throw serviceUnavailable(permissionDenied ? `${message}: permission denied` : message, {
    bucket: storage.bucket,
    provider: storage.provider,
    statusCode: response.status,
  });
}

function buildStorageUrl(storage, objectKey) {
  const endpoint = new URL(storage.endpoint);
  const encodedKey = encodePath(objectKey);

  if (storage.forcePathStyle) {
    endpoint.pathname = joinUrlPaths(endpoint.pathname, encodePath(storage.bucket), encodedKey);
  } else {
    endpoint.pathname = joinUrlPaths(endpoint.pathname, encodedKey);
  }

  endpoint.search = "";
  return endpoint;
}

function buildPublicUrl(storage, objectKey) {
  const base = new URL(storage.publicBaseUrl);
  base.pathname = joinUrlPaths(base.pathname, encodePath(objectKey));
  base.search = "";
  return base.toString();
}

function canonicalizeQuery(params) {
  return params
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function createSigningKey(secret, dateStamp, region) {
  const dateKey = hmacBuffer(`AWS4${secret}`, dateStamp);
  const regionKey = hmacBuffer(dateKey, region);
  const serviceKey = hmacBuffer(regionKey, SIGNING_SERVICE);
  return hmacBuffer(serviceKey, "aws4_request");
}

function hmacBuffer(key, value) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key, value) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hashPayload(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function inferExtension(fileName, mimeType) {
  const known = {
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (known[mimeType]) return known[mimeType];

  const match = String(fileName)
    .toLowerCase()
    .match(/\.([a-z0-9]{1,8})$/);
  return match ? match[1] : "bin";
}

function parseNullableInteger(value) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function assertOptionalMaxBytes(value) {
  if (value != null && (!Number.isSafeInteger(value) || value < 1)) {
    throw serviceUnavailable("Object storage read maxBytes must be a positive safe integer");
  }
}

async function readResponseBodyLimited(response, maxBytes) {
  if (maxBytes == null) return Buffer.from(await response.arrayBuffer());
  if (!response.body) return Buffer.alloc(0);

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      await response.body.cancel().catch(() => {});
      throw serviceUnavailable("Object storage read exceeds the configured byte limit", {
        maxBytes,
      });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, totalBytes);
}

function encodePath(path) {
  return trimSlashes(path).split("/").map(encodeRfc3986).join("/");
}

function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function joinUrlPaths(...parts) {
  const joined = parts
    .map((part) => trimSlashes(part))
    .filter(Boolean)
    .join("/");
  return `/${joined}`;
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function assertStorageObjectKey(value) {
  if (typeof value !== "string" || !value.trim() || value.startsWith("/")) {
    throw serviceUnavailable("Object storage key is invalid");
  }
  const segments = value.split("/");
  if (
    value.includes("\0") ||
    value.includes("\\") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw serviceUnavailable("Object storage key is invalid");
  }
}

function parseListObjectsResponse(xml) {
  const document = String(xml);
  const normalizedDocument = document.trim().replace(/^<\?xml[^?]*\?>\s*/i, "");
  if (!/^<ListBucketResult(?:\s[^>]*)?>[\s\S]*<\/ListBucketResult>$/.test(normalizedDocument)) {
    throw serviceUnavailable("Object storage listing returned malformed XML");
  }
  if (countXmlTag(document, "IsTruncated") !== 1) {
    throw serviceUnavailable("Object storage listing returned malformed pagination XML");
  }
  const encodingType = decodeXml(readXmlTag(xml, "EncodingType"));
  const decodeListValue = (value) => {
    const decoded = decodeXml(value);
    if (encodingType !== "url") return decoded;
    try {
      return decodeURIComponent(decoded);
    } catch {
      throw serviceUnavailable("Object storage listing returned invalid URL encoding");
    }
  };
  const truncatedValue = decodeXml(readXmlTag(xml, "IsTruncated"));
  if (!new Set(["true", "false"]).has(truncatedValue)) {
    throw serviceUnavailable("Object storage listing returned an invalid IsTruncated value");
  }
  const contentMatches = [...document.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)];
  const contentOpeningCount = (document.match(/<Contents(?:\s[^>]*)?>/g) ?? []).length;
  const contentClosingCount = (document.match(/<\/Contents>/g) ?? []).length;
  if (
    contentOpeningCount !== contentClosingCount ||
    contentMatches.length !== contentOpeningCount
  ) {
    throw serviceUnavailable("Object storage listing returned malformed object XML");
  }
  const objects = contentMatches.map((match) => {
    const objectKey = decodeListValue(readRequiredXmlTag(match[1], "Key"));
    const sizeValue = readRequiredXmlTag(match[1], "Size");
    const sizeBytes = parseNullableInteger(sizeValue);
    if (!objectKey || sizeBytes == null || sizeBytes < 0) {
      throw serviceUnavailable("Object storage listing returned an invalid object entry");
    }
    return {
      objectKey,
      sizeBytes,
      etag: decodeXml(readXmlTag(match[1], "ETag")) || null,
      lastModified: decodeXml(readXmlTag(match[1], "LastModified")) || null,
    };
  });
  return {
    objects,
    isTruncated: truncatedValue === "true",
    nextContinuationToken: decodeListValue(readXmlTag(xml, "NextContinuationToken")) || null,
  };
}

function countXmlTag(xml, name) {
  return (String(xml).match(new RegExp(`<${name}>[\\s\\S]*?<\\/${name}>`, "g")) ?? []).length;
}

function readRequiredXmlTag(xml, name) {
  const value = readXmlTag(xml, name);
  if (value === "") {
    throw serviceUnavailable(`Object storage listing is missing ${name}`);
  }
  return value;
}

function readXmlTag(xml, name) {
  const match = String(xml).match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return match?.[1] ?? "";
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
