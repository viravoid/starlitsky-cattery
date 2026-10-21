import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.STORAGE_PROVIDER = "cos";
process.env.STORAGE_BUCKET = "probe-standard-target-1234567890";
process.env.STORAGE_REGION = "ap-chengdu";
process.env.STORAGE_ACCESS_KEY_ID = "probe-target-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "probe-target-secret-key";
process.env.STORAGE_LEGACY_BUCKET = "probe-lightcos-source-1234567890";
process.env.STORAGE_LEGACY_ACCESS_KEY_ID = "probe-source-access-key";
process.env.STORAGE_LEGACY_ACCESS_KEY_SECRET = "probe-source-secret-key";
process.env.STORAGE_READ_BUCKETS_JSON = JSON.stringify([
  {
    bucket: "probe-lightcos-source-1234567890",
    provider: "lightcos",
    region: "ap-chengdu",
    endpoint: "https://probe-lightcos-source-1234567890.cos.ap-chengdu.myqcloud.com",
    publicBaseUrl: "https://legacy-media.example.test",
  },
]);

const { LightCosReadProbeError, runLightCosReadProbe } = await import("./lightcos-read-probe.mjs");

const BUCKET = "probe-lightcos-source-1234567890";
const ENDPOINT = `https://${BUCKET}.cos.ap-chengdu.myqcloud.com`;
const OBJECT_KEY = "approved/猫 image.jpg";
const BODY = Buffer.from("synthetic-lightcos-probe-body");
const SHA256 = crypto.createHash("sha256").update(BODY).digest("hex");
const calls = [];
const storage = {
  async headObject(input) {
    calls.push({ method: "HEAD", input });
    return {
      exists: true,
      contentLength: BODY.length,
      contentType: "image/jpeg",
      etag: '"probe-etag"',
    };
  },
  async getObject(input) {
    calls.push({ method: "GET", input });
    return {
      exists: true,
      body: BODY,
      contentLength: BODY.length,
      contentType: "image/jpeg",
      etag: '"probe-etag"',
    };
  },
};

const report = await runLightCosReadProbe({
  bucket: BUCKET,
  objectKey: OBJECT_KEY,
  confirmedEndpoint: ENDPOINT,
  confirmReadOnlyProbe: true,
  expectedSizeBytes: BODY.length,
  expectedSha256: SHA256,
  maxDownloadBytes: 1024,
  storage,
});

assert.equal(report.status, "passed");
assert.equal(report.requestCount, 2);
assert.equal(report.object.bytes, BODY.length);
assert.equal(report.object.sha256, SHA256);
assert.deepEqual(
  calls.map((item) => item.method),
  ["HEAD", "GET"],
);
assert.equal(calls[1].input.maxBytes, 1024);
assert.equal(JSON.stringify(report).includes(OBJECT_KEY), false);
assert.equal(JSON.stringify(report).includes(process.env.STORAGE_LEGACY_ACCESS_KEY_ID), false);

let requestCount = 0;
await assert.rejects(
  () =>
    runLightCosReadProbe({
      bucket: BUCKET,
      objectKey: OBJECT_KEY,
      confirmedEndpoint: ENDPOINT,
      expectedSha256: SHA256,
      storage: {
        headObject: async () => {
          requestCount += 1;
        },
      },
    }),
  /explicit read-only confirmation/,
);
await assert.rejects(
  () =>
    runLightCosReadProbe({
      bucket: BUCKET,
      objectKey: OBJECT_KEY,
      confirmedEndpoint: "https://unapproved.example.test",
      confirmReadOnlyProbe: true,
      expectedSizeBytes: BODY.length,
      expectedSha256: SHA256,
      storage: {
        headObject: async () => {
          requestCount += 1;
        },
      },
    }),
  /exact confirmation/,
);
assert.equal(requestCount, 0);

await assert.rejects(
  () =>
    runLightCosReadProbe({
      bucket: BUCKET,
      objectKey: OBJECT_KEY,
      confirmedEndpoint: ENDPOINT,
      confirmReadOnlyProbe: true,
      expectedSizeBytes: BODY.length,
      expectedSha256: "0".repeat(64),
      maxDownloadBytes: 1024,
      storage,
    }),
  (error) => error instanceof LightCosReadProbeError && /SHA-256/.test(error.message),
);

console.info("Synthetic bounded Lighthouse COS object probe verification passed");
