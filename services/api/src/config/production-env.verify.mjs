const PLACEHOLDER_PATTERNS = [
  /replace-with/i,
  /\byour[-_]/i,
  /[-_]your\b/i,
  /example\.com/i,
  /changeme/i,
  /placeholder/i,
  /test-secret/i,
  /development-auth-token-secret/i,
];

const DEFAULT_SECRET_VALUES = new Set([
  "development-auth-token-secret",
  "replace-with-local-secret-only",
]);

const STORAGE_PROVIDERS = new Set(["s3", "cos"]);
const STORAGE_READ_PROVIDERS = new Set([...STORAGE_PROVIDERS, "lightcos"]);

const failures = [];
const warnings = [];

const nodeEnv = readEnv("NODE_ENV");
if (nodeEnv !== "production") {
  fail("NODE_ENV must be set to production for this verifier.");
}

requireNonPlaceholder("DATABASE_URL");
validateApiBinding();

const authSecretField = readEnv("AUTH_TOKEN_SECRET") ? "AUTH_TOKEN_SECRET" : "JWT_SECRET";
const authSecret = readEnv(authSecretField);
if (!authSecret) {
  fail("AUTH_TOKEN_SECRET or JWT_SECRET must be set.");
} else {
  validateNonPlaceholder(authSecretField, authSecret);
  if (DEFAULT_SECRET_VALUES.has(authSecret) || authSecret.length < 32) {
    fail(`${authSecretField} must be a non-default production-grade secret.`);
  }
}

requireNonPlaceholder("WECHAT_APP_ID");
requireNonPlaceholder("WECHAT_APP_SECRET");
validateAdminPasswordLogin();

rejectEnabled("WECHAT_MOCK_LOGIN_ENABLED");
rejectEnabled("WECHAT_MOCK_QR_ENABLED");

validateCorsOrigins();
validateStorage();

