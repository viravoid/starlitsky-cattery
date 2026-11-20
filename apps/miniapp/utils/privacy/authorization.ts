type PrivacyDecision = (agreed: boolean) => void;

let pendingDecision: PrivacyDecision | null = null;
let showing = false;

export function registerPrivacyAuthorization() {
  wx.onNeedPrivacyAuthorization((resolve) => {
    // A denied request is reported to WeChat, never silently treated as consent.
    if (pendingDecision) pendingDecision(false);
    pendingDecision = (agreed) => resolve(agreed
      ? { buttonId: "agree-btn", event: "agree" }
      : { event: "disagree" });
    if (showing) return;
    showing = true;
    wx.navigateTo({
      url: "/pages/privacy-consent/index",
      fail() {
        decidePrivacyAuthorization(false);
      },
    });
  });
}

export function hasPendingPrivacyAuthorization() {
  return pendingDecision !== null;
}

export function decidePrivacyAuthorization(agreed: boolean) {
  const decision = pendingDecision;
  pendingDecision = null;
  showing = false;
  decision?.(agreed);
}
