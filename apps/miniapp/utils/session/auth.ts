import type {
  AuthSessionData,
  CurrentUserResponseData,
  WechatLoginRequest,
} from "@starlitsky/shared";
import { get, post } from "../request/index";
import { resetSessionState, setSessionState } from "../../store/session/index";
import { clearToken, getToken, setToken } from "./token-storage";
import { isVisualQaModeEnabled } from "../visual-qa/mode";
import { getVisualQaCurrentUser } from "../visual-qa/fixtures";

export async function loginWithWechat() {
  const code = await getWechatLoginCode();
  const response = await post<AuthSessionData, WechatLoginRequest>("/auth/wechat/login", { code });

  if (!response.success) {
    throw new Error(response.message);
  }

  setToken(response.data.token);
  setSessionState({
    token: response.data.token,
    userId: response.data.user.id,
    currentRole: response.data.user.currentRole,
    roles: response.data.user.roles,
    user: response.data.user,
    expiresAt: response.data.expiresAt,
  });

  return response.data;
}

export async function refreshCurrentUser() {
  if (isVisualQaModeEnabled()) {
    const user = getVisualQaCurrentUser();
    setSessionState({
      token: "visual-qa-token",
      userId: user.id,
      currentRole: user.currentRole,
      roles: user.roles,
      user,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    return user;
  }

  const token = getToken();
  if (!token) {
    resetSessionState();
    return null;
  }

  try {
    const response = await get<CurrentUserResponseData>("/auth/me");
    if (!response.success) {
      clearLocalSession();
      return null;
    }

    setSessionState({
      token,
      userId: response.data.user.id,
      currentRole: response.data.user.currentRole,
      roles: response.data.user.roles,
      user: response.data.user,
    });
    return response.data.user;
  } catch {
    clearLocalSession();
    return null;
  }
}

export async function logout() {
  try {
    await post<null>("/auth/logout");
  } finally {
    clearLocalSession();
  }
}

function clearLocalSession() {
  clearToken();
  resetSessionState();
}

function getWechatLoginCode() {
  return new Promise<string>((resolve, reject) => {
    wx.login({
      success(response) {
        if (response.code) {
          resolve(response.code);
          return;
        }
        reject(new Error(response.errMsg || "wx.login did not return code"));
      },
      fail(error) {
        reject(new Error(error.errMsg || "wx.login failed"));
      },
    });
  });
}
