#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const env = readFileSync(
  fileURLToPath(new URL("../apps/miniapp/config/env.ts", import.meta.url)),
  "utf8",
);
const trial = env.match(/MINIAPP_TRIAL_API_BASE_URL\s*=\s*"([^"]*)"/)?.[1];
assert.ok(trial, "Trial upload blocked: configure an isolated HTTPS API first.");
const url = new URL(trial);
assert.equal(url.protocol, "https:", "Trial API must use HTTPS.");
assert.notEqual(
  url.hostname,
  "api.starlitskycattery.top",
  "Trial must not use the production API.",
);
assert.match(
  env,
  /trial:\s*MINIAPP_TRIAL_API_BASE_URL/,
  "Trial must use the isolated API constant.",
);
assert.ok(
  env.includes(`"${url.hostname}"`),
  "Register the trial request host in MINIAPP_WECHAT_LEGAL_DOMAINS.",
);
console.log(
  "Trial source configuration is ready for external HTTPS, WeChat domain, and data-isolation checks.",
);
