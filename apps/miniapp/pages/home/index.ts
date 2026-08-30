import type { FixedPageMediaAssetData } from "@starlitsky/shared";
import { getFixedPage } from "../../utils/public-content";

interface HomeEntry {
  desc: string;
  no: string;
  title: string;
  url: string;
}

interface HomeGroup {
  cn: string;
  en: string;
  entries: HomeEntry[];
  lead: string;
}

interface HomeData {
  catsPreview: {
    description: string;
    title: string;
  };
  error: string;
  groups: HomeGroup[];
  heroImageUrl: string;
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
  previewHeroImage(): void;
  retryLoad(): Promise<void>;
  setData(data: Partial<HomeData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
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
      lead: "了解星月的成立时间、主理人与繁育理念、生活照顾方式。",
      entries: [
        entry("01", "猫舍介绍", "2019 年成立于西安，注册于 WCF、CFA。", "about"),
        entry("02", "猫舍环境", "600 余平别墅散养，科学分区，拒绝笼养。", "environment"),
        entry("03", "繁育理念", "繁育体质好、亲人自信的小猫。", "philosophy"),
        entry("04", "喂养体系", "湿粮、熟自制、猫粮与营养补充的日常体系。", "feeding"),
      ],
    },
    {
      en: "Before You Adopt",
      cn: "接猫前了解",
      lead: "正式咨询和接猫前，可以先了解流程、保障和联系方式。",
      entries: [
        entry("05", "价格与接猫流程", "阅读介绍、排队、选猫，到体检绝育后接猫。", "process"),
        entry("06", "售后保障", "遗传病筛查、窝次透明，去新家前完成基础保障。", "aftercare"),
        entry("07", "联系方式", "微信、小红书、微博、抖音账号可复制。", "contact"),
      ],
    },
  ],
  catsPreview: {
    title: "我们的猫",
    description: "查看在售与观察中的小猫，以及陪伴我们的种猫。",
  },
  heroImageUrl: "",
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

  previewHeroImage(this: HomePage) {
    if (!this.data.heroImageUrl || this.data.previewUrls.length === 0) return;
    wx.previewImage({ current: this.data.heroImageUrl, urls: this.data.previewUrls });
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
    url: `/pages/fixed-page/index?slug=${encodeURIComponent(slug)}`,
  };
}

function normalizeHomeContent(value: unknown, mediaAssets: FixedPageMediaAssetData[] = []) {
  const images = normalizeHomeImages(mediaAssets);
  if (!value || typeof value !== "object") return { ...DEFAULT_HOME, ...images };
  const input = value as Record<string, any>;
  const hero = isObject(input.hero) ? input.hero : {};
  const intro = isObject(input.intro) ? input.intro : {};
  const catsPreview = isObject(input.catsPreview) ? input.catsPreview : {};
  return {
    ...DEFAULT_HOME,
    title: stringOr(hero.title, DEFAULT_HOME.title),
    subtitle: stringOr(hero.subtitle, DEFAULT_HOME.subtitle),
    introMeta: [stringOr(intro.eyebrowPrefix, "Est."), stringOr(intro.fixedMeta, "")]
      .filter(Boolean)
      .join(" "),
    introBody: stringOr(intro.body, DEFAULT_HOME.introBody),
    catsPreview: {
      title: stringOr(catsPreview.title, DEFAULT_HOME.catsPreview.title),
      description: stringOr(catsPreview.description, DEFAULT_HOME.catsPreview.description),
    },
    ...images,
  };
}

function normalizeHomeImages(mediaAssets: FixedPageMediaAssetData[]) {
  const urls = mediaAssets
    .filter((item) => item.kind === "image")
    .map((item) => item.sourceUrl || item.thumbnailUrl || "")
    .filter(Boolean);
  return {
    heroImageUrl: urls[0] ?? "",
    previewUrls: urls,
  };
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
