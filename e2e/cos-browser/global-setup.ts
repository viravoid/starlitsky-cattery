import type { FullConfig } from "@playwright/test";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash, scryptSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { createServer as createNetServer } from "node:net";
import { fileURLToPath } from "node:url";
import {
  ADMIN_ORIGIN,
  API_ORIGIN,
  COS_ORIGIN,
  E2E_ADMIN_PASSWORD,
  E2E_ADMIN_USERNAME,
  E2E_CAT_ID,
  E2E_LEGACY_BUCKET,
  E2E_LEGACY_MEDIA_ID,
  E2E_LEGACY_OBJECT_KEY,
  E2E_NEW_BUCKET,
  TEST_PNG,
} from "./constants";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default async function globalSetup(_config: FullConfig) {
  const isolatedRoot = mkdtempSync(join(tmpdir(), "starlitsky-cos-browser-e2e-"));
  const runId = isolatedRunId(isolatedRoot);
  const databasePath = resolve(root, "services/api/prisma", `cos-browser-e2e-${runId}.db`);
  const databaseUrl = `file:${databasePath.split(/[\\/]/).at(-1)}`;
  const children: Array<{ child: ChildProcess; label: string; output: string[] }> = [];
  const sharedEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
  };

  try {
    await Promise.all([assertPortAvailable(5174), assertPortAvailable(4310), assertPortAvailable(9320)]);
    execFileSync(
      process.execPath,
      [
        resolve(root, "services/api/node_modules/prisma/build/index.js"),
        "generate",
        "--schema",
        "services/api/prisma/schema.prisma",
      ],
      { cwd: root, env: sharedEnv, stdio: "pipe" },
    );
    applySqliteMigrations(databasePath);
    await seedIsolatedDatabase(databaseUrl);

    children.push(
      startNode("COS fixture", "e2e/cos-browser/mock-cos-server.mjs", [], {
        ...sharedEnv,
        COS_E2E_ADMIN_ORIGIN: ADMIN_ORIGIN,
        COS_E2E_BUCKETS: `${E2E_NEW_BUCKET},${E2E_LEGACY_BUCKET}`,
        COS_E2E_PORT: "9320",
      }),
    );
    await waitForUrl(`${COS_ORIGIN}/_test/health`, children);
    await seedLegacyObject();

    const storageReadBuckets = JSON.stringify([
      {
        bucket: E2E_LEGACY_BUCKET,
        provider: "cos",
        region: "ap-test",
        endpoint: COS_ORIGIN,
        publicBaseUrl: COS_ORIGIN,
        forcePathStyle: true,
      },
    ]);
    children.push(
      startNode("API", "services/api/src/server.mjs", [], {
        ...sharedEnv,
        NODE_ENV: "development",
        API_HOST: "127.0.0.1",
        API_PORT: "4310",
        AUTH_TOKEN_SECRET: "local-cos-e2e-auth-token-secret-32-characters",
        ADMIN_USERNAME: E2E_ADMIN_USERNAME,
        ADMIN_PASSWORD_HASH: createPasswordHash(E2E_ADMIN_PASSWORD),
        CORS_ALLOWED_ORIGINS: ADMIN_ORIGIN,
        STORAGE_PROVIDER: "cos",
        STORAGE_BUCKET: E2E_NEW_BUCKET,
        STORAGE_REGION: "ap-test",
        STORAGE_ENDPOINT: COS_ORIGIN,
        STORAGE_PUBLIC_BASE_URL: COS_ORIGIN,
        STORAGE_ACCESS_KEY_ID: "local-cos-e2e-access-key",
        STORAGE_ACCESS_KEY_SECRET: "local-cos-e2e-secret-key",
        STORAGE_KEY_PREFIX: `cos-e2e/${runId}`,
        STORAGE_FORCE_PATH_STYLE: "true",
        STORAGE_UPLOAD_EXPIRES_SECONDS: "60",
        STORAGE_READ_EXPIRES_SECONDS: "60",
        STORAGE_MAX_IMAGE_BYTES: "1048576",
        STORAGE_LEGACY_BUCKET: E2E_LEGACY_BUCKET,
        STORAGE_READ_BUCKETS_JSON: storageReadBuckets,
      }),
    );
    await waitForUrl(`${API_ORIGIN}/health`, children);

    const viteCli = resolve(root, "node_modules/vite/bin/vite.js");
    children.push(
      startProcess(
        "Admin",
        process.execPath,
        [viteCli, "--config", "apps/admin/vite.config.ts", "--host", "127.0.0.1", "--port", "5174"],
        {
          ...sharedEnv,
          VITE_API_BASE_URL: API_ORIGIN,
          VITE_MEDIA_UPLOAD_TIMEOUT_MS: "800",
        },
      ),
    );
    await waitForUrl(ADMIN_ORIGIN, children);
  } catch (error) {
    await stopChildren(children);
    removeIsolatedDatabase(databasePath);
    removeIsolatedRoot(isolatedRoot);
    throw error;
  }

  return async () => {
    await stopChildren(children);
    removeIsolatedDatabase(databasePath);
    removeIsolatedRoot(isolatedRoot);
  };
}

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolveAvailable, rejectAvailable) => {
    const probe = createNetServer();
    probe.once("error", (error) => rejectAvailable(new Error(`Port ${port} is not available`, { cause: error })));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolveAvailable()));
  });
}

