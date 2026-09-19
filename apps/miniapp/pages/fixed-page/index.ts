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

  async openAftercareContract(this: FixedPageInstance) {
    if (!this.data.aftercareContractUrl) return;
    try {
      const tempFilePath = await downloadTempFile(
        this.data.aftercareContractUrl,
        this.data.aftercareContractExtension,
      );
      wx.openDocument({
        filePath: tempFilePath,
        fileType: this.data.aftercareContractExtension || undefined,
        showMenu: true,
        fail(error) {
          wx.showToast({ icon: "none", title: error.errMsg || "合同打开失败" });
        },
      });
    } catch (error) {
      wx.showToast({ icon: "none", title: getErrorMessage(error) });
    }
  },

  async downloadAftercareContract(this: FixedPageInstance) {
    if (!this.data.aftercareContractUrl) return;
    try {
      await downloadTempFile(
        this.data.aftercareContractUrl,
        this.data.aftercareContractExtension,
      );
      wx.showToast({ icon: "success", title: "合同已下载" });
    } catch (error) {
      wx.showToast({ icon: "none", title: getErrorMessage(error) });
    }
  },
});

function downloadTempFile(url: string, extension: string) {
  return new Promise<string>((resolve, reject) => {
    wx.request({
      url,
      method: "GET",
      responseType: "arraybuffer",
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error("合同下载失败"));
          return;
        }
        if (!(response.data instanceof ArrayBuffer)) {
          reject(new Error("合同文件格式异常"));
          return;
        }
        const suffix = extension || "pdf";
        const filePath = `${wx.env.USER_DATA_PATH}/aftercare-contract-${Date.now()}.${suffix}`;
        wx.getFileSystemManager().writeFile({
          filePath,
          data: response.data,
          success() {
            resolve(filePath);
          },
          fail(error) {
            reject(new Error(error.errMsg || "合同写入失败"));
          },
        });
      },
      fail(error) {
        reject(new Error(error.errMsg || "合同下载失败"));
      },
    });
  });
}

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
