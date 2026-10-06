import type { CreateMyCatRequest, MyCatData, UpdateMyCatRequest } from "@starlitsky/shared";
import { createMyCat, getMyCat, updateMyCat } from "../../utils/public-content/index";
import { refreshCurrentUser } from "../../utils/session/auth";

interface EditOptions {
  id?: string;
}

interface EditData {
  birthday: string;
  color: string;
  error: string;
  gender: string;
  id: string;
  isEditing: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  name: string;
  note: string;
  personality: string;
  relationship: string;
  relationshipStartedAt: string;
}

interface EditPage {
  data: EditData;
  loadCat(id: string): Promise<void>;
  setData(data: Partial<EditData>): void;
}

interface InputEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
  detail: {
    value: string;
  };
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    birthday: "",
    color: "",
    error: "",
    gender: "female",
    id: "",
    isEditing: false,
    isLoading: true,
    isSubmitting: false,
    name: "",
    note: "",
    personality: "",
    relationship: "owner",
    relationshipStartedAt: "",
  } as EditData,

  async onLoad(this: EditPage, options: EditOptions) {
    const id = typeof options.id === "string" ? decodeURIComponent(options.id) : "new";
    const isEditing = id !== "new";
    this.setData({ id, isEditing });
    wx.setNavigationBarTitle({ title: isEditing ? "编辑猫咪" : "添加猫咪" });
    if (isEditing) {
      await this.loadCat(id);
      return;
    }
    this.setData({ isLoading: false });
  },

  async loadCat(this: EditPage, id: string) {
    this.setData({ error: "", isLoading: true });
    const user = await refreshCurrentUser();
    if (!user || user.parentProfile?.status !== "active" || !user.roles.includes("parent")) {
      this.setData({ error: "请先完成家长认证", isLoading: false });
      return;
    }

    try {
      const cat = await getMyCat(id);
      this.setData({ ...toFormData(cat), error: "", isLoading: false });
    } catch (error) {
      this.setData({ error: getErrorMessage(error), isLoading: false });
    }
  },

  onInput(this: EditPage, event: InputEvent) {
    const key = event.currentTarget.dataset.key as keyof EditData;
    if (!key) return;
    this.setData({ [key]: event.detail.value } as Partial<EditData>);
  },

  setGender(this: EditPage, event: TapEvent) {
    const gender = event.currentTarget.dataset.gender;
    if (!gender) return;
    this.setData({ gender });
  },

  setRelationship(this: EditPage, event: TapEvent) {
    const relationship = event.currentTarget.dataset.relationship;
    if (!relationship) return;
    this.setData({ relationship });
  },

  async save(this: EditPage) {
    const payload = toPayload(this.data);
    if (!payload.name.trim()) {
      wx.showToast({ icon: "none", title: "请填写猫咪名字" });
      return;
    }

    this.setData({ isSubmitting: true });
    try {
      const saved = this.data.isEditing
        ? await updateMyCat(this.data.id, payload as UpdateMyCatRequest)
        : await createMyCat(payload as CreateMyCatRequest);
      wx.showToast({ icon: "success", title: "已保存" });
      wx.navigateTo({ url: `/pages/my-cat-detail/index?id=${encodeURIComponent(saved.id)}` });
    } catch (error) {
      wx.showToast({ icon: "none", title: getErrorMessage(error) });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },
});

function toFormData(cat: MyCatData): Partial<EditData> {
  return {
    birthday: toDateInput(cat.birthday),
    color: cat.color || "",
    gender: cat.gender || "female",
    name: cat.name,
    note: cat.note || "",
    personality: cat.personality || "",
    relationship: cat.relationship || "owner",
    relationshipStartedAt: toDateInput(cat.relationshipStartedAt),
  };
}

function toPayload(data: EditData): CreateMyCatRequest {
  return {
    name: data.name,
    gender: data.gender || null,
    color: data.color || null,
    birthday: data.birthday || null,
    personality: data.personality || null,
    relationship: data.relationship || "owner",
    relationshipStartedAt: data.relationshipStartedAt || null,
    note: data.note || null,
  };
}

function toDateInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "猫咪资料保存失败";
}
