import type { CatData } from "@starlitsky/shared";
import { listPublicCats } from "../../utils/public-content/index";
import { resolveCatFrame, type ImageFrameMode } from "../../utils/cat-presentation";

type TabKey = "kittens" | "studs";
type GenderFilterId = "" | "male" | "female";

interface CatListItem {
  id: string;
  imageClass: string;
  imageMode: ImageFrameMode;
  imageStyle: string;
  imageUrl: string;
  kind: TabKey;
  lineOne: string;
  lineTwo: string;
  lineThree: string;
  litterId: string;
  litterName: string;
  genderKey: string;
  metaItems: CatMetaItem[];
  name: string;
  pill: string;
  statusKey: string;
}

interface CatMetaItem {
  label: string;
  value: string;
}

interface CatsPage {
  data: {
    activeFilter: string;
    activeGenderId: GenderFilterId;
    activeGenderLabel: string;
    activeLitterLabel: string;
    activeLitterId: string;
    activeTab: TabKey;
    genderFilters: GenderFilter[];
    genderOpen: boolean;
    items: CatListItem[];
    litterFilters: LitterFilter[];
    litterOpen: boolean;
  };
  getTabBar?(): { setData(data: { selected: number }): void };
  loadCats(): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Record<string, unknown>): void;
}

interface LitterFilter {
  id: string;
  name: string;
}

interface GenderFilter {
  id: GenderFilterId;
  name: string;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

const KITTEN_FILTERS = ["找家中", "待找家", "已有家"];
const STUD_FILTERS = ["现役公猫", "现役母猫", "预备役种猫"];
const GENDER_FILTERS: GenderFilter[] = [
  { id: "", name: "全部" },
  { id: "male", name: "弟弟" },
  { id: "female", name: "妹妹" },
];

Page({
  data: {
    activeFilter: "找家中",
    activeGenderId: "" as GenderFilterId,
    activeGenderLabel: "全部",
    activeLitterLabel: "全部窝次",
    activeLitterId: "",
    activeTab: "kittens" as TabKey,
    error: "",
    filters: KITTEN_FILTERS,
    genderFilters: GENDER_FILTERS,
    genderOpen: false,
    isLoading: true,
    items: [] as CatListItem[],
    litterFilters: [{ id: "", name: "全部窝次" }],
    litterOpen: false,
    visibleItems: [] as CatListItem[],
  },

  async onLoad(this: CatsPage) {
    await this.loadCats();
  },

  onShow(this: CatsPage) {
    this.getTabBar?.()?.setData({ selected: 1 });
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
        ...deriveView(
          items,
          this.data.activeTab,
          this.data.activeFilter,
          this.data.activeLitterId,
          this.data.activeGenderId,
        ),
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
      genderOpen: false,
      litterOpen: false,
      ...deriveView(
        this.data.items,
        tab,
        tab === "kittens" ? KITTEN_FILTERS[0] : STUD_FILTERS[0],
        "",
        this.data.activeGenderId,
      ),
    });
  },

  setFilter(this: CatsPage, event: TapEvent) {
    const filter = event.currentTarget.dataset.filter;
    this.setData({
      ...deriveView(
        this.data.items,
        this.data.activeTab,
        filter,
        this.data.activeLitterId,
        this.data.activeGenderId,
      ),
    });
  },

  toggleLitter(this: CatsPage) {
    this.setData({ genderOpen: false, litterOpen: !this.data.litterOpen });
  },

  setLitter(this: CatsPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id || "";
    const nextId = id === this.data.activeLitterId ? "" : id;
    this.setData({
      litterOpen: false,
      ...deriveView(
        this.data.items,
        this.data.activeTab,
        this.data.activeFilter,
        nextId,
        this.data.activeGenderId,
      ),
    });
  },

  toggleGender(this: CatsPage) {
    this.setData({ genderOpen: !this.data.genderOpen, litterOpen: false });
  },

