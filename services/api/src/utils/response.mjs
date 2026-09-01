export function sendSuccess(response, { statusCode = 200, data = null, message = "OK" } = {}) {
  sendJson(response, statusCode, {
    success: true,
    data,
    message,
  });
}

export function sendError(response, error) {
  sendJson(response, error.statusCode || 500, {
    success: false,
    error: {
      code: error.code || "INTERNAL_ERROR",
      details: error.details,
    },
    message: error.message || "Internal server error",
  });
}

export function sendNoContent(response, statusCode = 204) {
  response.writeHead(statusCode, buildJsonHeaders());
  response.end();
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, buildJsonHeaders());
  response.end(JSON.stringify(body));
}

function buildJsonHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
}
