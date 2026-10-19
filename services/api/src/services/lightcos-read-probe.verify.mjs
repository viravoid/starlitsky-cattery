import assert from "node:assert/strict";

process.env.STORAGE_PROVIDER = "cos";
process.env.STORAGE_BUCKET = "probe-standard-target";
process.env.STORAGE_REGION = "ap-chengdu";
process.env.STORAGE_ACCESS_KEY_ID = "probe-synthetic-access-key";
process.env.STORAGE_ACCESS_KEY_SECRET = "probe-synthetic-secret-key";
process.env.STORAGE_READ_BUCKETS_JSON = JSON.stringify([
  {
    bucket: "probe-lightcos-source-1234567890",
    provider: "lightcos",
    endpoint: "https://probe-lightcos-source-1234567890.light-cos.com",
    publicBaseUrl: "https://legacy-media.example.test",
  },
]);

const { LightCosReadProbeError, runLightCosReadProbe } = await import("./lightcos-read-probe.mjs");

const BUCKET = "probe-lightcos-source-1234567890";
const ENDPOINT = `https://${BUCKET}.light-cos.com/`;
const PREFIX = "approved/猫 %/";
const FIRST_KEY = `${PREFIX}first image.jpg`;
const SECOND_KEY = `${PREFIX}second%image.jpg`;
const BODY = Buffer.from("synthetic-lightcos-probe-body");

const requests = [];
const responses = [
  xmlResponse(
    `<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>true</IsTruncated><NextMarker>${encodeURIComponent(FIRST_KEY)}</NextMarker><Contents><Key>${encodeURIComponent(FIRST_KEY)}</Key><Size>${BODY.length}</Size></Contents></ListBucketResult>`,
    "request-list-1",
  ),
  xmlResponse(
    `<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>false</IsTruncated><Contents><Key>${encodeURIComponent(SECOND_KEY)}</Key><Size>${BODY.length}</Size></Contents></ListBucketResult>`,
    "request-list-2",
  ),
  new Response(null, {
    status: 200,
    headers: {
      "content-length": String(BODY.length),
      "content-type": "image/jpeg",
      etag: '"probe-etag"',
      "x-cos-request-id": "request-head",
    },
  }),
  objectResponse(BODY, "request-authorized-get"),
  objectResponse(BODY, "request-presigned-get"),
];

const report = await runLightCosReadProbe({
  bucket: BUCKET,
  prefix: PREFIX,
  expectedFirstKey: FIRST_KEY,
  expectedSecondKey: SECOND_KEY,
  objectKey: FIRST_KEY,
  confirmedEndpoint: ENDPOINT,
  confirmReadOnlyProbe: true,
  maxDownloadBytes: 1024,
  fetchImplementation: syntheticFetch(responses, requests),
});

assert.equal(report.status, "passed");
assert.equal(report.requestCount, 5);
assert.equal(report.http.length, 5);
assert.equal(report.object.bytes, BODY.length);
assert.equal(report.http[0].requestId, "request-list-1");
assert.deepEqual(
  requests.map((request) => request.init.method),
  ["GET", "GET", "HEAD", "GET", "GET"],
);
assert.ok(requests.every((request) => request.init.redirect === "manual"));
assert.equal(requests[0].url.searchParams.get("max-keys"), "1");
assert.equal(requests[0].url.searchParams.get("prefix"), PREFIX);
assert.equal(requests[1].url.searchParams.get("marker"), FIRST_KEY);
assert.ok(requests[4].url.searchParams.has("q-signature"));
const serializedReport = JSON.stringify(report);
assert.equal(serializedReport.includes(process.env.STORAGE_ACCESS_KEY_ID), false);
assert.equal(serializedReport.includes(process.env.STORAGE_ACCESS_KEY_SECRET), false);
assert.equal(serializedReport.includes("q-signature"), false);
assert.equal(serializedReport.includes(FIRST_KEY), false);

