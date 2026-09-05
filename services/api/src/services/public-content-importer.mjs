import { PUBLIC_CONTENT_MANIFEST } from "../content/public-content-manifest.mjs";
import { FIXED_PAGE_SLUGS } from "../content/fixed-page-definitions.mjs";

const FIXED_PAGE_OWNED_FIELDS = [
  "title",
  "status",
  "seo_title",
  "seo_description",
  "content_schema_version",
  "content_json",
];
const CAT_OWNED_FIELDS = [
  "name",
  "gender",
  "color",
  "lifecycle_status",
  "visibility",
  "story_json",
];
const BREEDING_PROFILE_OWNED_FIELDS = [
  "breeding_role",
  "reproductive_state",
  "status_label",
  "trait",
  "source",
  "sort_order",
];
const ALLOWED_FIXED_PAGE_STATUS = new Set(["draft", "published", "hidden"]);
const ALLOWED_CAT_VISIBILITY = new Set(["visible", "hidden", "archived"]);
const ALLOWED_GENDER = new Set(["male", "female", "unknown"]);
const ALLOWED_BREEDING_ROLE = new Set(["king", "queen", "candidate"]);
const ALLOWED_REPRODUCTIVE_STATE = new Set([
  "active",
  "observing",
  "paused",
  "retired",
  "semiRetired",
]);
const DISALLOWED_COUNT_MODELS = [
  "user",
  "userRole",
  "userSession",
  "adminLoginChallenge",
  "parentProfile",
  "parentInvite",
  "parentApplication",
  "parentCatLink",
  "selectionApplication",
  "post",
  "postCat",
  "postLitter",
  "comment",
  "postLike",
  "mediaAsset",
  "mediaBinding",
];

export class PublicContentImportError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PublicContentImportError";
    this.details = details;
  }
}

export function assertPublicContentImporterRuntime({
  confirmProduction = false,
  databaseUrl = process.env.DATABASE_URL,
  nodeEnv = process.env.NODE_ENV,
} = {}) {
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new PublicContentImportError("DATABASE_URL must be set explicitly.");
  }
  if (!isSqliteDatabaseUrl(databaseUrl)) {
    throw new PublicContentImportError("Public content importer only supports explicit SQLite file: DATABASE_URL values.", {
      databaseUrl: redactedDatabaseUrl(databaseUrl),
    });
  }
  if (isProductionTarget(databaseUrl, nodeEnv) && !confirmProduction) {
    throw new PublicContentImportError(
      "Production-like targets require --confirm-production even for dry-run.",
      {
        databaseUrl: redactedDatabaseUrl(databaseUrl),
        nodeEnv,
      },
    );
  }

  return {
    databaseUrl,
    isProductionTarget: isProductionTarget(databaseUrl, nodeEnv),
  };
}

