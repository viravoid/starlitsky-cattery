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
