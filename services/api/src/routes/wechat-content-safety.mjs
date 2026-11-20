import { applyCommunityImageCheckResult } from "../services/community-service.mjs";
import { decodeWechatSecureCallback, verifyWechatCallbackSignature } from "../services/community-content-safety.mjs";
import { config } from "../config/env.mjs";
import { badRequest, methodNotAllowed, serviceUnavailable } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";

export async function routeWechatContentSafety(request, response, url) {
  if (request.method === "GET") {
    verifyWechatCallbackSignature(url.searchParams);
    const challenge = url.searchParams.get("echostr");
    if (!challenge || challenge.length > 512) throw badRequest("Invalid challenge");
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end(challenge);
    return;
  }
  if (request.method !== "POST") throw methodNotAllowed();
  const body = await readJsonBody(request);
  const event = decodeWechatSecureCallback(url.searchParams, body);
  const recognized = await applyCommunityImageCheckResult(event);
  if (!recognized && !(await forwardToIsolatedTrial(url.searchParams, body))) {
    throw serviceUnavailable("Media check result is not ready to apply");
  }
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  response.end("success");
}

async function forwardToIsolatedTrial(searchParams, body) {
  if (!config.wechat.trialCallbackUrl) return false;
  const target = new URL(config.wechat.trialCallbackUrl);
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" ||
      target.port !== "8081" || target.pathname !== "/webhooks/wechat/content-safety" ||
      target.search || target.hash) throw serviceUnavailable("Trial callback route is invalid");
  target.search = searchParams.toString();
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
    return response.ok && (await response.text()) === "success";
  } catch {
    return false;
  }
}