if (failures.length > 0) {
  console.error("Production environment verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  if (warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }
  process.exit(1);
}

console.log("Production environment verification passed:");
console.log("- runtime, database, auth, WeChat, CORS, and object storage checks passed");
if (warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

function validateCorsOrigins() {
  const rawOrigins = readEnv("CORS_ALLOWED_ORIGINS");
  if (!rawOrigins) {
    fail("CORS_ALLOWED_ORIGINS must include at least one explicit production admin origin.");
    return;
  }

  const origins = rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    fail("CORS_ALLOWED_ORIGINS must include at least one explicit production admin origin.");
    return;
  }

  for (const origin of origins) {
    if (origin === "*") {
      fail("CORS_ALLOWED_ORIGINS must not include wildcard origins.");
      continue;
    }
    validateNonPlaceholder("CORS_ALLOWED_ORIGINS", origin);
    try {
      const parsed = new URL(origin);
      if (!["https:", "http:"].includes(parsed.protocol)) {
        fail(`CORS_ALLOWED_ORIGINS contains a non-HTTP origin: ${origin}`);
      }
      if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
        fail(`CORS_ALLOWED_ORIGINS entries must be origins only, not URLs with paths: ${origin}`);
      }
      if (parsed.protocol !== "https:" && !isLocalhost(parsed.hostname)) {
        fail(`CORS_ALLOWED_ORIGINS must use HTTPS outside localhost: ${origin}`);
      }
    } catch {
      fail(`CORS_ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
  }
}

function validateApiBinding() {
  const apiHost = readEnv("API_HOST");
  if (!apiHost) {
    fail("API_HOST must be set explicitly in production.");
    return;
  }

  if (!isLocalhost(apiHost)) {
    fail("API_HOST must bind to localhost in production; expose the API through Nginx only.");
  }

  const apiPortName = readEnv("API_PORT") ? "API_PORT" : readEnv("PORT") ? "PORT" : "";
  if (apiPortName) {
    readPositiveInteger(apiPortName);
  }
}

function validateStorage() {
  const provider = readEnv("STORAGE_PROVIDER") || "s3";
  validateNonPlaceholder("STORAGE_PROVIDER", provider);

  if (!STORAGE_PROVIDERS.has(provider)) {
    fail(`STORAGE_PROVIDER must be one of: ${Array.from(STORAGE_PROVIDERS).join(", ")}.`);
    return;
  }

  requireNonPlaceholder("STORAGE_BUCKET");
  requireNonPlaceholder("STORAGE_REGION");
  requireNonPlaceholder("STORAGE_ACCESS_KEY_ID");
  requireNonPlaceholder("STORAGE_ACCESS_KEY_SECRET");

  const endpoint = readEnv("STORAGE_ENDPOINT");
  const publicBaseUrl = readEnv("STORAGE_PUBLIC_BASE_URL");

  if (endpoint) {
    validateHttpUrl("STORAGE_ENDPOINT", endpoint);
  } else {
    warnings.push(
      `STORAGE_ENDPOINT is not set; the API will derive the ${provider} endpoint from bucket and region.`,
    );
  }

  if (publicBaseUrl) {
    validateHttpUrl("STORAGE_PUBLIC_BASE_URL", publicBaseUrl);
  } else {
    warnings.push(
      "STORAGE_PUBLIC_BASE_URL is not set; uploaded managed media will keep a stable storage endpoint URL in the database, while API responses generate short-lived read URLs from object metadata.",
    );
  }

  const uploadExpires = readPositiveInteger("STORAGE_UPLOAD_EXPIRES_SECONDS");
  if (uploadExpires !== undefined && uploadExpires > 3600) {
    fail("STORAGE_UPLOAD_EXPIRES_SECONDS must be no more than 3600.");
  }
  const readExpires = readPositiveInteger("STORAGE_READ_EXPIRES_SECONDS");
  if (readExpires !== undefined && readExpires > 3600) {
    fail("STORAGE_READ_EXPIRES_SECONDS must be no more than 3600.");
  }

  readPositiveInteger("STORAGE_MAX_IMAGE_BYTES");
  validateStorageReadBuckets();
}

function validateStorageReadBuckets() {
  const raw = readEnv("STORAGE_READ_BUCKETS_JSON");
  const legacyBucket = readEnv("STORAGE_LEGACY_BUCKET");
  if (!raw) {
    if (legacyBucket && legacyBucket !== readEnv("STORAGE_BUCKET")) {
      fail("STORAGE_LEGACY_BUCKET must be present in STORAGE_READ_BUCKETS_JSON.");
    }
    return;
  }

  let entries;
  try {
    entries = JSON.parse(raw);
  } catch {
    fail("STORAGE_READ_BUCKETS_JSON must be valid JSON.");
    return;
  }
  if (!Array.isArray(entries)) {
    fail("STORAGE_READ_BUCKETS_JSON must be a JSON array.");
    return;
  }

  const buckets = new Set([readEnv("STORAGE_BUCKET")]);
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`STORAGE_READ_BUCKETS_JSON[${index}] must be an object.`);
      continue;
    }
    if ("accessKeyId" in entry || "accessKeySecret" in entry) {
      fail(`STORAGE_READ_BUCKETS_JSON[${index}] must not contain credentials.`);
    }
    const bucket = typeof entry.bucket === "string" ? entry.bucket.trim() : "";
    if (!bucket) {
      fail(`STORAGE_READ_BUCKETS_JSON[${index}].bucket is required.`);
      continue;
    }
    if (buckets.has(bucket)) fail(`Duplicate storage bucket in read allowlist: ${bucket}.`);
    buckets.add(bucket);
    if (entry.region != null && typeof entry.region !== "string") {
      fail(`STORAGE_READ_BUCKETS_JSON[${index}].region must be a string.`);
    }
    const readProvider =
      typeof entry.provider === "string"
        ? entry.provider.trim()
        : readEnv("STORAGE_PROVIDER") || "s3";
    if (!STORAGE_READ_PROVIDERS.has(readProvider)) {
      fail(
        `STORAGE_READ_BUCKETS_JSON[${index}].provider must be one of: ${Array.from(STORAGE_READ_PROVIDERS).join(", ")}.`,
      );
    }
    if (entry.endpoint)
      validateHttpUrl(`STORAGE_READ_BUCKETS_JSON[${index}].endpoint`, entry.endpoint);
    if (entry.publicBaseUrl) {
      validateHttpUrl(`STORAGE_READ_BUCKETS_JSON[${index}].publicBaseUrl`, entry.publicBaseUrl);
    }
    if (readProvider === "lightcos" && !entry.publicBaseUrl) {
      fail(
        `STORAGE_READ_BUCKETS_JSON[${index}].publicBaseUrl is required for LightCOS so stored legacy-domain references are not inferred from the API endpoint.`,
      );
    }
    if (readProvider === "lightcos" && !/^[a-z0-9][a-z0-9-]*-\d+$/.test(bucket)) {
      fail(
        `STORAGE_READ_BUCKETS_JSON[${index}].bucket must include the numeric APPID suffix for LightCOS.`,
      );
    }
    if (readProvider === "lightcos" && entry.forcePathStyle === true) {
      fail(
        `STORAGE_READ_BUCKETS_JSON[${index}].forcePathStyle must be false for LightCOS virtual-hosted requests.`,
      );
    }
  }
  if (legacyBucket && !buckets.has(legacyBucket)) {
    fail("STORAGE_LEGACY_BUCKET must be present in STORAGE_READ_BUCKETS_JSON.");
  }
}

function validateAdminPasswordLogin() {
  requireNonPlaceholder("ADMIN_USERNAME");

  const passwordHash = requireNonPlaceholder("ADMIN_PASSWORD_HASH");
  if (
    passwordHash &&
    !/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/.test(passwordHash)
  ) {
    fail("ADMIN_PASSWORD_HASH must use the scrypt$N$r$p$salt$key format.");
  }

  if (readEnv("ADMIN_INITIAL_PASSWORD")) {
    fail(
      "ADMIN_INITIAL_PASSWORD must not be set; production Admin login accepts password hashes only.",
    );
  }

  readPositiveInteger("ADMIN_LOGIN_RATE_LIMIT_WINDOW_MS");
  readPositiveInteger("ADMIN_LOGIN_RATE_LIMIT_MAX");
  readPositiveInteger("ADMIN_LOGIN_RATE_LIMIT_MAX_BUCKETS");
}

function requireNonPlaceholder(name) {
  const value = readEnv(name);
  if (!value) {
    fail(`${name} must be set.`);
    return "";
  }
  validateNonPlaceholder(name, value);
  return value;
}

function validateNonPlaceholder(name, value) {
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
    fail(`${name} must not use a placeholder value.`);
  }
}

function validateHttpUrl(name, value) {
  validateNonPlaceholder(name, value);
  try {
    const parsed = new URL(value);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      fail(`${name} must be an HTTP(S) URL.`);
    }
    if (parsed.protocol !== "https:" && !isLocalhost(parsed.hostname)) {
      fail(`${name} must use HTTPS outside localhost.`);
    }
  } catch {
    fail(`${name} must be a valid URL.`);
  }
}

function rejectEnabled(name) {
  const value = readEnv(name);
  if (["true", "1", "yes", "on"].includes(value.toLowerCase())) {
    fail(`${name} must not be enabled in production.`);
  }
}

function readPositiveInteger(name) {
  const value = readEnv(name);
  if (!value) return undefined;
  validateNonPlaceholder(name, value);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail(`${name} must be a positive integer.`);
    return undefined;
  }
  return parsed;
}

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function fail(message) {
  failures.push(message);
}

function isLocalhost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
