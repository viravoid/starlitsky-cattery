import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { applyCorsHeaders, isAllowedOrigin } from "../middleware/cors.mjs";
import {
  assertRateLimit,
  buildIpRateLimitKey,
  getClientIp,
  getRateLimitBucketCount,
  resetRateLimitBuckets,
} from "../middleware/rate-limit.mjs";
import { ApiError } from "../utils/errors.mjs";
import { fetchWithTimeout, isFetchTimeoutError } from "../utils/fetch.mjs";
import { sendError } from "../utils/response.mjs";
import { routeRequest } from "../routes/index.mjs";

const originalNodeEnv = process.env.NODE_ENV;
const originalCorsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
process.env.NODE_ENV = "production";
delete process.env.CORS_ALLOWED_ORIGINS;
const { config: productionConfig } = await import("../config/env.mjs?security-hardening-production");
assert.deepEqual(productionConfig.cors.allowedOrigins, []);
restoreEnv("NODE_ENV", originalNodeEnv);
restoreEnv("CORS_ALLOWED_ORIGINS", originalCorsAllowedOrigins);

assert.equal(isAllowedOrigin("https://admin.example.com", {
  allowedOrigins: ["https://admin.example.com"],
}), true);
assert.equal(isAllowedOrigin("https://evil.example.com", {
  allowedOrigins: ["https://admin.example.com"],
}), false);
assert.equal(isAllowedOrigin(undefined, {
  allowedOrigins: ["https://admin.example.com"],
}), false);

const allowedResponse = createFakeResponse();
applyCorsHeaders(
  { headers: { origin: "https://admin.example.com" } },
  allowedResponse,
  { cors: { allowedOrigins: ["https://admin.example.com"] } },
);
assert.equal(allowedResponse.headers["access-control-allow-origin"], "https://admin.example.com");
assert.equal(allowedResponse.headers.vary, "Origin");

const blockedResponse = createFakeResponse();
applyCorsHeaders(
  { headers: { origin: "https://evil.example.com" } },
  blockedResponse,
  { cors: { allowedOrigins: ["https://admin.example.com"] } },
);
assert.equal(blockedResponse.headers["access-control-allow-origin"], undefined);

const optionsResponse = createFakeResponse();
await simulateServerRequest(
  {
    method: "OPTIONS",
    headers: {
      origin: "https://admin.example.com",
      host: "api.example.com",
      "access-control-request-headers": "authorization,content-type",
    },
    remoteAddress: "203.0.113.10",
  },
  optionsResponse,
  { config: createRouteConfig(["https://admin.example.com"]) },
);
assert.equal(optionsResponse.statusCode, 204);
assert.equal(optionsResponse.headers["access-control-allow-origin"], "https://admin.example.com");
assert.equal(optionsResponse.headers["access-control-allow-headers"], "authorization,content-type");

const miniappHealthResponse = createFakeResponse();
await simulateServerRequest(
  {
    method: "GET",
    url: "/health",
    headers: { host: "api.example.com" },
    remoteAddress: "203.0.113.10",
  },
  miniappHealthResponse,
  { config: createRouteConfig(["https://admin.example.com"]) },
);
assert.equal(miniappHealthResponse.statusCode, 200);
assert.equal(miniappHealthResponse.headers["access-control-allow-origin"], undefined);
assert.equal(JSON.parse(miniappHealthResponse.body).success, true);

const spoofedForwardedRequestA = createFakeRequest({
  headers: { "x-forwarded-for": "198.51.100.20" },
  remoteAddress: "203.0.113.10",
});
const spoofedForwardedRequestB = createFakeRequest({
  headers: { "x-forwarded-for": "198.51.100.21" },
  remoteAddress: "203.0.113.10",
});
assert.equal(getClientIp(spoofedForwardedRequestA), "203.0.113.10");
assert.equal(
  buildIpRateLimitKey(spoofedForwardedRequestA, "wechat-login"),
  buildIpRateLimitKey(spoofedForwardedRequestB, "wechat-login"),
);

const trustedProxyRequest = createFakeRequest({
  headers: { "x-forwarded-for": "198.51.100.20" },
  remoteAddress: "10.0.0.10",
});
assert.equal(getClientIp(trustedProxyRequest, { trustProxy: true, trustedProxyHops: 1 }), "198.51.100.20");

const trustedProxyChainRequest = createFakeRequest({
  headers: { "x-forwarded-for": "198.51.100.20, 10.0.0.11" },
  remoteAddress: "10.0.0.10",
});
assert.equal(getClientIp(trustedProxyChainRequest, { trustProxy: true, trustedProxyHops: 2 }), "198.51.100.20");

resetRateLimitBuckets();
assert.doesNotThrow(() => assertRateLimit("verify-ip", { windowMs: 1000, max: 2 }, 1000));
assert.doesNotThrow(() => assertRateLimit("verify-ip", { windowMs: 1000, max: 2 }, 1001));
assert.throws(
  () => assertRateLimit("verify-ip", { windowMs: 1000, max: 2 }, 1002),
  (error) => error instanceof ApiError && error.statusCode === 429,
);
assert.doesNotThrow(() => assertRateLimit("verify-ip", { windowMs: 1000, max: 2 }, 2101));

const rateLimitResponse = createFakeResponse();
sendError(
  rateLimitResponse,
  new ApiError({
    statusCode: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests",
    details: { retryAfterSeconds: 7 },
  }),
);
assert.equal(rateLimitResponse.headers["retry-after"], "7");
assert.equal(rateLimitResponse.body.includes("203.0.113"), false);

resetRateLimitBuckets();
assert.doesNotThrow(() => assertRateLimit("expired-ip", { windowMs: 1000, max: 10 }, 1000));
assert.equal(getRateLimitBucketCount(), 1);
assert.doesNotThrow(() => assertRateLimit("fresh-ip", { windowMs: 1000, max: 10 }, 2101));
assert.equal(getRateLimitBucketCount(), 1);

resetRateLimitBuckets();
assert.doesNotThrow(() => assertRateLimit("bucket-a", { windowMs: 1000, max: 10, maxBuckets: 1 }, 1000));
assert.doesNotThrow(() => assertRateLimit("bucket-b", { windowMs: 1000, max: 10, maxBuckets: 1 }, 1001));
assert.equal(getRateLimitBucketCount(), 1);

const originalFetch = globalThis.fetch;
globalThis.fetch = (_resource, init) =>
  new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });

try {
  await assert.rejects(
    () => fetchWithTimeout("https://example.invalid", {}, 1),
    (error) => isFetchTimeoutError(error),
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Security hardening verification passed");

function createFakeResponse() {
  const response = new EventEmitter();
  response.headers = {};
  response.body = "";
  response.setHeader = (name, value) => {
    response.headers[name.toLowerCase()] = value;
  };
  response.getHeader = (name) => response.headers[name.toLowerCase()];
  response.writeHead = (statusCode, headers = {}) => {
    response.statusCode = statusCode;
    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
  };
  response.end = (body = "") => {
    response.body = String(body);
  };
  return response;
}

function createFakeRequest({
  method = "GET",
  url = "/",
  headers = {},
  remoteAddress = "127.0.0.1",
} = {}) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress },
  };
}

function createRouteConfig(allowedOrigins = []) {
  return {
    service: { name: "starlitsky-api" },
    server: { host: "127.0.0.1", port: 4310 },
    cors: { allowedOrigins },
  };
}

async function simulateServerRequest(requestOptions, response, context) {
  const request = createFakeRequest(requestOptions);
  applyCorsHeaders(request, response, context.config);
  await routeRequest(request, response, context);
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
