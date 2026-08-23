import { prisma } from "../db/prisma.mjs";
import { ensureActiveFixedPageExists } from "./fixed-page-service.mjs";
import { badRequest, notFound } from "../utils/errors.mjs";
import { buildPaginationMeta, parseBooleanParam, parsePagination } from "../utils/request.mjs";

const MEDIA_KIND_VALUES = new Set(["image", "video", "document", "audio"]);
const MEDIA_STATUS_VALUES = new Set(["pending", "active", "rejected", "archived"]);
const OWNER_TYPE_VALUES = new Set(["cat", "litter", "post", "parent_profile", "fixed_page"]);
const VISIBILITY_VALUES = new Set(["visible", "hidden", "archived"]);

const MEDIA_CREATE_FIELDS = [
  "kind",
  "sourceUrl",
  "thumbnailUrl",
  "title",
  "altText",
  "mimeType",
  "sizeBytes",
  "width",
  "height",
  "durationSeconds",
  "checksum",
  "status",
  "metadataJson",
  "ownerType",
  "ownerId",
  "usage",
  "sortOrder",
  "bindingVisibility",
];
const MEDIA_UPDATE_FIELDS = MEDIA_CREATE_FIELDS.filter(
  (field) => !["ownerType", "ownerId", "usage", "sortOrder", "bindingVisibility"].includes(field),
);
const BINDING_CREATE_FIELDS = ["ownerType", "ownerId", "usage", "sortOrder", "visibility"];
const BINDING_UPDATE_FIELDS = ["usage", "sortOrder", "visibility"];

const MEDIA_INCLUDE = {
  bindings: {
    where: { deleted_at: null },
    orderBy: [{ sort_order: "asc" }, { created_at: "desc" }, { id: "asc" }],
  },
};

