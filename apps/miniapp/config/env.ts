type MiniProgramEnvVersion = "develop" | "trial" | "release";

const API_BASE_URLS: Record<MiniProgramEnvVersion, string> = {
  develop: "http://127.0.0.1:4310",
  trial: "",
  release: "",
};

export function getApiBaseUrl() {
  const envVersion = getMiniProgramEnvVersion();
  const apiBaseUrl = API_BASE_URLS[envVersion].trim();
  if (apiBaseUrl) return apiBaseUrl;
  throw new Error(`Miniapp API base URL is not configured for ${envVersion}`);
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
