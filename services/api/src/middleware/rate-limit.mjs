import { tooManyRequests } from "../utils/errors.mjs";

const buckets = new Map();
const DEFAULT_MAX_BUCKETS = 10_000;

export function assertRateLimit(key, options = {}, nowMs = Date.now()) {
  const limit = normalizeLimit(options);
  if (!key || !limit) return;

  pruneExpiredBuckets(nowMs);
  if (!buckets.has(key) && buckets.size >= limit.maxBuckets) {
    evictOldestBucket();
  }

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

export function buildIpRateLimitKey(request, prefix, proxyConfig = {}) {
  return `${prefix}:${getClientIp(request, proxyConfig)}`;
}

export function getClientIp(request, proxyConfig = {}) {
  if (proxyConfig.trustProxy) {
    const forwardedIp = getForwardedClientIp(request.headers, proxyConfig.trustedProxyHops);
    if (forwardedIp) return forwardedIp;
  }

  return request.socket?.remoteAddress || "unknown";
}

export function resetRateLimitBuckets() {
  buckets.clear();
}

export function getRateLimitBucketCount() {
  return buckets.size;
}

function normalizeLimit(options) {
  const windowMs = Number(options.windowMs);
  const max = Number(options.max);
  const maxBuckets = Number(options.maxBuckets || DEFAULT_MAX_BUCKETS);
  if (!Number.isInteger(windowMs) || windowMs <= 0) return null;
  if (!Number.isInteger(max) || max <= 0) return null;
  if (!Number.isInteger(maxBuckets) || maxBuckets <= 0) return null;
  return { windowMs, max, maxBuckets };
}

function getForwardedClientIp(headers = {}, trustedProxyHops = 1) {
  const forwardedFor = headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    const forwardedChain = forwardedFor
      .split(",")
      .map((address) => address.trim())
      .filter(Boolean);
    if (forwardedChain.length > 0) {
      const hopCount = Number.isInteger(Number(trustedProxyHops)) && Number(trustedProxyHops) > 0
        ? Number(trustedProxyHops)
        : 1;
      return forwardedChain[Math.max(0, forwardedChain.length - hopCount)];
    }
  }

  const realIp = headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  return null;
}

function pruneExpiredBuckets(nowMs) {
  for (const [key, bucket] of buckets) {
    if (!bucket || bucket.resetAtMs <= nowMs) {
      buckets.delete(key);
    }
  }
}

function evictOldestBucket() {
  let oldestKey = null;
  let oldestResetAtMs = Infinity;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAtMs < oldestResetAtMs) {
      oldestKey = key;
      oldestResetAtMs = bucket.resetAtMs;
    }
  }
  if (oldestKey) buckets.delete(oldestKey);
}
