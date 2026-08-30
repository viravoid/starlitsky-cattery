import { prisma } from "../db/prisma.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parsePagination } from "../utils/request.mjs";

const STATUS_VALUES = new Set(["submitted", "reviewed"]);
const SUBMIT_FIELDS = [
  "clientDedupKey",
  "name",
  "gender",
  "phone",
  "age",
  "job",
  "city",
  "experience",
  "residents",
  "residentsNeutered",
  "hasKids",
  "housing",
  "windowSealed",
  "familyAgree",
  "maineCoonKnowledge",
  "wantGender",
  "wantColor",
  "budget",
  "acceptNeuter",
  "monthlySpend",
  "scientificFeeding",
  "acceptActive",
  "commitment",
  "additionalNote",
];
const REVIEW_FIELDS = ["status", "adminNote"];

const SELECTION_APPLICATION_INCLUDE = {
  user: {
    select: {
      id: true,
      nickname: true,
      avatar_url: true,
      phone: true,
    },
  },
  reviewer: {
    select: {
      id: true,
      nickname: true,
      avatar_url: true,
      phone: true,
    },
  },
};

export async function submitSelectionApplication(input, options = {}) {
  assertPlainObject(input);
  assertNoUnknownFields(input, SUBMIT_FIELDS);

  const clientDedupKey = nullableTrimmedString(input.clientDedupKey, "clientDedupKey", 160);
  if (clientDedupKey) {
    const existing = await prisma.selectionApplication.findUnique({
      where: { client_dedup_key: clientDedupKey },
      include: SELECTION_APPLICATION_INCLUDE,
    });
    if (existing) return toSelectionApplicationDto(existing);
  }

  const data = normalizeSubmitInput(input, options.user?.id ?? null, clientDedupKey);
  const application = await prisma.selectionApplication.create({
    data,
    include: SELECTION_APPLICATION_INCLUDE,
  });
  return toSelectionApplicationDto(application);
}

export async function getMyLatestSelectionApplication(userId) {
  const application = await prisma.selectionApplication.findFirst({
    where: { user_id: userId },
    include: SELECTION_APPLICATION_INCLUDE,
    orderBy: [{ submitted_at: "desc" }, { created_at: "desc" }, { id: "asc" }],
  });

  if (!application) throw notFound("Selection application not found");
  return toSelectionApplicationDto(application);
}

