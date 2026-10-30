import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.mjs";
import { badRequest, unauthorized } from "../utils/errors.mjs";
import { createPresignedPutUpload, putObject } from "./object-storage-service.mjs";
import { toCurrentUserDto } from "./auth-service.mjs";

const PROFILE_FIELDS = new Set(["nickname", "gender", "city", "contactWechat"]);
const MAX_AVATAR_BYTES = 700_000;

export async function updateMyProfile(userId, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Profile is required");
  if (Object.keys(input).some((field) => !PROFILE_FIELDS.has(field))) throw badRequest("Unsupported profile field");
  const nickname = requiredText(input.nickname, "nickname", 40);
  const gender = optionalText(input.gender, "gender", 20);
  if (gender && !["male", "female"].includes(gender)) throw badRequest("Invalid gender");
  const city = optionalText(input.city, "city", 120);
  const contactWechat = optionalText(input.contactWechat, "contactWechat", 120);

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) throw unauthorized();
    await transaction.parentProfile.updateMany({
      where: { user_id: userId },
      data: { display_name: nickname, gender, city, contact_wechat: contactWechat },
    });
    const user = await transaction.user.update({
      where: { id: userId },
      data: { nickname, gender, city, contact_wechat: contactWechat },
      include: { roles: true, parent_profile: true },
    });
    return toCurrentUserDto(user);
  });
}

export async function uploadMyAvatar(userId, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Avatar is required");
  if (Object.keys(input).some((field) => !["mimeType", "dataBase64"].includes(field))) {
    throw badRequest("Unsupported avatar field");
  }
  if (typeof input.dataBase64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.dataBase64)) {
    throw badRequest("Invalid avatar data");
  }
  const body = Buffer.from(input.dataBase64, "base64");
  if (body.length === 0 || body.length > MAX_AVATAR_BYTES) throw badRequest("Avatar must be at most 700 KB");
  const mimeType = detectImageType(body);
  if (!mimeType || mimeType !== input.mimeType) throw badRequest("Avatar must be a JPEG or PNG image");
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!existing) throw unauthorized();

  const upload = createPresignedPutUpload({ objectKey: `avatars/${userId}/${randomUUID()}.${mimeType === "image/png" ? "png" : "jpg"}`, mimeType });
  await putObject({ objectKey: upload.objectKey, body, contentType: mimeType, forbidOverwrite: true });
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar_url: upload.publicUrl },
    include: { roles: true, parent_profile: true },
  });
  return toCurrentUserDto(user);
}

function detectImageType(body) {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  return null;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw badRequest(`${field} must be 1-${maxLength} characters`);
  }
  return value.trim();
}

function optionalText(value, field, maxLength) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maxLength) throw badRequest(`Invalid ${field}`);
  return value.trim() || null;
}