export async function listMedia(searchParams) {
  const { page, pageSize, skip, take } = parsePagination(searchParams);
  const where = buildMediaWhere(searchParams);

  const [items, total] = await prisma.$transaction([
    prisma.mediaAsset.findMany({
      where,
      include: MEDIA_INCLUDE,
      orderBy: [{ created_at: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  return {
    items: items.map(toMediaDto),
    pagination: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getMedia(id) {
  const media = await prisma.mediaAsset.findFirst({
    where: {
      id,
      deleted_at: null,
    },
    include: MEDIA_INCLUDE,
  });

  if (!media) throw notFound("Media asset not found");
  return toMediaDto(media);
}

export async function createMedia(input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, MEDIA_CREATE_FIELDS);

  const mediaData = normalizeMediaInput(input, {
    mode: "create",
    allowedFields: MEDIA_CREATE_FIELDS,
  });
  const bindingData = normalizeOptionalInitialBinding(input);

  const media = await prisma.$transaction(async (transaction) => {
    const created = await transaction.mediaAsset.create({ data: mediaData });

    if (bindingData) {
      await ensureOwnerExists(bindingData.owner_type, bindingData.owner_id, transaction);
      await transaction.mediaBinding.create({
        data: {
          media_id: created.id,
          ...bindingData,
        },
      });
    }

    return transaction.mediaAsset.findUnique({
      where: { id: created.id },
      include: MEDIA_INCLUDE,
    });
  });

  return toMediaDto(media);
}

export async function updateMedia(id, input) {
  assertPlainObject(input);
  const existing = await prisma.mediaAsset.findFirst({
    where: {
      id,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!existing) throw notFound("Media asset not found");

  const data = normalizeMediaInput(input, {
    mode: "update",
    allowedFields: MEDIA_UPDATE_FIELDS,
  });

  if (Object.keys(data).length === 0) {
    throw badRequest("At least one media field must be provided");
  }

  const media = await prisma.mediaAsset.update({
    where: { id },
    data,
    include: MEDIA_INCLUDE,
  });

  return toMediaDto(media);
}

export async function deleteMedia(id) {
  const existing = await prisma.mediaAsset.findFirst({
    where: {
      id,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!existing) throw notFound("Media asset not found");

  const media = await prisma.$transaction(async (transaction) => {
    const now = new Date();
    await transaction.mediaBinding.updateMany({
      where: {
        media_id: id,
        deleted_at: null,
      },
      data: {
        deleted_at: now,
        visibility: "archived",
      },
    });

    return transaction.mediaAsset.update({
      where: { id },
      data: {
        deleted_at: now,
        status: "archived",
      },
      include: MEDIA_INCLUDE,
    });
  });

  return toMediaDto(media);
}

export async function listMediaBindings(mediaId) {
  await ensureActiveMediaExists(mediaId);
  const bindings = await prisma.mediaBinding.findMany({
    where: {
      media_id: mediaId,
      deleted_at: null,
    },
    orderBy: [{ sort_order: "asc" }, { created_at: "desc" }, { id: "asc" }],
  });

  return bindings.map(toMediaBindingDto);
}

export async function createMediaBinding(mediaId, input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, BINDING_CREATE_FIELDS);
  await ensureActiveMediaExists(mediaId);

  const data = normalizeBindingInput(input, {
    mode: "create",
    allowedFields: BINDING_CREATE_FIELDS,
  });
  await ensureOwnerExists(data.owner_type, data.owner_id);

  const binding = await prisma.mediaBinding.create({
    data: {
      media_id: mediaId,
      ...data,
    },
  });

  return toMediaBindingDto(binding);
}

export async function updateMediaBinding(mediaId, bindingId, input) {
  assertPlainObject(input);
  assertNoUnknownFields(input, BINDING_UPDATE_FIELDS);

  const existing = await prisma.mediaBinding.findFirst({
    where: {
      id: bindingId,
      media_id: mediaId,
      deleted_at: null,
    },
  });

  if (!existing) throw notFound("Media binding not found");

  const data = normalizeBindingInput(input, {
    mode: "update",
    allowedFields: BINDING_UPDATE_FIELDS,
  });

  if (Object.keys(data).length === 0) {
    throw badRequest("At least one media binding field must be provided");
  }

  const binding = await prisma.mediaBinding.update({
    where: { id: bindingId },
    data,
  });

  return toMediaBindingDto(binding);
}

export async function deleteMediaBinding(mediaId, bindingId) {
  const existing = await prisma.mediaBinding.findFirst({
    where: {
      id: bindingId,
      media_id: mediaId,
      deleted_at: null,
    },
  });

  if (!existing) throw notFound("Media binding not found");

  const binding = await prisma.mediaBinding.update({
    where: { id: bindingId },
    data: {
      deleted_at: new Date(),
      visibility: "archived",
    },
  });

  return toMediaBindingDto(binding);
}

function buildMediaWhere(searchParams) {
  const includeDeleted = parseBooleanParam(searchParams.get("includeDeleted"));
  const query = searchParams.get("q");
  const kind = searchParams.get("kind");
  const status = searchParams.get("status");
  const ownerType = searchParams.get("ownerType");
  const ownerId = searchParams.get("ownerId");

  const where = {};
  if (!includeDeleted) where.deleted_at = null;
  if (kind) where.kind = kind;
  if (status) where.status = status;
  if (ownerType || ownerId) {
    where.bindings = {
      some: {
        deleted_at: null,
        ...(ownerType ? { owner_type: ownerType } : {}),
        ...(ownerId ? { owner_id: ownerId } : {}),
      },
    };
  }
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { alt_text: { contains: query } },
      { source_url: { contains: query } },
      { checksum: { contains: query } },
    ];
  }

  return where;
}

function normalizeMediaInput(input, { mode, allowedFields }) {
  assertNoUnknownFields(input, allowedFields);
  const data = {};

  if (mode === "create" || Object.hasOwn(input, "sourceUrl")) {
    data.source_url = requiredString(input.sourceUrl, "sourceUrl");
  }

  if (Object.hasOwn(input, "kind")) {
    data.kind = enumString(input.kind, "kind", MEDIA_KIND_VALUES);
  } else if (mode === "create") {
    data.kind = "image";
  }

  if (Object.hasOwn(input, "status")) {
    data.status = enumString(input.status, "status", MEDIA_STATUS_VALUES);
  } else if (mode === "create") {
    data.status = "active";
  }

  assignNullableString(data, "thumbnail_url", input, "thumbnailUrl");
  assignNullableString(data, "title", input, "title");
  assignNullableString(data, "alt_text", input, "altText");
  assignNullableString(data, "mime_type", input, "mimeType");
  assignNullableString(data, "checksum", input, "checksum");
  assignOptionalInteger(data, "size_bytes", input, "sizeBytes");
  assignOptionalInteger(data, "width", input, "width");
  assignOptionalInteger(data, "height", input, "height");
  assignOptionalInteger(data, "duration_seconds", input, "durationSeconds");

  if (Object.hasOwn(input, "metadataJson")) {
    data.metadata_json = input.metadataJson ?? null;
  }

  return data;
}

function normalizeOptionalInitialBinding(input) {
  const hasOwnerType = Object.hasOwn(input, "ownerType");
  const hasOwnerId = Object.hasOwn(input, "ownerId");
  const hasBindingFields =
    hasOwnerType ||
    hasOwnerId ||
    Object.hasOwn(input, "usage") ||
    Object.hasOwn(input, "sortOrder") ||
    Object.hasOwn(input, "bindingVisibility");

  if (!hasBindingFields) return null;
  if (!hasOwnerType || !hasOwnerId) {
    throw badRequest("ownerType and ownerId are required when creating a media binding");
  }

  return {
    owner_type: enumString(input.ownerType, "ownerType", OWNER_TYPE_VALUES),
    owner_id: requiredString(input.ownerId, "ownerId"),
    usage: optionalString(input.usage, "usage") ?? "gallery",
    sort_order: optionalInteger(input.sortOrder, "sortOrder") ?? 0,
    visibility: Object.hasOwn(input, "bindingVisibility")
      ? enumString(input.bindingVisibility, "bindingVisibility", VISIBILITY_VALUES)
      : "visible",
  };
}

function normalizeBindingInput(input, { mode, allowedFields }) {
  assertNoUnknownFields(input, allowedFields);
  const data = {};

  if (mode === "create" || Object.hasOwn(input, "ownerType")) {
    data.owner_type = enumString(input.ownerType, "ownerType", OWNER_TYPE_VALUES);
  }
  if (mode === "create" || Object.hasOwn(input, "ownerId")) {
    data.owner_id = requiredString(input.ownerId, "ownerId");
  }
  if (Object.hasOwn(input, "usage")) {
    data.usage = optionalString(input.usage, "usage") ?? "gallery";
  } else if (mode === "create") {
    data.usage = "gallery";
  }
  if (Object.hasOwn(input, "sortOrder")) {
    data.sort_order = optionalInteger(input.sortOrder, "sortOrder") ?? 0;
  } else if (mode === "create") {
    data.sort_order = 0;
  }
  if (Object.hasOwn(input, "visibility")) {
    data.visibility = enumString(input.visibility, "visibility", VISIBILITY_VALUES);
  } else if (mode === "create") {
    data.visibility = "visible";
  }

  return data;
}

async function ensureActiveMediaExists(mediaId) {
  const media = await prisma.mediaAsset.findFirst({
    where: {
      id: mediaId,
      deleted_at: null,
    },
    select: { id: true },
  });

  if (!media) throw notFound("Media asset not found");
}

async function ensureOwnerExists(ownerType, ownerId, client = prisma) {
  const owner = await findOwner(ownerType, ownerId, client);
  if (!owner) throw notFound("Media owner not found");
}

async function findOwner(ownerType, ownerId, client) {
  switch (ownerType) {
    case "cat":
      return client.cat.findFirst({
        where: {
          id: ownerId,
          deleted_at: null,
        },
        select: { id: true },
      });
    case "litter":
      return client.litter.findFirst({
        where: {
          id: ownerId,
          deleted_at: null,
        },
        select: { id: true },
      });
    case "post":
      return client.post.findFirst({
        where: {
          id: ownerId,
          deleted_at: null,
        },
        select: { id: true },
      });
    case "parent_profile":
      return client.parentProfile.findFirst({
        where: {
          id: ownerId,
          status: { not: "archived" },
        },
        select: { id: true },
      });
    case "fixed_page":
      await ensureActiveFixedPageExists(ownerId, client);
      return { id: ownerId };
    default:
      throw badRequest("ownerType must be cat, litter, post, parent_profile, or fixed_page");
  }
}

function toMediaDto(media) {
  return {
    id: media.id,
    kind: media.kind,
    sourceUrl: media.source_url,
    thumbnailUrl: media.thumbnail_url,
    title: media.title,
    altText: media.alt_text,
    mimeType: media.mime_type,
    sizeBytes: media.size_bytes,
    width: media.width,
    height: media.height,
    durationSeconds: media.duration_seconds,
    checksum: media.checksum,
    status: media.status,
    metadataJson: media.metadata_json,
    createdAt: toIsoString(media.created_at),
    updatedAt: toIsoString(media.updated_at),
    deletedAt: toIsoString(media.deleted_at),
    bindings: media.bindings ? media.bindings.map(toMediaBindingDto) : [],
  };
}

function toMediaBindingDto(binding) {
  return {
    id: binding.id,
    mediaId: binding.media_id,
    ownerType: binding.owner_type,
    ownerId: binding.owner_id,
    usage: binding.usage,
    sortOrder: binding.sort_order,
    visibility: binding.visibility,
    createdAt: toIsoString(binding.created_at),
    updatedAt: toIsoString(binding.updated_at),
    deletedAt: toIsoString(binding.deleted_at),
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

function optionalString(value, fieldName) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") throw badRequest(`${fieldName} must be a string`);
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

function optionalInteger(value, fieldName) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw badRequest(`${fieldName} must be a non-negative integer`);
  }
  return parsed;
}

function assignNullableString(data, dataField, input, inputField) {
  if (Object.hasOwn(input, inputField)) {
    data[dataField] = nullableString(input[inputField], inputField);
  }
}

function assignOptionalInteger(data, dataField, input, inputField) {
  if (Object.hasOwn(input, inputField)) {
    data[dataField] = optionalInteger(input[inputField], inputField) ?? null;
  }
}

function toIsoString(value) {
  return value ? value.toISOString() : null;
}
