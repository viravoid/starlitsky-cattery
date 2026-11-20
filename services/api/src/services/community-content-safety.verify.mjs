import assert from "node:assert/strict";
import { createHash } from "node:crypto";

process.env.WECHAT_MOCK_LOGIN_ENABLED = "false";
process.env.WECHAT_APP_ID = "verify-content-safety-app";
process.env.WECHAT_APP_SECRET = "verify-content-safety-secret";
const { checkCommunityText, requestCommunityImageCheck, verifyWechatCallbackSignature } =
  await import("./community-content-safety.mjs");

const user = { wechat_openid: "verify-real-format-openid" };
const calls = [];
const fetcher = async (url, options = {}) => {
  if (url.pathname === "/cgi-bin/token") {
    return Response.json({ access_token: "verify-token", expires_in: 7200 });
  }
  calls.push({ pathname: url.pathname, body: JSON.parse(options.body) });
  return Response.json(url.pathname.includes("msg_sec_check")
    ? { errcode: 0, result: { suggest: "pass" } }
    : { errcode: 0, trace_id: "verify-trace" });
};

assert.equal(await checkCommunityText("hello", user, 3, { fetcher }), "pass");
assert.deepEqual(calls[0], {
  pathname: "/wxa/msg_sec_check",
  body: { content: "hello", openid: user.wechat_openid, scene: 3, version: 2 },
});
assert.equal(await requestCommunityImageCheck("https://example.test/image.jpg", user, { fetcher }), "verify-trace");
assert.deepEqual(calls[1], {
  pathname: "/wxa/media_check_async",
  body: { media_url: "https://example.test/image.jpg", media_type: 2, openid: user.wechat_openid, scene: 3, version: 2 },
});

const riskyFetcher = async (url) => url.pathname === "/cgi-bin/token"
  ? Response.json({ access_token: "verify-token" })
  : Response.json({ errcode: 0, result: { suggest: "risky" } });
await assert.rejects(checkCommunityText("bad", user, 2, { fetcher: riskyFetcher }), { statusCode: 400 });
const failedFetcher = async () => Response.json({ errcode: 40001, errmsg: "invalid credential" });
await assert.rejects(checkCommunityText("hello", user, 2, { fetcher: failedFetcher }), { statusCode: 503 });
await assert.rejects(requestCommunityImageCheck("https://example.test/image.jpg", user, { fetcher: failedFetcher }), { statusCode: 503 });
await assert.rejects(checkCommunityText("hello", {}, 2, { fetcher }), { statusCode: 503 });

const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = "verifyNonce";
const token = "verify-message-token";
const signature = createHash("sha1").update([token, timestamp, nonce].sort().join("")).digest("hex");
verifyWechatCallbackSignature(new URLSearchParams({ signature, timestamp, nonce }), token);
assert.throws(() => verifyWechatCallbackSignature(
  new URLSearchParams({ signature: "0".repeat(40), timestamp, nonce }), token,
), { statusCode: 403 });
console.info("community content safety verification passed");