  setGender(this: CatsPage, event: TapEvent) {
    const id = (event.currentTarget.dataset.id || "") as GenderFilterId;
    const nextId = id === this.data.activeGenderId ? "" : id;
    this.setData({
      genderOpen: false,
      ...deriveView(
        this.data.items,
        this.data.activeTab,
        this.data.activeFilter,
        this.data.activeLitterId,
        nextId,
      ),
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

  openQuestionnaire() {
    wx.navigateTo({ url: "/pages/questionnaire/index" });
  },
});

function deriveView(
  items: CatListItem[],
  tab: TabKey,
  activeFilter: string,
  activeLitterId: string,
  activeGenderId: GenderFilterId,
) {
  const tabItems = items.filter((item) => item.kind === tab);
  const filters = tab === "kittens" ? KITTEN_FILTERS : STUD_FILTERS;
  const normalizedFilter = filters.includes(activeFilter)
    ? activeFilter
    : tab === "kittens"
      ? KITTEN_FILTERS[0]
      : STUD_FILTERS[0];
  const litterFilters = deriveLitterFilters(items);
  const normalizedLitterId = litterFilters.some((item) => item.id === activeLitterId)
    ? activeLitterId
    : "";
  const activeLitterLabel =
    litterFilters.find((item) => item.id === normalizedLitterId)?.name || "全部";
  const normalizedGenderId = GENDER_FILTERS.some((item) => item.id === activeGenderId)
    ? activeGenderId
    : "";
  const activeGenderLabel =
    GENDER_FILTERS.find((item) => item.id === normalizedGenderId)?.name || "全部";
  return {
    activeFilter: normalizedFilter,
    activeGenderId: normalizedGenderId,
    activeGenderLabel,
    activeLitterLabel,
    activeLitterId: normalizedLitterId,
    filters,
    genderFilters: GENDER_FILTERS,
    litterFilters,
    visibleItems: tabItems.filter(
      (item) =>
        item.statusKey === normalizedFilter &&
        (!normalizedGenderId || item.genderKey === normalizedGenderId) &&
        (tab !== "kittens" || !normalizedLitterId || item.litterId === normalizedLitterId),
    ),
  };
}

function toCatListItem(cat: CatData): CatListItem | null {
  const image = cat.mediaAssets.find((item) => item.usage === "cover") ?? cat.mediaAssets[0];
  const frame = resolveCatFrame(cat, "listCard");
  const imageFields = {
    imageClass: frame?.style ? "thumb-image positioned-image" : "thumb-image",
    imageMode: frame?.mode ?? "aspectFill",
    imageStyle: frame?.style ?? "",
    imageUrl: frame?.url || image?.thumbnailUrl || image?.sourceUrl || "",
  };
  if (cat.kittenProfile) {
    const status = saleStatusLabel(cat.kittenProfile.saleStatus);
    const color = cat.color || "待补充";
    const birthday = formatBirthday(cat.birthday);
    const litterName = formatLitterName(cat.kittenProfile.litter?.name || "");
    return {
      id: cat.id,
      ...imageFields,
      kind: "kittens",
      lineOne: `性别 ${genderLabel(cat.gender)} · 颜色 ${color}`,
      lineTwo: `生日 ${birthday}`,
      lineThree: "",
      litterId: cat.kittenProfile.litter?.id || "",
      litterName,
      genderKey: cat.gender || "",
      metaItems: [
        { label: "性别", value: genderLabel(cat.gender) },
        { label: "颜色", value: color },
        { label: "生日", value: birthday },
      ],
      name: cat.name,
      pill: status,
      statusKey: status,
    };
  }

  if (cat.breedingProfile) {
    const category = breedingCategoryLabel(cat.breedingProfile.category);
    const reproductiveState =
      cat.breedingProfile.statusLabel ||
      reproductiveStateLabel(cat.breedingProfile.reproductiveState);
    const color = cat.color || "颜色待补充";
    const trait = cat.breedingProfile.trait || cat.breedingProfile.source || "";
    const metaItems = [
      { label: "身份", value: category },
      { label: "颜色", value: color },
    ];
    if (trait) metaItems.push({ label: "特点", value: trait });
    if (cat.birthday) metaItems.push({ label: "生日", value: formatBirthday(cat.birthday) });
    return {
      id: cat.id,
      ...imageFields,
      kind: "studs",
      lineOne: `${category} · ${color}`,
      lineTwo: trait || "资料待补充",
      lineThree: cat.birthday ? `生日 ${formatBirthday(cat.birthday)}` : "",
      litterId: "",
      litterName: "",
      genderKey: cat.gender || "",
      metaItems,
      name: cat.name,
      pill: reproductiveState,
      statusKey: category,
    };
  }

  return null;
}

function deriveLitterFilters(items: CatListItem[]) {
  const filters: LitterFilter[] = [{ id: "", name: "全部" }];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.kind !== "kittens" || !item.litterId || seen.has(item.litterId)) continue;
    seen.add(item.litterId);
    const name = item.litterName || item.litterId;
    filters.push({ id: item.litterId, name });
  }
  return filters;
}

function formatLitterName(value: string) {
  const match = value.match(/([A-Z])\s*窝/i);
  if (match) return `${match[1].toUpperCase()}窝`;
  return value;
}

function formatBirthday(value: string | null) {
  return value ? value.slice(0, 10) : "待补充";
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "猫咪资料加载失败";
}
