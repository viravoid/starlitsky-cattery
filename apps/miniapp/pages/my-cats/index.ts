import type { MyCatData } from "@starlitsky/shared";
import { listMyCats } from "../../utils/public-content";
import { refreshCurrentUser } from "../../utils/session/auth";

interface MyCatCard {
  color: string;
  id: string;
  imageUrl: string;
  lineOne: string;
  lineTwo: string;
  name: string;
  relationship: string;
}

interface MyCatsData {
  error: string;
  isEmpty: boolean;
  isLoading: boolean;
  items: MyCatCard[];
  needsParentAuth: boolean;
}

interface MyCatsPage {
  data: MyCatsData;
  loadCats(): Promise<void>;
  setData(data: Partial<MyCatsData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    error: "",
    isEmpty: false,
    isLoading: true,
    items: [],
    needsParentAuth: false,
  } as MyCatsData,

  async onLoad(this: MyCatsPage) {
    await this.loadCats();
  },

  async onPullDownRefresh(this: MyCatsPage) {
    await this.loadCats();
    wx.stopPullDownRefresh();
  },

  async loadCats(this: MyCatsPage) {
    this.setData({ error: "", isEmpty: false, isLoading: true, needsParentAuth: false });
    const user = await refreshCurrentUser();
    if (!user || user.parentProfile?.status !== "active" || !user.roles.includes("parent")) {
      this.setData({ isEmpty: false, isLoading: false, items: [], needsParentAuth: true });
      return;
    }

    try {
      const data = await listMyCats({ pageSize: 100 });
      this.setData({
        error: "",
        isEmpty: data.items.length === 0,
        isLoading: false,
        items: data.items.map(toCard),
        needsParentAuth: false,
      });
    } catch (error) {
      this.setData({
        error: getErrorMessage(error),
        isEmpty: false,
        isLoading: false,
        items: [],
      });
    }
  },

  async retryLoad(this: MyCatsPage) {
    await this.loadCats();
  },

  openParentAuth() {
    wx.navigateTo({ url: "/pages/parent-auth/index" });
  },

  openCat(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/my-cat-detail/index?id=${encodeURIComponent(id)}` });
  },
});

function toCard(cat: MyCatData): MyCatCard {
  const image = cat.mediaAssets.find((item) => item.usage === "cover") ?? cat.mediaAssets[0];
  return {
    color: cat.color || "颜色待补充",
    id: cat.id,
    imageUrl: image?.thumbnailUrl || image?.sourceUrl || "",
    lineOne: `${genderLabel(cat.gender)} · ${cat.color || "颜色待补充"}`,
    lineTwo: cat.litter ? `${cat.litter.name} · ${statusLabel(cat.lifecycleStatus)}` : statusLabel(cat.lifecycleStatus),
    name: cat.name,
    relationship: relationshipLabel(cat.relationship),
  };
}

function genderLabel(value: string | null) {
  if (value === "male") return "弟弟";
  if (value === "female") return "妹妹";
  return "未设置";
}

function relationshipLabel(value: string) {
  if (value === "owner") return "家长";
  if (value === "co_owner") return "共同家长";
  if (value === "caregiver") return "照护人";
  return value || "家长";
}

function statusLabel(value: string) {
  if (value === "adopted") return "已到家";
  if (value === "retired") return "退休";
  if (value === "growing") return "成长中";
  return value || "猫咪";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "我的猫咪加载失败";
}
