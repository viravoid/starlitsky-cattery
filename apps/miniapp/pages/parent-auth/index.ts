import type {
  ParentClaimCatCandidateData,
  ParentApplicationData,
  SubmitParentApplicationRequest,
} from "@starlitsky/shared";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";
import {
  getMyParentApplication,
  searchCats,
  submitParentApplication,
  verifyParentInvite,
} from "../../utils/parent-auth";

interface ParentAuthLoadOptions {
  code?: string;
  qrCredential?: string;
  scene?: string;
  token?: string;
}

interface InputEvent {
  detail: {
    value: string;
  };
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

interface ParentAuthPage {
  data: ParentAuthData;
  loadMyApplication(): Promise<void>;
  setData(data: Partial<ParentAuthData>): void;
  verifyInvite(credential?: InviteCredential): Promise<boolean>;
}

interface InviteCredential {
  code?: string;
  token?: string;
  qrCredential?: string;
}

interface ParentAuthData {
  application: ParentApplicationData | null;
  cats: ParentClaimCatCandidateData[];
  catMode: "existing" | "new";
  catQuery: string;
  city: string;
  contactPhone: string;
  contactWechat: string;
  displayName: string;
  existingCatId: string;
  existingCatName: string;
  existingCatNote: string;
  inviteCode: string;
  inviteMessage: string;
  inviteQrCredential: string;
  inviteToken: string;
  inviteValid: boolean;
  isSearchingCats: boolean;
  isSubmitting: boolean;
  isVerifying: boolean;
  newCatArrivedAt: string;
  newCatBirthday: string;
  newCatColor: string;
  newCatGender: string;
  newCatName: string;
  newCatPersonality: string;
  realName: string;
}

const DEFAULT_DATA: ParentAuthData = {
  application: null,
  cats: [],
  catMode: "existing",
  catQuery: "",
  city: "",
  contactPhone: "",
  contactWechat: "",
  displayName: "",
  existingCatId: "",
  existingCatName: "",
  existingCatNote: "",
  inviteCode: "",
  inviteMessage: "",
  inviteQrCredential: "",
  inviteToken: "",
  inviteValid: false,
  isSearchingCats: false,
  isSubmitting: false,
  isVerifying: false,
  newCatArrivedAt: "",
  newCatBirthday: "",
  newCatColor: "",
  newCatGender: "",
  newCatName: "",
  newCatPersonality: "",
  realName: "",
};

Page({
  data: DEFAULT_DATA,

  async onLoad(this: ParentAuthPage, options: ParentAuthLoadOptions) {
    const credential = getCredentialFromOptions(options);
    this.setData({
      inviteCode: credential.code,
      inviteQrCredential: credential.qrCredential,
      inviteToken: credential.token,
    });

    await refreshCurrentUser();
    await this.loadMyApplication();

    if (credential.code || credential.token || credential.qrCredential) {
      await this.verifyInvite(credential);
    }
  },

  async loadMyApplication(this: ParentAuthPage) {
    try {
      const application = await getMyParentApplication();
      this.setData({ application });
    } catch {
      this.setData({ application: null });
    }
  },

  async verifyInvite(this: ParentAuthPage, credential?: InviteCredential) {
    const code = credential?.code ?? this.data.inviteCode;
    const token = credential?.token ?? this.data.inviteToken;
    const qrCredential = credential?.qrCredential ?? this.data.inviteQrCredential;
    if (!code && !token && !qrCredential) {
      this.setData({ inviteMessage: "请先输入邀请码", inviteValid: false });
      return false;
    }

    this.setData({ isVerifying: true, inviteMessage: "" });
    try {
      const result = await verifyParentInvite({ code, token, qrCredential });
      this.setData({
        inviteValid: result.valid,
        inviteMessage: result.valid
          ? "邀请有效，可以提交申请"
          : `邀请不可用：${result.reason || "invalid"}`,
      });
      return result.valid;
    } catch (error) {
      this.setData({ inviteMessage: getErrorMessage(error), inviteValid: false });
      return false;
    } finally {
      this.setData({ isVerifying: false });
    }
  },

  async onVerifyCode(this: ParentAuthPage) {
    await this.verifyInvite();
  },

  async onSearchCats(this: ParentAuthPage) {
    this.setData({ isSearchingCats: true });
    try {
      await loginWithWechat();
      const cats = await searchCats(this.data.catQuery, getCredentialFromData(this.data));
      this.setData({ cats });
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      this.setData({ isSearchingCats: false });
    }
  },

  onSelectExistingCat(this: ParentAuthPage, event: TapEvent) {
    this.setData({
      existingCatId: event.currentTarget.dataset.catId || "",
      existingCatName: event.currentTarget.dataset.catName || "",
    });
  },

  useExistingCat(this: ParentAuthPage) {
    this.setData({ catMode: "existing" });
  },

  useNewCat(this: ParentAuthPage) {
    this.setData({ catMode: "new" });
  },

  async onSubmit(this: ParentAuthPage) {
    const inviteValid = this.data.inviteValid || (await this.verifyInvite());
    if (!inviteValid) return;

    const payload = toSubmitPayload(this.data);
    if (!payload) return;

    this.setData({ isSubmitting: true });
    try {
      await loginWithWechat();
      const application = await submitParentApplication(payload);
      this.setData({ application, isSubmitting: false });
      showToast("申请已提交，等待审核");
    } catch (error) {
      this.setData({ isSubmitting: false });
      showToast(getErrorMessage(error));
    }
  },

  onInviteCodeInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({
      inviteCode: event.detail.value,
      inviteQrCredential: "",
      inviteToken: "",
      inviteValid: false,
    });
  },
  onDisplayNameInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ displayName: event.detail.value });
  },
  onRealNameInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ realName: event.detail.value });
  },
  onContactPhoneInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ contactPhone: event.detail.value });
  },
  onContactWechatInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ contactWechat: event.detail.value });
  },
  onCityInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ city: event.detail.value });
  },
  onCatQueryInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ catQuery: event.detail.value });
  },
  onExistingCatNoteInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ existingCatNote: event.detail.value });
  },
  onNewCatNameInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ newCatName: event.detail.value });
  },
  onNewCatGenderInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ newCatGender: event.detail.value });
  },
  onNewCatColorInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ newCatColor: event.detail.value });
  },
  onNewCatBirthdayInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ newCatBirthday: event.detail.value });
  },
  onNewCatArrivedAtInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ newCatArrivedAt: event.detail.value });
  },
  onNewCatPersonalityInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ newCatPersonality: event.detail.value });
  },
});