export function validatePublicContentManifest(
  manifest = PUBLIC_CONTENT_MANIFEST,
  { allowedFixedPageSlugs = FIXED_PAGE_SLUGS } = {},
) {
  const errors = [];

  if (!manifest || typeof manifest !== "object") errors.push("manifest must be an object");
  if (!Number.isInteger(manifest.version) || manifest.version <= 0) {
    errors.push("manifest.version must be a positive integer");
  }
  requiredString(manifest.manifestId, "manifest.manifestId", errors);
  requiredString(manifest.manifestDate, "manifest.manifestDate", errors);
  requiredString(manifest.source?.fileName, "manifest.source.fileName", errors);

  validateUniqueCollection({
    errors,
    items: manifest.fixedPages,
    label: "fixedPages",
    keyOf: (item) => item.importId,
  });
  validateUniqueCollection({
    errors,
    items: manifest.fixedPages,
    label: "fixedPages.slug",
    keyOf: (item) => item.slug,
  });
  for (const page of arrayOrEmpty(manifest.fixedPages)) {
    requiredString(page.importId, "fixedPage.importId", errors);
    requiredString(page.sourceHeading, "fixedPage.sourceHeading", errors);
    requiredString(page.slug, "fixedPage.slug", errors);
    requiredString(page.title, "fixedPage.title", errors);
    if (!allowedFixedPageSlugs.has(page.slug)) {
      errors.push(`fixedPage slug is not supported by current product: ${page.slug}`);
    }
    if (!ALLOWED_FIXED_PAGE_STATUS.has(page.status)) {
      errors.push(`fixedPage status is unsupported: ${page.status}`);
    }
    if (!Number.isInteger(page.contentSchemaVersion) || page.contentSchemaVersion <= 0) {
      errors.push(`fixedPage ${page.slug} contentSchemaVersion must be a positive integer`);
    }
    if (!isPlainObject(page.contentJson)) {
      errors.push(`fixedPage ${page.slug} contentJson must be an object`);
    }
  }

  validateUniqueCollection({
    errors,
    items: manifest.breedingCats,
    label: "breedingCats.importId",
    keyOf: (item) => item.importId,
  });
  validateUniqueCollection({
    errors,
    items: manifest.breedingCats,
    label: "breedingCats.cat.id",
    keyOf: (item) => item.cat?.id,
  });
  validateUniqueCollection({
    errors,
    items: manifest.breedingCats,
    label: "breedingCats.cat.name",
    keyOf: (item) => item.cat?.name,
  });
  for (const entry of arrayOrEmpty(manifest.breedingCats)) {
    requiredString(entry.importId, "breedingCat.importId", errors);
    requiredString(entry.sourceGroup, "breedingCat.sourceGroup", errors);
    requiredString(entry.cat?.id, "breedingCat.cat.id", errors);
    requiredString(entry.cat?.name, "breedingCat.cat.name", errors);
    requiredString(entry.cat?.color, "breedingCat.cat.color", errors);
    if (!ALLOWED_GENDER.has(entry.cat?.gender)) {
      errors.push(`breedingCat ${entry.cat?.name} gender is unsupported: ${entry.cat?.gender}`);
    }
    if (!ALLOWED_CAT_VISIBILITY.has(entry.cat?.visibility)) {
      errors.push(`breedingCat ${entry.cat?.name} visibility is unsupported: ${entry.cat?.visibility}`);
    }
    if (entry.cat?.lifecycleStatus !== "breeding") {
      errors.push(`breedingCat ${entry.cat?.name} lifecycleStatus must be breeding`);
    }
    if (!isPlainObject(entry.cat?.storyJson) || !Array.isArray(entry.cat?.storyJson?.story)) {
      errors.push(`breedingCat ${entry.cat?.name} storyJson.story must be an array`);
    }
    if (entry.cat?.storyJson?.source?.publicContentImportId !== entry.importId) {
      errors.push(`breedingCat ${entry.cat?.name} storyJson source import id must match importId`);
    }
    if (!ALLOWED_BREEDING_ROLE.has(entry.breedingProfile?.breedingRole)) {
      errors.push(
        `breedingCat ${entry.cat?.name} breedingRole is unsupported: ${entry.breedingProfile?.breedingRole}`,
      );
    }
    if (!ALLOWED_REPRODUCTIVE_STATE.has(entry.breedingProfile?.reproductiveState)) {
      errors.push(
        `breedingCat ${entry.cat?.name} reproductiveState is unsupported: ${entry.breedingProfile?.reproductiveState}`,
      );
    }
  }

  if (!Array.isArray(manifest.skippedSections) || manifest.skippedSections.length === 0) {
    errors.push("manifest.skippedSections must explicitly record skipped or unmapped source sections");
  }

  if (errors.length > 0) {
    throw new PublicContentImportError("Public content manifest is invalid.", { errors });
  }
  return true;
}

