import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma");
const serverPath = resolve(prismaDir, "../src/server.mjs");
const suffix = randomBytes(6).toString("hex");
const names = [`callback-prod-${suffix}.db`, `callback-trial-${suffix}.db`];
const [productionDb, trialDb] = names.map((name) => resolve(prismaDir, name));
const appId = "verify-callback-app";
const token = "verify-callback-token";
const key = randomBytes(32);
const encodingAesKey = key.toString("base64").slice(0, -1);
const children = [];

try {
  for (const name of names) createDatabase(name);
  seedAvatar(productionDb, "production-trace");
  seedAvatar(trialDb, "trial-trace");
  children.push(startServer(names[1], 8081));
  await waitForHealth(8081);
  children.push(startServer(names[0], 18080,
    "http://127.0.0.1:8081/webhooks/wechat/content-safety"));
  await waitForHealth(18080);

  const prodPass = signedEvent("production-trace", "pass");
  assert.equal((await deliver(prodPass)).status, 200);
  assert.equal(verdict(productionDb, "production-trace"), "pass");
  assert.equal(verdict(trialDb, "trial-trace"), "pending");

  const trialReview = signedEvent("trial-trace", "review");
  assert.equal((await deliver(trialReview)).status, 200);
  assert.equal(verdict(trialDb, "trial-trace"), "review");
  assert.equal(verdict(productionDb, "production-trace"), "pass");

  assert.equal((await deliver(signedEvent("unknown-trace", "pass"))).status, 503);
  assert.equal((await deliver({ ...prodPass, body: { Encrypt: signedEvent("production-trace", "risky").body.Encrypt } })).status, 403);
  assert.equal((await deliver(signedEvent("production-trace", "risky", "wrong-app"))).status, 403);
  assert.equal((await deliver(signedEvent("production-trace", "risky", appId, Date.now() - 601_000))).status, 403);
  assert.equal((await deliver(prodPass)).status, 200, "exact retry is idempotent");
  assert.equal((await deliver(signedEvent("production-trace", "risky"))).status, 200);
  assert.equal(verdict(productionDb, "production-trace"), "pass", "a replay cannot change a final verdict");
  assert.equal(verdict(trialDb, "trial-trace"), "review", "production events cannot modify trial data");
  console.info("isolated WeChat callback routing verification passed");
} finally {
  for (const child of children) {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
    }
  }
  for (const path of [productionDb, trialDb]) {
    for (const extension of ["", "-wal", "-shm"]) {
      if (existsSync(path + extension)) rmSync(path + extension);
    }
  }
}

function createDatabase(name) {
  const database = new DatabaseSync(resolve(prismaDir, name));
  try {
    const migrationDir = resolve(prismaDir, "migrations");
    for (const folder of readdirSync(migrationDir).sort()) {
      const path = resolve(migrationDir, folder, "migration.sql");
      if (existsSync(path)) database.exec(readFileSync(path, "utf8"));
    }
  } finally { database.close(); }
}

function seedAvatar(path, traceId) {
  const database = new DatabaseSync(path);
  try {
    const now = Date.now();
    database.prepare(`INSERT INTO media_assets
      (id, kind, source_url, status, metadata_json, created_at, updated_at)
      VALUES (?, 'image', ?, 'active', ?, ?, ?)`).run(
      traceId, `https://example.test/${traceId}.jpg`,
      JSON.stringify({ contentSafety: { purpose: "avatar", traceId, suggest: "pending" } }), now, now,
    );
  } finally { database.close(); }
}

function startServer(name, port, forwardUrl = "") {
  return spawn(process.execPath, [serverPath], {
    cwd: resolve(prismaDir, ".."),
    env: {
      ...process.env, NODE_ENV: "production", API_HOST: "127.0.0.1", API_PORT: String(port),
      DATABASE_URL: `file:${name}`, WECHAT_APP_ID: appId, WECHAT_MESSAGE_TOKEN: token,
      WECHAT_ENCODING_AES_KEY: encodingAesKey, WECHAT_TRIAL_CALLBACK_URL: forwardUrl,
      WECHAT_MOCK_LOGIN_ENABLED: "false", WECHAT_PHONE_VERIFICATION_ENABLED: "false",
    },
    stdio: "ignore",
  });
}

async function waitForHealth(port) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return;
    } catch { /* wait for server startup */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test API on port ${port} did not start`);
}

function signedEvent(traceId, suggest, embeddedAppId = appId, timeMs = Date.now()) {
  const timestamp = String(Math.floor(timeMs / 1000));
  const nonce = randomBytes(8).toString("hex");
  const message = Buffer.from(JSON.stringify({
    MsgType: "event", Event: "wxa_media_check", appid: appId, trace_id: traceId,
    errcode: 0, result: { suggest },
  }));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(message.length);
  const plain = Buffer.concat([randomBytes(16), length, message, Buffer.from(embeddedAppId)]);
  const padding = 32 - plain.length % 32;
  const cipher = createCipheriv("aes-256-cbc", key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([plain, Buffer.alloc(padding, padding)])), cipher.final(),
  ]).toString("base64");
  const msgSignature = createHash("sha1")
    .update([token, timestamp, nonce, encrypted].sort().join(""))
    .digest("hex");
  return {
    query: new URLSearchParams({ timestamp, nonce, msg_signature: msgSignature }),
    body: { Encrypt: encrypted },
  };
}

async function deliver(envelope) {
  return fetch(`http://127.0.0.1:18080/webhooks/wechat/content-safety?${envelope.query}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(envelope.body),
  });
}

function verdict(path, traceId) {
  const database = new DatabaseSync(path);
  try {
    return database.prepare(`SELECT json_extract(metadata_json, '$.contentSafety.suggest') AS verdict
      FROM media_assets WHERE id = ?`).get(traceId)?.verdict;
  } finally { database.close(); }
}
