type MiniProgramEnvVersion = "develop" | "trial" | "release";

export const MINIAPP_PRODUCTION_API_BASE_URL = "https://api.starlitskycattery.top";
export const MINIAPP_PRODUCTION_API_HOST = "api.starlitskycattery.top";
export const MINIAPP_PRODUCTION_COS_HOST =
  "starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com";
export const MINIAPP_LOCAL_API_BASE_URL_STORAGE_KEY = "starlitsky:miniapp:localApiBaseUrl";

export const MINIAPP_WECHAT_LEGAL_DOMAINS = {
  request: [MINIAPP_PRODUCTION_API_HOST, MINIAPP_PRODUCTION_COS_HOST],
  uploadFile: [],
  downloadFile: [MINIAPP_PRODUCTION_COS_HOST],
  socket: [],
} as const;

const API_BASE_URLS: Record<MiniProgramEnvVersion, string> = {
  develop: MINIAPP_PRODUCTION_API_BASE_URL,
  trial: MINIAPP_PRODUCTION_API_BASE_URL,
  release: MINIAPP_PRODUCTION_API_BASE_URL,
};

export function getApiBaseUrl() {
  const envVersion = getMiniProgramEnvVersion();
  const localApiBaseUrl = getExplicitLocalApiBaseUrl(envVersion);
  if (localApiBaseUrl) return localApiBaseUrl;

  const apiBaseUrl = API_BASE_URLS[envVersion].trim();
  if (apiBaseUrl) return apiBaseUrl;
  throw new Error(`Miniapp API base URL is not configured for ${envVersion}`);
}

function getExplicitLocalApiBaseUrl(envVersion: MiniProgramEnvVersion) {
  if (envVersion !== "develop") return "";

  try {
    const value = wx.getStorageSync(MINIAPP_LOCAL_API_BASE_URL_STORAGE_KEY);
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

function getMiniProgramEnvVersion(): MiniProgramEnvVersion {
  try {
    const envVersion = wx.getAccountInfoSync?.().miniProgram.envVersion;
    if (envVersion === "trial" || envVersion === "release") return envVersion;
  } catch {
    return "develop";
  }
  return "develop";
}
