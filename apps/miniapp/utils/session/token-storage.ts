const TOKEN_STORAGE_KEY = "starlitsky.session.token";

export function getToken() {
  return wx.getStorageSync(TOKEN_STORAGE_KEY) || "";
}

export function setToken(token: string) {
  wx.setStorageSync(TOKEN_STORAGE_KEY, token);
}

export function clearToken() {
  wx.removeStorageSync(TOKEN_STORAGE_KEY);
}
