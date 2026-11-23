// Development-only bridge for the miniapp's anonymous, published content.
// The upstream is deliberately fixed; no request header or parameter can select it.
const UPSTREAM = "https://api.starlitskycattery.top";
const TIMEOUT_MS = 6000;
const MAX_JSON_BYTES = 2_000_000;
const PUBLISHED_PAGES = new Set([
  "home", "about", "philosophy", "environment", "feeding", "process",
  "aftercare", "contact", "breeding-plan",
]);
const CAT_QUERY = new Set(["page", "pageSize", "q", "lifecycleStatus"]);
const POST_QUERY = new Set(["page", "pageSize", "q", "catId", "litterId", "category"]);
const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/;

export async function routeLocalPublicPreview(request, response, url, config, fetchImpl = fetch) {
  if (request.headers["x-local-public-preview"] !== "1") return false;

  if (config.env !== "development" || config.server.host !== "127.0.0.1") {
    send(response, 404, failure("NOT_FOUND", "Local public preview is unavailable"));
    return true;
  }
  if (request.method !== "GET") {
    send(response, 405, failure("METHOD_NOT_ALLOWED", "Public preview accepts GET only"));
    return true;
  }

  const kind = matchPublicRoute(url);
  if (!kind) {
    send(response, 404, failure("NOT_FOUND", "Public preview route not found"));
    return true;
  }

  try {
    const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM);
    const upstream = await fetchImpl(upstreamUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!upstream.ok) {
      send(response, upstream.status === 404 ? 404 : 502,
        failure(upstream.status === 404 ? "NOT_FOUND" : "UPSTREAM_ERROR", "Public content unavailable"));
      return true;
    }
    if (Number(upstream.headers.get("content-length")) > MAX_JSON_BYTES) {
      throw new Error("Public response too large");
    }
    const raw = await upstream.text();
    if (Buffer.byteLength(raw) > MAX_JSON_BYTES) throw new Error("Public response too large");
    const payload = JSON.parse(raw);
    const result = filterPublishedContent(kind, payload);
    if (!result) {
      send(response, 404, failure("NOT_FOUND", "Published content not found"));
      return true;
    }
    send(response, 200, result);
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    send(response, timeout ? 504 : 502,
      failure(timeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR", "Public content unavailable"));
  }
  return true;
}

function matchPublicRoute(url) {
  const { pathname, searchParams } = url;
  if (pathname === "/cats" && validQuery(searchParams, CAT_QUERY)) return "cats";
  if (pathname === "/community/posts" && validQuery(searchParams, POST_QUERY)) return "posts";
  const fixed = pathname.match(/^\/fixed-pages\/([^/]+)$/);
  if (fixed && PUBLISHED_PAGES.has(fixed[1]) && searchParams.size === 0) return "fixed";
  const cat = pathname.match(/^\/cats\/([^/]+)$/);
  if (cat && SAFE_ID.test(cat[1]) && searchParams.size === 0 &&
      !cat[1].startsWith("with-")) return "cat";
  const post = pathname.match(/^\/community\/posts\/([^/]+)$/);
  if (post && SAFE_ID.test(post[1]) && post[1] !== "mine" &&
      searchParams.size === 0) return "post";
  return null;
}

function validQuery(params, allowed) {
  const seen = new Set();
  for (const [key, value] of params) {
    if (!allowed.has(key) || seen.has(key) || value.length > 100) return false;
    if ((key === "page" || key === "pageSize") &&
        (!/^[1-9]\d{0,2}$/.test(value) || Number(value) > 100)) return false;
    seen.add(key);
  }
  return true;
}

function filterPublishedContent(kind, payload) {
  if (payload?.success !== true || !payload.data) return null;
  const data = payload.data;
  if (kind === "fixed") return data.status === "published" ? payload : null;
  if (kind === "cat") return publicCat(data) ? payload : null;
  if (kind === "post") return data.visibility === "visible" ? payload : null;
  if (!Array.isArray(data.items)) return null;
  if (kind === "cats") {
    const items = data.items.filter(publicCat);
    const removed = data.items.length - items.length;
    return { ...payload, data: { ...data, items,
      pagination: { ...data.pagination, total: Math.max(0, (data.pagination?.total ?? items.length) - removed) } } };
  }
  if (kind === "posts") {
    const items = data.items.filter((post) => post.visibility === "visible");
    const removed = data.items.length - items.length;
    return { ...payload, data: { ...data, items,
      pagination: { ...data.pagination, total: Math.max(0, (data.pagination?.total ?? items.length) - removed) } } };
  }
  return null;
}

function publicCat(cat) {
  return cat?.visibility === "visible" &&
    cat.id !== "trial-visible-cat-20261028" &&
    !/TEST ONLY/i.test(cat.name ?? "");
}

function failure(code, message) {
  return { success: false, error: { code }, message };
}

function send(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}
