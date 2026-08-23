import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parseBooleanParam, parsePagination } from "../utils/request.mjs";

const VISIBILITY_VALUES = new Set(["visible", "hidden", "archived"]);
const CREATE_FIELDS = [
  "name",
  "gender",
  "color",
  "birthday",
  "lifecycleStatus",
  "personality",
  "storyJson",
  "visibility",
];
const UPDATE_FIELDS = CREATE_FIELDS;

export async function listCats(searchParams) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const where = buildCatWhere(searchParams);

  const [items, total] = await prisma.$transaction([
    prisma.cat.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.cat.count({ where }),
  ]);

  return {
    items: items.map(toCatDto),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getCat(id) {
  const cat = await prisma.cat.findFirst({
    where: {
      id,
      deleted_at: null,
    },
  });

  if (!cat) throw notFound("Cat not found");
  return toCatDto(cat);
}

export async function createCat(input) {
  assertPlainObject(input);
  const data = normalizeCatInput(input, {
    mode: "create",
    allowedFields: CREATE_FIELDS,
  });

  const cat = await prisma.cat.create({ data });
  return toCatDto(cat);
}

export async function updateCat(id, input) {
  assertPlainObject(input);
  const existing = await prisma.cat.findFirst({
    where: {
      id,
      deleted_at: null,
    },
  });

  if (!existing) throw notFound("Cat not found");

  const data = normalizeCatInput(input, {
    mode: "update",
    allowedFields: UPDATE_FIELDS,
  });

  if (Object.keys(data).length === 0) {
    throw badRequest("At least one cat field must be provided");
  }

  const cat = await prisma.cat.update({
    where: { id },
    data,
  });

  return toCatDto(cat);
}

export async function deleteCat(id) {
  const existing = await prisma.cat.findFirst({
    where: {
      id,
      deleted_at: null,
    },
  });

  if (!existing) throw notFound("Cat not found");

  const cat = await prisma.cat.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      visibility: "archived",
    },
  });

  return toCatDto(cat);
}

async function ensureActiveCatExists(id, label = "Cat") {
  const cat = await prisma.cat.findFirst({
    where: {
      id,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!cat) throw badRequest(`${label} does not exist`);
}

export async function ensureActiveParentCatsExist(fatherCatId, motherCatId) {
  if (fatherCatId === motherCatId) {
    throw badRequest("Father cat and mother cat must be different");
  }

  await Promise.all([
    ensureActiveCatExists(fatherCatId, "Father cat"),
    ensureActiveCatExists(motherCatId, "Mother cat"),
  ]);
}

function buildCatWhere(searchParams) {
  const includeDeleted = parseBooleanParam(searchParams.get("includeDeleted"));
  const query = searchParams.get("q");
  const lifecycleStatus = searchParams.get("lifecycleStatus");
  const visibility = searchParams.get("visibility");

  const where = {};
  if (!includeDeleted) where.deleted_at = null;
  if (lifecycleStatus) where.lifecycle_status = lifecycleStatus;
  if (visibility) where.visibility = visibility;
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { color: { contains: query } },
      { personality: { contains: query } },
    ];
  }

  return where;
}

function normalizeCatInput(input, { mode, allowedFields }) {
  assertNoUnknownFields(input, allowedFields);

  const data = {};

  if (mode === "create" || Object.hasOwn(input, "name")) {
    data.name = requiredString(input.name, "name");
  }

  assignNullableString(data, "gender", input, "gender");
  assignNullableString(data, "color", input, "color");
  assignNullableString(data, "personality", input, "personality");
  assignOptionalString(data, "lifecycle_status", input, "lifecycleStatus");
  assignVisibility(data, input);

  if (Object.hasOwn(input, "birthday")) {
    data.birthday = parseNullableDate(input.birthday, "birthday");
  }

  if (Object.hasOwn(input, "storyJson")) {
    data.story_json = input.storyJson ?? null;
  }

  return data;
}

function toCatDto(cat) {
  return {
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    birthday: toIsoString(cat.birthday),
    lifecycleStatus: cat.lifecycle_status,
    personality: cat.personality,
    storyJson: cat.story_json,
    visibility: cat.visibility,
    createdAt: toIsoString(cat.created_at),
    updatedAt: toIsoString(cat.updated_at),
    deletedAt: toIsoString(cat.deleted_at),
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
  if (value == null) return null;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
  return value.trim() || null;
}

function assignNullableString(data, dataField, input, inputField) {
  if (Object.hasOwn(input, inputField)) {
    data[dataField] = nullableString(input[inputField], inputField);
  }
}

function assignOptionalString(data, dataField, input, inputField) {
  if (!Object.hasOwn(input, inputField)) return;

  if (typeof input[inputField] !== "string" || input[inputField].trim() === "") {
    throw badRequest(`${inputField} must be a non-empty string`);
  }

  data[dataField] = input[inputField].trim();
}

function assignVisibility(data, input) {
  if (!Object.hasOwn(input, "visibility")) return;

  if (!VISIBILITY_VALUES.has(input.visibility)) {
    throw badRequest("visibility must be visible, hidden, or archived");
  }

  data.visibility = input.visibility;
}

function parseNullableDate(value, fieldName) {
  if (value == null) return null;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be an ISO date string`);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`${fieldName} must be a valid ISO date string`);
  }

  return parsed;
}

function toIsoString(value) {
  return value ? value.toISOString() : null;
}
