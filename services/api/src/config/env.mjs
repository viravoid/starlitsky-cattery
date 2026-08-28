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
};

function parsePort(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
}
