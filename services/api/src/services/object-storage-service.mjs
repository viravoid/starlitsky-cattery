import crypto from "node:crypto";
import { config } from "../config/env.mjs";
import { serviceUnavailable } from "../utils/errors.mjs";

const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";
const SIGNING_SERVICE = "s3";
const LIGHTCOS_PROVIDER = "lightcos";
const LIGHTCOS_SIGNING_ALGORITHM = "sha1";
let testObjectStorageClient = null;

export function setObjectStorageTestClient(client) {
  testObjectStorageClient = client;
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
      ? createPresignedLightCosGetUrl({ objectKey, storage, now, expiresSeconds })
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

export async function listObjects({ bucket, prefix = "", continuationToken = "" }) {
  const storage = getStorageConfig({ bucket });
  if (testObjectStorageClient?.listObjects) {
    return testObjectStorageClient.listObjects({
      bucket: storage.bucket,
      continuationToken,
      prefix,
      storage,
    });
  }

  const queryParams = [["max-keys", "1000"]];
  if (storage.provider === LIGHTCOS_PROVIDER) queryParams.unshift(["encoding-type", "url"]);
  else queryParams.unshift(["list-type", "2"]);
  if (prefix) queryParams.push(["prefix", prefix]);
  if (continuationToken) {
    queryParams.push([
      storage.provider === LIGHTCOS_PROVIDER ? "marker" : "continuation-token",
      continuationToken,
    ]);
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

  return parseListObjectsResponse(await response.text(), storage.provider);
}

export async function getObject({ bucket, objectKey }) {
  assertStorageObjectKey(objectKey);
  const storage = getStorageConfig({ bucket });
  if (testObjectStorageClient?.getObject) {
    return testObjectStorageClient.getObject({ bucket: storage.bucket, objectKey, storage });
  }

  const response = await fetchSignedStorageRequest({ method: "GET", objectKey, storage });
  if (response.status === 404) return { exists: false };
  if (!response.ok) {
    throwStorageReadFailure("Object storage read failed", response, storage);
  }
  return {
    exists: true,
    body: Buffer.from(await response.arrayBuffer()),
    contentLength: parseNullableInteger(response.headers.get("content-length")),
    contentType: response.headers.get("content-type") || null,
    etag: response.headers.get("etag") || null,
  };
}

export async function putObject({ bucket, objectKey, body, contentType }) {
  assertStorageObjectKey(objectKey);
  const storage = getStorageConfig({ bucket });
  assertStorageWriteSupported(storage);
  if (testObjectStorageClient?.putObject) {
    return testObjectStorageClient.putObject({
      body,
      bucket: storage.bucket,
      contentType,
      objectKey,
      storage,
    });
  }

  const response = await fetchSignedStorageRequest({
    body,
    contentType,
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
}) {
  if (storage.provider === LIGHTCOS_PROVIDER) {
    return fetchSignedLightCosRequest({
      method,
      objectKey,
      storage,
      queryParams,
      body,
      contentType,
    });
  }

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
  if (contentType) headerEntries.push(["content-type", contentType]);
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
  if (contentType) headers["content-type"] = contentType;
  return fetch(requestUrl, {
    body,
    method,
    headers,
  });
}

async function fetchSignedLightCosRequest({
  method,
  objectKey,
  storage,
  queryParams = [],
  body = null,
  contentType = null,
}) {
  if (!new Set(["GET", "HEAD"]).has(method) || body != null || contentType != null) {
    throw serviceUnavailable("LightCOS compatibility is read-only", {
      bucket: storage.bucket,
      method,
      provider: storage.provider,
    });
  }
  const requestUrl = buildStorageUrl(storage, objectKey);
  requestUrl.search = canonicalizeQuery(queryParams);
  const authorization = createLightCosAuthorization({
    accessKeyId: storage.accessKeyId,
    accessKeySecret: storage.accessKeySecret,
    expiresSeconds: Math.min(storage.readExpiresSeconds, 3600),
    headers: [["host", requestUrl.host]],
    method,
    pathname: decodeURIComponent(requestUrl.pathname),
    queryParams,
  });
  return fetch(requestUrl, {
    method,
    headers: { Authorization: authorization },
  });
}

function createPresignedLightCosGetUrl({ objectKey, storage, now, expiresSeconds }) {
  const requestUrl = buildStorageUrl(storage, objectKey);
  const authorization = createLightCosAuthorization({
    accessKeyId: storage.accessKeyId,
    accessKeySecret: storage.accessKeySecret,
    expiresSeconds,
    headers: [["host", requestUrl.host]],
    method: "GET",
    now,
    pathname: decodeURIComponent(requestUrl.pathname),
    queryParams: [],
  });
  for (const part of authorization.split("&")) {
    const separator = part.indexOf("=");
    requestUrl.searchParams.append(part.slice(0, separator), part.slice(separator + 1));
  }
  return requestUrl;
}

function createLightCosAuthorization({
  accessKeyId,
  accessKeySecret,
  expiresSeconds,
  headers,
  method,
  now = new Date(),
  pathname,
  queryParams,
}) {
  const startTimestamp = Math.floor(now.getTime() / 1000) - 1;
  const keyTime = `${startTimestamp};${startTimestamp + expiresSeconds}`;
  const canonicalHeaders = canonicalizeLightCosEntries(headers);
  const canonicalParams = canonicalizeLightCosEntries(queryParams);
  const headerList = canonicalLightCosKeyList(headers);
  const urlParamList = canonicalLightCosKeyList(queryParams);
  const httpString = [method.toLowerCase(), pathname, canonicalParams, canonicalHeaders, ""].join(
    "\n",
  );
  const signKey = crypto.createHmac("sha1", accessKeySecret).update(keyTime).digest("hex");
  const stringToSign = [
    LIGHTCOS_SIGNING_ALGORITHM,
    keyTime,
    crypto.createHash("sha1").update(httpString).digest("hex"),
    "",
  ].join("\n");
  const signature = crypto.createHmac("sha1", signKey).update(stringToSign).digest("hex");
  return [
    `q-sign-algorithm=${LIGHTCOS_SIGNING_ALGORITHM}`,
    `q-ak=${accessKeyId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    `q-header-list=${headerList}`,
    `q-url-param-list=${urlParamList}`,
    `q-signature=${signature}`,
  ].join("&");
}

function canonicalizeLightCosEntries(entries) {
  return normalizeLightCosEntries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function canonicalLightCosKeyList(entries) {
  return normalizeLightCosEntries(entries)
    .map(([key]) => key)
    .join(";");
}

function normalizeLightCosEntries(entries) {
  return entries
    .map(([key, value]) => [
      encodeRfc3986(String(key)).toLowerCase(),
      encodeRfc3986(value == null ? "" : String(value)),
    ])
    .sort(([left], [right]) => left.localeCompare(right));
}

export function getAllowedStorageBuckets() {
  const primary = getStorageConfig();
  return [primary, ...config.storage.readBuckets.map((entry) => hydrateStorageConfig(entry))].map(
    (storage) => ({
      bucket: storage.bucket,
      endpoint: storage.endpoint,
      provider: storage.provider,
      publicBaseUrl: storage.publicBaseUrl,
      region: storage.region,
    }),
  );
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
  const storage = {
    ...config.storage,
    ...entry,
    provider: entry.provider || config.storage.provider,
    region: entry.region || config.storage.region,
    endpoint: entry.endpoint || "",
    publicBaseUrl: entry.publicBaseUrl || "",
    accessKeyId: config.storage.accessKeyId,
    accessKeySecret: config.storage.accessKeySecret,
  };
  storage.endpoint = storage.endpoint || deriveEndpoint(storage);
  storage.publicBaseUrl = storage.publicBaseUrl || storage.endpoint;
  return storage;
}

function assertStorageConfigured(storage) {
  const missing = [];
  if (!storage.bucket) missing.push("STORAGE_BUCKET");
  if (!storage.region && storage.provider !== LIGHTCOS_PROVIDER) missing.push("STORAGE_REGION");
  if (!storage.accessKeyId) missing.push("STORAGE_ACCESS_KEY_ID");
  if (!storage.accessKeySecret) missing.push("STORAGE_ACCESS_KEY_SECRET");

  if (!storage.endpoint) missing.push("STORAGE_ENDPOINT");
  if (missing.length > 0) {
    throw serviceUnavailable("Object storage is not configured", { missing });
  }

  return storage;
}

function deriveEndpoint(storage) {
  if (!storage.bucket) return "";

  if (storage.provider === LIGHTCOS_PROVIDER) {
    return `https://${storage.bucket}.light-cos.com`;
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

function parseListObjectsResponse(xml, provider) {
  const encodingType = decodeXml(readXmlTag(xml, "EncodingType"));
  const decodeListValue = (value) => {
    const decoded = decodeXml(value);
    if (encodingType !== "url") return decoded;
    try {
      return decodeURIComponent(decoded);
    } catch {
      return decoded;
    }
  };
  const objects = [...String(xml).matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((match) => ({
    objectKey: decodeListValue(readXmlTag(match[1], "Key")),
    sizeBytes: parseNullableInteger(readXmlTag(match[1], "Size")),
    etag: decodeXml(readXmlTag(match[1], "ETag")) || null,
    lastModified: decodeXml(readXmlTag(match[1], "LastModified")) || null,
  }));
  return {
    objects,
    isTruncated: readXmlTag(xml, "IsTruncated") === "true",
    nextContinuationToken:
      decodeListValue(
        readXmlTag(xml, provider === LIGHTCOS_PROVIDER ? "NextMarker" : "NextContinuationToken"),
      ) || null,
  };
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
