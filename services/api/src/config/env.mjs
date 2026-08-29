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
  auth: {
    tokenSecret:
      process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || "development-auth-token-secret",
    sessionTtlDays: parsePositiveInteger(process.env.AUTH_SESSION_TTL_DAYS, 30),
  },
  wechat: {
    appId: process.env.WECHAT_APP_ID || "",
    appSecret: process.env.WECHAT_APP_SECRET || "",
    mockLoginEnabled: !isProduction && parseBoolean(process.env.WECHAT_MOCK_LOGIN_ENABLED || "true"),
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
