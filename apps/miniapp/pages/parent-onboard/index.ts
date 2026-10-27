import { getSessionState } from "../../store/session/index";
import { refreshCurrentUser } from "../../utils/session/auth";

interface ParentOnboardData {
  isActiveParent: boolean;
  parentInactive: boolean;
}

interface ParentOnboardPage {
  data: ParentOnboardData;
  setData(data: Partial<ParentOnboardData>): void;
  syncSession(): void;
}

Page({
  data: {
    isActiveParent: false,
    parentInactive: false,
  },

  async onLoad(this: ParentOnboardPage) {
    await refreshCurrentUser();
    this.syncSession();
  },

  async onShow(this: ParentOnboardPage) {
    await refreshCurrentUser();
    this.syncSession();
  },

  syncSession(this: ParentOnboardPage) {
    const session = getSessionState();
    const parentStatus = session.user?.parentProfile?.status || "";
    this.setData({
      isActiveParent: session.roles.includes("parent") && parentStatus === "active",
      parentInactive:
        session.roles.includes("parent") && Boolean(parentStatus) && parentStatus !== "active",
    });
  },

  openParentAuth() {
    wx.navigateTo({ url: "/pages/parent-auth/index" });
  },

  openMyCats() {
    wx.navigateTo({ url: "/pages/my-cats/index" });
  },

  openContact() {
    wx.navigateTo({ url: "/pages/fixed-page/index?slug=contact" });
  },
});
