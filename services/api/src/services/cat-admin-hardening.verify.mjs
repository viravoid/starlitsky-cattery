import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

process.env.DATABASE_URL = "file:cat-admin-hardening-verify.db";

rmLocalSqlite(process.env.DATABASE_URL);
await ensureLocalSqliteSchema(process.env.DATABASE_URL);

const { prisma } = await import("../db/prisma.mjs");
const { routeRequest } = await import("../routes/index.mjs");

const config = {
  auth: {
    tokenSecret: "cat-admin-hardening-verify-secret",
    sessionTtlDays: 7,
  },
  server: {
    host: "127.0.0.1",
    port: 0,
  },
};

const admin = await createUserWithRole("verify-cat-admin", "admin");
const father = await createCat("Verify Father", { gender: "male", lifecycle_status: "breeding" });
const mother = await createCat("Verify Mother", {
  gender: "female",
  lifecycle_status: "breeding",
});
const litter = await prisma.litter.create({
  data: {
    father_cat_id: father.id,
    mother_cat_id: mother.id,
    name: "Verify Litter",
    status: "born",
    visibility: "visible",
  },
});

const catCountBeforeBrokenKitten = await prisma.cat.count();
await assertRouteJsonRejects(
  "kitten profile failure must roll back Cat creation",
  "/cats/with-kitten-profile",
  admin,
  "POST",
  {
    cat: {
      lifecycleStatus: "growing",
      name: "Verify Broken Kitten",
      visibility: "visible",
    },
    kittenProfile: {
      litterId: "missing-litter",
      saleStatus: "evaluating",
    },
  },
  404,
);
assert.equal(
  await prisma.cat.count(),
  catCountBeforeBrokenKitten,
  "failed kitten profile create must not leave a Cat row",
);
assert.equal(
  await prisma.cat.count({ where: { name: "Verify Broken Kitten" } }),
  0,
  "failed kitten profile create must not leave the named Cat",
);

const catCountBeforeBrokenStud = await prisma.cat.count();
await assertRouteJsonRejects(
  "breeding profile failure must roll back Cat creation",
  "/cats/with-breeding-profile",
  admin,
  "POST",
  {
    breedingProfile: {
      category: "king",
    },
    cat: {
      lifecycleStatus: "breeding",
      name: "Verify Broken Stud",
      visibility: "visible",
    },
  },
  400,
);
assert.equal(
  await prisma.cat.count(),
  catCountBeforeBrokenStud,
  "failed breeding profile create must not leave a Cat row",
);
assert.equal(
  await prisma.cat.count({ where: { name: "Verify Broken Stud" } }),
  0,
  "failed breeding profile create must not leave the named Cat",
);

const createdKitten = await routeJson("/cats/with-kitten-profile", admin, "POST", {
  cat: {
    color: "blue golden",
    lifecycleStatus: "growing",
    name: "Verify Atomic Kitten",
    visibility: "visible",
  },
  kittenProfile: {
    litterId: litter.id,
    priceText: "TBD",
    saleStatus: "available",
    structureRatingJson: { head: 5 },
  },
});
assert.ok(createdKitten.id, "atomic kitten create should return Cat data");
assert.equal(createdKitten.kittenProfile?.catId, createdKitten.id);
assert.equal(
  await prisma.kittenProfile.count({ where: { cat_id: createdKitten.id } }),
  1,
  "atomic kitten create should persist the matching profile",
);

const createdStud = await routeJson("/cats/with-breeding-profile", admin, "POST", {
  breedingProfile: {
    category: "king",
    reproductiveState: "active",
    sortOrder: 3,
    statusLabel: "active",
  },
  cat: {
    lifecycleStatus: "breeding",
    name: "Verify Atomic Stud",
    visibility: "visible",
  },
});
assert.ok(createdStud.id, "atomic stud create should return Cat data");
assert.equal(createdStud.breedingProfile?.catId, createdStud.id);
assert.equal(
  await prisma.breedingCatProfile.count({ where: { cat_id: createdStud.id } }),
  1,
  "atomic stud create should persist the matching profile",
);

const parentUser = await createUserWithRole("verify-parent-user", "parent");
const parentProfile = await prisma.parentProfile.create({
  data: {
    display_name: "Verify Parent",
    status: "active",
    user_id: parentUser.id,
  },
});
await prisma.parentCatLink.create({
  data: {
    cat_id: createdKitten.id,
    parent_profile_id: parentProfile.id,
    relationship: "caregiver",
    status: "ended",
  },
});
await prisma.parentCatLink.create({
  data: {
    active_dedup_key: `${parentProfile.id}:${createdKitten.id}:owner`,
    cat_id: createdKitten.id,
    parent_profile_id: parentProfile.id,
    relationship: "owner",
    status: "active",
  },
});

const adminCats = await routeJson("/cats?pageSize=200", admin, "GET");
const listedKitten = adminCats.items.find((item) => item.id === createdKitten.id);
assert.equal(
  listedKitten.parentCatLinks[0].parentProfile.displayName,
  "Verify Parent",
  "admin cat list should include parent displayName from real links",
);
assert.equal(
  listedKitten.parentCatLinks[0].relationship,
  "owner",
  "admin cat list should order active links before inactive or ended links",
);

