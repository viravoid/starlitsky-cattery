import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.STORAGE_PROVIDER = "cos";
process.env.STORAGE_BUCKET = "verify-standard-target";
process.env.STORAGE_REGION = "ap-chengdu";
process.env.STORAGE_ACCESS_KEY_ID = "verify-lightcos-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "verify-lightcos-secret-key";
process.env.STORAGE_PUBLIC_BASE_URL = "https://verify-standard-target.cos.ap-chengdu.myqcloud.com";
process.env.STORAGE_READ_BUCKETS_JSON = JSON.stringify([
  {
    bucket: "verify-lightcos-source",
    provider: "lightcos",
    publicBaseUrl: "https://verify-lightcos-source.light-cos.com",
  },
]);

const SOURCE_BUCKET = "verify-lightcos-source";
const TARGET_BUCKET = "verify-standard-target";
const SECRET = process.env.STORAGE_ACCESS_KEY_SECRET;
const requests = [];
const responses = [];
const originalFetch = global.fetch;

global.fetch = async (input, init = {}) => {
  requests.push({ init, url: new URL(input) });
  const response = responses.shift();
  if (!response) throw new Error("synthetic fetch response queue exhausted");
  return response;
};

const {
  createPresignedGetUrl,
  createPresignedPutUpload,
  deleteObject,
  getObject,
  headObject,
  listObjects,
  putObject,
} = await import("./object-storage-service.mjs");
const { createCosMigrationInventory } = await import("./cos-migration-service.mjs");

