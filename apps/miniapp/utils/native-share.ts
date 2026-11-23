const SHARE_MENUS: Array<"shareAppMessage" | "shareTimeline"> = ["shareAppMessage", "shareTimeline"];

export function unavailableFriendShare() {
  return {
    title: "星月缅因猫舍",
    path: "/pages/home/index",
    imageUrl: "/assets/placeholder-cat.png",
  };
}

export function setNativeShareMenu(enabled: boolean) {
  if (isTimelineSinglePage()) return;
  if (enabled) {
    wx.showShareMenu({ menus: SHARE_MENUS });
  } else {
    wx.hideShareMenu({ menus: SHARE_MENUS });
  }
}

export function isTimelineSinglePage() {
  try {
    return (wx.getEnterOptionsSync?.().scene ?? wx.getLaunchOptionsSync?.().scene) === 1154;
  } catch {
    return false;
  }
}

export function shareQuery(params: Record<string, string>) {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function sharePath(pagePath: string, params?: Record<string, string>) {
  const query = params ? shareQuery(params) : "";
  return query ? `${pagePath}?${query}` : pagePath;
}

export function decodeRouteParam(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