const publicCats = await routeJson("/cats?pageSize=200", null, "GET");
const publicListedKitten = publicCats.items.find((item) => item.id === createdKitten.id);
assert.equal(
  Object.hasOwn(publicListedKitten, "parentCatLinks"),
  false,
  "public cat list must not expose parent link data",
);

const storyCat = await createCat("Verify Story Round Trip", {
  story_json: {
    detail: "old detail",
    diet: "old diet",
    imagePresentation: {
      coverPresentations: { listCard: { objectPositionX: 50, objectPositionY: 40, zoom: 1.2 } },
    },
    personality: "keep personality",
    source: { publicContentId: "story-source" },
    unknownKey: { nested: true },
  },
});
const updatedStoryCat = await routeJson(`/cats/${storyCat.id}`, admin, "PATCH", {
  storyJson: {
    imagePresentation: {
      coverPresentations: { listCard: { objectPositionX: 50, objectPositionY: 40, zoom: 1.2 } },
    },
    personality: "keep personality",
    source: { publicContentId: "story-source" },
    unknownKey: { nested: true },
  },
});
assert.equal(
  Object.hasOwn(updatedStoryCat.storyJson, "detail"),
  false,
  "storyJson round trip should allow explicitly cleared detail to be removed",
);
assert.equal(
  Object.hasOwn(updatedStoryCat.storyJson, "diet"),
  false,
  "storyJson round trip should allow explicitly cleared diet to be removed",
);
assert.equal(
  updatedStoryCat.storyJson.personality,
  "keep personality",
  "storyJson round trip should preserve unedited displayed fields",
);
assert.deepEqual(
  updatedStoryCat.storyJson.unknownKey,
  { nested: true },
  "storyJson round trip should preserve unknown keys",
);
assert.deepEqual(
  updatedStoryCat.storyJson.imagePresentation.coverPresentations.listCard,
  { objectPositionX: 50, objectPositionY: 40, zoom: 1.2 },
  "storyJson round trip should preserve imagePresentation",
);

console.info("cat admin hardening verification passed");
await prisma.$disconnect();

async function createUserWithRole(nickname, role) {
  return prisma.user.create({
    data: {
      nickname,
      roles: {
        create: { role },
      },
      status: "active",
    },
    include: { roles: true },
  });
}

async function createCat(name, data = {}) {
  return prisma.cat.create({
    data: {
      lifecycle_status: "growing",
      name,
      visibility: "visible",
      ...data,
    },
  });
}

async function routeJson(url, actingUser, method, body = undefined) {
  const response = createJsonResponse();
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await routeRequest(createRequest({ body, method, token, url }), response, { config });
  return response.data.data;
}

async function assertRouteJsonRejects(label, url, actingUser, method, body, statusCode) {
  const token = actingUser ? await createSessionToken(actingUser) : "";
  await assert.rejects(
    () => routeRequest(createRequest({ body, method, token, url }), createResponse(), { config }),
    (error) => error?.statusCode === statusCode,
    label,
  );
}

function createRequest({ body = undefined, method, token = "", url }) {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  request.method = method;
  request.url = url;
  request.headers = {
    host: "127.0.0.1",
  };
  if (token) request.headers.authorization = `Bearer ${token}`;
  return request;
}

async function createSessionToken(actingUser) {
  const token = `token-${actingUser.id}-${Math.random().toString(36).slice(2)}`;
  await prisma.userSession.create({
    data: {
      expires_at: new Date(Date.now() + 60_000),
      token_hash: createHash("sha256").update(`${config.auth.tokenSecret}:${token}`).digest("hex"),
      user_id: actingUser.id,
    },
  });
  return token;
}

function createResponse() {
  return {
    end() {},
    setHeader() {},
    writeHead() {},
  };
}

function createJsonResponse() {
  return {
    data: null,
    end(payload) {
      this.data = JSON.parse(payload);
    },
    setHeader() {},
    writeHead() {},
  };
}

async function ensureLocalSqliteSchema(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) return;

  const { DatabaseSync } = await import("node:sqlite");
  const sqlitePath = resolveSqlitePath(databaseUrl.slice("file:".length));
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const database = new DatabaseSync(sqlitePath);
  try {
    const hasUsersTable = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
      .get();
    if (hasUsersTable) return;

    const migrationsDir = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../prisma/migrations",
    );
    for (const folder of readdirSync(migrationsDir).sort()) {
      const migrationPath = resolve(migrationsDir, folder, "migration.sql");
      if (existsSync(migrationPath)) {
        database.exec(readFileSync(migrationPath, "utf8"));
      }
    }
  } finally {
    database.close();
  }
}

function rmLocalSqlite(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) return;
  const sqlitePath = resolveSqlitePath(databaseUrl.slice("file:".length));
  rmSync(sqlitePath, { force: true });
  rmSync(`${sqlitePath}-journal`, { force: true });
  rmSync(`${sqlitePath}-wal`, { force: true });
  rmSync(`${sqlitePath}-shm`, { force: true });
}

function resolveSqlitePath(rawPath) {
  const normalized = rawPath.trim().replace(/^"|"$/g, "");
  if (isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) return normalized;

  const prismaDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../prisma");
  return resolve(prismaDir, normalized);
}
