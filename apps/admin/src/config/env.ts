const DEFAULT_API_BASE_URL = "http://127.0.0.1:4310";

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredBaseUrl) return configuredBaseUrl;
  if (import.meta.env.PROD) {
    throw new Error("VITE_API_BASE_URL must be set for production Admin builds");
  }
  return DEFAULT_API_BASE_URL;
}
