import { listPublicCats } from "../../utils/public-content/index";
import { toPublicCatCard, type PublicCatCard } from "../../utils/public-cat-card";
import { setNativeShareMenu } from "../../utils/native-share";

type TabKey = "kittens" | "studs";
type GenderFilterId = "" | "male" | "female";

type CatListItem = PublicCatCard;

interface CatsPage {
  data: {
    activeFilter: string;
    activeGenderId: GenderFilterId;
    activeGenderLabel: string;
    activeLitterLabel: string;
    activeLitterId: string;
    activeTab: TabKey;
    filterPanelOpen: boolean;
    genderFilters: GenderFilter[];
    hasKittenFilters: boolean;
    items: CatListItem[];
    kittenStatusFilters: string[];
    litterFilters: LitterFilter[];
    studFilters: StudFilter[];
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
  id: Exclude<GenderFilterId, "">;
  name: string;
}

interface StudFilter {
  label: string;
  value: string;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

const KITTEN_FILTERS = ["找家中", "待找家", "已有家"];
const STUD_FILTERS: StudFilter[] = [
  { label: "全部", value: "" },
  { label: "现役公猫", value: "现役公猫" },
  { label: "现役母猫", value: "现役母猫" },
  { label: "预备役", value: "预备役种猫" },
];
const GENDER_FILTERS: GenderFilter[] = [
  { id: "male", name: "弟弟" },
  { id: "female", name: "妹妹" },
];

Page({
  data: {
    activeFilter: "",
    activeGenderId: "" as GenderFilterId,
    activeGenderLabel: "",
    activeLitterLabel: "",
    activeLitterId: "",
    activeTab: "kittens" as TabKey,
    error: "",
    filterPanelOpen: false,
    genderFilters: GENDER_FILTERS,
    hasKittenFilters: false,
    isLoading: true,
    items: [] as CatListItem[],
    kittenStatusFilters: KITTEN_FILTERS,
    litterFilters: [] as LitterFilter[],
    studFilters: STUD_FILTERS,
    visibleItems: [] as CatListItem[],
  },

  async onLoad(this: CatsPage) {
    await this.loadCats();
  },

  onShow(this: CatsPage) {
    setNativeShareMenu(true);
    this.getTabBar?.()?.setData({ selected: 1 });
  },

  onHide() {
    setNativeShareMenu(false);
  },

  onUnload() {
    setNativeShareMenu(false);
  },

  onShareAppMessage() {
    return { title: "星月缅因猫舍 · 我们的猫", path: "/pages/cats/index" };
  },

  onShareTimeline() {
    return { title: "星月缅因猫舍 · 我们的猫", query: "" };
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
        .map(toPublicCatCard)
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
      filterPanelOpen: false,
      ...deriveView(
        this.data.items,
        tab,
        "",
        "",
        "",
      ),
    });
  },

  showAllKittens(this: CatsPage) {
    this.setData({
      filterPanelOpen: false,
      ...deriveView(this.data.items, "kittens", "", "", ""),
    });
  },

  toggleKittenFilterPanel(this: CatsPage) {
    this.setData({ filterPanelOpen: !this.data.filterPanelOpen });
  },

  setStatusFilter(this: CatsPage, event: TapEvent) {
    const filter = event.currentTarget.dataset.filter;
    const nextFilter = filter === this.data.activeFilter ? "" : filter;
    this.setData({
      ...deriveView(
        this.data.items,
        this.data.activeTab,
        nextFilter,
        this.data.activeLitterId,
        this.data.activeGenderId,
      ),
    });
  },

  setStudFilter(this: CatsPage, event: TapEvent) {
    const filter = event.currentTarget.dataset.filter || "";
    this.setData({
      filterPanelOpen: false,
      ...deriveView(this.data.items, "studs", filter, "", ""),
    });
  },

  setLitter(this: CatsPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id || "";
    const nextId = id === this.data.activeLitterId ? "" : id;
    this.setData({
      ...deriveView(
        this.data.items,
        this.data.activeTab,
        this.data.activeFilter,
        nextId,
        this.data.activeGenderId,
      ),
    });
  },

  setGender(this: CatsPage, event: TapEvent) {
    const id = (event.currentTarget.dataset.id || "") as GenderFilterId;
    const nextId = id === this.data.activeGenderId ? "" : id;
    this.setData({
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
  const normalizedFilter =
    tab === "kittens"
      ? KITTEN_FILTERS.includes(activeFilter)
        ? activeFilter
        : ""
      : STUD_FILTERS.some((item) => item.value === activeFilter)
        ? activeFilter
        : "";
  const litterFilters = deriveLitterFilters(items);
  const normalizedLitterId = litterFilters.some((item) => item.id === activeLitterId)
    ? activeLitterId
    : "";
  const activeLitterLabel =
    litterFilters.find((item) => item.id === normalizedLitterId)?.name || "";
  const normalizedGenderId =
    tab === "kittens" && GENDER_FILTERS.some((item) => item.id === activeGenderId)
      ? activeGenderId
      : "";
  const activeGenderLabel =
    GENDER_FILTERS.find((item) => item.id === normalizedGenderId)?.name || "";
  const hasKittenFilters =
    tab === "kittens" && Boolean(normalizedFilter || normalizedLitterId || normalizedGenderId);
  return {
    activeFilter: normalizedFilter,
    activeGenderId: normalizedGenderId,
    activeGenderLabel,
    activeLitterLabel,
    activeLitterId: normalizedLitterId,
    hasKittenFilters,
    genderFilters: GENDER_FILTERS,
    kittenStatusFilters: KITTEN_FILTERS,
    litterFilters,
    studFilters: STUD_FILTERS,
    visibleItems: tabItems.filter(
      (item) =>
        (!normalizedFilter || item.statusKey === normalizedFilter) &&
        (tab !== "kittens" || !normalizedGenderId || item.genderKey === normalizedGenderId) &&
        (tab !== "kittens" || !normalizedLitterId || item.litterId === normalizedLitterId),
    ),
  };
}

function deriveLitterFilters(items: CatListItem[]) {
  const filters: LitterFilter[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.kind !== "kittens" || !item.litterId || seen.has(item.litterId)) continue;
    seen.add(item.litterId);
    const name = item.litterName || item.litterId;
    filters.push({ id: item.litterId, name });
  }
  return filters;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "猫咪资料加载失败";
}
