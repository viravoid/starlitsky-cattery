export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  message: string;
}

export interface ApiErrorPayload {
  code: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
  message: string;
}

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;

export interface HealthCheckData {
  status: "ok";
  service: string;
  environment: string;
  timestamp: string;
}
