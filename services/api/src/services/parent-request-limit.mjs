import { tooManyRequests } from "../utils/errors.mjs";

const buckets = new Map();

export function limitParentRequest(kind, userId, { max, windowMs }) {
  const now = Date.now();
  const key = `${kind}:${userId}`;
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  if (bucket.count >= max) throw tooManyRequests("Too many requests; please try later");
  bucket.count += 1;
  buckets.set(key, bucket);
  if (buckets.size > 10_000) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(entryKey);
    }
    if (buckets.size > 10_000) buckets.delete(buckets.keys().next().value);
  }
}
