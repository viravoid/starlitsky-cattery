#!/usr/bin/env node

import { prisma } from "../db/prisma.mjs";
import { loadPublicContentManifest } from "../content/public-content-manifest-selector.mjs";
import {
  PublicContentImportError,
  assertPublicContentImporterRuntime,
  runPublicContentImport,
} from "../services/public-content-importer.mjs";

const options = parseArgs(process.argv.slice(2));

try {
  const manifest = await loadPublicContentManifest(options.manifest);
  const runtimeContext = assertPublicContentImporterRuntime({
    confirmProduction: options.confirmProduction,
  });
  const result = await runPublicContentImport({
    apply: options.apply,
    client: prisma,
    manifest,
    runtimeContext,
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanPlan(result);
  }
} catch (error) {
  if (options.json && error instanceof PublicContentImportError) {
    console.error(JSON.stringify({ error: error.message, details: error.details }, null, 2));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    if (error instanceof PublicContentImportError && error.details) {
      console.error(JSON.stringify(error.details, null, 2));
    }
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

function parseArgs(argv) {
  const options = {
    apply: false,
    confirmProduction: false,
    json: false,
    manifest: "legacy",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--confirm-production") {
      options.confirmProduction = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--manifest requires a value: legacy or web-demo");
      }
      options.manifest = value;
      index += 1;
    } else if (arg.startsWith("--manifest=")) {
      options.manifest = arg.slice("--manifest=".length);
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  return options;
}

function printHumanPlan(result) {
  console.log(`Public content import ${result.mode}`);
  console.log(`Manifest: ${result.manifestId} v${result.manifestVersion}`);
  console.log(`Fixed pages: ${summarizeActions(result.fixedPages)}`);
  console.log(`Fixed-page media: ${summarizeActions(result.fixedPageMedia ?? [])}`);
  console.log(`Cat media: ${summarizeActions(result.catMedia ?? [])}`);
  console.log(`Breeding cats: ${summarizeActions(result.breedingCats)}`);
  console.log(`Skipped sections: ${result.skippedSections.length}`);
  if (result.applyResult?.productionBackupPath) {
    console.log(`Production DB backup: ${result.applyResult.productionBackupPath}`);
  }
  if (result.conflicts.length > 0) {
    console.log(`Conflicts: ${result.conflicts.length}`);
  }
}

function summarizeActions(items) {
  const counts = { create: 0, update: 0, noop: 0 };
  for (const item of items) counts[item.action] = (counts[item.action] ?? 0) + 1;
  return Object.entries(counts)
    .map(([action, count]) => `${action}=${count}`)
    .join(", ");
}
