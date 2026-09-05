#!/usr/bin/env node

import { prisma } from "../db/prisma.mjs";
import {
  PublicContentImportError,
  assertPublicContentImporterRuntime,
  runPublicContentImport,
} from "../services/public-content-importer.mjs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const confirmProduction = args.has("--confirm-production");
const json = args.has("--json");

try {
  assertPublicContentImporterRuntime({ confirmProduction });
  const result = await runPublicContentImport({ apply, client: prisma });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHumanPlan(result);
  }
} catch (error) {
  if (json && error instanceof PublicContentImportError) {
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

function printHumanPlan(result) {
  console.log(`Public content import ${result.mode}`);
  console.log(`Manifest: ${result.manifestId} v${result.manifestVersion}`);
  console.log(`Fixed pages: ${summarizeActions(result.fixedPages)}`);
  console.log(`Breeding cats: ${summarizeActions(result.breedingCats)}`);
  console.log(`Skipped sections: ${result.skippedSections.length}`);
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
