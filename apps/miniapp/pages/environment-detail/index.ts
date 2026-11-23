import type { FixedPageMediaAssetData } from "@starlitsky/shared";
import { getFixedPage } from "../../utils/public-content/index";
import { decodeRouteParam, isTimelineSinglePage, setNativeShareMenu, sharePath, shareQuery, unavailableFriendShare } from "../../utils/native-share";
import {
  emptyFixedPageView,
  findEnvironmentSection,
  normalizeFixedPageView,
  type EnvironmentSectionView,
} from "../../utils/fixed-page-content";

interface EnvironmentDetailOptions {
  sectionId?: string;
}

interface EnvironmentDetailData {
  error: string;
  isLoading: boolean;
  shareReady: boolean;
  previewUrls: string[];
  section: EnvironmentSectionView | null;
  sectionId: string;
  showRoomDescriptions: boolean;
}

interface EnvironmentDetailPage {
  data: EnvironmentDetailData;
  shareVisible?: boolean;
  loadSection(sectionId: string): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Partial<EnvironmentDetailData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    error: "",
    isLoading: true,
    shareReady: false,
    previewUrls: [],
    section: null,
    sectionId: "",
    showRoomDescriptions: true,
  } as EnvironmentDetailData,

  async onLoad(this: EnvironmentDetailPage, options: EnvironmentDetailOptions) {
    setNativeShareMenu(false);
    const sectionId = decodeRouteParam(options.sectionId);
    this.setData({ sectionId, shareReady: false });
    await this.loadSection(sectionId);
  },

  onShow(this: EnvironmentDetailPage) {
    this.shareVisible = true;
    setNativeShareMenu(this.data.shareReady);
  },

  onHide(this: EnvironmentDetailPage) {
    this.shareVisible = false;
    setNativeShareMenu(false);
  },

  onUnload(this: EnvironmentDetailPage) {
    this.shareVisible = false;
    setNativeShareMenu(false);
  },

  onShareAppMessage(this: EnvironmentDetailPage) {
    const section = this.data.shareReady ? this.data.section : null;
    if (!section) return unavailableFriendShare();
    return {
      title: `${section.title} · 星月猫舍环境`,
      path: sharePath("/pages/environment-detail/index", { sectionId: section.id }),
    };
  },

  onShareTimeline(this: EnvironmentDetailPage) {
    const section = this.data.shareReady ? this.data.section : null;
    if (!section) return { title: "星月缅因猫舍", query: "" };
    return {
      title: `${section.title} · 星月猫舍环境`,
      query: shareQuery({ sectionId: section.id }),
    };
  },

  async onPullDownRefresh(this: EnvironmentDetailPage) {
    await this.loadSection(this.data.sectionId);
    wx.stopPullDownRefresh();
  },

  async loadSection(this: EnvironmentDetailPage, sectionId: string) {
    this.setData({ shareReady: false });
    if (this.shareVisible) setNativeShareMenu(false);
    if (!sectionId) {
      this.setData({ error: "缺少环境分区 ID", isLoading: false, section: null });
      return;
    }

    this.setData({ error: "", isLoading: true });
    try {
      const page = await getFixedPage("environment");
      const view = normalizeFixedPageView(
        "environment",
        page.title,
        page.contentJson,
        page.mediaAssets as FixedPageMediaAssetData[],
      );
      const section = findEnvironmentSection(view, sectionId);
      if (!section || page.status !== "published" || section.id !== sectionId) {
        throw new Error("未找到公开的环境分区");
      }

      const previewUrls = section.rooms.flatMap((room) => room.images.map((image) => image.url));
      this.setData({
        error: "",
        isLoading: false,
        shareReady: true,
        previewUrls,
        section,
        sectionId,
        showRoomDescriptions:
          section.id !== "environment-zone-queen" && section.id !== "environment-zone-king",
      });
      if (this.shareVisible) setNativeShareMenu(true);
      if (!isTimelineSinglePage()) wx.setNavigationBarTitle({ title: section.title });
    } catch (error) {
      this.setData({
        error: getErrorMessage(error),
        isLoading: false,
        shareReady: false,
        previewUrls: [],
        section: null,
        sectionId,
        showRoomDescriptions: true,
      });
      if (!isTimelineSinglePage()) wx.setNavigationBarTitle({ title: emptyFixedPageView("environment").title });
    }
  },

  async retryLoad(this: EnvironmentDetailPage) {
    await this.loadSection(this.data.sectionId);
  },

  previewImage(this: EnvironmentDetailPage, event: TapEvent) {
    const current = event.currentTarget.dataset.url;
    if (!current || this.data.previewUrls.length === 0) return;
    wx.previewImage({ current, urls: this.data.previewUrls });
  },
});

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "内容加载失败";
}