export async function createPublicContentImportPlan({
  client,
  manifest = PUBLIC_CONTENT_MANIFEST,
} = {}) {
  if (!client) throw new PublicContentImportError("A Prisma client is required.");
  validatePublicContentManifest(manifest);

  const [fixedPages, cats, profiles, beforeCounts] = await Promise.all([
    client.fixedPage.findMany({
      where: { slug: { in: manifest.fixedPages.map((page) => page.slug) } },
    }),
    client.cat.findMany({
      where: {
        OR: [
          { id: { in: manifest.breedingCats.map((entry) => entry.cat.id) } },
          { name: { in: manifest.breedingCats.map((entry) => entry.cat.name) } },
        ],
      },
    }),
    client.breedingCatProfile.findMany({
      where: { cat_id: { in: manifest.breedingCats.map((entry) => entry.cat.id) } },
    }),
    countTables(client),
  ]);

  const fixedPagesBySlug = new Map(fixedPages.map((page) => [page.slug, page]));
  const catsById = new Map(cats.map((cat) => [cat.id, cat]));
  const profilesByCatId = new Map(profiles.map((profile) => [profile.cat_id, profile]));
  const plan = {
    manifestId: manifest.manifestId,
    manifestVersion: manifest.version,
    mode: "dry-run",
    fixedPages: [],
    breedingCats: [],
    skippedSections: manifest.skippedSections.map((section) => ({ ...section })),
    conflicts: [],
    beforeCounts,
  };

  for (const page of manifest.fixedPages) {
    const existing = fixedPagesBySlug.get(page.slug);
    if (existing?.deleted_at) {
      plan.conflicts.push({
        kind: "fixed-page-deleted",
        slug: page.slug,
        message: "A deleted fixed page with this slug already exists; importer will not restore it.",
      });
      continue;
    }
    const data = toFixedPageData(page);
    plan.fixedPages.push({
      importId: page.importId,
      sourceHeading: page.sourceHeading,
      slug: page.slug,
      action: existing ? diffAction(existing, data, FIXED_PAGE_OWNED_FIELDS) : "create",
      ownedFields: FIXED_PAGE_OWNED_FIELDS,
      changes: existing ? diffFields(existing, data, FIXED_PAGE_OWNED_FIELDS) : data,
    });
  }

  for (const entry of manifest.breedingCats) {
    const existingById = catsById.get(entry.cat.id);
    const sameNameCats = cats.filter((cat) => cat.name === entry.cat.name && cat.id !== entry.cat.id);
    if (sameNameCats.length > 0) {
      plan.conflicts.push({
        kind: "breeding-cat-name-conflict",
        importId: entry.importId,
        catId: entry.cat.id,
        name: entry.cat.name,
        conflictingIds: sameNameCats.map((cat) => cat.id),
        message: "A cat with the same name exists without the manifest import identity.",
      });
      continue;
    }
    if (existingById?.deleted_at) {
      plan.conflicts.push({
        kind: "breeding-cat-deleted",
        importId: entry.importId,
        catId: entry.cat.id,
        name: entry.cat.name,
        message: "A deleted cat with the manifest id already exists; importer will not restore it.",
      });
      continue;
    }
    if (
      existingById?.story_json?.source?.publicContentImportId &&
      existingById.story_json.source.publicContentImportId !== entry.importId
    ) {
      plan.conflicts.push({
        kind: "breeding-cat-import-id-conflict",
        importId: entry.importId,
        catId: entry.cat.id,
        name: entry.cat.name,
        existingImportId: existingById.story_json.source.publicContentImportId,
        message: "The existing cat has a different public content import identity.",
      });
      continue;
    }

    const catData = toCatData(entry);
    const profileData = toBreedingProfileData(entry);
    const profile = profilesByCatId.get(entry.cat.id);
    plan.breedingCats.push({
      importId: entry.importId,
      sourceGroup: entry.sourceGroup,
      name: entry.cat.name,
      action: existingById ? diffAction(existingById, catData, CAT_OWNED_FIELDS) : "create",
      catOwnedFields: CAT_OWNED_FIELDS,
      breedingProfileOwnedFields: BREEDING_PROFILE_OWNED_FIELDS,
      catChanges: existingById ? diffFields(existingById, catData, CAT_OWNED_FIELDS) : catData,
      breedingProfileAction: profile ? diffAction(profile, profileData, BREEDING_PROFILE_OWNED_FIELDS) : "create",
      breedingProfileChanges: profile
        ? diffFields(profile, profileData, BREEDING_PROFILE_OWNED_FIELDS)
        : profileData,
    });
  }

  return plan;
}

