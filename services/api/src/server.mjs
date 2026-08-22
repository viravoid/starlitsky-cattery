import { createServer } from "node:http";

const host = process.env.API_HOST || "127.0.0.1";
const port = Number(process.env.API_PORT || process.env.PORT || 4310);

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      status: "ok",
      service: "starlitsky-api",
      timestamp: new Date().toISOString()
    });
    return;
  }

  sendJson(response, 404, {
    status: "not_found",
    message: "Route not found"
  });
});

server.listen(port, host, () => {
  console.log(`starlitsky-api listening at http://${host}:${port}`);
});

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}
