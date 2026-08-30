import type { CatData } from "@starlitsky/shared";
import { listPublicCats } from "../../utils/public-content";

type TabKey = "kittens" | "studs";

interface CatListItem {
  id: string;
  imageUrl: string;
  kind: TabKey;
  lineOne: string;
  lineTwo: string;
  name: string;
  pill: string;
  statusKey: string;
}

interface CatsPage {
  data: {
    activeFilter: string;
    activeTab: TabKey;
    items: CatListItem[];
  };
  loadCats(): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Record<string, unknown>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    activeFilter: "全部",
    activeTab: "kittens" as TabKey,
    error: "",
    filters: ["全部"],
    isLoading: true,
    items: [] as CatListItem[],
    visibleItems: [] as CatListItem[],
  },

  async onLoad(this: CatsPage) {
    await this.loadCats();
  },

  async onPullDownRefresh(this: CatsPage) {
    await this.loadCats();
    wx.stopPullDownRefresh();
  },

  async loadCats(this: CatsPage) {
    this.setData({ error: "", isLoading: true });
    try {
      const data = await listPublicCats({ pageSize: 100 });
      const items = data.items
        .map(toCatListItem)
        .filter((item): item is CatListItem => Boolean(item));
      this.setData({
        error: "",
        isLoading: false,
        items,
        ...deriveView(items, this.data.activeTab, this.data.activeFilter),
      });
    } catch (error) {
      this.setData({
        error: getErrorMessage(error),
        isLoading: false,
        items: [],
        visibleItems: [],
      });
    }
  },

  async retryLoad(this: CatsPage) {
    await this.loadCats();
  },

  switchTab(this: CatsPage, event: TapEvent) {
    const tab = event.currentTarget.dataset.tab as TabKey;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({
      activeTab: tab,
      ...deriveView(this.data.items, tab, "全部"),
    });
  },

  setFilter(this: CatsPage, event: TapEvent) {
    const filter = event.currentTarget.dataset.filter;
    this.setData({
      ...deriveView(this.data.items, this.data.activeTab, filter),
    });
  },

  openCat(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    const kind = event.currentTarget.dataset.kind as TabKey;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/cat-detail/index?id=${encodeURIComponent(id)}&kind=${kind}`,
    });
  },
});

function deriveView(items: CatListItem[], tab: TabKey, activeFilter: string) {
  const tabItems = items.filter((item) => item.kind === tab);
  const filters = [
    "全部",
    ...Array.from(new Set(tabItems.map((item) => item.statusKey).filter(Boolean))),
  ];
  const normalizedFilter = filters.includes(activeFilter) ? activeFilter : "全部";
  return {
    activeFilter: normalizedFilter,
    filters,
    visibleItems:
      normalizedFilter === "全部"
        ? tabItems
        : tabItems.filter((item) => item.statusKey === normalizedFilter),
  };
}

function toCatListItem(cat: CatData): CatListItem | null {
  const image = cat.mediaAssets.find((item) => item.usage === "cover") ?? cat.mediaAssets[0];
  if (cat.kittenProfile) {
    const status = saleStatusLabel(cat.kittenProfile.saleStatus);
    return {
      id: cat.id,
      imageUrl: image?.thumbnailUrl || image?.sourceUrl || "",
      kind: "kittens",
      lineOne: `性别 ${genderLabel(cat.gender)} · ${cat.color || "颜色待补充"}`,
      lineTwo: `${cat.kittenProfile.litter?.name || "未分配窝次"} · ${
        cat.kittenProfile.priceText || "价格沟通"
      }`,
      name: cat.name,
      pill: status,
      statusKey: status,
    };
  }

  if (cat.breedingProfile) {
    const category = breedingCategoryLabel(cat.breedingProfile.category);
    return {
      id: cat.id,
      imageUrl: image?.thumbnailUrl || image?.sourceUrl || "",
      kind: "studs",
      lineOne: `${category} · ${cat.color || "颜色待补充"}`,
      lineTwo: cat.breedingProfile.trait || cat.breedingProfile.source || "资料待补充",
      name: cat.name,
      pill:
        cat.breedingProfile.statusLabel ||
        reproductiveStateLabel(cat.breedingProfile.reproductiveState),
      statusKey: category,
    };
  }

  return null;
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
  if (value === "male") return "现役公猫";
  if (value === "female") return "现役母猫";
  if (value === "candidate") return "预备役种猫";
  return value || "种猫";
}

function reproductiveStateLabel(value: string) {
  if (value === "preparing") return "准备中";
  if (value === "retired") return "已退休";
  if (value === "semiRetired") return "半退役";
  return value || "在役";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "猫咪资料加载失败";
}
