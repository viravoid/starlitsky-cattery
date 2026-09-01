import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { applyCorsHeaders, isAllowedOrigin } from "../middleware/cors.mjs";
import { assertRateLimit, resetRateLimitBuckets } from "../middleware/rate-limit.mjs";
import { ApiError } from "../utils/errors.mjs";
import { fetchWithTimeout, isFetchTimeoutError } from "../utils/fetch.mjs";

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

resetRateLimitBuckets();
assert.doesNotThrow(() => assertRateLimit("verify-ip", { windowMs: 1000, max: 2 }, 1000));
assert.doesNotThrow(() => assertRateLimit("verify-ip", { windowMs: 1000, max: 2 }, 1001));
assert.throws(
  () => assertRateLimit("verify-ip", { windowMs: 1000, max: 2 }, 1002),
  (error) => error instanceof ApiError && error.statusCode === 429,
);
assert.doesNotThrow(() => assertRateLimit("verify-ip", { windowMs: 1000, max: 2 }, 2101));

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
  response.setHeader = (name, value) => {
    response.headers[name.toLowerCase()] = value;
  };
  response.getHeader = (name) => response.headers[name.toLowerCase()];
  return response;
}