function getCredentialFromOptions(options: ParentAuthLoadOptions) {
  if (options.token)
    return { code: "", token: decodeURIComponent(options.token), qrCredential: "" };
  if (options.code) return { code: decodeURIComponent(options.code), token: "", qrCredential: "" };
  if (options.qrCredential) {
    return { code: "", token: "", qrCredential: decodeURIComponent(options.qrCredential) };
  }

  const scene = options.scene ? decodeURIComponent(options.scene) : "";
  if (scene.startsWith("token=")) {
    return { code: "", token: scene.slice("token=".length), qrCredential: "" };
  }
  if (scene.startsWith("code=")) {
    return { code: scene.slice("code=".length), token: "", qrCredential: "" };
  }
  if (scene.startsWith("i=")) return { code: "", token: "", qrCredential: scene.slice(2) };
  return { code: "", token: "", qrCredential: scene };
}

function toSubmitPayload(data: ParentAuthData): SubmitParentApplicationRequest | null {
  if (!data.displayName.trim()) {
    showToast("请填写展示昵称");
    return null;
  }

  const payload: SubmitParentApplicationRequest = {
    displayName: data.displayName.trim(),
    realName: emptyToNull(data.realName),
    contactPhone: emptyToNull(data.contactPhone),
    contactWechat: emptyToNull(data.contactWechat),
    city: emptyToNull(data.city),
    ...getCredentialFromData(data),
  };

  if (data.catMode === "existing") {
    if (!data.existingCatId) {
      showToast("请选择要认领的猫");
      return null;
    }
    payload.existingCatClaims = [
      {
        catId: data.existingCatId,
        relationship: "owner",
        note: emptyToNull(data.existingCatNote),
      },
    ];
    return payload;
  }

  if (!data.newCatName.trim()) {
    showToast("请填写猫咪名字");
    return null;
  }
  payload.newCats = [
    {
      name: data.newCatName.trim(),
      gender: emptyToNull(data.newCatGender),
      color: emptyToNull(data.newCatColor),
      birthday: emptyToNull(data.newCatBirthday),
      arrivedAt: emptyToNull(data.newCatArrivedAt),
      personality: emptyToNull(data.newCatPersonality),
      relationship: "owner",
    },
  ];
  return payload;
}

function getCredentialFromData(data: ParentAuthData): InviteCredential {
  if (data.inviteQrCredential) return { qrCredential: data.inviteQrCredential };
  if (data.inviteToken) return { token: data.inviteToken };
  return { code: data.inviteCode };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function showToast(title: string) {
  wx.showToast({
    icon: "none",
    title,
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}
