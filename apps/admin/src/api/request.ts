import type { ApiErrorResponse, ApiResponse } from "@starlitsky/shared";
import { getApiBaseUrl } from "../config/env";
import { clearAdminAuthToken, getAdminAuthToken } from "./auth-token";

type RequestMethod = "DELETE" | "GET" | "PATCH" | "POST";

export interface AdminRequestOptions<TBody = unknown> {
  path: string;
  data?: TBody;
  headers?: Record<string, string>;
}

export function adminGet<TData>(path: string) {
  return adminRequest<TData>({ path }, "GET");
}

export function adminPost<TData, TBody = unknown>(path: string, data?: TBody) {
  return adminRequest<TData, TBody>({ path, data }, "POST");
}

export function adminPatch<TData, TBody = unknown>(path: string, data?: TBody) {
  return adminRequest<TData, TBody>({ path, data }, "PATCH");
}

export function adminDelete<TData>(path: string) {
  return adminRequest<TData>({ path }, "DELETE");
}

async function adminRequest<TData, TBody = unknown>(
  options: AdminRequestOptions<TBody>,
  method: RequestMethod,
): Promise<ApiResponse<TData>> {
  const token = getAdminAuthToken();
  const response = await fetch(buildUrl(options.path), {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.data === undefined ? undefined : JSON.stringify(options.data),
  });

  const payload = (await response.json().catch(() => createParseError())) as ApiResponse<TData>;
  if (response.ok) return payload;
  if (response.status === 401) clearAdminAuthToken();

  return normalizeErrorResponse(payload, response.status);
}

function buildUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeErrorResponse(value: ApiResponse<unknown>, status: number): ApiErrorResponse {
  if (value && value.success === false) return value;
  return {
    success: false,
    error: { code: `HTTP_${status}` },
    message: "Request failed",
  };
}

function createParseError(): ApiErrorResponse {
  return {
    success: false,
    error: { code: "INVALID_JSON" },
    message: "Invalid API response",
  };
}
