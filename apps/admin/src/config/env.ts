const DEFAULT_API_BASE_URL = "http://127.0.0.1:4310";
const DEFAULT_MEDIA_UPLOAD_TIMEOUT_MS = 60_000;
const MAX_MEDIA_UPLOAD_TIMEOUT_MS = 5 * 60_000;

export function getApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredBaseUrl) return configuredBaseUrl;
  if (import.meta.env.PROD) {
    throw new Error("VITE_API_BASE_URL must be set for production Admin builds");
  }
  return DEFAULT_API_BASE_URL;
}

export function getMediaUploadTimeoutMs() {
  const configured = Number(import.meta.env.VITE_MEDIA_UPLOAD_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MEDIA_UPLOAD_TIMEOUT_MS;
  return Math.min(Math.floor(configured), MAX_MEDIA_UPLOAD_TIMEOUT_MS);
}
