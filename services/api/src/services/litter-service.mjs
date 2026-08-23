import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parseBooleanParam, parsePagination } from "../utils/request.mjs";
import { ensureActiveParentCatsExist } from "./cat-service.mjs";

const VISIBILITY_VALUES = new Set(["visible", "hidden", "archived"]);
const CREATE_FIELDS = [
  "name",
  "birthDate",
  "expectedBirthDate",
  "status",
  "fatherCatId",
  "motherCatId",
  "possibleColorsJson",
  "colorNote",
  "note",
  "visibility",
];
const UPDATE_FIELDS = CREATE_FIELDS;

const LITTER_INCLUDE = {
  father_cat: true,
  mother_cat: true,
};

export async function listLitters(searchParams) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const where = buildLitterWhere(searchParams);

  const [items, total] = await prisma.$transaction([
    prisma.litter.findMany({
      where,
      include: LITTER_INCLUDE,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.litter.count({ where }),
  ]);

  return {
    items: items.map(toLitterDto),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getLitter(id) {
  const litter = await prisma.litter.findFirst({
    where: {
      id,
      deleted_at: null,
    },
    include: LITTER_INCLUDE,
  });

  if (!litter) throw notFound("Litter not found");
  return toLitterDto(litter);
}

export async function createLitter(input) {
  assertPlainObject(input);
  const data = normalizeLitterInput(input, {
    mode: "create",
    allowedFields: CREATE_FIELDS,
  });

  await ensureActiveParentCatsExist(data.father_cat_id, data.mother_cat_id);

  const litter = await prisma.litter.create({
    data,
    include: LITTER_INCLUDE,
  });

  return toLitterDto(litter);
}

export async function updateLitter(id, input) {
  assertPlainObject(input);

  const existing = await prisma.litter.findFirst({
    where: {
      id,
      deleted_at: null,
    },
  });

  if (!existing) throw notFound("Litter not found");

  const data = normalizeLitterInput(input, {
    mode: "update",
    allowedFields: UPDATE_FIELDS,
  });

  if (Object.keys(data).length === 0) {
    throw badRequest("At least one litter field must be provided");
  }

  const fatherCatId = data.father_cat_id ?? existing.father_cat_id;
  const motherCatId = data.mother_cat_id ?? existing.mother_cat_id;
  await ensureActiveParentCatsExist(fatherCatId, motherCatId);

  const litter = await prisma.litter.update({
    where: { id },
    data,
    include: LITTER_INCLUDE,
  });

  return toLitterDto(litter);
}

export async function deleteLitter(id) {
  const existing = await prisma.litter.findFirst({
    where: {
      id,
      deleted_at: null,
    },
  });

  if (!existing) throw notFound("Litter not found");

  const litter = await prisma.litter.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      visibility: "archived",
    },
    include: LITTER_INCLUDE,
  });

  return toLitterDto(litter);
}

function buildLitterWhere(searchParams) {
  const includeDeleted = parseBooleanParam(searchParams.get("includeDeleted"));
  const query = searchParams.get("q");
  const status = searchParams.get("status");
  const visibility = searchParams.get("visibility");
  const fatherCatId = searchParams.get("fatherCatId");
  const motherCatId = searchParams.get("motherCatId");

  const where = {};
  if (!includeDeleted) where.deleted_at = null;
  if (status) where.status = status;
  if (visibility) where.visibility = visibility;
  if (fatherCatId) where.father_cat_id = fatherCatId;
  if (motherCatId) where.mother_cat_id = motherCatId;
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { color_note: { contains: query } },
      { note: { contains: query } },
    ];
  }

  return where;
}

function normalizeLitterInput(input, { mode, allowedFields }) {
  assertNoUnknownFields(input, allowedFields);

  const data = {};

  if (mode === "create" || Object.hasOwn(input, "name")) {
    data.name = requiredString(input.name, "name");
  }

  if (mode === "create" || Object.hasOwn(input, "fatherCatId")) {
    data.father_cat_id = requiredString(input.fatherCatId, "fatherCatId");
  }

  if (mode === "create" || Object.hasOwn(input, "motherCatId")) {
    data.mother_cat_id = requiredString(input.motherCatId, "motherCatId");
  }

  assignOptionalString(data, "status", input, "status");
  assignNullableString(data, "color_note", input, "colorNote");
  assignNullableString(data, "note", input, "note");
  assignVisibility(data, input);

  if (Object.hasOwn(input, "birthDate")) {
    data.birth_date = parseNullableDate(input.birthDate, "birthDate");
  }

  if (Object.hasOwn(input, "expectedBirthDate")) {
    data.expected_birth_date = parseNullableDate(input.expectedBirthDate, "expectedBirthDate");
  }

  if (Object.hasOwn(input, "possibleColorsJson")) {
    data.possible_colors_json = input.possibleColorsJson ?? null;
  }

  return data;
}

function toLitterDto(litter) {
  return {
    id: litter.id,
    name: litter.name,
    birthDate: toIsoString(litter.birth_date),
    expectedBirthDate: toIsoString(litter.expected_birth_date),
    status: litter.status,
    fatherCatId: litter.father_cat_id,
    motherCatId: litter.mother_cat_id,
    fatherCat: litter.father_cat ? toLitterCatDto(litter.father_cat) : undefined,
    motherCat: litter.mother_cat ? toLitterCatDto(litter.mother_cat) : undefined,
    possibleColorsJson: litter.possible_colors_json,
    colorNote: litter.color_note,
    note: litter.note,
    visibility: litter.visibility,
    createdAt: toIsoString(litter.created_at),
    updatedAt: toIsoString(litter.updated_at),
    deletedAt: toIsoString(litter.deleted_at),
  };
}

function toLitterCatDto(cat) {
  return {
    id: cat.id,
    name: cat.name,
    gender: cat.gender,
    color: cat.color,
    lifecycleStatus: cat.lifecycle_status,
    visibility: cat.visibility,
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
