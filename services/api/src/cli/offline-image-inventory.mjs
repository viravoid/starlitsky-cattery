#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOfflineImageInventory,
  OfflineImageInventoryError,
  summarizeOfflineImageInventory,
} from "../services/offline-image-inventory.mjs";

const options = parseArgs(process.argv.slice(2));

try {
  const report = createOfflineImageInventory({
    databasePath: resolveUserPath(required(options.database, "--database")),
    legacySourceMap: readJson(required(options.legacySourceMap, "--legacy-source-map")),
    supplementalManifest: options.supplementalManifest
      ? readJson(options.supplementalManifest)
      : null,
    approvedSupplementalManifestSha256: options.approveSupplementalManifestSha256,
    repositoryRoot: options.repositoryRoot
      ? resolveUserPath(options.repositoryRoot)
      : defaultRepositoryRoot(),
  });
  if (options.output) {
    const outputPath = resolveUserPath(options.output);
    if (outputPath === resolveUserPath(options.database)) {
      throw new OfflineImageInventoryError("--output must not overwrite the input database");
    }
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  }
  process.stdout.write(`${JSON.stringify(summarizeOfflineImageInventory(report), null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof OfflineImageInventoryError && error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
}

function parseArgs(args) {
  const parsed = {
    approveSupplementalManifestSha256: "",
    database: "",
    legacySourceMap: "",
    output: "",
    repositoryRoot: "",
    supplementalManifest: "",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new OfflineImageInventoryError(`Unsupported argument: ${arg}`);
    }
    const [name, inlineValue] = arg.split("=", 2);
    const field = {
      "--approve-supplemental-manifest-sha256": "approveSupplementalManifestSha256",
      "--database": "database",
      "--legacy-source-map": "legacySourceMap",
      "--output": "output",
      "--repository-root": "repositoryRoot",
      "--supplemental-manifest": "supplementalManifest",
    }[name];
    if (!field) throw new OfflineImageInventoryError(`Unsupported argument: ${arg}`);
    const value = inlineValue ?? args[++index] ?? "";
    if (!value) throw new OfflineImageInventoryError(`${name} requires a value`);
    parsed[field] = value;
  }
  return parsed;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolveUserPath(path), "utf8"));
  } catch (error) {
    throw new OfflineImageInventoryError(
      `Failed to read JSON input ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function required(value, flag) {
  if (!value) throw new OfflineImageInventoryError(`${flag} is required`);
  return value;
}

function defaultRepositoryRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function resolveUserPath(path) {
  return resolve(process.env.INIT_CWD || process.cwd(), path);
}