export async function listSelectionApplications(searchParams) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const where = {};
  const status = searchParams.get("status");
  const query = searchParams.get("q");

  if (status) {
    if (!STATUS_VALUES.has(status)) throw badRequest("status contains an unsupported value");
    where.status = status;
  }
  if (query) {
    where.OR = [
      { contact_name: { contains: query } },
      { contact_phone: { contains: query } },
      { contact_city: { contains: query } },
      { contact_job: { contains: query } },
    ];
  }

  const [items, total] = await prisma.$transaction([
    prisma.selectionApplication.findMany({
      where,
      include: SELECTION_APPLICATION_INCLUDE,
      orderBy: [{ submitted_at: "desc" }, { created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.selectionApplication.count({ where }),
  ]);

  return {
    items: items.map(toSelectionApplicationDto),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getSelectionApplication(id) {
  const application = await prisma.selectionApplication.findUnique({
    where: { id },
    include: SELECTION_APPLICATION_INCLUDE,
  });

  if (!application) throw notFound("Selection application not found");
  return toSelectionApplicationDto(application);
}

export async function updateSelectionApplicationReview(id, input, reviewer) {
  assertPlainObject(input);
  assertNoUnknownFields(input, REVIEW_FIELDS);

  const existing = await prisma.selectionApplication.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw notFound("Selection application not found");

  const data = {};
  if (Object.hasOwn(input, "adminNote")) {
    data.admin_note = nullableTrimmedString(input.adminNote, "adminNote", 4000);
  }
  if (Object.hasOwn(input, "status")) {
    const status = enumString(input.status, "status", STATUS_VALUES);
    data.status = status;
    data.reviewed_by = status === "reviewed" ? reviewer.id : null;
    data.reviewed_at = status === "reviewed" ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    throw badRequest("At least one review field must be provided");
  }

  const application = await prisma.selectionApplication.update({
    where: { id },
    data,
    include: SELECTION_APPLICATION_INCLUDE,
  });
  return toSelectionApplicationDto(application);
}

function normalizeSubmitInput(input, userId, clientDedupKey) {
  const phone = requiredString(input.phone, "phone", 32);
  if (!/^1\d{10}$/.test(phone)) {
    throw badRequest("phone must be a valid 11 digit mainland China mobile number");
  }

  const residents = requiredString(input.residents, "residents", 80);
  const residentsNeutered =
    residents === "yes" ? requiredString(input.residentsNeutered, "residentsNeutered", 80) : null;

  return {
    user_id: userId,
    client_dedup_key: clientDedupKey,
    contact_name: requiredString(input.name, "name", 120),
    contact_gender: requiredString(input.gender, "gender", 80),
    contact_phone: phone,
    contact_age: requiredString(input.age, "age", 40),
    contact_job: requiredString(input.job, "job", 120),
    contact_city: requiredString(input.city, "city", 120),
    cat_experience_json: {
      experience: requiredString(input.experience, "experience", 80),
    },
    existing_pets_json: {
      residents,
      residentsNeutered,
    },
    living_environment_json: {
      hasKids: requiredString(input.hasKids, "hasKids", 80),
      housing: requiredString(input.housing, "housing", 120),
      windowSealed: requiredString(input.windowSealed, "windowSealed", 120),
      familyAgree: requiredString(input.familyAgree, "familyAgree", 120),
    },
    maine_coon_knowledge: nullableTrimmedString(
      input.maineCoonKnowledge,
      "maineCoonKnowledge",
      2000,
    ),
    preferences_json: {
      wantGender: requiredString(input.wantGender, "wantGender", 80),
      wantColor: requiredString(input.wantColor, "wantColor", 240),
      budget: requiredString(input.budget, "budget", 120),
      monthlySpend: requiredString(input.monthlySpend, "monthlySpend", 80),
    },
    commitments_json: {
      acceptNeuter: requiredString(input.acceptNeuter, "acceptNeuter", 80),
      scientificFeeding: requiredString(input.scientificFeeding, "scientificFeeding", 80),
      acceptActive: requiredString(input.acceptActive, "acceptActive", 80),
      commitment: requiredString(input.commitment, "commitment", 80),
    },
    additional_note: nullableTrimmedString(input.additionalNote, "additionalNote", 4000),
  };
}

function toSelectionApplicationDto(application) {
  const catExperience = objectValue(application.cat_experience_json);
  const existingPets = objectValue(application.existing_pets_json);
  const livingEnvironment = objectValue(application.living_environment_json);
  const preferences = objectValue(application.preferences_json);
  const commitments = objectValue(application.commitments_json);

  return {
    id: application.id,
    userId: application.user_id,
    contactName: application.contact_name,
    contactGender: application.contact_gender,
    contactPhone: application.contact_phone,
    contactAge: application.contact_age,
    contactJob: application.contact_job,
    contactCity: application.contact_city,
    catExperience: {
      experience: stringValue(catExperience.experience),
    },
    existingPets: {
      residents: stringValue(existingPets.residents),
      residentsNeutered: nullableStringValue(existingPets.residentsNeutered),
    },
    livingEnvironment: {
      hasKids: stringValue(livingEnvironment.hasKids),
      housing: stringValue(livingEnvironment.housing),
      windowSealed: stringValue(livingEnvironment.windowSealed),
      familyAgree: stringValue(livingEnvironment.familyAgree),
    },
    maineCoonKnowledge: application.maine_coon_knowledge,
    preferences: {
      wantGender: stringValue(preferences.wantGender),
      wantColor: stringValue(preferences.wantColor),
      budget: stringValue(preferences.budget),
      monthlySpend: stringValue(preferences.monthlySpend),
    },
    commitments: {
      acceptNeuter: stringValue(commitments.acceptNeuter),
      scientificFeeding: stringValue(commitments.scientificFeeding),
      acceptActive: stringValue(commitments.acceptActive),
      commitment: stringValue(commitments.commitment),
    },
    additionalNote: application.additional_note,
    status: application.status,
    submittedAt: toIsoString(application.submitted_at),
    adminNote: application.admin_note,
    reviewedAt: toIsoString(application.reviewed_at),
    createdAt: toIsoString(application.created_at),
    updatedAt: toIsoString(application.updated_at),
    user: application.user ? toUserSummaryDto(application.user) : null,
    reviewedBy: application.reviewer ? toUserSummaryDto(application.reviewer) : null,
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

function requiredString(value, fieldName, maxLength) {
  if (typeof value !== "string" || value.trim() === "") {
    throw badRequest(`${fieldName} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw badRequest(`${fieldName} is too long`);
  }
  return normalized;
}

function nullableTrimmedString(value, fieldName, maxLength) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw badRequest(`${fieldName} is too long`);
  return normalized;
}

function enumString(value, fieldName, allowedValues) {
  const normalized = requiredString(value, fieldName, 80);
  if (!allowedValues.has(normalized)) {
    throw badRequest(`${fieldName} contains an unsupported value`);
  }
  return normalized;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function nullableStringValue(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function toUserSummaryDto(user) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatar_url,
    phone: user.phone,
  };
}

function toIsoString(value) {
  return value ? value.toISOString() : null;
}
