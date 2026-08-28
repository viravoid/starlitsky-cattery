import { ApiError } from "../utils/errors.mjs";
import { logger } from "../utils/logger.mjs";
import { sendError } from "../utils/response.mjs";

export function handleError(error, response) {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError({
          statusCode: 500,
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        });

  logger.error(apiError.message, error);
  sendError(response, apiError);
}
