import assert from "node:assert/strict";
import { Readable } from "node:stream";

process.env.STORAGE_PROVIDER = "cos";
process.env.STORAGE_BUCKET = "verify-standard-target-1234567890";
process.env.STORAGE_REGION = "ap-chengdu";
process.env.STORAGE_ACCESS_KEY_ID = "verify-target-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "verify-target-secret-key";
process.env.STORAGE_SESSION_TOKEN = "verify-target-session-token";
process.env.STORAGE_LEGACY_BUCKET = "verify-lightcos-source-1234567890";
process.env.STORAGE_LEGACY_ACCESS_KEY_ID = "verify-source-access-key";
process.env.STORAGE_LEGACY_ACCESS_KEY_SECRET = "verify-source-secret-key";
process.env.STORAGE_LEGACY_SESSION_TOKEN = "verify-source-session-token";
process.env.STORAGE_PUBLIC_BASE_URL =
  "https://verify-standard-target-1234567890.cos.ap-chengdu.myqcloud.com";
process.env.STORAGE_READ_BUCKETS_JSON = JSON.stringify([
  {
    bucket: "verify-lightcos-source-1234567890",
    provider: "lightcos",
    region: "ap-chengdu",
    endpoint: "https://verify-lightcos-source-1234567890.cos.ap-chengdu.myqcloud.com",
    publicBaseUrl: "https://legacy-media.example.test",
    historicalBaseUrls: ["https://older-legacy-media.example.test/images"],
  },
]);

const SOURCE_BUCKET = "verify-lightcos-source-1234567890";
const TARGET_BUCKET = "verify-standard-target-1234567890";
const OBJECT_KEY = "media/猫 image.webp";
const BODY = Buffer.from("synthetic-lighthouse-object-body");
const sdkCalls = [];
const sdkOptions = [];
const originalFetch = global.fetch;

const {
  createPresignedGetUrl,
  createPresignedPutUpload,
  deleteObject,
  getAllowedStorageBuckets,
  getObject,
  headObject,
  listObjects,
  putObject,
  setCosSdkTestClientFactory,
} = await import("./object-storage-service.mjs");

setCosSdkTestClientFactory((options, storage) => {
  sdkOptions.push({ options, storage });
  return {
    headObject(params, callback) {
      sdkCalls.push({ method: "headObject", params });
      if (params.Key === "media/missing.jpg") {
        callback(Object.assign(new Error("missing"), { statusCode: 404 }));
        return;
      }
      callback(null, {
        ETag: '"synthetic-etag"',
        headers: {
          "content-length": String(BODY.length),
          "content-type": "image/webp",
          "last-modified": "Tue, 20 Oct 2026 00:00:00 GMT",
        },
      });
    },
    getObjectStream(params, callback) {
      sdkCalls.push({ method: "getObjectStream", params });
      const stream = Readable.from([BODY.subarray(0, 8), BODY.subarray(8)]);
      queueMicrotask(() =>
        callback(null, {
          ETag: '"synthetic-etag"',
          headers: {
            "content-length": String(BODY.length),
            "content-type": "image/webp",
          },
        }),
      );
      return stream;
    },
    getObjectUrl(params) {
      sdkCalls.push({ method: "getObjectUrl", params });
      return `https://${params.Bucket}.cos.${params.Region}.myqcloud.com/${encodeURIComponent(params.Key)}?q-signature=synthetic`;
    },
  };
});