function applySqliteMigrations(databasePath: string) {
  const database = new DatabaseSync(databasePath);
  try {
    const migrationsDirectory = resolve(root, "services/api/prisma/migrations");
    for (const folder of readdirSync(migrationsDirectory).sort()) {
      const migrationPath = resolve(migrationsDirectory, folder, "migration.sql");
      if (!existsSync(migrationPath)) continue;
      database.exec(readFileSync(migrationPath, "utf8"));
    }
  } finally {
    database.close();
  }
}

async function seedIsolatedDatabase(databaseUrl: string) {
  process.env.DATABASE_URL = databaseUrl;
  const requireFromApi = createRequire(resolve(root, "services/api/package.json"));
  const { PrismaClient } = requireFromApi("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.cat.create({
      data: {
        id: E2E_CAT_ID,
        name: "COS E2E 隔离测试猫",
        lifecycle_status: "growing",
        visibility: "visible",
      },
    });
    await prisma.mediaAsset.create({
      data: {
        id: E2E_LEGACY_MEDIA_ID,
        kind: "image",
        source_url: `${COS_ORIGIN}/${E2E_LEGACY_BUCKET}/${E2E_LEGACY_OBJECT_KEY}`,
        title: "COS E2E legacy private image",
        alt_text: "isolated legacy private image",
        mime_type: "image/png",
        size_bytes: TEST_PNG.length,
        width: 1,
        height: 1,
        status: "active",
        metadata_json: {
          upload: {
            provider: "cos",
            bucket: E2E_LEGACY_BUCKET,
            objectKey: E2E_LEGACY_OBJECT_KEY,
            verifiedAt: new Date().toISOString(),
          },
        },
        bindings: {
          create: {
            owner_type: "cat",
            owner_id: E2E_CAT_ID,
            usage: "gallery",
            sort_order: 0,
            visibility: "visible",
          },
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function seedLegacyObject() {
  const response = await fetch(
    `${COS_ORIGIN}/${E2E_LEGACY_BUCKET}/${E2E_LEGACY_OBJECT_KEY}?X-Amz-Signature=local-seed`,
    { method: "PUT", headers: { "content-type": "image/png" }, body: TEST_PNG },
  );
  if (!response.ok)
    throw new Error(`Could not seed isolated legacy object: HTTP ${response.status}`);
  await fetch(`${COS_ORIGIN}/_test/events`, { method: "DELETE" });
}

function createPasswordHash(password: string) {
  const N = 16_384;
  const r = 8;
  const p = 1;
  const salt = createHash("sha256").update("starlitsky-local-cos-e2e").digest().subarray(0, 16);
  const key = scryptSync(password, salt, 32, { N, r, p });
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

function isolatedRunId(path: string) {
  return createHash("sha256").update(path).digest("hex").slice(0, 12);
}

function startNode(label: string, relativeScript: string, args: string[], env: NodeJS.ProcessEnv) {
  return startProcess(label, process.execPath, [resolve(root, relativeScript), ...args], env);
}

function startProcess(label: string, command: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  const output: string[] = [];
  child.stdout?.on("data", (chunk) => output.push(String(chunk)));
  child.stderr?.on("data", (chunk) => output.push(String(chunk)));
  return { child, label, output };
}

async function waitForUrl(
  url: string,
  children: Array<{ child: ChildProcess; label: string; output: string[] }>,
) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The isolated process may still be starting.
    }
    const exited = children.find(({ child }) => child.exitCode != null);
    if (exited) {
      throw new Error(`${exited.label} exited early:\n${exited.output.join("")}`);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${url}\n${formatChildOutput(children)}`);
}

async function stopChildren(children: Array<{ child: ChildProcess }>) {
  await Promise.all(
    [...children].reverse().map(
      ({ child }) =>
        new Promise<void>((resolveStop) => {
          if (child.exitCode != null) return resolveStop();
          const timer = setTimeout(() => {
            child.kill("SIGKILL");
            resolveStop();
          }, 2_000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolveStop();
          });
          child.kill("SIGTERM");
        }),
    ),
  );
}

function removeIsolatedRoot(path: string) {
  const resolved = resolve(path);
  const expectedPrefix = resolve(tmpdir(), "starlitsky-cos-browser-e2e-");
  if (!resolved.startsWith(expectedPrefix)) {
    throw new Error(`Refusing to remove unexpected E2E path: ${resolved}`);
  }
  rmSync(resolved, { force: true, recursive: true });
}

function removeIsolatedDatabase(path: string) {
  const resolved = resolve(path);
  const databaseDirectory = resolve(root, "services/api/prisma");
  if (
    dirname(resolved) !== databaseDirectory ||
    !resolved.split(/[\\/]/).at(-1)?.startsWith("cos-browser-e2e-")
  ) {
    throw new Error(`Refusing to remove unexpected E2E database path: ${resolved}`);
  }
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${resolved}${suffix}`, { force: true });
  }
}

function formatChildOutput(children: Array<{ label: string; output: string[] }>) {
  return children.map(({ label, output }) => `${label}:\n${output.join("")}`).join("\n");
}
