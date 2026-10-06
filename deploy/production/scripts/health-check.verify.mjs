import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = resolve("deploy/production/scripts/health-check.sh");

export function runHealthCheckBehaviorVerification() {
  const bash = findUsableBash();
  const cases = [
    {
      name: "immediate success works",
      scenario: "immediate-success",
      expectStatus: 0,
      expectAttempts: 1,
    },
    {
      name: "initial connection failures followed by success work",
      scenario: "fail-then-success",
      expectStatus: 0,
      expectAttempts: 3,
    },
    {
      name: "non-ok health body keeps retrying",
      scenario: "non-ok-then-success",
      expectStatus: 0,
      expectAttempts: 3,
    },
    {
      name: "permanent failure exits non-zero after bounded attempts",
      scenario: "permanent-failure",
      expectStatus: 1,
      expectAttemptsAtLeast: 1,
      expectAttemptsAtMost: 3,
      maxWaitSeconds: "2",
    },
  ];

  for (const testCase of cases) {
    runCase(bash, testCase);
  }

  console.log("Health check behavior verification passed.");
}

function runCase(bash, testCase) {
  const tempRoot = mkdtempSync(join(tmpdir(), "starlitsky-health-check-"));
  const curlPath = join(tempRoot, process.platform === "win32" ? "curl" : "curl");
  const counterPath = join(tempRoot, "counter.txt");

  writeFileSync(counterPath, "0");
  writeFileSync(curlPath, fakeCurlScript, { mode: 0o755 });

  try {
    const result = spawnSync(bash, [scriptPath], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${tempRoot}${delimiter}${process.env.PATH ?? ""}`,
        HEALTH_CHECK_FAKE_COUNTER: counterPath,
        HEALTH_CHECK_FAKE_SCENARIO: testCase.scenario,
        CURL_BIN: toBashPath(curlPath),
        API_HEALTH_URL: "http://127.0.0.1:65535/health",
        API_HEALTH_MAX_WAIT_SECONDS: testCase.maxWaitSeconds ?? "5",
        API_HEALTH_RETRY_INTERVAL_SECONDS: "1",
      },
    });

    const attempts = Number(readFileSync(counterPath, "utf8").trim());
    const expectedStatus = testCase.expectStatus;
    const actualStatus = result.status ?? 1;
    if (expectedStatus === 0 && actualStatus !== 0) {
      failCase(testCase, result, `expected success but exited ${actualStatus}`);
    }
    if (expectedStatus !== 0 && actualStatus === 0) {
      failCase(testCase, result, "expected non-zero exit but succeeded");
    }
    if (testCase.expectAttempts !== undefined && attempts !== testCase.expectAttempts) {
      failCase(testCase, result, `expected ${testCase.expectAttempts} attempt(s), got ${attempts}`);
    }
    if (
      testCase.expectAttemptsAtLeast !== undefined &&
      attempts < testCase.expectAttemptsAtLeast
    ) {
      failCase(
        testCase,
        result,
        `expected at least ${testCase.expectAttemptsAtLeast} attempt(s), got ${attempts}`,
      );
    }
    if (testCase.expectAttemptsAtMost !== undefined && attempts > testCase.expectAttemptsAtMost) {
      failCase(
        testCase,
        result,
        `expected at most ${testCase.expectAttemptsAtMost} attempt(s), got ${attempts}`,
      );
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function failCase(testCase, result, message) {
  throw new Error(
    [
      `Health check verifier failed: ${testCase.name}`,
      message,
      `stdout: ${result.stdout?.trim() ?? ""}`,
      `stderr: ${result.stderr?.trim() ?? ""}`,
    ].join("\n"),
  );
}

function findUsableBash() {
  const candidates = [
    process.env.BASH,
    "C:/Users/Administrator/AppData/Local/hermes/git/bin/bash.exe",
    "C:/Program Files/Git/bin/bash.exe",
    "bash",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }

  throw new Error("A usable bash executable is required for health-check verification.");
}

function toBashPath(path) {
  if (process.platform !== "win32") return path;
  return path.replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`).replaceAll("\\", "/");
}

const fakeCurlScript = `#!/usr/bin/env bash
set -euo pipefail

counter_file="\${HEALTH_CHECK_FAKE_COUNTER:?}"
scenario="\${HEALTH_CHECK_FAKE_SCENARIO:?}"
count="$(cat "$counter_file")"
count="$((count + 1))"
printf '%s' "$count" > "$counter_file"

case "$scenario" in
  immediate-success)
    echo '{"status":"ok"}'
    exit 0
    ;;
  fail-then-success)
    if (( count < 3 )); then
      echo 'simulated connection failure' >&2
      exit 7
    fi
    echo '{"status":"ok"}'
    exit 0
    ;;
  non-ok-then-success)
    if (( count < 3 )); then
      echo '{"status":"starting"}'
      exit 0
    fi
    echo '{"status":"ok"}'
    exit 0
    ;;
  permanent-failure)
    echo 'simulated permanent failure' >&2
    exit 7
    ;;
  *)
    echo "unknown fake curl scenario: $scenario" >&2
    exit 2
    ;;
esac
`;

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runHealthCheckBehaviorVerification();
}
