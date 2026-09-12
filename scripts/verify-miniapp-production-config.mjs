#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const envPath = join(repoRoot, "apps/miniapp/config/env.ts");
const projectConfigPath = join(repoRoot, "apps/miniapp/project.config.json");
const miniappRoot = join(repoRoot, "apps/miniapp");

const expectedAppId = "wx6d3a94b9d6eadeaa";
const expectedApiBaseUrl = "https://api.starlitskycattery.top";
const expectedCosHost = "starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com";

const envText = readFileSync(envPath, "utf8");
const projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf8"));
const miniappFiles = listTextFiles(miniappRoot);
const miniappTextByPath = new Map(miniappFiles.map((path) => [path, readFileSync(path, "utf8")]));
const combinedMiniappText = [...miniappTextByPath.values()].join("\n");

const apiBaseUrls = extractApiBaseUrls(envText);
assert.equal(apiBaseUrls.develop, expectedApiBaseUrl);
assert.equal(apiBaseUrls.trial, expectedApiBaseUrl);
assert.equal(apiBaseUrls.release, expectedApiBaseUrl);

for (const envVersion of ["develop", "trial", "release"]) {
  const url = new URL(apiBaseUrls[envVersion]);
  assert.equal(url.protocol, "https:", `${envVersion} API base must use HTTPS.`);
  assert.notEqual(url.hostname, "localhost", `${envVersion} API base must not use localhost.`);
  assert.notEqual(url.hostname, "127.0.0.1", `${envVersion} API base must not use loopback.`);
  assert.equal(url.hostname, "api.starlitskycattery.top");
}

assert.match(
  envText,
  /throw new Error\(`Miniapp API base URL is not configured for \$\{envVersion\}`\)/,
  "Unknown or blank env versions must still fail closed.",
);
assert.match(
  envText,
  /MINIAPP_PRODUCTION_API_BASE_URL\s*=\s*"https:\/\/api\.starlitskycattery\.top"/,
);
assert.match(
  envText,
  /MINIAPP_LOCAL_API_BASE_URL_STORAGE_KEY\s*=\s*"starlitsky:miniapp:localApiBaseUrl"/,
);
assert.match(
  envText,
  /getExplicitLocalApiBaseUrl\(envVersion\)/,
  "Develop local API use must require an explicit runtime opt-in.",
);
assert.match(envText, /MINIAPP_PRODUCTION_API_HOST\s*=\s*"api\.starlitskycattery\.top"/);
assert.match(
  envText,
  /MINIAPP_PRODUCTION_COS_HOST\s*=\s*"starlitsky-cattery-1480740947\.cos\.ap-chengdu\.myqcloud\.com"/,
);

assert.equal(projectConfig.appid, expectedAppId, "project.config.json must use the real AppID.");
assert.notEqual(projectConfig.appid, "touristappid", "touristappid must not be committed.");
assert.equal(
  /APP_SECRET|WECHAT_APP_SECRET|appsecret/i.test(JSON.stringify(projectConfig) + envText),
  false,
  "Miniapp config must not contain an AppSecret.",
);

assert.ok(
  combinedMiniappText.includes("wx.request"),
  "Miniapp must still route network requests through auditable wx.request paths.",
);
assert.equal(
  /\bwx\.uploadFile\s*\(/.test(combinedMiniappText),
  false,
  "Current miniapp implementation must not require uploadFile legal domains.",
);
assert.equal(
  /\bwx\.downloadFile\s*\(/.test(combinedMiniappText),
  false,
  "Current miniapp implementation must not directly call wx.downloadFile.",
);
assert.equal(
  /\bwx\.connectSocket\s*\(/.test(combinedMiniappText),
  false,
  "Current miniapp implementation must not require socket legal domains.",
);
assert.ok(
  /\bwx\.request\s*\(\s*\{\s*url,\s*method:\s*"PUT"/s.test(combinedMiniappText),
  "Community image upload must remain visible as wx.request PUT to the presigned COS URL.",
);
assert.ok(
  /<image[\s\S]*src="\{\{/.test(combinedMiniappText),
  "Remote image display paths must remain visible for downloadFile/image-domain audit.",
);

const legalDomains = extractLegalDomainMatrix(envText);
assert.deepEqual(legalDomains.request, ["api.starlitskycattery.top", expectedCosHost]);
assert.deepEqual(legalDomains.uploadFile, []);
assert.deepEqual(legalDomains.downloadFile, [expectedCosHost]);
assert.deepEqual(legalDomains.socket, []);

console.log("Miniapp production config verification passed.");

function extractApiBaseUrls(text) {
  const match = text.match(
    /const API_BASE_URLS:[^{]+{\s*develop:\s*([^,\n]+),\s*trial:\s*([^,\n]+),\s*release:\s*([^,\n]+),\s*}/m,
  );
  assert.ok(match, "API_BASE_URLS block must be explicit.");
  return {
    develop: resolveEnvValue(match[1], text),
    trial: resolveEnvValue(match[2], text),
    release: resolveEnvValue(match[3], text),
  };
}

function resolveEnvValue(valueExpression, text) {
  const trimmed = valueExpression.trim();
  if (trimmed.startsWith('"')) return JSON.parse(trimmed);
  if (trimmed === "MINIAPP_PRODUCTION_API_BASE_URL") {
    const match = text.match(/MINIAPP_PRODUCTION_API_BASE_URL\s*=\s*"([^"]+)"/);
    assert.ok(match, "MINIAPP_PRODUCTION_API_BASE_URL must be a literal.");
    return match[1];
  }
  throw new Error(`Unsupported API base expression: ${trimmed}`);
}

function extractLegalDomainMatrix(text) {
  const request = extractArray("request", text);
  const uploadFile = extractArray("uploadFile", text);
  const downloadFile = extractArray("downloadFile", text);
  const socket = extractArray("socket", text);
  return { request, uploadFile, downloadFile, socket };
}

function extractArray(key, text) {
  const match = text.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`, "m"));
  assert.ok(match, `${key} legal-domain matrix must be explicit.`);
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      if (item.startsWith('"')) return JSON.parse(item);
      if (item === "MINIAPP_PRODUCTION_COS_HOST") return expectedCosHost;
      if (item === "MINIAPP_PRODUCTION_API_HOST") return new URL(expectedApiBaseUrl).hostname;
      throw new Error(`Unsupported legal-domain entry: ${item}`);
    });
}

function listTextFiles(root) {
  const result = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      result.push(...listTextFiles(path));
    } else if (/\.(json|ts|wxml|wxss)$/.test(path)) {
      result.push(path);
    }
  }
  return result;
}
