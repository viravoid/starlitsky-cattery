import type { FixedPageMediaAssetData } from "@starlitsky/shared";
import { getFixedPage } from "../../utils/public-content/index";
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
  previewUrls: string[];
  section: EnvironmentSectionView | null;
  sectionId: string;
  showRoomDescriptions: boolean;
}

interface EnvironmentDetailPage {
  data: EnvironmentDetailData;
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
    previewUrls: [],
    section: null,
    sectionId: "",
    showRoomDescriptions: true,
  } as EnvironmentDetailData,

  async onLoad(this: EnvironmentDetailPage, options: EnvironmentDetailOptions) {
    const sectionId =
      typeof options.sectionId === "string" ? decodeURIComponent(options.sectionId) : "";
    this.setData({ sectionId });
    await this.loadSection(sectionId);
  },

  async onPullDownRefresh(this: EnvironmentDetailPage) {
    await this.loadSection(this.data.sectionId);
    wx.stopPullDownRefresh();
  },

  async loadSection(this: EnvironmentDetailPage, sectionId: string) {
    if (!sectionId) {
      this.setData({ error: "缺少环境分区 ID", isLoading: false });
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
      if (!section) throw new Error("未找到环境分区");

      const previewUrls = section.rooms.flatMap((room) => room.images.map((image) => image.url));
      this.setData({
        error: "",
        isLoading: false,
        previewUrls,
        section,
        sectionId,
        showRoomDescriptions:
          section.id !== "environment-zone-queen" && section.id !== "environment-zone-king",
      });
      wx.setNavigationBarTitle({ title: section.title });
    } catch (error) {
      this.setData({
        error: getErrorMessage(error),
        isLoading: false,
        previewUrls: [],
        section: null,
        sectionId,
        showRoomDescriptions: true,
      });
      wx.setNavigationBarTitle({ title: emptyFixedPageView("environment").title });
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
