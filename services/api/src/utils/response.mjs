export function sendSuccess(response, { statusCode = 200, data = null, message = "OK" } = {}) {
  sendJson(response, statusCode, {
    success: true,
    data,
    message
  });
}

export function sendError(response, error) {
  sendJson(response, error.statusCode || 500, {
    success: false,
    error: {
      code: error.code || "INTERNAL_ERROR",
      details: error.details
    },
    message: error.message || "Internal server error"
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}
