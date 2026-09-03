import { fetchWithTimeout, isFetchTimeoutError } from "../utils/fetch.mjs";

const WECHAT_ACCESS_TOKEN_URL = "https://api.weixin.qq.com/cgi-bin/token";
const WECHAT_UNLIMITED_CODE_URL = "https://api.weixin.qq.com/wxa/getwxacodeunlimit";
export const MINI_PROGRAM_CODE_SCENE_LIMIT = 32;

export async function createMiniProgramCode({ scene, page, config }) {
  if (scene.length > MINI_PROGRAM_CODE_SCENE_LIMIT) {
    return {
      provider: "unavailable",
      status: "unavailable",
      page,
      scene,
      imageDataUrl: null,
      message: "QR scene is longer than the WeChat mini program limit",
    };
  }

  if (config?.wechat?.appId && config?.wechat?.appSecret) {
    try {
      return await createWechatMiniProgramCode({ scene, page, config });
    } catch (error) {
      return {
        provider: "wechat",
        status: "unavailable",
        page,
        scene,
        imageDataUrl: null,
        message: error instanceof Error ? error.message : "WeChat QR generation failed",
      };
    }
  }

  if (config?.wechat?.mockQrEnabled ?? config?.isDevelopment ?? true) {
    return {
      provider: "dev-mock",
      status: "mock",
      page,
      scene,
      imageDataUrl: createDevMockQrDataUrl(scene),
      message:
        "Dev mock only: configure WECHAT_APP_ID and WECHAT_APP_SECRET for a real mini program code",
    };
  }

  return {
    provider: "unavailable",
    status: "unavailable",
    page,
    scene,
    imageDataUrl: null,
    message: "WeChat mini program credentials are not configured",
  };
}

async function createWechatMiniProgramCode({ scene, page, config }) {
  const tokenUrl = new URL(WECHAT_ACCESS_TOKEN_URL);
  tokenUrl.searchParams.set("grant_type", "client_credential");
  tokenUrl.searchParams.set("appid", config.wechat.appId);
  tokenUrl.searchParams.set("secret", config.wechat.appSecret);

  const tokenResponse = await fetchWechat(tokenUrl, undefined, config, {
    timeout: "WeChat access token request timed out",
    failure: "WeChat access token request failed",
  });
  if (!tokenResponse.ok) throw new Error("WeChat access token request failed");
  const tokenPayload = await tokenResponse.json();
  if (tokenPayload.errcode || typeof tokenPayload.access_token !== "string") {
    throw new Error(tokenPayload.errmsg || "WeChat access token was not issued");
  }

  const codeUrl = new URL(WECHAT_UNLIMITED_CODE_URL);
  codeUrl.searchParams.set("access_token", tokenPayload.access_token);
  const codeResponse = await fetchWechat(
    codeUrl,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scene,
        page,
        check_path: config.wechat.qrCheckPath,
        env_version: config.wechat.qrEnvVersion,
      }),
    },
    config,
    {
      timeout: "WeChat mini program code request timed out",
      failure: "WeChat mini program code request failed",
    },
  );
  if (!codeResponse.ok) throw new Error("WeChat mini program code request failed");

  const contentType = codeResponse.headers.get("content-type") || "";
  const arrayBuffer = await codeResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (contentType.includes("application/json")) {
    const payload = JSON.parse(buffer.toString("utf8"));
    throw new Error(payload.errmsg || "WeChat mini program code was not generated");
  }

  return {
    provider: "wechat",
    status: "ready",
    page,
    scene,
    imageDataUrl: `data:${contentType || "image/png"};base64,${buffer.toString("base64")}`,
    message: "WeChat mini program code generated",
  };
}

async function fetchWechat(url, init, config, messages) {
  try {
    return await fetchWithTimeout(url, init, config?.wechat?.upstreamTimeoutMs);
  } catch (error) {
    throw new Error(isFetchTimeoutError(error) ? messages.timeout : messages.failure);
  }
}

function createDevMockQrDataUrl(scene) {
  const escapedScene = escapeSvgText(scene);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260"><rect width="260" height="260" fill="#fff"/><rect x="14" y="14" width="232" height="232" fill="none" stroke="#111827" stroke-width="4"/><rect x="36" y="36" width="54" height="54" fill="#111827"/><rect x="170" y="36" width="54" height="54" fill="#111827"/><rect x="36" y="170" width="54" height="54" fill="#111827"/><path d="M118 52h20v20h-20zm38 0h10v10h-10zm-38 38h10v10h-10zm30 12h58v18h-58zm-34 34h20v20h-20zm42 0h14v14h-14zm32 0h20v38h-20zm-72 36h54v18h-54zm82 30h24v20h-24z" fill="#111827"/><text x="130" y="126" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#b91c1c">DEV MOCK</text><text x="130" y="148" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#374151">Not a real WeChat code</text><text x="130" y="242" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#374151">${escapedScene}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
