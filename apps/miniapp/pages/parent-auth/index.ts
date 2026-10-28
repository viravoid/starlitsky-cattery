import type {
  ParentClaimCatCandidateData,
  ParentApplicationData,
  SubmitParentApplicationRequest,
} from "@starlitsky/shared";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";
import {
  getMyParentApplication,
  getParentPhoneVerificationCapability,
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

interface PhoneEvent {
  detail: { code?: string; errMsg?: string };
}

interface ParentAuthData {
  application: ParentApplicationData | null;
  applicationStatusClass: string;
  applicationStatusLabel: string;
  cats: ParentClaimCatCandidateData[];
  catMode: "existing" | "unlisted" | "new";
  catQuery: string;
  city: string;
  contactWechat: string;
  contactPhone: string;
  verifiedPhone: string;
  phoneVerificationToken: string;
  displayName: string;
  existingCatId: string;
  existingCatName: string;
  existingCatNote: string;
  phoneMessage: string;
  phoneVerificationEnabled: boolean;
  isSearchingCats: boolean;
  isSubmitting: boolean;
  isVerifyingPhone: boolean;
  newCatArrivedAt: string;
  newCatBirthday: string;
  newCatColor: string;
  newCatGender: string;
  newCatName: string;
  unlistedCatIdentification: string;
  newCatPersonality: string;
  realName: string;
}

const DEFAULT_DATA: ParentAuthData = {
  application: null,
  applicationStatusClass: "",
  applicationStatusLabel: "",
  cats: [],
  catMode: "existing",
  catQuery: "",
  city: "",
  contactWechat: "",
  contactPhone: "",
  verifiedPhone: "",
  phoneVerificationToken: "",
  displayName: "",
  existingCatId: "",
  existingCatName: "",
  existingCatNote: "",
  phoneMessage: "",
  phoneVerificationEnabled: false,
  isSearchingCats: false,
  isSubmitting: false,
  isVerifyingPhone: false,
  newCatArrivedAt: "",
  newCatBirthday: "",
  newCatColor: "",
  newCatGender: "",
  newCatName: "",
  unlistedCatIdentification: "",
  newCatPersonality: "",
  realName: "",
};

Page({
  data: DEFAULT_DATA,

  async onLoad(this: ParentAuthPage) {
    await refreshCurrentUser();
    await this.loadMyApplication();
    try {
      this.setData({ phoneVerificationEnabled: await getParentPhoneVerificationCapability() });
    } catch {
      this.setData({ phoneVerificationEnabled: false });
    }
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
      });
    } catch {
      this.setData({ application: null, applicationStatusClass: "", applicationStatusLabel: "" });
    }
  },

  async onGetPhoneNumber(this: ParentAuthPage, event: PhoneEvent) {
    if (!this.data.phoneVerificationEnabled) return;
    if (!event.detail.code) {
      this.setData({ phoneMessage: "未获取手机号，可手动填写手机号或微信号" });
      return;
    }
    this.setData({ isVerifyingPhone: true, phoneMessage: "" });
    try {
      await loginWithWechat();
      const result = await verifyParentPhone(event.detail.code);
      this.setData({
        verifiedPhone: result.phone,
        phoneVerificationToken: result.verificationToken,
        contactPhone: "",
        phoneMessage: "手机号由微信获取，仅用于联系及核实申请",
      });
    } catch (error) {
      this.setData({ phoneMessage: `${getErrorMessage(error)}，可手动填写联系方式` });
    } finally {
      this.setData({ isVerifyingPhone: false });
    }
  },

  useManualContact(this: ParentAuthPage) {
    this.setData({ verifiedPhone: "", phoneVerificationToken: "", phoneMessage: "" });
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

  onContactPhoneInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({
      contactPhone: event.detail.value,
      verifiedPhone: "",
      phoneVerificationToken: "",
    });
  },
  onDisplayNameInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ displayName: event.detail.value });
  },
  onRealNameInput(this: ParentAuthPage, event: InputEvent) {
    this.setData({ realName: event.detail.value });
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
  if (!data.phoneVerificationToken && !data.contactPhone.trim() && !data.contactWechat.trim()) {
    showToast("请填写手机号或微信号，或授权微信手机号");
    return null;
  }
  if (data.contactPhone.trim() && !/^\+?[0-9 -]{7,20}$/.test(data.contactPhone.trim())) {
    showToast("请检查手机号格式");
    return null;
  }

  const payload: SubmitParentApplicationRequest = {
    displayName: data.displayName.trim(),
    realName: emptyToNull(data.realName),
    contactPhone: data.phoneVerificationToken ? null : emptyToNull(data.contactPhone),
    phoneVerificationToken: data.phoneVerificationToken || undefined,
    contactWechat: emptyToNull(data.contactWechat),
    city: emptyToNull(data.city),
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
