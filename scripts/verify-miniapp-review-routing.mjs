#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const envSource = readFileSync(join(root, "apps/miniapp/config/env.ts"), "utf8");
const requestSource = readFileSync(join(root, "apps/miniapp/utils/request/index.ts"), "utf8");
const publicSource = readFileSync(join(root, "apps/miniapp/utils/public-content/index.ts"), "utf8");
const modeSource = readFileSync(join(root, "apps/miniapp/utils/visual-qa/mode.ts"), "utf8");

function load(source, wx, dependencies = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  runInNewContext(output, {
    exports,
    wx,
    require: (id) => {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

for (const { version, platform, expectedBase, local, deviceThrows = false } of [
  { version: "develop", platform: "devtools", expectedBase: "http://127.0.0.1:4310", local: true },
  {
    version: "develop",
    platform: "android",
    expectedBase: "https://api.starlitskycattery.top",
    local: false,
  },
  {
    version: "develop",
    platform: "ios",
    expectedBase: "https://api.starlitskycattery.top",
    local: false,
  },
  {
    version: "develop",
    platform: "android",
    expectedBase: "https://api.starlitskycattery.top",
    local: false,
    deviceThrows: true,
  },
  {
    version: "trial",
    platform: "android",
    expectedBase: "https://trial-api.starlitskycattery.top",
    local: false,
  },
  {
    version: "release",
    platform: "android",
    expectedBase: "https://api.starlitskycattery.top",
    local: false,
  },
]) {
  const wx = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: version } }),
    getDeviceInfo: () => {
      if (deviceThrows) throw new Error("unavailable");
      return { platform };
    },
    getSystemInfoSync: () => ({ platform }),
    request: (options) => {
      request = options;
      options.success({ statusCode: 200, data: { success: true, data: { slug: "home" } } });
    },
  };
  const env = load(envSource, wx);
  assert.equal(env.getApiBaseUrl(), expectedBase, `${version}/${platform} API base`);
  assert.equal(env.isLocalMiniProgramDevelopment(), local, `${version}/${platform} local mode`);

  let request;
  const requestClient = load(requestSource, wx, {
    "../../config/env": env,
    "../session/token-storage": { getToken: () => "", clearToken: () => {} },
  });
  const publicContent = load(publicSource, wx, {
    "../request/index": requestClient,
    "../../config/env": env,
    "./adapter": { getPublicContentAdapter: () => null },
  });
  await publicContent.getFixedPage("home");
  assert.equal(request.url, `${expectedBase}/fixed-pages/home`);
  assert.equal(request.method, "GET");
  assert.equal(request.header["content-type"], "application/json");
  assert.equal(request.header["x-local-public-preview"], local ? "1" : undefined);

  const mode = load(modeSource, wx, { "../../config/env": env });
  mode.configureVisualQaMode({ visualQa: "1" });
  assert.equal(mode.isVisualQaModeEnabled(), local, `${version}/${platform} fixture guard`);
}

console.log("Miniapp review routing verification passed.");
