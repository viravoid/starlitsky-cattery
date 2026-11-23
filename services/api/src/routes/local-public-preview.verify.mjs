import assert from "node:assert/strict";
import { routeLocalPublicPreview } from "./local-public-preview.mjs";

const config = { env: "development", server: { host: "127.0.0.1" } };
let calls = [];
const upstream = async (url, options) => {
  calls.push({ url, options });
  return new Response(JSON.stringify({ success: true, data: {
    items: [
      { id: "real", name: "真实猫", visibility: "visible" },
      { id: "trial-visible-cat-20261028", name: "TEST ONLY Visible Cat", visibility: "visible" },
      { id: "hidden", name: "隐身猫", visibility: "hidden" },
    ],
    pagination: { total: 3 },
  } }), { headers: { "content-type": "application/json" } });
};

function response() {
  return {
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = JSON.parse(body); },
  };
}

async function invoke(path, method = "GET", settings = config, headers = { "x-local-public-preview": "1", authorization: "Bearer private", cookie: "private=1" }, fetcher = upstream) {
  const result = response();
  const handled = await routeLocalPublicPreview({ method, headers }, result,
    new URL(path, "http://127.0.0.1:4310"), settings, fetcher);
  return { handled, ...result };
}

const cats = await invoke("/cats?pageSize=100");
assert.equal(cats.status, 200);
assert.deepEqual(cats.body.data.items.map((cat) => cat.id), ["real"]);
assert.equal(cats.body.data.pagination.total, 1);
assert.equal(cats.headers["cache-control"], "no-store");
assert.equal(calls[0].url.origin, "https://api.starlitskycattery.top");
assert.equal(calls[0].options.method, "GET");
assert.deepEqual(calls[0].options.headers, { accept: "application/json" });
assert.equal(calls[0].options.redirect, "error");

for (const path of ["/admin/users", "/me/cats", "/community/posts/mine", "/fixed-pages/questionnaire", "/cats?includeHidden=true", "/cats?url=https://evil.example", "/community/posts?status=hidden"]) {
  assert.equal((await invoke(path)).status, 404, path);
}
for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
  assert.equal((await invoke("/cats", method)).status, 405, method);
}
assert.equal((await invoke("/cats", "GET", { env: "production", server: { host: "127.0.0.1" } })).status, 404);
assert.equal((await invoke("/cats", "GET", { env: "development", server: { host: "0.0.0.0" } })).status, 404);
assert.equal((await invoke("/cats", "GET", config, {})).handled, false);
assert.equal(calls.length, 1, "rejected requests never reach upstream");

const fixed = await invoke("/fixed-pages/about", "GET", config, { "x-local-public-preview": "1" },
  async () => new Response(JSON.stringify({ success: true, data: { status: "draft" } })));
assert.equal(fixed.status, 404);
const media = await invoke("/fixed-pages/home", "GET", config, { "x-local-public-preview": "1" },
  async () => new Response(JSON.stringify({ success: true, data: {
    status: "published", mediaAssets: [{ sourceUrl: "https://example.invalid/signed?expires=1" }],
  } })));
assert.equal(media.status, 200);
assert.equal(media.headers["cache-control"], "no-store", "signed URLs cannot be cached by the proxy");
const posts = await invoke("/community/posts?pageSize=50", "GET", config, { "x-local-public-preview": "1" },
  async () => new Response(JSON.stringify({ success: true, data: {
    items: [{ visibility: "visible" }, { visibility: "hidden" }], pagination: { total: 2 },
  } })));
assert.equal(posts.body.data.items.length, 1);
assert.equal(posts.body.data.pagination.total, 1);
const timeout = await invoke("/cats", "GET", config, { "x-local-public-preview": "1" },
  async () => { throw new DOMException("timed out", "TimeoutError"); });
assert.equal(timeout.status, 504);
const error = await invoke("/cats", "GET", config, { "x-local-public-preview": "1" },
  async () => new Response("failure", { status: 500 }));
assert.equal(error.status, 502);

console.log("Local public preview guard checks passed");
