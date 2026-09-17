import type { CatData } from "@starlitsky/shared";
import { getPublicCat } from "../../utils/public-content/index";

interface DetailOptions {
  id?: string;
}

interface InfoItem {
  label: string;
  value: string;
}

interface GalleryItem {
  id: string;
  label: string;
  url: string;
}

interface RatingRow {
  label: string;
  value: number;
  stars: Array<{ active: boolean; highlight: boolean }>;
}

interface RatingGroup {
  title: string;
  rows: RatingRow[];
}

interface NoteParagraph {
  id: string;
  prefix: string;
  suffix: string;
  text: string;
}

interface CatDetailData {
  cat: CatData | null;
  error: string;
  gallery: string[];
  galleryItems: GalleryItem[];
  id: string;
  info: InfoItem[];
  isLoading: boolean;
  litterId: string;
  litterName: string;
  noteParagraphs: NoteParagraph[];
  ratingGroups: RatingGroup[];
  showStructureRating: boolean;
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
    galleryItems: [],
    id: "",
    info: [],
    isLoading: true,
    litterId: "",
    litterName: "",
    noteParagraphs: [],
    ratingGroups: [],
    showStructureRating: false,
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

  openQuestionnaire() {
    wx.navigateTo({ url: "/pages/questionnaire/index" });
  },

  openCatTimeline(this: CatDetailPage) {
    if (!this.data.id) return;
    wx.navigateTo({
      url: `/pages/community-linked/index?catId=${encodeURIComponent(this.data.id)}&title=${encodeURIComponent("TA 的猫友圈动态")}`,
    });
  },

  openLitterTimeline(this: CatDetailPage) {
    if (!this.data.litterId) return;
    wx.navigateTo({
      url: `/pages/community-linked/index?litterId=${encodeURIComponent(this.data.litterId)}&title=${encodeURIComponent(`${this.data.litterName || "所属窝次"}的动态`)}`,
    });
  },
});

function toDetailView(cat: CatData) {
  const galleryItems = cat.mediaAssets
    .filter((item) => item.kind === "image")
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item, index) => {
      const url = item.sourceUrl || item.thumbnailUrl || "";
      return url
        ? {
            id: item.id,
            label: item.altText || item.title || `猫咪图片 ${index + 1}`,
            url,
          }
        : null;
    })
    .filter((item): item is GalleryItem => Boolean(item));
  const gallery = galleryItems.map((item) => item.url);
  const commonInfo: InfoItem[] = [
    { label: "颜色", value: cat.color || "待补充" },
    { label: "生日", value: cat.birthday ? cat.birthday.slice(0, 10) : "待补充" },
  ];

  if (cat.kittenProfile) {
    const ratingGroups = normalizeRatingGroups(cat.kittenProfile.structureRatingJson);
    return {
      gallery,
      galleryItems,
      info: [
        ...commonInfo,
        ...(cat.kittenProfile.saleStatus !== "adopted"
          ? [{ label: "是否已绝育", value: "示例文字（待更新）" }]
          : []),
        { label: "父亲", value: cat.kittenProfile.litter?.fatherCat?.name || "待补充" },
        { label: "母亲", value: cat.kittenProfile.litter?.motherCat?.name || "待补充" },
        { label: "窝次", value: cat.kittenProfile.litter?.name || "暂未分配" },
        { label: "价格", value: cat.kittenProfile.priceText || "沟通确认" },
      ],
      litterId: cat.kittenProfile.litter?.id || "",
      litterName: cat.kittenProfile.litter?.name || "",
      noteParagraphs: toNoteParagraphs(
        paragraphsFromStory(cat.storyJson, cat.personality || "主理人介绍待补充。"),
      ),
      ratingGroups,
      showStructureRating: ratingGroups.some((group) => group.rows.length > 0),
      statusLabel: saleStatusLabel(cat.kittenProfile.saleStatus),
    };
  }

  if (cat.breedingProfile) {
    return {
      gallery,
      galleryItems,
      info: [
        ...commonInfo,
        { label: "身份", value: breedingCategoryLabel(cat.breedingProfile.category) },
        { label: "繁育状态", value: reproductiveStateLabel(cat.breedingProfile.reproductiveState) },
        { label: "来源 / 血线", value: cat.breedingProfile.source || "待补充" },
      ],
      litterId: "",
      litterName: "",
      noteParagraphs: toNoteParagraphs(
        paragraphsFromStory(
          cat.storyJson,
          cat.breedingProfile.trait || cat.personality || "主理人介绍待补充。",
        ),
      ),
      ratingGroups: [],
      showStructureRating: false,
      statusLabel:
        cat.breedingProfile.statusLabel ||
        reproductiveStateLabel(cat.breedingProfile.reproductiveState),
    };
  }

  return {
    gallery,
    galleryItems,
    info: commonInfo,
    litterId: "",
    litterName: "",
    noteParagraphs: toNoteParagraphs(
      paragraphsFromStory(cat.storyJson, cat.personality || "资料待补充。"),
    ),
    ratingGroups: [],
    showStructureRating: false,
    statusLabel: lifecycleLabel(cat.lifecycleStatus),
  };
}

function toNoteParagraphs(paragraphs: string[]): NoteParagraph[] {
  return paragraphs.map((text, index) => ({
    id: `note-${index}`,
    prefix: index === 0 ? "「" : "",
    suffix: index === paragraphs.length - 1 ? "」" : "",
    text,
  }));
}

function paragraphsFromStory(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return [fallback];
  const input = value as Record<string, any>;
  if (typeof input.note === "string" && input.note.trim()) return splitParagraphs(input.note);
  if (Array.isArray(input.story)) {
    const paragraphs = input.story.filter((item) => typeof item === "string" && item.trim());
    if (paragraphs.length > 0) return paragraphs;
  }
  return [fallback];
}

function splitParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRatingGroups(value: unknown): RatingGroup[] {
  const input = value && typeof value === "object" ? (value as Record<string, any>) : {};
  const face = input.face && typeof input.face === "object" ? input.face : {};
  const body = input.body && typeof input.body === "object" ? input.body : {};
  return [
    {
      title: "面部结构",
      rows: [
        ratingRow("眼睛", face.eyes),
        ratingRow("耳朵", face.ears),
        ratingRow("嘴套", face.muzzle),
        ratingRow("侧脸", face.profile),
      ].filter((item): item is RatingRow => Boolean(item)),
    },
    {
      title: "身体结构",
      rows: [
        ratingRow("身长", body.length),
        ratingRow("体格", body.build),
        ratingRow("整体", body.overall),
      ].filter((item): item is RatingRow => Boolean(item)),
    },
  ];
}

function ratingRow(label: string, raw: unknown): RatingRow | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const value = Math.max(0, Math.min(6, Math.round(raw)));
  return {
    label,
    value,
    stars: Array.from({ length: 6 }).map((_, index) => ({
      active: index < value,
      highlight: value === 6 && index === 0,
    })),
  };
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
