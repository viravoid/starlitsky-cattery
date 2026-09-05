import {
  ENVIRONMENT_MEDIA_USAGES,
  getFixedPageMediaUrl,
  mapFixedPageMedia,
} from "@starlitsky/shared";
import type { FixedPageMediaAssetData, FixedPageMediaLike } from "@starlitsky/shared";
import { getFixedPage } from "../../utils/public-content";

interface FixedPageOptions {
  slug?: string;
}

interface ContactAccount {
  id: string;
  label: string;
  value: string;
}

interface ViewSection {
  body: string;
  mediaGroups: SectionMediaGroup[];
  title: string;
}

interface PageImage {
  altText: string;
  id: string;
  title: string;
  usage: string;
  url: string;
}

interface SectionMediaGroup {
  id: string;
  images: PageImage[];
  title: string;
}

interface FixedPageViewData {
  accounts: ContactAccount[];
  body: string;
  coverImage: PageImage | null;
  error: string;
  facts: string[];
  footerNotice: string;
  galleryImages: PageImage[];
  introduction: string;
  isContact: boolean;
  isLoading: boolean;
  previewUrls: string[];
  sections: ViewSection[];
  slug: string;
  title: string;
}

interface FixedPageInstance {
  data: FixedPageViewData;
  loadPage(slug: string): Promise<void>;
  previewPageImage(event: TapEvent): void;
  retryLoad(): Promise<void>;
  setData(data: Partial<FixedPageViewData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

const PAGE_DEFAULTS: Record<string, Omit<FixedPageViewData, "error" | "isLoading" | "slug">> = {
  about: {
    accounts: [],
    body: "欢迎了解我们的猫舍。星月缅因猫舍成立于 2019 年，位于西安，注册于 WCF、CFA。\n\n我们由主理人星下和月七全职经营，重视小猫健康、社会化训练、喂养和生活环境。",
    coverImage: null,
    facts: ["2019 年成立", "西安", "WCF / CFA 注册", "别墅散养", "长期售后"],
    footerNotice: "",
    galleryImages: [],
    introduction: "",
    isContact: false,
    previewUrls: [],
    sections: [],
    title: "猫舍介绍",
  },
  philosophy: {
    accounts: [],
    body: "我们希望繁育体质好、亲人、自信、能真正进入家庭生活的小猫。\n\n繁育不是追求数量，而是长期观察、谨慎搭配、尊重动物福利，并持续记录每一只小猫的成长。",
    coverImage: null,
    facts: [],
    footerNotice: "",
    galleryImages: [],
    introduction: "",
    isContact: false,
    previewUrls: [],
    sections: [],
    title: "繁育理念",
  },
  environment: {
    accounts: [],
    body: "猫舍采用别墅散养与科学分区，日常清洁消毒，尽量让猫咪在稳定、舒展、有互动的环境中生活。",
    coverImage: null,
    facts: ["600 余平生活空间", "科学分区", "拒绝笼养", "日常清洁消毒"],
    footerNotice: "",
    galleryImages: [],
    introduction: "",
    isContact: false,
    previewUrls: [],
    sections: [],
    title: "猫舍环境",
  },
  feeding: {
    accounts: [],
    body: "喂养体系以湿粮、熟自制、猫粮自助和营养补充结合，让小猫从小适应多样食物，减少挑食。",
    coverImage: null,
    facts: ["白天湿粮", "熟自制", "夜间猫粮自助", "冻干与营养补充"],
    footerNotice: "",
    galleryImages: [],
    introduction: "",
    isContact: false,
    previewUrls: [],
    sections: [],
    title: "喂养体系",
  },
  process: {
    accounts: [],
    body: "建议先阅读猫舍介绍与繁育理念，再填写问卷或联系主理人沟通。确认适合后进入排队、看猫、选猫、体检、绝育和接猫流程。",
    coverImage: null,
    facts: ["阅读介绍", "填写问卷", "沟通排队", "选猫确认", "体检绝育后接猫"],
    footerNotice: "",
    galleryImages: [],
    introduction: "",
    isContact: false,
    previewUrls: [],
    sections: [],
    title: "价格与接猫流程",
  },
  aftercare: {
    accounts: [],
    body: "我们重视长期售后。小猫去新家前会完成基础健康检查、疫苗安排和绝育要求，也会持续陪伴家长解决适应期问题。",
    coverImage: null,
    facts: ["遗传病筛查", "窝次透明", "去新家前健康检查", "长期售后"],
    footerNotice: "",
    galleryImages: [],
    introduction: "",
    isContact: false,
    previewUrls: [],
    sections: [],
    title: "售后保障",
  },
  contact: {
    accounts: [
      { id: "wechat", label: "微信号", value: "xingyuemianyinmao" },
      { id: "xiaohongshu", label: "小红书", value: "StarlitSky星月缅因猫舍" },
      { id: "weibo", label: "微博", value: "星月缅因猫舍" },
      { id: "douyin", label: "抖音", value: "星月家的猫" },
    ],
    body: "",
    coverImage: null,
    facts: [],
    footerNotice: "咨询前建议先读完接猫流程，方便我们更好地沟通。",
    galleryImages: [],
    introduction: "点击即可复制账号，欢迎来聊聊猫、看看小猫日常。",
    isContact: true,
    previewUrls: [],
    sections: [],
    title: "联系方式",
  },
};

Page({
  data: {
    ...PAGE_DEFAULTS.about,
    error: "",
    isLoading: true,
    slug: "about",
  } as FixedPageViewData,

  async onLoad(this: FixedPageInstance, options: FixedPageOptions) {
    const slug = normalizeSlug(options.slug);
    this.setData({ slug });
    await this.loadPage(slug);
  },

  async onPullDownRefresh(this: FixedPageInstance) {
    await this.loadPage(this.data.slug);
    wx.stopPullDownRefresh();
  },

  async loadPage(this: FixedPageInstance, slug: string) {
    const fallback = PAGE_DEFAULTS[slug] ?? PAGE_DEFAULTS.about;
    this.setData({ ...fallback, error: "", isLoading: true, slug });
    try {
      const page = await getFixedPage(slug);
      const viewData = normalizeFixedPage(slug, page.title, page.contentJson, page.mediaAssets);
      this.setData({
        ...viewData,
        error: "",
        isLoading: false,
        slug,
      });
      wx.setNavigationBarTitle({ title: viewData.title });
    } catch (error) {
      this.setData({ ...fallback, error: getErrorMessage(error), isLoading: false, slug });
      wx.setNavigationBarTitle({ title: fallback.title });
    }
  },

  async retryLoad(this: FixedPageInstance) {
    await this.loadPage(this.data.slug);
  },

  previewPageImage(this: FixedPageInstance, event: TapEvent) {
    const current = event.currentTarget.dataset.url;
    if (!current || this.data.previewUrls.length === 0) return;
    wx.previewImage({ current, urls: this.data.previewUrls });
  },

  copyAccount(event: TapEvent) {
    const value = event.currentTarget.dataset.value;
    if (!value) return;
    wx.setClipboardData({ data: value });
  },
});

function normalizeFixedPage(
  slug: string,
  title: string,
  value: unknown,
  mediaAssets: FixedPageMediaAssetData[] = [],
) {
  const fallback = PAGE_DEFAULTS[slug] ?? PAGE_DEFAULTS.about;
  const { environmentSlots, ...imageData } = normalizePageImages(slug, mediaAssets);
  if (!value || typeof value !== "object") {
    return {
      ...fallback,
      ...imageData,
      sections: attachEnvironmentMediaToSections(
        slug,
        normalizeViewSections(fallback.sections),
        environmentSlots,
      ),
      title: title || fallback.title,
    };
  }
  const input = value as Record<string, any>;
  if (Object.keys(input).length === 0)
    return {
      ...fallback,
      ...imageData,
      sections: attachEnvironmentMediaToSections(
        slug,
        normalizeViewSections(fallback.sections),
        environmentSlots,
      ),
      title: title || fallback.title,
    };
  const facts = input.facts && typeof input.facts === "object" ? Object.values(input.facts) : [];
  const accounts = Array.isArray(input.accounts)
    ? input.accounts
        .map((item: any, index: number) => ({
          id: stringOr(item?.id, `contact-${index}`),
          label: stringOr(item?.label, ""),
          value: stringOr(item?.value, ""),
        }))
        .filter((item: ContactAccount) => item.value)
    : fallback.accounts;
  const sections = normalizeViewSections(
    Array.isArray(input.sections)
      ? input.sections
          .map((item: any) => ({
            title: stringOr(item?.title, ""),
            body: stringOr(item?.body ?? item?.description ?? item?.content, ""),
          }))
          .filter((item) => item.title || item.body)
      : fallback.sections,
  );
  const sectionsWithMedia = attachEnvironmentMediaToSections(slug, sections, environmentSlots);

  return {
    ...fallback,
    ...imageData,
    accounts,
    body: stringOr(input.body ?? input.openingBelief, fallback.body),
    facts: facts.filter((item): item is string => typeof item === "string" && Boolean(item.trim())),
    footerNotice: stringOr(input.footerNotice, fallback.footerNotice),
    introduction: stringOr(input.introduction, fallback.introduction),
    isContact: slug === "contact",
    sections: sectionsWithMedia,
    title: title || fallback.title,
  };
}

function normalizeViewSections(sections: Array<Pick<ViewSection, "body" | "title">>) {
  return sections.map((section) => ({
    ...section,
    mediaGroups: [],
  }));
}

function normalizePageImages(slug: string, mediaAssets: FixedPageMediaAssetData[]) {
  const mapped = mapFixedPageMedia(slug, mediaAssets);
  return {
    coverImage: toPageImage(mapped.coverMedia),
    environmentSlots: {
      maternity: mapped.environmentSlots.maternity.map(toPageImage).filter(isPageImage),
      publicArea: mapped.environmentSlots.publicArea.map(toPageImage).filter(isPageImage),
      medical: mapped.environmentSlots.medical.map(toPageImage).filter(isPageImage),
    },
    galleryImages: mapped.galleryMedia.map(toPageImage).filter(isPageImage),
    previewUrls: mapped.previewMedia.map(getFixedPageMediaUrl).filter(Boolean),
  };
}

function attachEnvironmentMediaToSections(
  slug: string,
  sections: ViewSection[],
  environmentSlots: {
    maternity: PageImage[];
    publicArea: PageImage[];
    medical: PageImage[];
  },
) {
  if (slug !== "environment") return sections;

  return sections.map((section) => {
    const mediaGroups: SectionMediaGroup[] = [];
    if (section.title.includes("母婴")) {
      mediaGroups.push({
        id: ENVIRONMENT_MEDIA_USAGES.maternity,
        images: environmentSlots.maternity,
        title: "母婴房",
      });
    }
    if (section.title.includes("公共活动区") || section.title.includes("公区")) {
      mediaGroups.push({
        id: ENVIRONMENT_MEDIA_USAGES.publicArea,
        images: environmentSlots.publicArea,
        title: "公共活动区",
      });
    }
    if (section.title.includes("其他功能空间")) {
      mediaGroups.push({
        id: ENVIRONMENT_MEDIA_USAGES.medical,
        images: environmentSlots.medical,
        title: "医疗间",
      });
    }
    return {
      ...section,
      mediaGroups: mediaGroups.filter((group) => group.images.length > 0),
    };
  });
}

function toPageImage(media: FixedPageMediaLike | null): PageImage | null {
  if (!media) return null;
  const url = getFixedPageMediaUrl(media);
  if (!url) return null;
  return {
    altText: media.altText || media.title || "",
    id: `${media.id}:${media.usage}:${media.sortOrder}`,
    title: media.title || "",
    usage: media.usage,
    url,
  };
}

function isPageImage(image: PageImage | null): image is PageImage {
  return Boolean(image);
}

function normalizeSlug(value: unknown) {
  const slug = typeof value === "string" ? decodeURIComponent(value) : "about";
  return PAGE_DEFAULTS[slug] ? slug : "about";
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "内容加载失败";
}
