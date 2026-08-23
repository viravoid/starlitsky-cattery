import { sendSuccess } from "../utils/response.mjs";

export function handleHealth(_request, response, context) {
  sendSuccess(response, {
    data: {
      status: "ok",
      service: context.config.service.name,
      environment: context.config.env,
      timestamp: new Date().toISOString(),
    },
    message: "Service healthy",
  });
}