export async function runPublicContentImport({
  apply = false,
  client,
  manifest = PUBLIC_CONTENT_MANIFEST,
} = {}) {
  const plan = await createPublicContentImportPlan({ client, manifest });
  plan.mode = apply ? "apply" : "dry-run";
  if (plan.conflicts.length > 0) {
    throw new PublicContentImportError("Public content import has conflicts and will not continue.", {
      plan,
    });
  }
  if (!apply) return plan;

  await client.$transaction(async (transaction) => {
    for (const page of manifest.fixedPages) {
      const data = toFixedPageData(page);
      await transaction.fixedPage.upsert({
        where: { slug: page.slug },
        create: {
          id: `fixed-page-${page.slug}`,
          slug: page.slug,
          ...data,
        },
        update: data,
      });
    }

    for (const entry of manifest.breedingCats) {
      const catData = toCatData(entry);
      await transaction.cat.upsert({
        where: { id: entry.cat.id },
        create: {
          id: entry.cat.id,
          ...catData,
        },
        update: catData,
      });
      await transaction.breedingCatProfile.upsert({
        where: { cat_id: entry.cat.id },
        create: {
          cat_id: entry.cat.id,
          ...toBreedingProfileData(entry),
        },
        update: toBreedingProfileData(entry),
      });
    }
  });

  return {
    ...plan,
    afterCounts: await countTables(client),
  };
}

export async function countTables(client) {
  const entries = await Promise.all([
    ["fixedPage", client.fixedPage.count()],
    ["cat", client.cat.count()],
    ["breedingCatProfile", client.breedingCatProfile.count()],
    ["kittenProfile", client.kittenProfile.count()],
    ["litter", client.litter.count()],
    ...DISALLOWED_COUNT_MODELS.map((model) => [model, client[model].count()]),
  ]);
  return Object.fromEntries(
    await Promise.all(entries.map(async ([name, value]) => [name, await value])),
  );
}

function toFixedPageData(page) {
  return {
    title: page.title,
    status: page.status,
    seo_title: page.seoTitle ?? null,
    seo_description: page.seoDescription ?? null,
    content_schema_version: page.contentSchemaVersion,
    content_json: page.contentJson,
    published_at: page.status === "published" ? new Date() : null,
  };
}

function toCatData(entry) {
  return {
    name: entry.cat.name,
    gender: entry.cat.gender,
    color: entry.cat.color,
    lifecycle_status: entry.cat.lifecycleStatus,
    visibility: entry.cat.visibility,
    story_json: entry.cat.storyJson,
  };
}

function toBreedingProfileData(entry) {
  return {
    breeding_role: entry.breedingProfile.breedingRole,
    reproductive_state: entry.breedingProfile.reproductiveState,
    status_label: entry.breedingProfile.statusLabel,
    trait: entry.breedingProfile.trait,
    source: entry.breedingProfile.source,
    sort_order: entry.breedingProfile.sortOrder,
  };
}

function diffAction(existing, next, fields) {
  return diffFields(existing, next, fields).length === 0 ? "noop" : "update";
}

function diffFields(existing, next, fields) {
  const changes = [];
  for (const field of fields) {
    if (!jsonEqual(existing[field] ?? null, next[field] ?? null)) {
      changes.push({
        field,
        from: existing[field] ?? null,
        to: next[field] ?? null,
      });
    }
  }
  return changes;
}

function validateUniqueCollection({ errors, items, keyOf, label }) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(`${label} must be a non-empty array`);
    return;
  }
  const seen = new Set();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    if (seen.has(key)) errors.push(`${label} contains duplicate value: ${key}`);
    seen.add(key);
  }
}

function requiredString(value, fieldName, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${fieldName} must be a non-empty string`);
  }
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function jsonEqual(left, right) {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortJson(nestedValue)]),
  );
}

function isSqliteDatabaseUrl(databaseUrl) {
  return databaseUrl.trim().startsWith("file:");
}

function isProductionTarget(databaseUrl, nodeEnv) {
  const normalized = databaseUrl.replaceAll("\\", "/").toLowerCase();
  return nodeEnv === "production" || normalized.includes("/opt/starlitsky/data/");
}

function redactedDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return "";
  if (databaseUrl.startsWith("file:")) return databaseUrl;
  return "<non-sqlite-database-url>";
}
