import type {
  AuthSessionData,
  CurrentUserResponseData,
  WechatLoginRequest,
} from "@starlitsky/shared";
import { get, post } from "../request/index";
import { resetSessionState, setSessionState } from "../../store/session/index";
import { clearToken, getToken, setToken } from "./token-storage";
import { getSessionAuthAdapter } from "./adapter";

export async function loginWithWechat() {
  const adapter = getSessionAuthAdapter();
  if (adapter?.loginWithWechat) return adapter.loginWithWechat();

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
  const adapter = getSessionAuthAdapter();
  if (adapter?.refreshCurrentUser) return adapter.refreshCurrentUser();

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
  const adapter = getSessionAuthAdapter();
  if (adapter?.logout) return adapter.logout();

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
