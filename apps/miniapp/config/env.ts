type MiniProgramEnvVersion = "develop" | "trial" | "release";

export const MINIAPP_PRODUCTION_API_BASE_URL = "https://api.starlitskycattery.top";
export const MINIAPP_DEVELOP_API_BASE_URL = "http://127.0.0.1:4310";
export const MINIAPP_TRIAL_API_BASE_URL = "https://trial-api.starlitskycattery.top";
export const MINIAPP_PRODUCTION_API_HOST = "api.starlitskycattery.top";
export const MINIAPP_PRODUCTION_COS_HOST =
  "starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com";
export const MINIAPP_MEDIA_COS_HOST =
  "starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com";

export const MINIAPP_WECHAT_LEGAL_DOMAINS = {
  request: [
    MINIAPP_PRODUCTION_API_HOST,
    "trial-api.starlitskycattery.top",
    MINIAPP_PRODUCTION_COS_HOST,
    MINIAPP_MEDIA_COS_HOST,
  ],
  uploadFile: [],
  downloadFile: [
    "trial-api.starlitskycattery.top",
    MINIAPP_PRODUCTION_COS_HOST,
    MINIAPP_MEDIA_COS_HOST,
  ],
  socket: [],
} as const;

const API_BASE_URLS: Record<MiniProgramEnvVersion, string> = {
  develop: MINIAPP_DEVELOP_API_BASE_URL,
  trial: MINIAPP_TRIAL_API_BASE_URL,
  release: MINIAPP_PRODUCTION_API_BASE_URL,
};

export function getApiBaseUrl() {
  const envVersion = getMiniProgramEnvVersion();
  // WeChat may run a submitted review package as "develop" on a real device.
  // Loopback is only reachable from the local Developer Tools simulator.
  const apiBaseUrl = (
    envVersion === "develop" && !isLocalMiniProgramDevelopment()
      ? MINIAPP_PRODUCTION_API_BASE_URL
      : API_BASE_URLS[envVersion]
  ).trim();
  if (apiBaseUrl) return apiBaseUrl;
  throw new Error(`Miniapp API base URL is not configured for ${envVersion}`);
}

export function isLocalMiniProgramDevelopment() {
  if (getMiniProgramEnvVersion() !== "develop") return false;
  try {
    if (wx.getDeviceInfo?.().platform === "devtools") return true;
  } catch {
    /* Fall back to the older synchronous API. */
  }
  try {
    return wx.getSystemInfoSync?.().platform === "devtools";
  } catch {
    return false;
  }
}

export function getMiniProgramEnvVersion(): MiniProgramEnvVersion {
  try {
    const envVersion = wx.getAccountInfoSync?.().miniProgram.envVersion;
    if (envVersion === "trial" || envVersion === "release") return envVersion;
  } catch {
    return "develop";
  }
  return "develop";
}