let networkCalls = 0;
await assert.rejects(
  () =>
    runLightCosReadProbe({
      bucket: BUCKET,
      prefix: PREFIX,
      expectedFirstKey: FIRST_KEY,
      expectedSecondKey: SECOND_KEY,
      objectKey: FIRST_KEY,
      confirmedEndpoint: ENDPOINT,
      fetchImplementation: async () => {
        networkCalls += 1;
        throw new Error("must not run");
      },
    }),
  /explicit read-only confirmation/,
);
await assert.rejects(
  () =>
    runLightCosReadProbe({
      bucket: BUCKET,
      prefix: PREFIX,
      expectedFirstKey: FIRST_KEY,
      expectedSecondKey: SECOND_KEY,
      objectKey: FIRST_KEY,
      confirmedEndpoint: "https://unapproved.example.test",
      confirmReadOnlyProbe: true,
      fetchImplementation: async () => {
        networkCalls += 1;
        throw new Error("must not run");
      },
    }),
  /exact confirmation/,
);
assert.equal(networkCalls, 0);

const redirectRequests = [];
await assert.rejects(
  () =>
    runLightCosReadProbe({
      bucket: BUCKET,
      prefix: PREFIX,
      expectedFirstKey: FIRST_KEY,
      expectedSecondKey: SECOND_KEY,
      objectKey: FIRST_KEY,
      confirmedEndpoint: ENDPOINT,
      confirmReadOnlyProbe: true,
      fetchImplementation: syntheticFetch(
        [new Response(null, { status: 302, headers: { location: "https://elsewhere.test" } })],
        redirectRequests,
      ),
    }),
  (error) =>
    error instanceof LightCosReadProbeError &&
    /refused an HTTP redirect/.test(error.message) &&
    error.report.requestCount === 1,
);
assert.equal(redirectRequests.length, 1);

const oversizedRequests = [];
await assert.rejects(
  () =>
    runLightCosReadProbe({
      bucket: BUCKET,
      prefix: PREFIX,
      expectedFirstKey: FIRST_KEY,
      expectedSecondKey: SECOND_KEY,
      objectKey: FIRST_KEY,
      confirmedEndpoint: ENDPOINT,
      confirmReadOnlyProbe: true,
      maxDownloadBytes: 4,
      fetchImplementation: syntheticFetch(
        [
          xmlResponse(
            `<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>true</IsTruncated><NextMarker>${encodeURIComponent(FIRST_KEY)}</NextMarker><Contents><Key>${encodeURIComponent(FIRST_KEY)}</Key><Size>${BODY.length}</Size></Contents></ListBucketResult>`,
          ),
          xmlResponse(
            `<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>false</IsTruncated><Contents><Key>${encodeURIComponent(SECOND_KEY)}</Key><Size>${BODY.length}</Size></Contents></ListBucketResult>`,
          ),
          new Response(null, {
            status: 200,
            headers: { "content-length": String(BODY.length), "content-type": "image/jpeg" },
          }),
        ],
        oversizedRequests,
      ),
    }),
  (error) =>
    error instanceof LightCosReadProbeError &&
    /exceeds the approved download/.test(error.message) &&
    error.report.requestCount === 3,
);
assert.equal(oversizedRequests.length, 3);

console.info("Synthetic bounded LightCOS read probe verification passed");

function syntheticFetch(queue, log) {
  return async (input, init = {}) => {
    log.push({ init, url: new URL(input) });
    const response = queue.shift();
    if (!response) throw new Error("synthetic probe response queue exhausted");
    return response;
  };
}

function xmlResponse(xml, requestId = null) {
  const headers = { "content-type": "application/xml" };
  if (requestId) headers["x-cos-request-id"] = requestId;
  return new Response(xml, { status: 200, headers });
}

function objectResponse(body, requestId) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-length": String(body.length),
      "content-type": "image/jpeg",
      etag: '"probe-etag"',
      "x-cos-request-id": requestId,
    },
  });
}
