#!/usr/bin/env node

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { prisma } from "../db/prisma.mjs";
import {
  calculateExternalEvidenceIndexSha256,
  verifyExternalCosCopyEvidence,
} from "../services/cos-migration-external-evidence.mjs";
import {
  applyStorageSwitchPlan,
  buildStorageRollbackPlan,
  buildStorageSwitchPlan,
  calculateStorageSwitchCoverageAcknowledgementSha256,
  calculateStorageSwitchExclusionsSha256,
  calculateSupplementalObjectManifestSha256,
  CosMigrationError,
  createCosMigrationInventory,
  executeCosObjectCopies,
} from "../services/cos-migration-service.mjs";
import {
  assertMigrationWriteRuntime,
  databaseUrlFingerprint,
  verifyMigrationSqliteBackup,
} from "../services/cos-migration-runtime-guard.mjs";

const options = parseArgs(process.argv.slice(2));

try {
  let result;
  if (options.command === "inventory") {
    result = await createCosMigrationInventory({
      client: prisma,
      sourceBucket: required(options.sourceBucket, "--source-bucket"),
      targetBucket: required(options.targetBucket, "--target-bucket"),
      maxObjectBytes: options.maxObjectBytes,
      supplementalManifest: options.supplementalManifest
        ? readJson(options.supplementalManifest)
        : null,
      approvedSupplementalManifestSha256: options.approveSupplementalManifestSha256,
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
  } else if (options.command === "external-evidence-verify") {
    const evidence = readExternalEvidence(
      required(options.externalEvidenceIndex, "--external-evidence-index"),
      required(options.approveExternalEvidenceSha256, "--approve-external-evidence-sha256"),
    );
    const verification = verifyExternalCosCopyEvidence({
      inventory: options.inventory ? readJson(options.inventory) : null,
      index: evidence.index,
      bundles: evidence.bundles,
      approvedIndexSha256: options.approveExternalEvidenceSha256,
    });
    result = {
      status: "verified-external-copy-evidence",
      verifiedObjects: verification.verifiedKeys.length,
      verifiedBytes: verification.provenance.reduce((sum, item) => sum + item.sizeBytes, 0),
      indexSha256: verification.approvedIndexSha256,
      inventoryChecked: Boolean(options.inventory),
    };
  } else if (options.command === "switch-plan") {
    result = buildStorageSwitchPlan({
      inventory: readJson(required(options.inventory, "--inventory")),
      copyReport: options.copyReport ? readJson(options.copyReport) : null,
      externalEvidence: options.externalEvidenceIndex
        ? readExternalEvidence(options.externalEvidenceIndex, options.approveExternalEvidenceSha256)
        : null,
      approvedExternalEvidenceSha256: options.approveExternalEvidenceSha256,
      exclusions: options.exclusions ? readJson(options.exclusions) : null,
      approvedExclusionsSha256: options.approveExclusionsSha256,
      coverageAcknowledgement: options.coverageAcknowledgement
        ? readJson(options.coverageAcknowledgement)
        : null,
      approvedCoverageAcknowledgementSha256: options.approveCoverageAcknowledgementSha256,
    });
  } else if (options.command === "exclusions-hash") {
    result = {
      exclusionsSha256: calculateStorageSwitchExclusionsSha256(
        readJson(required(options.exclusions, "--exclusions")),
      ),
    };
  } else if (options.command === "supplemental-manifest-hash") {
    result = {
      supplementalManifestSha256: calculateSupplementalObjectManifestSha256(
        readJson(required(options.supplementalManifest, "--supplemental-manifest")),
      ),
    };
  } else if (options.command === "coverage-acknowledgement-hash") {
    result = {
      coverageAcknowledgementSha256: calculateStorageSwitchCoverageAcknowledgementSha256(
        readJson(required(options.coverageAcknowledgement, "--coverage-acknowledgement")),
      ),
    };
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
    const backupEvidence = options.apply
      ? await verifyMigrationSqliteBackup({
          backupPath: required(options.backupFile, "--backup-file"),
          databaseUrl: required(process.env.DATABASE_URL, "DATABASE_URL"),
          expectedSha256: required(options.confirmBackupSha256, "--confirm-backup-sha256"),
        })
      : null;
    result = await applyStorageSwitchPlan({
      client: prisma,
      plan,
      apply: options.apply,
      backupEvidence,
      confirmDatabaseWrite: options.confirmDatabaseWrite,
    });
  } else {
    throw new CosMigrationError(
      "Command must be inventory, copy, external-evidence-verify, supplemental-manifest-hash, exclusions-hash, coverage-acknowledgement-hash, switch-plan, rollback-plan, or switch",
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
    approveCoverageAcknowledgementSha256: "",
    approveExclusionsSha256: "",
    approveSupplementalManifestSha256: "",
    backupFile: "",
    confirmBackupSha256: "",
    confirmDatabaseWrite: false,
    confirmDatabaseUrlSha256: "",
    confirmObjectWrite: false,
    confirmProduction: false,
    confirmTargetBucket: "",
    copyReport: "",
    externalEvidenceIndex: "",
    approveExternalEvidenceSha256: "",
    coverageAcknowledgement: "",
    exclusions: "",
    inventory: "",
    maxObjectBytes: 10 * 1024 * 1024,
    output: "",
    plan: "",
    sourceBucket: "",
    switchReport: "",
    supplementalManifest: "",
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
        "--approve-coverage-acknowledgement-sha256": "approveCoverageAcknowledgementSha256",
        "--approve-exclusions-sha256": "approveExclusionsSha256",
        "--approve-supplemental-manifest-sha256": "approveSupplementalManifestSha256",
        "--backup-file": "backupFile",
        "--confirm-backup-sha256": "confirmBackupSha256",
        "--confirm-database-url-sha256": "confirmDatabaseUrlSha256",
        "--confirm-target-bucket": "confirmTargetBucket",
        "--copy-report": "copyReport",
        "--external-evidence-index": "externalEvidenceIndex",
        "--approve-external-evidence-sha256": "approveExternalEvidenceSha256",
        "--coverage-acknowledgement": "coverageAcknowledgement",
        "--inventory": "inventory",
        "--max-object-bytes": "maxObjectBytes",
        "--exclusions": "exclusions",
        "--output": "output",
        "--plan": "plan",
        "--source-bucket": "sourceBucket",
        "--switch-report": "switchReport",
        "--supplemental-manifest": "supplementalManifest",
        "--target-bucket": "targetBucket",
        "--write-environment": "writeEnvironment",
      }[name];
      if (!field) throw new CosMigrationError(`Unsupported argument: ${arg}`);
      parsed[field] = field === "maxObjectBytes" ? Number(value) : value;
    } else {
      throw new CosMigrationError(`Unsupported argument: ${arg}`);
    }
  }
  return parsed;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function readExternalEvidence(indexPath, approvedSha256) {
  const index = readJson(indexPath);
  if (
    !/^[a-f0-9]{64}$/.test(approvedSha256 ?? "") ||
    index.indexSha256 !== approvedSha256 ||
    calculateExternalEvidenceIndexSha256(index) !== approvedSha256
  ) {
    throw new CosMigrationError("External evidence index approval/hash mismatch");
  }
  const base = realpathSync(dirname(resolve(indexPath)));
  const bundles = (index.bundles ?? []).map((bundle) => {
    const artifacts = {};
    for (const name of [
      "sourceReport",
      "sourceEvidenceIndex",
      "copyManifest",
      "copyPlan",
      "copyJournal",
    ]) {
      const pin = bundle.artifacts?.[name];
      if (!pin?.path || !/^[a-f0-9]{64}$/.test(pin.rawSha256 ?? "")) {
        throw new CosMigrationError(
          `External evidence ${bundle.id ?? "bundle"}/${name} lacks a raw SHA-256 pin`,
        );
      }
      const artifactPath = resolve(base, pin.path);
      const localPath = relative(base, artifactPath);
      if (isAbsolute(pin.path) || localPath.startsWith("..") || isAbsolute(localPath)) {
        throw new CosMigrationError(
          `External evidence ${bundle.id}/${name} path escapes its index directory`,
        );
      }
      const realArtifactPath = realpathSync(artifactPath);
      const realLocalPath = relative(base, realArtifactPath);
      if (realLocalPath.startsWith("..") || isAbsolute(realLocalPath)) {
        throw new CosMigrationError(
          `External evidence ${bundle.id}/${name} symlink escapes its index directory`,
        );
      }
      const raw = readFileSync(realArtifactPath);
      if (createHash("sha256").update(raw).digest("hex") !== pin.rawSha256) {
        throw new CosMigrationError(`External evidence ${bundle.id}/${name} raw SHA-256 mismatch`);
      }
      artifacts[name] = JSON.parse(raw.toString("utf8"));
    }
    return artifacts;
  });
  return { index, bundles };
}

function required(value, flag) {
  if (!value) throw new CosMigrationError(`${flag} is required`);
  return value;
}