try {
  responses.push(
    xmlResponse(`
      <ListBucketResult>
        <EncodingType>url</EncodingType>
        <IsTruncated>true</IsTruncated>
        <NextMarker>media%2Fimages%2Fa.jpg</NextMarker>
        <Contents><Key>media%2Fimages%2Fa.jpg</Key><Size>3</Size><ETag>"a"</ETag><LastModified>2026-10-18T00:00:00Z</LastModified></Contents>
      </ListBucketResult>`),
    xmlResponse(`
      <ListBucketResult>
        <EncodingType>url</EncodingType>
        <Marker>media%2Fimages%2Fa.jpg</Marker>
        <IsTruncated>false</IsTruncated>
        <Contents><Key>media%2Fimages%2Fb%20space.jpg</Key><Size>4</Size><ETag>"b"</ETag><LastModified>2026-10-18T00:00:01Z</LastModified></Contents>
      </ListBucketResult>`),
  );
  const inventory = await createCosMigrationInventory({
    client: emptyInventoryClient(),
    sourceBucket: SOURCE_BUCKET,
    targetBucket: TARGET_BUCKET,
    storage: {
      headObject: async () => ({ exists: false }),
      listObjects: (input) =>
        input.bucket === SOURCE_BUCKET
          ? listObjects(input)
          : Promise.resolve({ objects: [], isTruncated: false, nextContinuationToken: null }),
    },
  });
  assert.deepEqual(
    inventory.sourceObjects.map((object) => object.objectKey),
    ["media/images/a.jpg", "media/images/b space.jpg"],
    "LightCOS V1 marker/NextMarker pages must be traversed and URL-decoded",
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url.host, `${SOURCE_BUCKET}.light-cos.com`);
  assert.equal(requests[0].url.searchParams.has("list-type"), false);
  assert.equal(requests[0].url.searchParams.get("encoding-type"), "url");
  assert.equal(requests[1].url.searchParams.get("marker"), "media/images/a.jpg");
  for (const request of requests.splice(0)) assertValidHeaderSignature(request);

  responses.push(
    new Response(null, {
      status: 200,
      headers: {
        "content-length": "5",
        "content-type": "image/jpeg",
        etag: '"head-etag"',
        "last-modified": "Sun, 18 Oct 2026 00:00:00 GMT",
      },
    }),
  );
  const metadata = await headObject({ bucket: SOURCE_BUCKET, objectKey: "media/images/a.jpg" });
  assert.deepEqual(metadata, {
    exists: true,
    contentLength: 5,
    contentType: "image/jpeg",
    etag: '"head-etag"',
    lastModified: "Sun, 18 Oct 2026 00:00:00 GMT",
  });
  assert.equal(requests[0].init.method, "HEAD");
  assertValidHeaderSignature(requests.shift());

  responses.push(new Response(null, { status: 404 }));
  assert.deepEqual(
    await headObject({ bucket: SOURCE_BUCKET, objectKey: "media/images/missing.jpg" }),
    { exists: false },
  );
  assertValidHeaderSignature(requests.shift());

  const body = Buffer.from("lightcos-object-body");
  responses.push(
    new Response(body, {
      status: 200,
      headers: {
        "content-length": String(body.length),
        "content-type": "image/webp",
        etag: '"get-etag"',
      },
    }),
  );
  const object = await getObject({ bucket: SOURCE_BUCKET, objectKey: "media/猫 image.webp" });
  assert.equal(object.exists, true);
  assert.equal(object.body.equals(body), true);
  assert.equal(object.contentType, "image/webp");
  const getRequest = requests.shift();
  assert.equal(getRequest.url.pathname, "/media/%E7%8C%AB%20image.webp");
  assertValidHeaderSignature(getRequest);

  responses.push(new Response(null, { status: 404 }));
  assert.deepEqual(
    await getObject({ bucket: SOURCE_BUCKET, objectKey: "media/images/missing.jpg" }),
    { exists: false },
  );
  assertValidHeaderSignature(requests.shift());

  responses.push(new Response("denied", { status: 403 }));
  await assert.rejects(
    () => listObjects({ bucket: SOURCE_BUCKET }),
    (error) =>
      /permission denied/.test(error?.message) &&
      error?.details?.statusCode === 403 &&
      error?.details?.provider === "lightcos",
  );
  assertValidHeaderSignature(requests.shift());

  responses.push(new Response("failure", { status: 500 }));
  await assert.rejects(
    () => getObject({ bucket: SOURCE_BUCKET, objectKey: "media/images/a.jpg" }),
    (error) => error?.details?.statusCode === 500,
  );
  assertValidHeaderSignature(requests.shift());

  responses.push(new Response("denied", { status: 403 }));
  await assert.rejects(
    () => headObject({ bucket: SOURCE_BUCKET, objectKey: "media/images/a.jpg" }),
    /permission denied/,
  );
  assertValidHeaderSignature(requests.shift());

  responses.push(
    xmlResponse(
      "<ListBucketResult><IsTruncated>true</IsTruncated><Contents><Key>a</Key><Size>1</Size></Contents></ListBucketResult>",
    ),
  );
  await assert.rejects(
    () =>
      createCosMigrationInventory({
        client: emptyInventoryClient(),
        sourceBucket: SOURCE_BUCKET,
        targetBucket: TARGET_BUCKET,
        storage: {
          headObject: async () => ({ exists: false }),
          listObjects: (input) =>
            input.bucket === SOURCE_BUCKET
              ? listObjects(input)
              : Promise.resolve({ objects: [], isTruncated: false, nextContinuationToken: null }),
        },
      }),
    /Truncated object listing did not return a continuation token/,
  );
  assertValidHeaderSignature(requests.shift());

  await assert.rejects(
    () =>
      putObject({
        bucket: SOURCE_BUCKET,
        objectKey: "media/images/forbidden.jpg",
        body: Buffer.from("no"),
        contentType: "image/jpeg",
      }),
    /LightCOS compatibility is read-only/,
  );
  await assert.rejects(
    () => deleteObject({ bucket: SOURCE_BUCKET, objectKey: "media/images/forbidden.jpg" }),
    /LightCOS compatibility is read-only/,
  );
  assert.equal(requests.length, 0, "LightCOS write attempts must stop before fetch");

  const signedLightCosRead = createPresignedGetUrl({
    bucket: SOURCE_BUCKET,
    objectKey: "media/images/a.jpg",
  });
  assert.equal(signedLightCosRead.provider, "lightcos");
  assertValidQuerySignature(new URL(signedLightCosRead.url));

  const standardRead = new URL(
    createPresignedGetUrl({ bucket: TARGET_BUCKET, objectKey: "media/images/a.jpg" }).url,
  );
  assert.equal(standardRead.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  const standardUpload = new URL(
    createPresignedPutUpload({ objectKey: "media/images/new.jpg", mimeType: "image/jpeg" }).upload
      .url,
  );
  assert.equal(standardUpload.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");

  console.info("Synthetic LightCOS read compatibility verification passed");
} finally {
  global.fetch = originalFetch;
}

function emptyInventoryClient() {
  const empty = { findMany: async () => [] };
  return {
    mediaAsset: empty,
    user: empty,
    cat: empty,
    fixedPage: empty,
    parentApplication: empty,
    kittenProfile: empty,
    litter: empty,
    selectionApplication: empty,
  };
}

function xmlResponse(xml) {
  return new Response(xml, { status: 200, headers: { "content-type": "application/xml" } });
}

function assertValidHeaderSignature(request) {
  const authorization = new Headers(request.init.headers).get("authorization");
  assert.ok(authorization, "LightCOS read request must carry Authorization");
  assertSignature({
    authorization,
    method: request.init.method,
    requestUrl: request.url,
    queryEntries: [...request.url.searchParams.entries()],
  });
}

function assertValidQuerySignature(requestUrl) {
  const authNames = new Set([
    "q-sign-algorithm",
    "q-ak",
    "q-sign-time",
    "q-key-time",
    "q-header-list",
    "q-url-param-list",
    "q-signature",
  ]);
  const authorization = [...requestUrl.searchParams.entries()]
    .filter(([key]) => authNames.has(key))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  assertSignature({
    authorization,
    method: "GET",
    requestUrl,
    queryEntries: [...requestUrl.searchParams.entries()].filter(([key]) => !authNames.has(key)),
  });
}

function assertSignature({ authorization, method, requestUrl, queryEntries }) {
  const auth = new URLSearchParams(authorization);
  assert.equal(auth.get("q-sign-algorithm"), "sha1");
  assert.equal(auth.get("q-ak"), process.env.STORAGE_ACCESS_KEY_ID);
  assert.equal(auth.get("q-header-list"), "host");
  const keyTime = auth.get("q-key-time");
  assert.match(keyTime, /^\d+;\d+$/);
  assert.equal(auth.get("q-sign-time"), keyTime);
  const canonicalHeaders = canonicalEntries([["host", requestUrl.host]]);
  const canonicalParams = canonicalEntries(queryEntries);
  assert.equal(
    auth.get("q-url-param-list"),
    normalizedEntries(queryEntries)
      .map(([key]) => key)
      .join(";"),
  );
  const httpString = [
    method.toLowerCase(),
    decodeURIComponent(requestUrl.pathname),
    canonicalParams,
    canonicalHeaders,
    "",
  ].join("\n");
  const signKey = crypto.createHmac("sha1", SECRET).update(keyTime).digest("hex");
  const stringToSign = [
    "sha1",
    keyTime,
    crypto.createHash("sha1").update(httpString).digest("hex"),
    "",
  ].join("\n");
  const expected = crypto.createHmac("sha1", signKey).update(stringToSign).digest("hex");
  assert.equal(auth.get("q-signature"), expected);
}

function canonicalEntries(entries) {
  return normalizedEntries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function normalizedEntries(entries) {
  return entries
    .map(([key, value]) => [encode(String(key)).toLowerCase(), encode(String(value ?? ""))])
    .sort(([left], [right]) => left.localeCompare(right));
}

function encode(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
