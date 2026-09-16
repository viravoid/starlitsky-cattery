import type { FixedPageMediaAssetData } from "@starlitsky/shared";
import { getFixedPage, listPublicCats } from "../../utils/public-content/index";
import {
  emptyFixedPageView,
  normalizeFixedPageView,
  type FixedPageViewData,
} from "../../utils/fixed-page-content";

interface FixedPageOptions {
  slug?: string;
}

interface FixedPageInstance {
  data: FixedPageViewData;
  loadPage(slug: string): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Partial<FixedPageViewData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    ...emptyFixedPageView("about"),
    isLoading: true,
  } as FixedPageViewData,

  async onLoad(this: FixedPageInstance, options: FixedPageOptions) {
    const slug = normalizeSlug(options.slug);
    this.setData({ ...emptyFixedPageView(slug), isLoading: true, slug });
    await this.loadPage(slug);
  },

  async onPullDownRefresh(this: FixedPageInstance) {
    await this.loadPage(this.data.slug);
    wx.stopPullDownRefresh();
  },

  async loadPage(this: FixedPageInstance, slug: string) {
    const fallback = emptyFixedPageView(slug);
    this.setData({ ...fallback, error: "", isLoading: true, slug });
    try {
      const page = await getFixedPage(slug);
      const cats = slug === "breeding-plan" ? (await listPublicCats({ pageSize: 100 })).items : [];
      const viewData = normalizeFixedPageView(
        slug,
        page.title,
        page.contentJson,
        page.mediaAssets as FixedPageMediaAssetData[],
        cats,
      );
      this.setData({ ...viewData, error: "", isLoading: false, slug });
      wx.setNavigationBarTitle({ title: viewData.title });
    } catch (error) {
      this.setData({
        ...fallback,
        error: getErrorMessage(error),
        isLoading: false,
        slug,
      });
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

  openEnvironmentSection(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/environment-detail/index?sectionId=${encodeURIComponent(id)}`,
    });
  },

  openStud(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/cat-detail/index?id=${encodeURIComponent(id)}&kind=studs`,
    });
  },
});

function normalizeSlug(value: unknown) {
  const slug = typeof value === "string" ? decodeURIComponent(value) : "about";
  return [
    "about",
    "aftercare",
    "breeding-plan",
    "contact",
    "environment",
    "feeding",
    "philosophy",
    "process",
  ].includes(slug)
    ? slug
    : "about";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "内容加载失败";
}
