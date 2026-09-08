#!/usr/bin/env node

import { prisma } from "../db/prisma.mjs";
import {
  EnvironmentMediaBatchImportError,
  assertEnvironmentMediaBatchRuntime,
  runEnvironmentMediaBatchImport,
} from "../services/environment-media-batch-importer.mjs";

const options = parseArgs(process.argv.slice(2));

try {
  const runtimeContext = assertEnvironmentMediaBatchRuntime({
    confirmProduction: options.confirmProduction,
  });
  const result = await runEnvironmentMediaBatchImport({
    apply: options.apply,
    client: prisma,
    runtimeContext,
    sourceDir: options.sourceDir,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanPlan(result);
  }
} catch (error) {
  if (options.json && error instanceof EnvironmentMediaBatchImportError) {
    console.error(JSON.stringify({ error: error.message, details: error.details }, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof EnvironmentMediaBatchImportError && error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

function parseArgs(args) {
  const parsed = {
    apply: false,
    confirmProduction: false,
    json: false,
    sourceDir: "",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") {
      parsed.apply = true;
    } else if (arg === "--confirm-production") {
      parsed.confirmProduction = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--source-dir") {
      parsed.sourceDir = args[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--source-dir=")) {
      parsed.sourceDir = arg.slice("--source-dir=".length);
    } else {
      throw new EnvironmentMediaBatchImportError(`Unsupported argument: ${arg}`);
    }
  }
  return parsed;
}

function printHumanPlan(result) {
  console.log(`Environment media batch ${result.mode}`);
  console.log(`Batch: ${result.sourceBatchId}`);
  console.log(`Source dir: ${result.sourceDir}`);
  for (const item of result.items) {
    console.log(
      [
        `- ${item.sourceItemId}`,
        item.filename,
        item.sha256Short,
        item.slot,
        `sort=${item.sortOrder}`,
        `action=${item.action}`,
        `visibility=${item.plannedBindingVisibility}`,
        `replacement=${item.replacementMembership}`,
      ].join(" | "),
    );
  }
  console.log(
    [
      `objectsToUpload=${result.summary.objectsToUpload}`,
      `assetsToCreate=${result.summary.assetsToCreate}`,
      `assetsToReuse=${result.summary.assetsToReuse}`,
      `bindingsToCreate=${result.summary.bindingsToCreate}`,
      `bindingsToUpdate=${result.summary.bindingsToUpdate}`,
      `bindingsToArchive=${result.summary.bindingsToArchive}`,
      `remoteDeletes=${result.summary.remoteDeletes}`,
    ].join(", "),
  );
  if (result.conflicts.length > 0) {
    console.log(`conflicts=${result.conflicts.length}`);
  }
  if (result.applyResult) {
    console.log(
      [
        `uploaded=${result.applyResult.uploadedCount}`,
        `reused=${result.applyResult.reusedCount}`,
        `createdBindings=${result.applyResult.createdBindingCount}`,
        `remoteDeletes=${result.applyResult.remoteDeletes}`,
      ].join(", "),
    );
  }
}
