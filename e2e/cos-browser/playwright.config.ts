import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ADMIN_ORIGIN } from "./constants";

export default defineConfig({
  testDir: ".",
  testMatch: "upload-acceptance.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  globalSetup: "./global-setup.ts",
  outputDir: join(tmpdir(), "starlitsky-cos-browser-e2e-results"),
  reporter: [["line"]],
  use: {
    baseURL: ADMIN_ORIGIN,
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
