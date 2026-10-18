import crypto from "node:crypto";
import { CosMigrationError } from "./cos-migration-service.mjs";

const WRITE_ENVIRONMENTS = new Set(["staging", "production"]);

export function assertMigrationWriteRuntime({
  apply = false,
  confirmProduction = false,
  configuredEnvironment = process.env.COS_MIGRATION_RUNTIME_ENVIRONMENT,
  exactTargetConfirmed = false,
  operation,
  operationConfirmed = false,
  runtimeEnvironment = "",
  nodeEnvironment = process.env.NODE_ENV,
} = {}) {
  if (!apply) return;
  if (!operationConfirmed) {
    throw new CosMigrationError(`${operation} requires its operation-specific confirmation`);
  }
  if (!exactTargetConfirmed) {
    throw new CosMigrationError(`${operation} requires exact target confirmation`);
  }
  if (!WRITE_ENVIRONMENTS.has(configuredEnvironment)) {
    throw new CosMigrationError(
      `${operation} requires COS_MIGRATION_RUNTIME_ENVIRONMENT=staging or production; there is no default`,
    );
  }
  if (!WRITE_ENVIRONMENTS.has(runtimeEnvironment)) {
    throw new CosMigrationError(
      `${operation} requires --write-environment staging or production; there is no default`,
    );
  }
  if (runtimeEnvironment !== configuredEnvironment) {
    throw new CosMigrationError(
      `${operation} --write-environment must match COS_MIGRATION_RUNTIME_ENVIRONMENT`,
    );
  }
  if (nodeEnvironment === "production" && configuredEnvironment !== "production") {
    throw new CosMigrationError(
      `${operation} cannot classify a NODE_ENV=production runtime as staging`,
    );
  }
  if (configuredEnvironment === "production" && !confirmProduction) {
    throw new CosMigrationError(
      `Production ${operation} also requires --confirm-production after separate approval`,
    );
  }
}

export function databaseUrlFingerprint(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") return "";
  return crypto.createHash("sha256").update(databaseUrl).digest("hex");
}
