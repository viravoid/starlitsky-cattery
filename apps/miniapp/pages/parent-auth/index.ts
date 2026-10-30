import type {
  ParentClaimCatCandidateData,
  ParentApplicationData,
  SubmitParentApplicationRequest,
} from "@starlitsky/shared";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";
import { getSessionState } from "../../store/session/index";
import {
  getParentPhoneVerificationCapability,
  getMyParentApplication,
  searchCats,
  submitParentApplication,
  verifyParentPhone,
} from "../../utils/parent-auth/index";

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
}

interface ParentAuthData {
  application: ParentApplicationData | null;
  applicationStatusClass: string;
  applicationStatusLabel: string;
  cats: ParentClaimCatCandidateData[];
  catMode: "existing" | "unlisted" | "new";
  catQuery: string;
  applicantGender: "" | "male" | "female";
  contactWechat: string;
  phoneCapabilityEnabled: boolean;
  phoneVerificationToken: string;
  verifiedPhone: string;
  isVerifyingPhone: boolean;
  displayName: string;
  existingCatId: string;
  existingCatName: string;
  isSearchingCats: boolean;
  isSubmitting: boolean;
  newCatArrivedAt: string;
  newCatBirthday: string;
  newCatColor: string;
  newCatGender: string;
  newCatName: string;
  unlistedCatIdentification: string;
  newCatPersonality: string;
}

const DEFAULT_DATA: ParentAuthData = {
  application: null,
  applicationStatusClass: "",
  applicationStatusLabel: "",
  cats: [],
  catMode: "existing",
  catQuery: "",
  applicantGender: "",
  contactWechat: "",
  phoneCapabilityEnabled: false,
  phoneVerificationToken: "",
  verifiedPhone: "",
  isVerifyingPhone: false,
  displayName: "",
  existingCatId: "",
  existingCatName: "",
  isSearchingCats: false,
  isSubmitting: false,
  newCatArrivedAt: "",
  newCatBirthday: "",
  newCatColor: "",
  newCatGender: "",
  newCatName: "",
  unlistedCatIdentification: "",
  newCatPersonality: "",
};

Page({
  data: DEFAULT_DATA,

  async onLoad(this: ParentAuthPage) {
    const user = await refreshCurrentUser();
    if (user) this.setData({
      displayName: user.parentProfile?.displayName || user.nickname || "",
      applicantGender: user.gender || "",
      contactWechat: user.contactWechat || "",
    });
    try {
      this.setData({ phoneCapabilityEnabled: await getParentPhoneVerificationCapability() });
    } catch {
      this.setData({ phoneCapabilityEnabled: false });
    }
    await this.loadMyApplication();
  },

  async loadMyApplication(this: ParentAuthPage) {
    try {
      const application = await getMyParentApplication();
      if (!application) {
        this.setData({ application: null, applicationStatusClass: "", applicationStatusLabel: "" });
        return;
      }
      this.setData({
        application,
        applicationStatusClass: statusClass(application.status),
        applicationStatusLabel: statusLabel(application.status),
        ...(application.status === "rejected" ? {
          displayName: application.displayName,
          applicantGender: application.gender || "",
          contactWechat: application.contactWechat || "",
        } : {}),
      });
    } catch {
      this.setData({ application: null, applicationStatusClass: "", applicationStatusLabel: "" });
    }
  },

  async onSearchCats(this: ParentAuthPage) {
    this.setData({ isSearchingCats: true });
    try {
      await loginWithWechat();
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

  useUnlistedCat(this: ParentAuthPage) {
    this.setData({ catMode: "unlisted" });
  },

  async onSubmit(this: ParentAuthPage) {
    const payload = toSubmitPayload(this.data);
    if (!payload) return;

    this.setData({ isSubmitting: true });
    try {
      await loginWithWechat();
      const application = await submitParentApplication(payload);
      this.setData({
        application,
        applicationStatusClass: statusClass(application.status),
        applicationStatusLabel: statusLabel(application.status),
        isSubmitting: false,
      });
      showToast("申请已提交，等待审核");
    } catch (error) {
      this.setData({ isSubmitting: false });
      showToast(getErrorMessage(error));
    }
  },

  async onGetPhoneNumber(this: ParentAuthPage, event: { detail: { code?: string; errMsg?: string; errno?: number } }) {
    const code = event.detail.code;
    if (!code || this.data.isVerifyingPhone) {
      if (event.detail.errno === 1400001) showToast("手机号体验额度已用完");
      return;
    }
    this.setData({ isVerifyingPhone: true });
    try {
      if (!getSessionState().user) await loginWithWechat();
      const proof = await verifyParentPhone(code);
      this.setData({ phoneVerificationToken: proof.verificationToken, verifiedPhone: proof.phone });
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      this.setData({ isVerifyingPhone: false });
    }
  },

  onDisplayNameInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ displayName: event.detail.value });
  },
  setApplicantGender(this: ParentAuthPage, event: TapEvent) {
    const value = event.currentTarget.dataset.gender;
    this.setData({ applicantGender: value === "male" || value === "female" ? value : "" });
  },
  onContactWechatInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ contactWechat: event.detail.value });
  },
  onCatQueryInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ catQuery: event.detail.value });
  },
  onNewCatNameInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ newCatName: event.detail.value });
  },
  onUnlistedCatIdentificationInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ unlistedCatIdentification: event.detail.value });
  },
  setNewCatGender(this: ParentAuthPage, event: TapEvent) {
    const gender = event.currentTarget.dataset.gender || "";
    this.setData({ newCatGender: gender });
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

function toSubmitPayload(data: ParentAuthData): SubmitParentApplicationRequest | null {
  if (!data.displayName.trim()) {
    showToast("请填写展示昵称");
    return null;
  }
  if (!data.contactWechat.trim() && !data.phoneVerificationToken) {
    showToast("请填写微信号或授权手机号");
    return null;
  }

  const payload: SubmitParentApplicationRequest = {
    displayName: data.displayName.trim(),
    gender: data.applicantGender || null,
    contactWechat: emptyToNull(data.contactWechat),
    ...(data.phoneVerificationToken ? { phoneVerificationToken: data.phoneVerificationToken } : {}),
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
      },
    ];
    return payload;
  }

  if (!data.newCatName.trim()) {
    showToast("请填写猫咪名字");
    return null;
  }
  if (data.catMode === "unlisted") {
    if (!data.unlistedCatIdentification.trim()) {
      showToast("请填写识别说明供主理人核对");
      return null;
    }
    payload.unlistedCatClaims = [
      {
        name: data.newCatName.trim(),
        identification: data.unlistedCatIdentification.trim(),
        relationship: "owner",
      },
    ];
    return payload;
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

function statusLabel(status: string) {
  if (status === "pending") return "待审核";
  if (status === "approved") return "已通过";
  if (status === "rejected") return "未通过";
  return status || "";
}

function statusClass(status: string) {
  if (status === "pending" || status === "approved" || status === "rejected") return status;
  return "";
}

function showToast(title: string) {
  wx.showToast({
    icon: "none",
    title,
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "操作失败";
}
