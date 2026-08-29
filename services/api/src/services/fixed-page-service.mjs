import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";

const FIXED_PAGE_DEFINITIONS = [
  { slug: "home", title: "首页" },
  { slug: "about", title: "猫舍介绍" },
  { slug: "philosophy", title: "繁育理念" },
  { slug: "environment", title: "猫舍环境" },
  { slug: "feeding", title: "喂养体系" },
  { slug: "process", title: "价格与接猫流程" },
  { slug: "aftercare", title: "售后保障" },
  { slug: "contact", title: "联系方式" },
  { slug: "questionnaire", title: "选猫问卷" },
  { slug: "breeding-plan", title: "繁育计划" },
];
const FIXED_PAGE_SLUGS = new Set(FIXED_PAGE_DEFINITIONS.map((page) => page.slug));
const STATUS_VALUES = new Set(["draft", "published", "hidden"]);
const UPDATE_FIELDS = [
  "title",
  "status",
  "seoTitle",
  "seoDescription",
  "contentSchemaVersion",
  "contentJson",
];

export async function listFixedPages() {
  const pages = await prisma.fixedPage.findMany({
    where: { deleted_at: null },
    orderBy: [{ slug: "asc" }],
  });
  const bySlug = new Map(pages.map((page) => [page.slug, page]));

  return FIXED_PAGE_DEFINITIONS.map((definition) => {
    const page = bySlug.get(definition.slug);
    return page ? toFixedPageDto(page) : toVirtualFixedPageDto(definition);
  });
}

export async function getFixedPage(slug) {
  const definition = assertFixedPageSlug(slug);
  const page = await prisma.fixedPage.findUnique({
    where: { slug },
  });

  if (!page || page.deleted_at) return toVirtualFixedPageDto(definition);
  return toFixedPageDto(page);
}

export async function updateFixedPage(slug, input) {
  assertPlainObject(input);
  const definition = assertFixedPageSlug(slug);
  const data = normalizeFixedPageInput(input);

  if (Object.keys(data).length === 0) {
    throw badRequest("At least one fixed page field must be provided");
  }

  const page = await prisma.fixedPage.upsert({
    where: { slug },
    create: {
      id: `fixed-page-${slug}`,
      slug,
      title: definition.title,
      ...data,
    },
    update: data,
  });

  return toFixedPageDto(page);
}

export async function ensureActiveFixedPageExists(id, client = prisma) {
  const page = await client.fixedPage.findFirst({
    where: {
      id,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!page) throw notFound("Fixed page not found");
}

function normalizeFixedPageInput(input) {
  assertNoUnknownFields(input, UPDATE_FIELDS);
  const data = {};

  if (Object.hasOwn(input, "title")) {
    data.title = requiredString(input.title, "title");
  }
  if (Object.hasOwn(input, "status")) {
    const status = enumString(input.status, "status", STATUS_VALUES);
    data.status = status;
    data.published_at = status === "published" ? new Date() : null;
  }
  assignNullableString(data, "seo_title", input, "seoTitle");
  assignNullableString(data, "seo_description", input, "seoDescription");

  if (Object.hasOwn(input, "contentSchemaVersion")) {
    data.content_schema_version = positiveInteger(
      input.contentSchemaVersion,
      "contentSchemaVersion",
    );
  }
  if (Object.hasOwn(input, "contentJson")) {
    data.content_json = normalizeContentJson(input.contentJson);
  }

  return data;
}

function assertFixedPageSlug(slug) {
  if (!FIXED_PAGE_SLUGS.has(slug)) {
    throw notFound("Fixed page not found");
  }
  return FIXED_PAGE_DEFINITIONS.find((page) => page.slug === slug);
}

function toFixedPageDto(page) {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    seoTitle: page.seo_title,
    seoDescription: page.seo_description,
    contentSchemaVersion: page.content_schema_version,
    contentJson: page.content_json ?? {},
    publishedAt: toIsoString(page.published_at),
    createdAt: toIsoString(page.created_at),
    updatedAt: toIsoString(page.updated_at),
    deletedAt: toIsoString(page.deleted_at),
  };
}

function toVirtualFixedPageDto(definition) {
  const now = new Date(0).toISOString();
  return {
    id: `fixed-page-${definition.slug}`,
    slug: definition.slug,
    title: definition.title,
    status: "draft",
    seoTitle: null,
    seoDescription: null,
    contentSchemaVersion: 1,
    contentJson: {},
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("Request body must be a JSON object");
  }
}

function assertNoUnknownFields(input, allowedFields) {
  const allowed = new Set(allowedFields);
  const unknownFields = Object.keys(input).filter((field) => !allowed.has(field));
  if (unknownFields.length > 0) {
    throw badRequest("Request body contains unsupported fields", {
      fields: unknownFields,
    });
  }
}

function requiredString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest(`${fieldName} is required`);
  }
  return value.trim();
}

function nullableString(value, fieldName) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
  return value.trim() || null;
}

function enumString(value, fieldName, allowedValues) {
  const normalized = requiredString(value, fieldName);
  if (!allowedValues.has(normalized)) {
    throw badRequest(`${fieldName} contains an unsupported value`);
  }
  return normalized;
}

function positiveInteger(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function normalizeContentJson(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("contentJson must be a JSON object");
  }
  return value;
}

function assignNullableString(data, dataField, input, inputField) {
  if (Object.hasOwn(input, inputField)) {
    data[dataField] = nullableString(input[inputField], inputField);
  }
}

function toIsoString(value) {
  return value ? value.toISOString() : null;
}
