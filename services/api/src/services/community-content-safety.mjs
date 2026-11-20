import { createDecipheriv, createHash, timingSafeEqual } from "node:crypto";
import { config } from "../config/env.mjs";
import { prisma } from "../db/prisma.mjs";
import { badRequest, forbidden, serviceUnavailable } from "../utils/errors.mjs";
import { fetchWithTimeout } from "../utils/fetch.mjs";

const TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const TEXT_URL = "https://api.weixin.qq.com/wxa/msg_sec_check";
const MEDIA_URL = "https://api.weixin.qq.com/wxa/media_check_async";
let accessTokenCache = null;
let accessTokenPromise = null;

export async function checkCommunityText(content, user, scene, { fetcher = fetchWithTimeout } = {}) {
  if (!config.isProduction && config.wechat.mockLoginEnabled) return "pass";
  const payload = await callWechat(TEXT_URL, {
    content,
    openid: await requireWechatOpenId(user),
    scene,
    version: 2,
  }, fetcher);
  const suggestion = payload.result?.suggest;
  if (suggestion === "risky") throw badRequest("内容包含不适合发布的信息，请修改后重试");
  if (suggestion !== "pass" && suggestion !== "review") {
    throw serviceUnavailable("内容安全检测暂不可用，请稍后重试");
  }
  return suggestion;
}

export async function requestCommunityImageCheck(mediaUrl, user, { fetcher = fetchWithTimeout, scene = 3 } = {}) {
  if (!config.isProduction && config.wechat.mockLoginEnabled) return "development-mock";
  const payload = await callWechat(MEDIA_URL, {
    media_url: mediaUrl,
    media_type: 2,
    openid: await requireWechatOpenId(user),
    scene,
    version: 2,
  }, fetcher);
  if (typeof payload.trace_id !== "string" || !payload.trace_id) {
    throw serviceUnavailable("图片安全检测暂不可用，请稍后重试");
  }
  return payload.trace_id;
}

export function verifyWechatCallbackSignature(searchParams, messageToken = config.wechat.messageToken) {
  const signature = searchParams.get("signature") || "";
  const timestamp = searchParams.get("timestamp") || "";
  const nonce = searchParams.get("nonce") || "";
  if (!messageToken || !/^[a-f0-9]{40}$/i.test(signature) ||
      !/^\d{1,15}$/.test(timestamp) || !/^[A-Za-z0-9]{1,128}$/.test(nonce)) {
    throw forbidden("Invalid WeChat callback signature");
  }
  const expected = createHash("sha1")
    .update([messageToken, timestamp, nonce].sort().join(""))
    .digest("hex");
  if (!timingSafeEqual(Buffer.from(signature.toLowerCase()), Buffer.from(expected))) {
    throw forbidden("Invalid WeChat callback signature");
  }
}

export function decodeWechatSecureCallback(searchParams, body, {
  messageToken = config.wechat.messageToken,
  encodingAesKey = config.wechat.encodingAesKey,
  appId = config.wechat.appId,
  now = Date.now(),
} = {}) {
  const timestamp = searchParams.get("timestamp") || "";
  const nonce = searchParams.get("nonce") || "";
  const signature = searchParams.get("msg_signature") || "";
  const encrypted = body?.Encrypt;
  if (!messageToken || !appId || !/^[A-Za-z0-9+/]{43}$/.test(encodingAesKey || "") ||
      !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 600 ||
      !/^[A-Za-z0-9]{1,128}$/.test(nonce) || !/^[a-f0-9]{40}$/i.test(signature) ||
      typeof encrypted !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted)) {
    throw forbidden("Invalid WeChat secure callback");
  }
  const expected = createHash("sha1")
    .update([messageToken, timestamp, nonce, encrypted].sort().join(""))
    .digest("hex");
  if (!timingSafeEqual(Buffer.from(signature.toLowerCase()), Buffer.from(expected))) {
    throw forbidden("Invalid WeChat secure callback");
  }
  try {
    const key = Buffer.from(`${encodingAesKey}=`, "base64");
    const ciphertext = Buffer.from(encrypted, "base64");
    if (key.length !== 32 || ciphertext.length === 0 || ciphertext.length % 16 !== 0) throw new Error("shape");
    const decipher = createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
    decipher.setAutoPadding(false);
    const padded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const padding = padded.at(-1);
    if (!padding || padding > 32 || !padded.subarray(-padding).every((value) => value === padding)) {
      throw new Error("padding");
    }
    const plain = padded.subarray(0, -padding);
    if (plain.length < 20) throw new Error("length");
    const messageLength = plain.readUInt32BE(16);
    const appIdOffset = 20 + messageLength;
    if (messageLength === 0 || appIdOffset >= plain.length ||
        plain.subarray(appIdOffset).toString("utf8") !== appId) throw new Error("appid");
    const event = JSON.parse(plain.subarray(20, appIdOffset).toString("utf8"));
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("event");
    return event;
  } catch {
    throw forbidden("Invalid WeChat secure callback");
  }
}

async function requireWechatOpenId(user) {
  const openid = user?.wechat_openid ?? (user?.id
    ? (await prisma.user.findUnique({ where: { id: user.id }, select: { wechat_openid: true } }))?.wechat_openid
    : null);
  if (typeof openid !== "string" || !openid || openid.startsWith("mock_")) {
    throw serviceUnavailable("微信身份暂不可用于内容安全检测，请重新登录后重试");
  }
  return openid;
}

async function callWechat(endpoint, body, fetcher) {
  if (!config.wechat.appId || !config.wechat.appSecret) {
    throw serviceUnavailable("内容安全检测暂不可用，请稍后重试");
  }
  try {
    const timeout = config.wechat.upstreamTimeoutMs;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const accessToken = await getAccessToken(fetcher, timeout);
      const url = new URL(endpoint);
      url.searchParams.set("access_token", accessToken);
      const response = await fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }, timeout);
      const payload = await response.json();
      if (response.ok && payload.errcode === 0) return payload;
      if (attempt === 0 && [40001, 42001].includes(payload.errcode)) {
        accessTokenCache = null;
        continue;
      }
      throw new Error("check");
    }
  } catch {
    // Never expose access tokens, user content, or WeChat response details.
    throw serviceUnavailable("内容安全检测暂不可用，请稍后重试");
  }
}

async function getAccessToken(fetcher, timeout) {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) return accessTokenCache.value;
  if (!accessTokenPromise) {
    accessTokenPromise = (async () => {
      const tokenUrl = new URL(TOKEN_URL);
      tokenUrl.searchParams.set("grant_type", "client_credential");
      tokenUrl.searchParams.set("appid", config.wechat.appId);
      tokenUrl.searchParams.set("secret", config.wechat.appSecret);
      const response = await fetcher(tokenUrl, {}, timeout);
      const payload = await response.json();
      if (!response.ok || payload.errcode || !payload.access_token) throw new Error("token");
      accessTokenCache = {
        value: payload.access_token,
        expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 300) * 1000,
      };
      return accessTokenCache.value;
    })().finally(() => { accessTokenPromise = null; });
  }
  return accessTokenPromise;
}
