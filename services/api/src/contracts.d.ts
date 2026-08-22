import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  HealthCheckData,
} from "@starlitsky/shared";

export type HealthApiResponse = ApiSuccessResponse<HealthCheckData>;

export type ApiFailureResponse = ApiErrorResponse;
