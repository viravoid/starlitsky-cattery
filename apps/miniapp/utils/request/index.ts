import type { ApiErrorResponse, ApiResponse } from "@starlitsky/shared";
import { getApiBaseUrl } from "../../config/env";
import { clearToken, getToken } from "../session/token-storage";

type RequestMethod = "DELETE" | "GET" | "PATCH" | "POST";

export interface RequestOptions<TBody = unknown> {
  url: string;
  data?: TBody;
  header?: Record<string, string>;
}

export function get<TResponse>(url: string, options: Omit<RequestOptions, "url"> = {}) {
  return request<TResponse>({ ...options, url }, "GET");
}

export function post<TResponse, TBody = unknown>(
  url: string,
  data?: TBody,
  options: Omit<RequestOptions<TBody>, "url" | "data"> = {},
) {
  return request<TResponse>({ ...options, url, data }, "POST");
}

export function patch<TResponse, TBody = unknown>(
  url: string,
  data?: TBody,
  options: Omit<RequestOptions<TBody>, "url" | "data"> = {},
) {
  return request<TResponse>({ ...options, url, data }, "PATCH");
}

export function del<TResponse>(url: string, options: Omit<RequestOptions, "url"> = {}) {
  return request<TResponse>({ ...options, url }, "DELETE");
}

function request<TResponse, TBody = unknown>(
  options: RequestOptions<TBody>,
  method: RequestMethod,
): Promise<ApiResponse<TResponse>> {
  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(options.url),
      method,
      data: options.data,
      header: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...options.header
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as ApiResponse<TResponse>);
          return;
        }

        if (response.statusCode === 401) {
          clearToken();
        }

        reject(normalizeError(response.statusCode, response.data));
      },
      fail(error) {
        reject({
          success: false,
          error: { code: "NETWORK_ERROR" },
          message: error.errMsg || "Network request failed"
        } satisfies ApiErrorResponse);
      }
    });
  });
}

function buildUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeError(statusCode: number, data: unknown): ApiErrorResponse {
  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    (data as { success?: unknown }).success === false
  ) {
    return data as ApiErrorResponse;
  }

  return {
    success: false,
    error: { code: `HTTP_${statusCode}` },
    message: "Request failed"
  };
}
