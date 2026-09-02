export class ApiError extends Error {
  constructor({ statusCode, code, message, details }) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message = "Invalid request parameters", details) {
  return new ApiError({
    statusCode: 400,
    code: "BAD_REQUEST",
    message,
    details,
  });
}

export function unauthorized(message = "Authentication required") {
  return new ApiError({
    statusCode: 401,
    code: "UNAUTHORIZED",
    message,
  });
}

export function forbidden(message = "Insufficient permissions") {
  return new ApiError({
    statusCode: 403,
    code: "FORBIDDEN",
    message,
  });
}

export function notFound(message = "Not found") {
  return new ApiError({
    statusCode: 404,
    code: "NOT_FOUND",
    message,
  });
}

export function methodNotAllowed(message = "Method not allowed") {
  return new ApiError({
    statusCode: 405,
    code: "METHOD_NOT_ALLOWED",
    message,
  });
}

export function tooManyRequests(message = "Too many requests", details) {
  return new ApiError({
    statusCode: 429,
    code: "TOO_MANY_REQUESTS",
    message,
    details,
  });
}

export function serviceUnavailable(message = "Service unavailable", details) {
  return new ApiError({
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    message,
    details,
  });
}