try {
  const allowedSource = getAllowedStorageBuckets().find((entry) => entry.bucket === SOURCE_BUCKET);
  assert.equal(allowedSource.endpoint, `https://${SOURCE_BUCKET}.cos.ap-chengdu.myqcloud.com`);
  assert.deepEqual(allowedSource.historicalBaseUrls, [
    "https://older-legacy-media.example.test/images",
  ]);

  const metadata = await headObject({ bucket: SOURCE_BUCKET, objectKey: OBJECT_KEY });
  assert.deepEqual(metadata, {
    exists: true,
    contentLength: BODY.length,
    contentType: "image/webp",
    etag: '"synthetic-etag"',
    lastModified: "Tue, 20 Oct 2026 00:00:00 GMT",
  });
  assert.deepEqual(sdkCalls.at(-1).params, {
    Bucket: SOURCE_BUCKET,
    Key: OBJECT_KEY,
    Region: "ap-chengdu",
  });
  assert.equal(sdkOptions.at(-1).options.SecretId, "verify-source-access-key");
  assert.equal(sdkOptions.at(-1).options.SecretKey, "verify-source-secret-key");
  assert.equal(sdkOptions.at(-1).options.SecurityToken, "verify-source-session-token");
  assert.notEqual(sdkOptions.at(-1).options.SecretId, process.env.STORAGE_ACCESS_KEY_ID);

  assert.deepEqual(await headObject({ bucket: SOURCE_BUCKET, objectKey: "media/missing.jpg" }), {
    exists: false,
  });

  const object = await getObject({
    bucket: SOURCE_BUCKET,
    maxBytes: BODY.length,
    objectKey: OBJECT_KEY,
  });
  assert.equal(object.exists, true);
  assert.equal(object.body.equals(BODY), true);
  assert.equal(object.contentLength, BODY.length);
  assert.equal(object.contentType, "image/webp");
  await assert.rejects(
    () => getObject({ bucket: SOURCE_BUCKET, maxBytes: 4, objectKey: OBJECT_KEY }),
    /exceeds the configured byte limit/,
  );

  const callsBeforeList = sdkCalls.length;
  await assert.rejects(
    () => listObjects({ bucket: SOURCE_BUCKET }),
    /source bucket listing is unsupported/,
  );
  assert.equal(sdkCalls.length, callsBeforeList, "listing must fail before an SDK request");

  await assert.rejects(
    () =>
      putObject({
        bucket: SOURCE_BUCKET,
        objectKey: "media/forbidden.jpg",
        body: Buffer.from("no"),
        contentType: "image/jpeg",
      }),
    /LightCOS compatibility is read-only/,
  );
  await assert.rejects(
    () => deleteObject({ bucket: SOURCE_BUCKET, objectKey: "media/forbidden.jpg" }),
    /LightCOS compatibility is read-only/,
  );

  const sourceRead = new URL(
    createPresignedGetUrl({ bucket: SOURCE_BUCKET, objectKey: OBJECT_KEY }).url,
  );
  assert.equal(sourceRead.host, `${SOURCE_BUCKET}.cos.ap-chengdu.myqcloud.com`);
  assert.equal(sourceRead.searchParams.get("q-signature"), "synthetic");

  const standardRead = new URL(
    createPresignedGetUrl({ bucket: TARGET_BUCKET, objectKey: "media/a.jpg" }).url,
  );
  assert.equal(standardRead.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.match(standardRead.searchParams.get("X-Amz-Credential"), /^verify-target-access-key\//);
  assert.equal(
    standardRead.searchParams.get("X-Amz-Security-Token"),
    "verify-target-session-token",
  );
  const standardUpload = new URL(
    createPresignedPutUpload({ objectKey: "media/new.jpg", mimeType: "image/jpeg" }).upload.url,
  );
  assert.equal(standardUpload.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.equal(
    standardUpload.searchParams.get("X-Amz-Security-Token"),
    "verify-target-session-token",
  );

  let signedTargetWrite = null;
  global.fetch = async (input, init) => {
    signedTargetWrite = { input: String(input), init };
    return new Response(null, { status: 200, headers: { etag: '"target-etag"' } });
  };
  await putObject({
    bucket: TARGET_BUCKET,
    objectKey: "media/copied.jpg",
    body: BODY,
    contentType: "image/jpeg",
    forbidOverwrite: true,
  });
  assert.equal(
    signedTargetWrite.init.headers["x-amz-security-token"],
    "verify-target-session-token",
  );
  assert.match(
    signedTargetWrite.init.headers.Authorization,
    /SignedHeaders=.*x-amz-security-token;x-cos-forbid-overwrite/,
  );
  assert.equal(signedTargetWrite.init.headers["x-cos-forbid-overwrite"], "true");

  console.info("Synthetic Lighthouse COS SDK object-read verification passed");
} finally {
  global.fetch = originalFetch;
  setCosSdkTestClientFactory(null);
}
