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
    trustProxy: parseBoolean(process.env.TRUST_PROXY),
    trustedProxyHops: parsePositiveInteger(process.env.TRUST_PROXY_HOPS, 1),
  },
  cors: {
    allowedOrigins: parseOriginList(
      process.env.CORS_ALLOWED_ORIGINS,
      isProduction ? [] : ["http://127.0.0.1:5174", "http://localhost:5174"],
    ),
  },
  auth: {
    tokenSecret:
      process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || "development-auth-token-secret",
    sessionTtlDays: parsePositiveInteger(process.env.AUTH_SESSION_TTL_DAYS, 30),
    revokedSessionCleanupDays: parsePositiveInteger(
      process.env.AUTH_REVOKED_SESSION_CLEANUP_DAYS,
      30,
    ),
    sessionCleanupIntervalMs: parsePositiveInteger(
      process.env.AUTH_SESSION_CLEANUP_INTERVAL_MS,
      60 * 60 * 1000,
    ),
    wechatLoginRateLimit: {
      windowMs: parsePositiveInteger(process.env.WECHAT_LOGIN_RATE_LIMIT_WINDOW_MS, 60 * 1000),
      max: parsePositiveInteger(process.env.WECHAT_LOGIN_RATE_LIMIT_MAX, 20),
      maxBuckets: parsePositiveInteger(process.env.WECHAT_LOGIN_RATE_LIMIT_MAX_BUCKETS, 10_000),
    },
    adminLoginChallengeTtlMs: parsePositiveInteger(
      process.env.ADMIN_LOGIN_CHALLENGE_TTL_MS,
      4 * 60 * 1000,
    ),
    adminLoginChallengeCreateRateLimit: {
      windowMs: parsePositiveInteger(
        process.env.ADMIN_LOGIN_CHALLENGE_CREATE_RATE_LIMIT_WINDOW_MS,
        60 * 1000,
      ),
      max: parsePositiveInteger(process.env.ADMIN_LOGIN_CHALLENGE_CREATE_RATE_LIMIT_MAX, 12),
      maxBuckets: parsePositiveInteger(
        process.env.ADMIN_LOGIN_CHALLENGE_CREATE_RATE_LIMIT_MAX_BUCKETS,
        10_000,
      ),
    },
    adminLoginChallengePollRateLimit: {
      windowMs: parsePositiveInteger(
        process.env.ADMIN_LOGIN_CHALLENGE_POLL_RATE_LIMIT_WINDOW_MS,
        60 * 1000,
      ),
      max: parsePositiveInteger(process.env.ADMIN_LOGIN_CHALLENGE_POLL_RATE_LIMIT_MAX, 45),
      maxBuckets: parsePositiveInteger(
        process.env.ADMIN_LOGIN_CHALLENGE_POLL_RATE_LIMIT_MAX_BUCKETS,
        10_000,
      ),
    },
  },
  wechat: {
    appId: process.env.WECHAT_APP_ID || "",
    appSecret: process.env.WECHAT_APP_SECRET || "",
    mockLoginEnabled:
      !isProduction && parseBoolean(process.env.WECHAT_MOCK_LOGIN_ENABLED || "true"),
    mockQrEnabled: !isProduction && parseBoolean(process.env.WECHAT_MOCK_QR_ENABLED || "true"),
    qrEnvVersion: process.env.WECHAT_MINIAPP_QR_ENV_VERSION || (isProduction ? "release" : "trial"),
    qrCheckPath: parseBoolean(process.env.WECHAT_MINIAPP_QR_CHECK_PATH || "true"),
    upstreamTimeoutMs: parsePositiveInteger(process.env.WECHAT_UPSTREAM_TIMEOUT_MS, 5000),
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

function parseOriginList(value, fallback = []) {
  const raw = typeof value === "string" ? value : "";
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== "*");
  return origins.length > 0 ? origins : fallback;
}
