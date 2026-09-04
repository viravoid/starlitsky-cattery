import type { CatData } from "@starlitsky/shared";
import { getPublicCat } from "../../utils/public-content";

interface DetailOptions {
  id?: string;
  kind?: string;
}

interface InfoItem {
  label: string;
  value: string;
}

interface CatDetailData {
  cat: CatData | null;
  error: string;
  gallery: string[];
  id: string;
  info: InfoItem[];
  isLoading: boolean;
  kindLabel: string;
  note: string;
  statusLabel: string;
}

interface CatDetailPage {
  data: CatDetailData;
  loadCat(id: string): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Partial<CatDetailData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    cat: null,
    error: "",
    gallery: [],
    id: "",
    info: [],
    isLoading: true,
    kindLabel: "猫咪详情",
    note: "",
    statusLabel: "",
  } as CatDetailData,

  async onLoad(this: CatDetailPage, options: DetailOptions) {
    const id = typeof options.id === "string" ? decodeURIComponent(options.id) : "";
    this.setData({ id });
    await this.loadCat(id);
  },

  async onPullDownRefresh(this: CatDetailPage) {
    await this.loadCat(this.data.id);
    wx.stopPullDownRefresh();
  },

  async loadCat(this: CatDetailPage, id: string) {
    if (!id) {
      this.setData({ error: "缺少猫咪 ID", isLoading: false });
      return;
    }

    this.setData({ error: "", isLoading: true });
    try {
      const cat = await getPublicCat(id);
      const view = toDetailView(cat);
      this.setData({ cat, error: "", isLoading: false, ...view });
      wx.setNavigationBarTitle({ title: cat.name });
    } catch (error) {
      this.setData({ cat: null, error: getErrorMessage(error), isLoading: false });
    }
  },

  async retryLoad(this: CatDetailPage) {
    await this.loadCat(this.data.id);
  },

  previewImage(this: CatDetailPage, event: TapEvent) {
    const current = event.currentTarget.dataset.url;
    if (!current || this.data.gallery.length === 0) return;
    wx.previewImage({ current, urls: this.data.gallery });
  },
});

function toDetailView(cat: CatData) {
  const gallery = cat.mediaAssets
    .map((item) => item.sourceUrl || item.thumbnailUrl || "")
    .filter(Boolean);
  const commonInfo: InfoItem[] = [
    { label: "颜色", value: cat.color || "待补充" },
    { label: "性别", value: genderLabel(cat.gender) },
    { label: "生日", value: cat.birthday ? cat.birthday.slice(0, 10) : "待补充" },
  ];

  if (cat.kittenProfile) {
    return {
      gallery,
      info: [
        ...commonInfo,
        { label: "状态", value: saleStatusLabel(cat.kittenProfile.saleStatus) },
        { label: "价格", value: cat.kittenProfile.priceText || "沟通确认" },
        { label: "窝次", value: cat.kittenProfile.litter?.name || "未分配" },
        { label: "父亲", value: cat.kittenProfile.litter?.fatherCat?.name || "待补充" },
        { label: "母亲", value: cat.kittenProfile.litter?.motherCat?.name || "待补充" },
      ],
      kindLabel: "小猫详情",
      note: noteFromStory(cat.storyJson) || cat.personality || "主理人介绍待补充。",
      statusLabel: saleStatusLabel(cat.kittenProfile.saleStatus),
    };
  }

  if (cat.breedingProfile) {
    return {
      gallery,
      info: [
        ...commonInfo,
        { label: "身份", value: breedingCategoryLabel(cat.breedingProfile.category) },
        { label: "繁育状态", value: reproductiveStateLabel(cat.breedingProfile.reproductiveState) },
        { label: "来源", value: cat.breedingProfile.source || "待补充" },
      ],
      kindLabel: "种猫详情",
      note:
        noteFromStory(cat.storyJson) ||
        cat.breedingProfile.trait ||
        cat.personality ||
        "主理人介绍待补充。",
      statusLabel:
        cat.breedingProfile.statusLabel ||
        reproductiveStateLabel(cat.breedingProfile.reproductiveState),
    };
  }

  return {
    gallery,
    info: commonInfo,
    kindLabel: "猫咪详情",
    note: noteFromStory(cat.storyJson) || cat.personality || "资料待补充。",
    statusLabel: lifecycleLabel(cat.lifecycleStatus),
  };
}

function noteFromStory(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const input = value as Record<string, any>;
  if (typeof input.note === "string") return input.note;
  if (Array.isArray(input.story))
    return input.story.filter((item) => typeof item === "string").join("\n\n");
  return "";
}

function genderLabel(value: string | null) {
  if (value === "male") return "弟弟";
  if (value === "female") return "妹妹";
  return "未设置";
}

function saleStatusLabel(value: string) {
  if (value === "available") return "待找家";
  if (value === "reserved") return "找家中";
  if (value === "adopted") return "已有家";
  return value || "待评估";
}

function breedingCategoryLabel(value: string) {
  if (value === "king") return "现役公猫";
  if (value === "queen") return "现役母猫";
  if (value === "candidate") return "预备役种猫";
  return value || "种猫";
}

function reproductiveStateLabel(value: string) {
  if (value === "observing") return "观察中";
  if (value === "active") return "在役";
  if (value === "paused") return "暂停";
  if (value === "retired") return "已退休";
  if (value === "semiRetired") return "半退役";
  return value || "在役";
}

function lifecycleLabel(value: string) {
  if (value === "growing") return "成长中";
  if (value === "breeding") return "繁育中";
  if (value === "retired") return "已退休";
  if (value === "adopted") return "已去新家";
  return value || "资料待补充";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "猫咪详情加载失败";
}
