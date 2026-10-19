import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.COS_E2E_PORT || 9320);
const allowedOrigin = process.env.COS_E2E_ADMIN_ORIGIN || "http://127.0.0.1:5174";
const allowedBuckets = new Set(
  String(process.env.COS_E2E_BUCKETS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const objects = new Map();
const events = [];
let nextPutMode = "ok";

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);

  if (url.pathname === "/_test/health") {
    return json(response, 200, { ok: true });
  }
  if (url.pathname === "/_test/events" && request.method === "GET") {
    return json(response, 200, { events });
  }
  if (url.pathname === "/_test/events" && request.method === "DELETE") {
    events.length = 0;
    return json(response, 200, { cleared: true });
  }
  if (url.pathname === "/_test/next-put" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)).toString("utf8") || "{}");
    if (!new Set(["ok", "fail", "hang"]).has(body.mode)) {
      return json(response, 400, { error: "invalid mode" });
    }
    nextPutMode = body.mode;
    return json(response, 200, { mode: nextPutMode });
  }

  const target = parseTarget(url.pathname);
  if (!target || !allowedBuckets.has(target.bucket)) {
    return json(response, 404, { error: "unknown isolated test object" });
  }

  if (request.method === "OPTIONS") {
    const originAllowed = request.headers.origin === allowedOrigin;
    if (originAllowed) setCorsHeaders(response, allowedOrigin);
    const status = originAllowed ? 204 : 403;
    events.push({
      method: "OPTIONS",
      bucket: target.bucket,
      objectKey: target.objectKey,
      origin: request.headers.origin || null,
      status,
    });
    response.writeHead(status);
    response.end();
    return;
  }

  if (!isSignedRequest(request, url)) {
    setCorsForRequest(request, response);
    events.push({ ...target, method: request.method, status: 403 });
    return json(response, 403, { error: "private object requires a signed request" });
  }

  if (request.method === "PUT") {
    const mode = nextPutMode;
    nextPutMode = "ok";
    const body = await readBody(request);
    setCorsForRequest(request, response);

    if (mode === "fail") {
      events.push({ ...target, method: "PUT", status: 503 });
      return json(response, 503, { error: "injected isolated PUT failure" });
    }
    if (mode === "hang") {
      events.push({ ...target, method: "PUT", status: 0 });
      request.on("close", () => {
        if (!response.writableEnded) response.destroy();
      });
      return;
    }

    objects.set(objectId(target), {
      body,
      contentType: request.headers["content-type"] || "application/octet-stream",
      etag: `"cos-e2e-${body.length}"`,
      lastModified: new Date().toUTCString(),
    });
    events.push({ ...target, method: "PUT", status: 200 });
    response.setHeader("etag", `"cos-e2e-${body.length}"`);
    response.writeHead(200);
    response.end();
    return;
  }

  const stored = objects.get(objectId(target));
  if (!stored) {
    setCorsForRequest(request, response);
    events.push({ ...target, method: request.method, status: 404 });
    response.writeHead(404);
    response.end();
    return;
  }

  if (request.method === "HEAD") {
    events.push({ ...target, method: "HEAD", status: 200 });
    setObjectHeaders(response, stored);
    response.writeHead(200);
    response.end();
    return;
  }

  if (request.method === "GET") {
    setCorsForRequest(request, response);
    events.push({ ...target, method: "GET", status: 200 });
    setObjectHeaders(response, stored);
    response.writeHead(200);
    response.end(stored.body);
    return;
  }

  response.writeHead(405);
  response.end();
});

server.listen(port, host, () => {
  process.stdout.write(`isolated COS fixture listening at http://${host}:${port}\n`);
});

function parseTarget(pathname) {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments.length < 2) return null;
  return { bucket: segments[0], objectKey: segments.slice(1).join("/") };
}

function objectId({ bucket, objectKey }) {
  return `${bucket}\0${objectKey}`;
}

function isSignedRequest(request, url) {
  return Boolean(
    url.searchParams.get("X-Amz-Signature") ||
    String(request.headers.authorization || "").startsWith("AWS4-HMAC-SHA256 "),
  );
}

function setCorsForRequest(request, response) {
  response.setHeader("vary", "Origin");
  if (request.headers.origin === allowedOrigin) setCorsHeaders(response, allowedOrigin);
}

function setCorsHeaders(response, origin) {
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("access-control-allow-methods", "GET,HEAD,PUT,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  response.setHeader("access-control-expose-headers", "etag,content-length,content-type");
  response.setHeader("access-control-max-age", "60");
  response.setHeader("vary", "Origin");
}

function setObjectHeaders(response, stored) {
  response.setHeader("content-length", String(stored.body.length));
  response.setHeader("content-type", stored.contentType);
  response.setHeader("etag", stored.etag);
  response.setHeader("last-modified", stored.lastModified);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function json(response, status, value) {
  response.setHeader("content-type", "application/json");
  response.writeHead(status);
  response.end(JSON.stringify(value));
}

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
