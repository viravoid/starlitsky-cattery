#!/usr/bin/env node

import assert from "node:assert/strict";

const bases = ["https://api.starlitskycattery.top", "https://trial-api.starlitskycattery.top"];
const slugs = [
  "home",
  "about",
  "environment",
  "philosophy",
  "breeding-plan",
  "feeding",
  "process",
  "aftercare",
  "contact",
];

async function getJson(url) {
  const started = Date.now();
  const response = await fetch(url, {
    method: "GET",
    headers: { "content-type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, `${new URL(url).pathname}: HTTP ${response.status}`);
  const body = await response.json();
  assert.equal(body.success, true, `${new URL(url).pathname}: API failure`);
  assert.ok(body.data && typeof body.data === "object", `${new URL(url).pathname}: missing data`);
  return { data: body.data, ms: Date.now() - started };
}

async function checkImage(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:");
  if (url.host === "trial-api.starlitskycattery.top" && url.pathname.startsWith("/trial-media/")) {
    assert.equal(url.search, "", "trial media proxy must not leak signed query parameters");
  } else {
    const signedAt = url.searchParams.get("X-Amz-Date");
    const lifetime = Number(url.searchParams.get("X-Amz-Expires"));
    assert.ok(
      signedAt && Number.isFinite(lifetime) && lifetime > 0,
      `${url.host}: missing signature lifetime`,
    );
    const match = signedAt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    assert.ok(match, `${url.host}: malformed signature date`);
    const expiresAt =
      Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]) +
      lifetime * 1000;
    assert.ok(expiresAt > Date.now() + 60_000, `${url.host}: signature nearly expired`);
  }
  const response = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-1023" },
    signal: AbortSignal.timeout(15000),
  });
  assert.ok(
    response.status === 206 || response.status === 200,
    `${url.host}: image HTTP ${response.status}`,
  );
  assert.match(
    response.headers.get("content-type") ?? "",
    /^image\//,
    `${url.host}: image content type`,
  );
  await response.body?.cancel();
  return url.host;
}

for (const base of bases) {
  const mediaUrls = new Set();
  let maxMs = 0;
  let environmentSections = 0;
  for (const slug of slugs) {
    const { data, ms } = await getJson(`${base}/fixed-pages/${slug}`);
    maxMs = Math.max(maxMs, ms);
    assert.equal(data.status, "published", `${slug}: unpublished`);
    assert.ok(data.contentJson && typeof data.contentJson === "object", `${slug}: missing content`);
    if (slug === "environment") {
      environmentSections = data.contentJson.sections?.length ?? 0;
      assert.equal(environmentSections, 6, "environment: expected six sections");
    }
    for (const media of data.mediaAssets ?? []) {
      if (media.kind === "image" && media.sourceUrl) mediaUrls.add(media.sourceUrl);
    }
  }
  const { data: cats, ms } = await getJson(`${base}/cats?pageSize=100`);
  maxMs = Math.max(maxMs, ms);
  assert.ok(Array.isArray(cats.items) && cats.items.length > 0, "missing public cats");
  for (const cat of cats.items) {
    const { data: detail, ms: detailMs } = await getJson(
      `${base}/cats/${encodeURIComponent(cat.id)}`,
    );
    maxMs = Math.max(maxMs, detailMs);
    assert.equal(detail.id, cat.id, "cat detail mismatch");
    for (const media of detail.mediaAssets ?? []) {
      if (media.kind === "image" && media.sourceUrl) mediaUrls.add(media.sourceUrl);
    }
  }
  const hosts = new Map();
  const urls = [...mediaUrls];
  for (let offset = 0; offset < urls.length; offset += 8) {
    const results = await Promise.all(urls.slice(offset, offset + 8).map(checkImage));
    for (const host of results) hosts.set(host, (hosts.get(host) ?? 0) + 1);
  }
  console.log(
    JSON.stringify({
      api: base,
      fixedPages: slugs.length,
      environmentSections,
      publicCats: cats.items.length,
      catDetails: cats.items.length,
      images: urls.length,
      imageHosts: Object.fromEntries(hosts),
      slowestApiMs: maxMs,
    }),
  );
}
