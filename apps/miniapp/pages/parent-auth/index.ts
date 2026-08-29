import type {
  CatData,
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
  verifyInvite(credential?: { code?: string; token?: string }): Promise<boolean>;
}

interface ParentAuthData {
  application: ParentApplicationData | null;
  cats: CatData[];
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
      inviteToken: credential.token,
    });

    await refreshCurrentUser();
    await this.loadMyApplication();

    if (credential.code || credential.token) {
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

  async verifyInvite(this: ParentAuthPage, credential?: { code?: string; token?: string }) {
    const code = credential?.code ?? this.data.inviteCode;
    const token = credential?.token ?? this.data.inviteToken;
    if (!code && !token) {
      this.setData({ inviteMessage: "请先输入邀请码", inviteValid: false });
      return false;
    }

    this.setData({ isVerifying: true, inviteMessage: "" });
    try {
      const result = await verifyParentInvite({ code, token });
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
      const cats = await searchCats(this.data.catQuery);
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
    this.setData({ inviteCode: event.detail.value, inviteToken: "", inviteValid: false });
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
  if (options.token) return { code: "", token: decodeURIComponent(options.token) };
  if (options.code) return { code: decodeURIComponent(options.code), token: "" };

  const scene = options.scene ? decodeURIComponent(options.scene) : "";
  if (scene.startsWith("token=")) return { code: "", token: scene.slice("token=".length) };
  if (scene.startsWith("code=")) return { code: scene.slice("code=".length), token: "" };
  return { code: "", token: scene };
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
    ...(data.inviteToken ? { inviteToken: data.inviteToken } : { inviteCode: data.inviteCode }),
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
