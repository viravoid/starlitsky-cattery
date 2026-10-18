#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../db/prisma.mjs";
import {
  applyStorageSwitchPlan,
  buildStorageRollbackPlan,
  buildStorageSwitchPlan,
  CosMigrationError,
  createCosMigrationInventory,
  executeCosObjectCopies,
} from "../services/cos-migration-service.mjs";
import {
  assertMigrationWriteRuntime,
  databaseUrlFingerprint,
} from "../services/cos-migration-runtime-guard.mjs";

const options = parseArgs(process.argv.slice(2));

try {
  let result;
  if (options.command === "inventory") {
    result = await createCosMigrationInventory({
      client: prisma,
      sourceBucket: required(options.sourceBucket, "--source-bucket"),
      targetBucket: required(options.targetBucket, "--target-bucket"),
    });
  } else if (options.command === "copy") {
    const inventory = readJson(required(options.inventory, "--inventory"));
    assertMigrationWriteRuntime({
      apply: options.apply,
      confirmProduction: options.confirmProduction,
      exactTargetConfirmed:
        Boolean(options.confirmTargetBucket) &&
        options.confirmTargetBucket === inventory.targetBucket,
      operation: "Object copy",
      operationConfirmed: options.confirmObjectWrite,
      runtimeEnvironment: options.writeEnvironment,
    });
    result = await executeCosObjectCopies({
      inventory,
      apply: options.apply,
      confirmObjectWrite: options.confirmObjectWrite,
    });
  } else if (options.command === "switch-plan") {
    result = buildStorageSwitchPlan({
      inventory: readJson(required(options.inventory, "--inventory")),
      copyReport: readJson(required(options.copyReport, "--copy-report")),
    });
  } else if (options.command === "rollback-plan") {
    result = buildStorageRollbackPlan({
      switchPlan: readJson(required(options.plan, "--plan")),
      switchReport: readJson(required(options.switchReport, "--switch-report")),
    });
  } else if (options.command === "switch") {
    const plan = readJson(required(options.plan, "--plan"));
    const currentDatabaseFingerprint = databaseUrlFingerprint(process.env.DATABASE_URL);
    assertMigrationWriteRuntime({
      apply: options.apply,
      confirmProduction: options.confirmProduction,
      exactTargetConfirmed:
        Boolean(currentDatabaseFingerprint) &&
        Boolean(options.confirmDatabaseUrlSha256) &&
        options.confirmDatabaseUrlSha256 === currentDatabaseFingerprint,
      operation: "Database switch",
      operationConfirmed: options.confirmDatabaseWrite,
      runtimeEnvironment: options.writeEnvironment,
    });
    result = await applyStorageSwitchPlan({
      client: prisma,
      plan,
      apply: options.apply,
      confirmDatabaseWrite: options.confirmDatabaseWrite,
    });
  } else {
    throw new CosMigrationError(
      "Command must be inventory, copy, switch-plan, rollback-plan, or switch",
    );
  }

  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) writeFileSync(resolve(options.output), json, "utf8");
  else process.stdout.write(json);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof CosMigrationError && error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

function parseArgs(args) {
  const parsed = {
    command: args[0] ?? "",
    apply: false,
    confirmDatabaseWrite: false,
    confirmDatabaseUrlSha256: "",
    confirmObjectWrite: false,
    confirmProduction: false,
    confirmTargetBucket: "",
    copyReport: "",
    inventory: "",
    output: "",
    plan: "",
    sourceBucket: "",
    switchReport: "",
    targetBucket: "",
    writeEnvironment: "",
  };
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") parsed.apply = true;
    else if (arg === "--confirm-object-write") parsed.confirmObjectWrite = true;
    else if (arg === "--confirm-database-write") parsed.confirmDatabaseWrite = true;
    else if (arg === "--confirm-production") parsed.confirmProduction = true;
    else if (arg.startsWith("--")) {
      const [name, inlineValue] = arg.split("=", 2);
      const value = inlineValue ?? args[++index] ?? "";
      const field = {
        "--copy-report": "copyReport",
        "--confirm-database-url-sha256": "confirmDatabaseUrlSha256",
        "--confirm-target-bucket": "confirmTargetBucket",
        "--inventory": "inventory",
        "--output": "output",
        "--plan": "plan",
        "--source-bucket": "sourceBucket",
        "--switch-report": "switchReport",
        "--target-bucket": "targetBucket",
        "--write-environment": "writeEnvironment",
      }[name];
      if (!field) throw new CosMigrationError(`Unsupported argument: ${arg}`);
      parsed[field] = value;
    } else {
      throw new CosMigrationError(`Unsupported argument: ${arg}`);
    }
  }
  return parsed;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function required(value, flag) {
  if (!value) throw new CosMigrationError(`${flag} is required`);
  return value;
}
