import crypto from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CosMigrationError } from "./cos-migration-service.mjs";

const WRITE_ENVIRONMENTS = new Set(["staging", "production"]);
const REQUIRED_MIGRATION_BACKUP_TABLES = new Set(["_prisma_migrations", "MediaAsset", "User"]);

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

export async function verifyMigrationSqliteBackup({
  backupPath,
  databaseUrl,
  expectedSha256,
} = {}) {
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("file:")) {
    throw new CosMigrationError(
      "Migration backup verification currently requires a SQLite file URL",
    );
  }
  if (typeof backupPath !== "string" || backupPath.trim() === "" || !existsSync(backupPath)) {
    throw new CosMigrationError("Migration backup file does not exist");
  }
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256 ?? "")) {
    throw new CosMigrationError("Migration backup requires an exact SHA-256 confirmation");
  }
  const resolvedBackupPath = realpathSync(backupPath);
  const livePath = resolveSqliteDatabasePath(databaseUrl);
  if (existsSync(livePath) && realpathSync(livePath) === resolvedBackupPath) {
    throw new CosMigrationError("Migration backup must be a separate file from the live database");
  }
  const sizeBytes = statSync(resolvedBackupPath).size;
  if (sizeBytes <= 0) throw new CosMigrationError("Migration backup file is empty");
  const actualSha256 = crypto
    .createHash("sha256")
    .update(readFileSync(resolvedBackupPath))
    .digest("hex");
  if (actualSha256 !== expectedSha256.toLowerCase()) {
    throw new CosMigrationError("Migration backup SHA-256 does not match the approved value", {
      actualSha256,
    });
  }
  const { DatabaseSync } = await import("node:sqlite");
  let database;
  try {
    database = new DatabaseSync(resolvedBackupPath, { readOnly: true });
    const integrity = database.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") {
      throw new CosMigrationError("Migration backup failed SQLite integrity_check", { integrity });
    }
    const foreignKeyFailures = database.prepare("PRAGMA foreign_key_check").all();
    if (foreignKeyFailures.length > 0) {
      throw new CosMigrationError("Migration backup failed SQLite foreign_key_check", {
        failures: foreignKeyFailures,
      });
    }
    const tableNames = new Set(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name),
    );
    const missingTables = [...REQUIRED_MIGRATION_BACKUP_TABLES].filter(
      (tableName) => !tableNames.has(tableName),
    );
    if (missingTables.length > 0) {
      throw new CosMigrationError("Migration backup is missing required application tables", {
        missingTables,
      });
    }
  } catch (error) {
    if (error instanceof CosMigrationError) throw error;
    throw new CosMigrationError("Migration backup is not a readable SQLite database", {
      cause: error instanceof Error ? error.message : String(error),
    });
  } finally {
    database?.close();
  }
  return {
    status: "verified",
    backupPath: resolvedBackupPath,
    backupSha256: actualSha256,
    databaseUrlSha256: databaseUrlFingerprint(databaseUrl),
    requiredTables: [...REQUIRED_MIGRATION_BACKUP_TABLES].sort(),
    sizeBytes,
  };
}

function resolveSqliteDatabasePath(databaseUrl) {
  const raw = databaseUrl.slice("file:".length).replace(/^"|"$/g, "");
  if (isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw)) return resolve(raw);
  return resolve(fileURLToPath(new URL("../../prisma/", import.meta.url)), raw);
}
