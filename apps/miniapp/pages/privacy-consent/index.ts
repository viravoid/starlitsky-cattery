import { decidePrivacyAuthorization, hasPendingPrivacyAuthorization } from "../../utils/privacy/authorization";

Page({
  data: { needsDecision: false },

  onLoad(this: { setData(data: { needsDecision: boolean }): void }) {
    this.setData({ needsDecision: hasPendingPrivacyAuthorization() });
  },

  onUnload() {
    if (hasPendingPrivacyAuthorization()) decidePrivacyAuthorization(false);
  },

  openGuide() {
    wx.openPrivacyContract({
      fail() { wx.showToast({ icon: "none", title: "隐私指引暂时无法打开" }); },
    });
  },

  agree() {
    decidePrivacyAuthorization(true);
    wx.navigateBack();
  },

  refuse() {
    decidePrivacyAuthorization(false);
    wx.navigateBack();
  },
});
