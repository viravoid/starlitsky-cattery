#!/usr/bin/env node

import { LightCosReadProbeError, runLightCosReadProbe } from "../services/lightcos-read-probe.mjs";

const options = parseArgs(process.argv.slice(2));

try {
  const result = await runLightCosReadProbe({
    bucket: required(options.sourceBucket, "--source-bucket"),
    prefix: required(options.prefix, "--prefix"),
    expectedFirstKey: required(options.expectedFirstKey, "--expected-first-key"),
    expectedSecondKey: required(options.expectedSecondKey, "--expected-second-key"),
    objectKey: required(options.objectKey, "--object-key"),
    confirmedEndpoint: required(options.confirmEndpoint, "--confirm-endpoint"),
    confirmReadOnlyProbe: options.confirmReadOnlyProbe,
    maxDownloadBytes: options.maxDownloadBytes,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof LightCosReadProbeError && error.report) {
    console.error(JSON.stringify(error.report, null, 2));
  }
  process.exitCode = 1;
}

function parseArgs(args) {
  const parsed = {
    confirmEndpoint: "",
    confirmReadOnlyProbe: false,
    expectedFirstKey: "",
    expectedSecondKey: "",
    maxDownloadBytes: 256 * 1024,
    objectKey: "",
    prefix: "",
    sourceBucket: "",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--confirm-read-only-probe") {
      parsed.confirmReadOnlyProbe = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new LightCosReadProbeError(`Unsupported argument: ${arg}`);
    const [name, inlineValue] = arg.split("=", 2);
    const value = inlineValue ?? args[++index] ?? "";
    const field = {
      "--confirm-endpoint": "confirmEndpoint",
      "--expected-first-key": "expectedFirstKey",
      "--expected-second-key": "expectedSecondKey",
      "--max-download-bytes": "maxDownloadBytes",
      "--object-key": "objectKey",
      "--prefix": "prefix",
      "--source-bucket": "sourceBucket",
    }[name];
    if (!field) throw new LightCosReadProbeError(`Unsupported argument: ${arg}`);
    parsed[field] = field === "maxDownloadBytes" ? Number(value) : value;
  }
  return parsed;
}

function required(value, flag) {
  if (value == null || value === "") throw new LightCosReadProbeError(`${flag} is required`);
  return value;
}
