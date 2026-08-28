import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL ?? "file:dev.db";

if (!databaseUrl.startsWith("file:")) {
  process.exit(0);
}

const sqlitePath = resolveSqlitePath(databaseUrl.slice("file:".length));

try {
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const database = new DatabaseSync(sqlitePath);
  database.exec("PRAGMA user_version = 1;");
  database.close();
} catch (error) {
  console.error(
    "Failed to initialize the local SQLite development database before running Prisma.",
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function resolveSqlitePath(rawPath) {
  const normalized = rawPath.trim().replace(/^"|"$/g, "");
  if (isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) {
    return normalized;
  }

  const prismaDir = dirname(fileURLToPath(import.meta.url));
  return resolve(prismaDir, normalized);
}
