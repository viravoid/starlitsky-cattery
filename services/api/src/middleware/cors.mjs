const CORS_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
const CORS_HEADERS = "authorization,content-type";

export function applyCorsHeaders(request, response, config) {
  const origin = request.headers.origin;
  if (isAllowedOrigin(origin, config?.cors)) {
    response.setHeader("access-control-allow-origin", origin);
    appendVaryHeader(response, "Origin");
  }

  response.setHeader("access-control-allow-methods", CORS_METHODS);
  response.setHeader("access-control-allow-headers", CORS_HEADERS);
  response.setHeader("access-control-max-age", "600");
}

export function isAllowedOrigin(origin, corsConfig = {}) {
  if (typeof origin !== "string" || origin.trim() === "") return false;
  return Array.isArray(corsConfig.allowedOrigins) && corsConfig.allowedOrigins.includes(origin);
}

function appendVaryHeader(response, value) {
  const current = response.getHeader("vary");
  if (!current) {
    response.setHeader("vary", value);
    return;
  }

  const values = Array.isArray(current) ? current.join(",") : String(current);
  if (values.toLowerCase().split(",").map((item) => item.trim()).includes(value.toLowerCase())) {
    return;
  }
  response.setHeader("vary", `${values}, ${value}`);
}
