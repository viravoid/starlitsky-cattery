const runtimeEnv = process.env.NODE_ENV || "development";
const isProduction = runtimeEnv === "production";

export const config = {
  env: runtimeEnv,
  isDevelopment: !isProduction,
  isProduction,
  service: {
    name: "starlitsky-api",
  },
  server: {
    host: process.env.API_HOST || (isProduction ? "0.0.0.0" : "127.0.0.1"),
    port: parsePort(process.env.API_PORT || process.env.PORT, isProduction ? 8080 : 4310),
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || "s3",
    bucket: process.env.STORAGE_BUCKET || "",
    region: process.env.STORAGE_REGION || "",
    endpoint: process.env.STORAGE_ENDPOINT || "",
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL || "",
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
    accessKeySecret: process.env.STORAGE_ACCESS_KEY_SECRET || "",
    keyPrefix: process.env.STORAGE_KEY_PREFIX || "media",
    forcePathStyle: parseBoolean(process.env.STORAGE_FORCE_PATH_STYLE),
    uploadExpiresSeconds: parsePositiveInteger(process.env.STORAGE_UPLOAD_EXPIRES_SECONDS, 600),
    maxImageBytes: parsePositiveInteger(process.env.STORAGE_MAX_IMAGE_BYTES, 10 * 1024 * 1024),
  },
};

function parsePort(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolean(value) {
  return value === "true" || value === "1";
}
