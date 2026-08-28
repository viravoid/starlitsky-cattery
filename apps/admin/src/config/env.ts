const DEFAULT_API_BASE_URL = "http://127.0.0.1:4310";

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}
