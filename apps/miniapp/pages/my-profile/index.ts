import { getSessionState } from "../../store/session/index";
import { refreshCurrentUser, updateMyProfile, uploadMyAvatar } from "../../utils/session/auth";

interface ProfileData {
  avatarUrl: string;
  nickname: string;
  gender: "" | "male" | "female";
  city: string;
  contactWechat: string;
  isSaving: boolean;
}

interface ProfilePage {
  data: ProfileData;
  setData(data: Partial<ProfileData>): void;
}

Page({
  data: {
    avatarUrl: "",
    nickname: "",
    gender: "",
    city: "",
    contactWechat: "",
    isSaving: false,
  } as ProfileData,

  async onLoad(this: ProfilePage) {
    const user = await refreshCurrentUser();
    if (!user) {
      wx.switchTab({ url: "/pages/community/index" });
      return;
    }
    this.setData({
      avatarUrl: user.avatarUrl || "",
      nickname: user.parentProfile?.displayName || user.nickname || "",
      gender: user.gender || "",
      city: user.city || "",
      contactWechat: user.contactWechat || "",
    });
  },

  onNicknameInput(this: ProfilePage, event: { detail: { value: string } }) {
    this.setData({ nickname: event.detail.value });
  },
  onCityInput(this: ProfilePage, event: { detail: { value: string } }) {
    this.setData({ city: event.detail.value });
  },
  onWechatInput(this: ProfilePage, event: { detail: { value: string } }) {
    this.setData({ contactWechat: event.detail.value });
  },
  setGender(this: ProfilePage, event: { currentTarget: { dataset: Record<string, string> } }) {
    const value = event.currentTarget.dataset.gender;
    this.setData({ gender: value === "male" || value === "female" ? value : "" });
  },

  async onChooseAvatar(this: ProfilePage, event: { detail: { avatarUrl?: string } }) {
    const path = event.detail.avatarUrl;
    if (!path) return;
    try {
      const dataBase64 = await readBase64(path);
      const mimeType = imageType(dataBase64);
      if (!mimeType) throw new Error("请选择 JPG 或 PNG 头像");
      const user = await uploadMyAvatar({ mimeType, dataBase64 });
      this.setData({ avatarUrl: user.avatarUrl || "" });
    } catch (error) {
      wx.showToast({ icon: "none", title: errorMessage(error) });
    }
  },

  async save(this: ProfilePage, event: { detail: { value: { nickname?: string } } }) {
    const nickname = event.detail.value.nickname?.trim() || "";
    if (!nickname) {
      wx.showToast({ icon: "none", title: "请填写展示昵称" });
      return;
    }
    if (!getSessionState().user) return;
    this.setData({ isSaving: true });
    try {
      await updateMyProfile({
        nickname,
        gender: this.data.gender || null,
        city: this.data.city.trim() || null,
        contactWechat: this.data.contactWechat.trim() || null,
      });
      wx.showToast({ icon: "success", title: "已保存" });
    } catch (error) {
      wx.showToast({ icon: "none", title: errorMessage(error) });
    } finally {
      this.setData({ isSaving: false });
    }
  },
});

function readBase64(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success(result) { resolve(wx.arrayBufferToBase64(result.data)); },
      fail(error) { reject(new Error(error.errMsg || "读取头像失败")); },
    });
  });
}

function imageType(value: string): "image/jpeg" | "image/png" | null {
  if (value.startsWith("/9j/")) return "image/jpeg";
  if (value.startsWith("iVBORw0KGgo")) return "image/png";
  return null;
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "操作失败，请重试";
}
