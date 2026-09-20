import type { FixedPageMediaAssetData } from "@starlitsky/shared";
import { getFixedPage } from "../../utils/public-content/index";

interface HomeEntry {
  desc: string;
  no: string;
  statusLabel: string;
  title: string;
  url: string;
}

interface HomeGroup {
  artKey: "catProfile" | "windingPath";
  cn: string;
  en: string;
  entries: HomeEntry[];
  lead: string;
  partLabel: string;
  reverse: boolean;
}

interface HomeHeroSlide {
  id: string;
  imageUrl: string;
  label: string;
}

interface HomeData {
  catsPreview: {
    buttonText: string;
    description: string;
    eyebrow: string;
    title: string;
  };
  error: string;
  groups: HomeGroup[];
  hasHeroImages: boolean;
  currentHeroIndex: number;
  heroSlides: HomeHeroSlide[];
  introBody: string;
  introMeta: string;
  isLoading: boolean;
  previewUrls: string[];
  subtitle: string;
  title: string;
}

interface HomePage {
  data: HomeData;
  loadHome(): Promise<void>;
  onHeroChange(event: SwiperChangeEvent): void;
  previewHeroImage(event: TapEvent): void;
  retryLoad(): Promise<void>;
  setHeroSlide(event: TapEvent): void;
  setData(data: Partial<HomeData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

interface SwiperChangeEvent {
  detail: {
    current?: number;
  };
}

const DEFAULT_HOME = {
  title: "星月缅因猫舍",
  subtitle: "StarlitSky Maine Coon Cattery",
  introMeta: "Est. 2019 · Xi'an · WCF / CFA 注册",
  introBody:
    "做一家有温度的缅因猫舍\n低频率繁育，别墅散养，专注小猫社会化\n记录小猫从出生到去新家的日常\n绝育找家，长期售后",
  groups: [
    {
      en: "About StarlitSky",
      cn: "关于星月",
      lead: "了解星月缅因猫舍的\n成立时间、主理人\n与繁育理念、生活照顾方式。",
      entries: [
        entry("01", "猫舍介绍", "2019 年成立于西安，注册于 WCF、CFA，由星下与月七全职经营。", "about"),
        entry("02", "猫舍环境", "600 余平别墅散养，科学分区、拒绝笼养，另有三个院子供奔跑。", "environment"),
        entry("03", "繁育理念", "繁育体质好、亲人自信的小猫，从出生记录到去新家的每一步。", "philosophy"),
        entry("04", "繁育计划", "查看 2026 下半年繁育组合、预计时间与可能花色。", "breeding-plan"),
        entry("05", "喂养体系", "白天湿粮与熟自制，夜间猫粮自助并补充冻干、营养品。", "feeding"),
      ],
      artKey: "catProfile" as const,
      partLabel: "One",
      reverse: false,
    },
    {
      en: "Before You Adopt",
      cn: "接猫前了解",
      lead: "在正式咨询和接猫前\n可以先了解流程、保障\n问卷和联系方式。",
      entries: [
        entry("01", "价格与接猫流程", "阅读介绍、填写问卷、排队、选猫，到疫苗体检绝育后接猫。", "process"),
        entry("02", "售后保障", "种猫遗传病 all n/n，窝次透明，去新家前完成疫苗、体检与绝育。", "aftercare"),
        {
          no: "03",
          title: "选猫问卷",
          desc: "填写一份问卷，让我们更好地了解你的期待与生活方式。",
          statusLabel: "",
          url: "/pages/questionnaire/index",
        },
        entry("04", "联系方式", "微信、小红书、微博、抖音与小猫日常号，都可一键复制。", "contact"),
      ],
      artKey: "windingPath" as const,
      partLabel: "Two",
      reverse: true,
    },
  ],
  catsPreview: {
    eyebrow: "Our Cats",
    title: "我们的猫",
    description: "在售与观察中的小猫，以及陪伴我们的种猫，血线清晰、健康透明。",
    buttonText: "查看小猫与种猫",
  },
  hasHeroImages: false,
  currentHeroIndex: 0,
  heroSlides: [
    { id: "hero-1", imageUrl: "", label: "示例图片（首页轮播照片 1，待替换）" },
    { id: "hero-2", imageUrl: "", label: "示例图片（首页轮播照片 2，待替换）" },
    { id: "hero-3", imageUrl: "", label: "示例图片（首页轮播照片 3，待替换）" },
  ],
  previewUrls: [],
};

Page({
  data: {
    ...DEFAULT_HOME,
    error: "",
    isLoading: true,
  } as HomeData,

  async onLoad(this: HomePage) {
    await this.loadHome();
  },

  async onPullDownRefresh(this: HomePage) {
    await this.loadHome();
    wx.stopPullDownRefresh();
  },

  async loadHome(this: HomePage) {
    this.setData({ error: "", isLoading: true });
    try {
      const page = await getFixedPage("home");
      this.setData({
        ...normalizeHomeContent(page.contentJson, page.mediaAssets),
        error: "",
        isLoading: false,
      });
    } catch (error) {
      this.setData({
        ...DEFAULT_HOME,
        error: getErrorMessage(error),
        isLoading: false,
      });
    }
  },

  async retryLoad(this: HomePage) {
    await this.loadHome();
  },

  previewHeroImage(this: HomePage, event: TapEvent) {
    const current = event.currentTarget.dataset.url;
    if (!current || this.data.previewUrls.length === 0) return;
    wx.previewImage({ current, urls: this.data.previewUrls });
  },

  onHeroChange(this: HomePage, event: SwiperChangeEvent) {
    this.setData({ currentHeroIndex: event.detail.current ?? 0 });
  },

  setHeroSlide(this: HomePage, event: TapEvent) {
    const index = Number(event.currentTarget.dataset.index ?? 0);
    if (!Number.isNaN(index)) this.setData({ currentHeroIndex: index });
  },

  openEntry(event: TapEvent) {
    const url = event.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url });
  },

  openCats() {
    wx.switchTab({ url: "/pages/cats/index" });
  },
});

