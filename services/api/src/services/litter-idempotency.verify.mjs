import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma");
const databasePath = resolve(prismaDir, "litter-idempotency-verify.db");
process.env.DATABASE_URL = "file:litter-idempotency-verify.db";
rmDatabase();

const database = new DatabaseSync(databasePath);
try {
  for (const folder of readdirSync(resolve(prismaDir, "migrations")).sort()) {
    const migrationPath = resolve(prismaDir, "migrations", folder, "migration.sql");
    if (existsSync(migrationPath)) database.exec(readFileSync(migrationPath, "utf8"));
  }
} finally {
  database.close();
}

const { prisma } = await import("../db/prisma.mjs");
const { routeRequest } = await import("../routes/index.mjs");
const { sendError } = await import("../utils/response.mjs");
const { applyCorsHeaders } = await import("../middleware/cors.mjs");
const config = {
  auth: { tokenSecret: "litter-idempotency-verify-secret", sessionTtlDays: 1 },
  cors: { allowedOrigins: ["http://127.0.0.1:5174"] },
  server: { host: "127.0.0.1", port: 0 },
};
const server = createServer(async (request, response) => {
  applyCorsHeaders(request, response, config);
  try {
    await routeRequest(request, response, { config });
  } catch (error) {
    sendError(response, error);
  }
});
server.listen(0, "127.0.0.1");
await once(server, "listening");

try {
  const admin = await prisma.user.create({
    data: { nickname: "Synthetic admin", roles: { create: { role: "admin" } } },
  });
  const ordinary = await prisma.user.create({
    data: { nickname: "Synthetic user", roles: { create: { role: "user" } } },
  });
  const otherAdmin = await prisma.user.create({
    data: { nickname: "Synthetic second admin", roles: { create: { role: "admin" } } },
  });
  const father = await prisma.cat.create({ data: { name: "Synthetic father" } });
  const mother = await prisma.cat.create({ data: { name: "Synthetic mother" } });
  const adminToken = await createToken(admin.id);
  const ordinaryToken = await createToken(ordinary.id);
  const otherAdminToken = await createToken(otherAdmin.id);
  const body = { name: "Synthetic litter", fatherCatId: father.id, motherCatId: mother.id };
  const preflight = await fetch(`http://127.0.0.1:${server.address().port}/litters`, {
    method: "OPTIONS",
    headers: {
      origin: "http://127.0.0.1:5174",
      "access-control-request-headers": "idempotency-key",
    },
  });
  assert.match(preflight.headers.get("access-control-allow-headers"), /idempotency-key/);

  const baseline = await prisma.litter.count();
  const first = await post(body, "same-key-0001", adminToken);
  const retry = await post(body, "same-key-0001", adminToken);
  assert.equal(first.data.id, retry.data.id, "same key and body must reuse the litter");
  assert.equal(await prisma.litter.count(), baseline + 1);

  const otherAdminsLitter = await post(body, "same-key-0001", otherAdminToken);
  assert.notEqual(otherAdminsLitter.data.id, first.data.id, "a shared key cannot replay another admin's litter");
  assert.equal(await prisma.litter.count(), baseline + 2);

  const normalized = await post({ ...body, name: `  ${body.name}  ` }, "normalized-key-0001", adminToken);
  const normalizedRetry = await post(body, "normalized-key-0001", adminToken);
  assert.equal(normalized.data.id, normalizedRetry.data.id, "hashing must use normalized server data");
  assert.equal(await prisma.litter.count(), baseline + 3);

  await assert.rejects(
    () => post({ ...body, note: "different" }, "same-key-0001", adminToken),
    (error) => error?.statusCode === 409,
    "same key with different body must conflict",
  );

  const simultaneous = await Promise.all([
    post(body, "parallel-key-0002", adminToken),
    post(body, "parallel-key-0002", adminToken),
  ]);
  assert.equal(simultaneous[0].data.id, simultaneous[1].data.id);
  assert.equal(await prisma.litter.count(), baseline + 4);

  await post(body, "lost-response-key-0003", adminToken); // The caller discards this response.
  const recovered = await post(body, "lost-response-key-0003", adminToken);
  assert.equal(recovered.data.id, (await post(body, "lost-response-key-0003", adminToken)).data.id);
  assert.equal(await prisma.litter.count(), baseline + 5);

  const distinct = await post(body, "different-key-0004", adminToken);
  assert.notEqual(distinct.data.id, first.data.id, "same name with a new key is a new litter");
  assert.equal(await prisma.litter.count(), baseline + 6);

  await post(body, null, adminToken);
  await post(body, null, adminToken);
  assert.equal(
    await prisma.litter.count(),
    baseline + 8,
    "legacy keyless requests stay compatible",
  );

  await assert.rejects(
    () => post(body, "forbidden-key-0005", ordinaryToken),
    (error) => error?.statusCode === 403,
  );
  assert.equal(await prisma.litter.count(), baseline + 8);
  assert.equal(await prisma.cat.count(), 2, "litter retries must not create parent cats");
  console.log("Litter POST idempotency verification passed");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  rmDatabase();
}

async function createToken(userId) {
  const token = `synthetic-${userId}`;
  await prisma.userSession.create({
    data: {
      user_id: userId,
      token_hash: createHash("sha256").update(`${config.auth.tokenSecret}:${token}`).digest("hex"),
      expires_at: new Date(Date.now() + 60_000),
    },
  });
  return token;
}

async function post(body, key, token) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/litters`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(key ? { "idempotency-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(payload.message), { statusCode: response.status });
  assert.equal(response.status, 201);
  return payload;
}

function rmDatabase() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}
