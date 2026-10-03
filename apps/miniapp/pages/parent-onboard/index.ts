import { getSessionState } from "../../store/session/index";
import { refreshCurrentUser } from "../../utils/session/auth";

interface InputEvent {
  detail: {
    value: string;
  };
}

interface ParentOnboardData {
  inviteCode: string;
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
    inviteCode: "",
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
      parentInactive: session.roles.includes("parent") && Boolean(parentStatus) && parentStatus !== "active",
    });
  },

  onInviteCodeInput(this: ParentOnboardPage, event: InputEvent) {
    this.setData({ inviteCode: event.detail.value });
  },

  openParentAuth(this: ParentOnboardPage) {
    const code = this.data.inviteCode.trim();
    wx.navigateTo({
      url: code
        ? `/pages/parent-auth/index?code=${encodeURIComponent(code)}`
        : "/pages/parent-auth/index",
    });
  },

  openMyCats() {
    wx.navigateTo({ url: "/pages/my-cats/index" });
  },

  openContact() {
    wx.navigateTo({ url: "/pages/fixed-page/index?slug=contact" });
  },
});
