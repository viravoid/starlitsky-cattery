import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.mjs";
import { badRequest, serviceUnavailable, tooManyRequests } from "../utils/errors.mjs";
import { fetchWithTimeout } from "../utils/fetch.mjs";
import { logger } from "../utils/logger.mjs";
import { limitParentRequest } from "./parent-request-limit.mjs";

const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const PHONE_URL = "https://api.weixin.qq.com/wxa/business/getuserphonenumber";
const PROOF_TTL_MS = 10 * 60 * 1000;

const hash = (prefix, value) => createHash("sha256").update(`${prefix}:${value}`).digest("hex");

export async function verifyParentPhoneCode(
  input,
  user,
  config,
  { fetcher = fetchWithTimeout } = {},
) {
  limitParentRequest("phone", user.id, { max: 5, windowMs: 60 * 60 * 1000 });
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => key !== "code") ||
    typeof input.code !== "string" ||
    !/^[\x21-\x7e]{8,512}$/.test(input.code)
  ) {
    throw badRequest("A valid WeChat phone code is required");
  }
  const since = new Date(Date.now() - 60 * 60 * 1000);
  if (
    (await prisma.parentPhoneVerification.count({
      where: { user_id: user.id, created_at: { gte: since } },
    })) >= 5
  ) {
    throw tooManyRequests("Too many phone verification attempts; use manual contact or try later");
  }

  // Reserve the code before calling WeChat. The database unique key prevents concurrent replay.
  let record;
  try {
    record = await prisma.parentPhoneVerification.create({
      data: {
        user_id: user.id,
        code_hash: hash("parent-phone-code", input.code),
        expires_at: new Date(Date.now() + PROOF_TTL_MS),
      },
    });
  } catch (error) {
    if (error?.code === "P2002") throw badRequest("WeChat phone code has already been used");
    throw error;
  }

  if (!config?.wechat?.appId || !config?.wechat?.appSecret) {
    throw serviceUnavailable("WeChat phone verification is unavailable; enter contact manually");
  }

  try {
    const tokenUrl = new URL(TOKEN_URL);
    tokenUrl.searchParams.set("grant_type", "client_credential");
    tokenUrl.searchParams.set("appid", config.wechat.appId);
    tokenUrl.searchParams.set("secret", config.wechat.appSecret);
    const timeout = config.wechat.upstreamTimeoutMs || 5000;
    const tokenResponse = await fetcher(tokenUrl, {}, timeout);
    if (!tokenResponse.ok) throw new Error("token unavailable");
    const tokenPayload = await tokenResponse.json();
    if (tokenPayload.errcode || typeof tokenPayload.access_token !== "string")
      throw new Error("token unavailable");
    const phoneUrl = new URL(PHONE_URL);
    phoneUrl.searchParams.set("access_token", tokenPayload.access_token);
    const phoneResponse = await fetcher(
      phoneUrl,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: input.code }),
      },
      timeout,
    );
    if (!phoneResponse.ok) throw new Error("phone unavailable");
    const payload = await phoneResponse.json();
    if (payload.errcode || typeof payload.phone_info?.phoneNumber !== "string") {
      throw new Error("phone unavailable");
    }
    const phone = payload.phone_info.phoneNumber;
    if (!/^\+?[0-9]{7,20}$/.test(phone)) throw new Error("invalid phone response");
    const verificationToken = randomBytes(32).toString("base64url");
    const verifiedAt = new Date();
    await prisma.parentPhoneVerification.update({
      where: { id: record.id },
      data: {
        token_hash: hash("parent-phone-proof", verificationToken),
        phone,
        verified_at: verifiedAt,
      },
    });
    return { phone, verificationToken, expiresAt: record.expires_at.toISOString() };
  } catch {
    // Never forward upstream errors: they may contain the access token or phone code.
    throw serviceUnavailable("WeChat phone verification failed; enter contact manually");
  }
}

export async function consumeParentPhoneVerification(transaction, userId, token) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,80}$/.test(token)) {
    throw badRequest("Phone verification has expired; verify again or enter contact manually");
  }
  const now = new Date();
  const tokenHash = hash("parent-phone-proof", token);
  const proof = await transaction.parentPhoneVerification.findUnique({
    where: { token_hash: tokenHash },
    select: { user_id: true, phone: true, verified_at: true },
  });
  const claimed = await transaction.parentPhoneVerification.updateMany({
    where: {
      token_hash: tokenHash,
      user_id: userId,
      consumed_at: null,
      expires_at: { gt: now },
      verified_at: { not: null },
      phone: { not: null },
    },
    data: { consumed_at: now, phone: null },
  });
  if (claimed.count !== 1) throw badRequest("Phone verification has expired or was already used");
  if (proof?.user_id !== userId || !proof.phone || !proof.verified_at) {
    throw badRequest("Phone verification has expired or was already used");
  }
  return { phone: proof.phone, verifiedAt: proof.verified_at };
}

export function startParentPhoneVerificationCleanup() {
  const cleanup = () =>
    prisma.parentPhoneVerification
      .deleteMany({
        where: { expires_at: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
      })
      .catch(() => logger.error("Parent phone proof cleanup failed"));
  void cleanup();
  const timer = setInterval(cleanup, 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