function entry(no: string, title: string, desc: string, slug: string): HomeEntry {
  return {
    no,
    title,
    desc,
    statusLabel: "",
    url: `/pages/fixed-page/index?slug=${encodeURIComponent(slug)}`,
  };
}

function normalizeHomeContent(value: unknown, mediaAssets: FixedPageMediaAssetData[] = []) {
  const heroSlides = normalizeHomeSlides(value, mediaAssets);
  const images = normalizeHomeImages(heroSlides);
  if (!value || typeof value !== "object") return { ...DEFAULT_HOME, ...images };
  const input = value as Record<string, any>;
  const hero = isObject(input.hero) ? input.hero : {};
  const intro = isObject(input.intro) ? input.intro : {};
  const catsPreview = isObject(input.catsPreview) ? input.catsPreview : {};
  const entriesInput = isObject(input.entries) ? input.entries : {};
  const groupsInput = Array.isArray(input.groups) ? input.groups : [];
  return {
    ...DEFAULT_HOME,
    title: stringOr(hero.title, DEFAULT_HOME.title),
    subtitle: stringOr(hero.subtitle, DEFAULT_HOME.subtitle),
    introMeta: [stringOr(intro.eyebrowPrefix, "Est."), stringOr(intro.fixedMeta, "2019 · Xi'an · WCF / CFA 注册")]
      .filter(Boolean)
      .join(" "),
    introBody: stringOr(intro.body, DEFAULT_HOME.introBody),
    catsPreview: {
      eyebrow: stringOr(catsPreview.eyebrow, DEFAULT_HOME.catsPreview.eyebrow),
      title: stringOr(catsPreview.title, DEFAULT_HOME.catsPreview.title),
      description: stringOr(catsPreview.description, DEFAULT_HOME.catsPreview.description),
      buttonText: stringOr(catsPreview.buttonText, DEFAULT_HOME.catsPreview.buttonText),
    },
    groups: normalizeGroups(groupsInput, entriesInput),
    ...images,
  };
}

function normalizeHomeSlides(value: unknown, mediaAssets: FixedPageMediaAssetData[]) {
  const input = isObject(value) ? (value as Record<string, any>) : {};
  const hero = isObject(input.hero) ? input.hero : {};
  const contentSlides = Array.isArray(hero.slides) ? hero.slides : DEFAULT_HOME.heroSlides;
  const mediaById = new Map(mediaAssets.map((item) => [item.id, item]));

  return contentSlides.map((slide: any, index: number) => {
    const id = stringOr(slide?.id, `hero-${index + 1}`);
    const label = stringOr(slide?.label, `首页轮播照片 ${index + 1}`);
    const imageId = typeof slide?.imageId === "string" ? slide.imageId : "";
    const matched = imageId ? mediaById.get(imageId) : null;
    return {
      id,
      imageUrl: matched ? matched.sourceUrl || matched.thumbnailUrl || "" : "",
      label,
    };
  });
}

function normalizeHomeImages(heroSlides: HomeHeroSlide[]) {
  const urls = heroSlides.map((item) => item.imageUrl).filter(Boolean);
  return {
    hasHeroImages: urls.length > 0,
    heroSlides,
    previewUrls: urls,
  };
}

function normalizeGroups(groupsInput: any[], entriesInput: Record<string, unknown>): HomeGroup[] {
  const entryIndex = new Map<string, any>(
    Object.entries(entriesInput).filter(([, value]) => isObject(value)),
  );
  const groups = groupsInput.length ? groupsInput : DEFAULT_HOME.groups;
  return groups.map((group, groupIndex) => {
    const fallback = DEFAULT_HOME.groups[groupIndex] ?? DEFAULT_HOME.groups[0];
    const order = Array.isArray(group?.entryOrder)
      ? group.entryOrder
      : fallback.entries.map((item) => item.title);
    const entries = order
      .map((entryId: unknown, index: number) => {
        const item = typeof entryId === "string" ? entryIndex.get(entryId) : null;
        if (!item) return fallback.entries[index];
        return {
          no: String(index + 1).padStart(2, "0"),
          title: stringOr(item.title, fallback.entries[index]?.title ?? ""),
          desc: stringOr(item.desc, fallback.entries[index]?.desc ?? ""),
          statusLabel: stringOr(item.statusLabel, ""),
          url: toMiniappUrl(item.to, fallback.entries[index]?.url ?? ""),
        };
      })
      .filter(Boolean);
    return {
      artKey: group?.artKey === "windingPath" ? "windingPath" : "catProfile",
      cn: stringOr(group?.cn, fallback.cn),
      en: stringOr(group?.en, fallback.en),
      entries,
      lead: stringOr(group?.lead, fallback.lead),
      partLabel: groupIndex === 0 ? "One" : groupIndex === 1 ? "Two" : String(groupIndex + 1),
      reverse: groupIndex % 2 === 1,
    };
  });
}

function toMiniappUrl(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value) return fallback;
  if (value === "/cats") return "/pages/cats/index";
  if (value === "/questionnaire") return "/pages/questionnaire/index";
  const slug = value.replace(/^\//, "");
  return `/pages/fixed-page/index?slug=${encodeURIComponent(slug)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "内容加载失败";
}
