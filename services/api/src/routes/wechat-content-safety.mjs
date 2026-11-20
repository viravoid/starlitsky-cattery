import { applyCommunityImageCheckResult } from "../services/community-service.mjs";
import { verifyWechatCallbackSignature } from "../services/community-content-safety.mjs";
import { badRequest, methodNotAllowed, serviceUnavailable } from "../utils/errors.mjs";
import { readJsonBody } from "../utils/request.mjs";

export async function routeWechatContentSafety(request, response, url) {
  verifyWechatCallbackSignature(url.searchParams);
  if (request.method === "GET") {
    const challenge = url.searchParams.get("echostr");
    if (!challenge || challenge.length > 512) throw badRequest("Invalid challenge");
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end(challenge);
    return;
  }
  if (request.method !== "POST") throw methodNotAllowed();
  const event = await readJsonBody(request);
  const recognized = await applyCommunityImageCheckResult(event);
  if (!recognized) throw serviceUnavailable("Media check result is not ready to apply");
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  response.end("success");
}
