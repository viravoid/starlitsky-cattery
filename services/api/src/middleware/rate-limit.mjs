import { tooManyRequests } from "../utils/errors.mjs";

const buckets = new Map();

export function assertRateLimit(key, options = {}, nowMs = Date.now()) {
  const limit = normalizeLimit(options);
  if (!key || !limit) return;

  const existing = buckets.get(key);
  const bucket =
    existing && existing.resetAtMs > nowMs ? existing : { count: 0, resetAtMs: nowMs + limit.windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > limit.max) {
    throw tooManyRequests("Too many WeChat login attempts. Please try again later.", {
      retryAfterSeconds: Math.ceil((bucket.resetAtMs - nowMs) / 1000),
    });
  }
}

export function buildIpRateLimitKey(request, prefix) {
  return `${prefix}:${getClientIp(request)}`;
}

export function getClientIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  return request.socket?.remoteAddress || "unknown";
}

export function resetRateLimitBuckets() {
  buckets.clear();
}

function normalizeLimit(options) {
  const windowMs = Number(options.windowMs);
  const max = Number(options.max);
  if (!Number.isInteger(windowMs) || windowMs <= 0) return null;
  if (!Number.isInteger(max) || max <= 0) return null;
  return { windowMs, max };
}
