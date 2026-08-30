import type { CommunityPostData } from "@starlitsky/shared";
import { getCommunityPost } from "../../utils/public-content";

interface DetailOptions {
  id?: string;
}

interface DetailImage {
  altText: string;
  id: string;
  title: string;
  url: string;
}

interface CommunityDetailData {
  author: string;
  category: string;
  content: string;
  date: string;
  error: string;
  id: string;
  images: DetailImage[];
  isLoading: boolean;
  linkedCats: string[];
  linkedLitters: string[];
  meta: string;
  pinned: boolean;
  previewUrls: string[];
}

interface CommunityDetailPage {
  data: CommunityDetailData;
  loadPost(id: string): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Partial<CommunityDetailData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    author: "",
    category: "",
    content: "",
    date: "",
    error: "",
    id: "",
    images: [],
    isLoading: true,
    linkedCats: [],
    linkedLitters: [],
    meta: "",
    pinned: false,
    previewUrls: [],
  } as CommunityDetailData,

  async onLoad(this: CommunityDetailPage, options: DetailOptions) {
    const id = typeof options.id === "string" ? decodeURIComponent(options.id) : "";
    this.setData({ id });
    await this.loadPost(id);
  },

  async onPullDownRefresh(this: CommunityDetailPage) {
    await this.loadPost(this.data.id);
    wx.stopPullDownRefresh();
  },

  async loadPost(this: CommunityDetailPage, id: string) {
    if (!id) {
      this.setData({ error: "缺少动态 ID", isLoading: false });
      return;
    }

    this.setData({ error: "", isLoading: true });
    try {
      const post = await getCommunityPost(id);
      this.setData({ ...toDetailView(post), error: "", id, isLoading: false });
      wx.setNavigationBarTitle({ title: categoryLabel(post.category) });
    } catch (error) {
      this.setData({ error: getErrorMessage(error), isLoading: false });
    }
  },

  async retryLoad(this: CommunityDetailPage) {
    await this.loadPost(this.data.id);
  },

  previewImage(this: CommunityDetailPage, event: TapEvent) {
    const url = event.currentTarget.dataset.url;
    if (!url || this.data.previewUrls.length === 0) return;
    wx.previewImage({ current: url, urls: this.data.previewUrls });
  },
});

function toDetailView(post: CommunityPostData) {
  const images = post.mediaAssets
    .filter((item) => item.kind === "image")
    .map((item) => {
      const url = item.sourceUrl || item.thumbnailUrl || "";
      if (!url) return null;
      return {
        altText: item.altText || item.title || "",
        id: item.id,
        title: item.title || "",
        url,
      };
    })
    .filter((item): item is DetailImage => Boolean(item));

  return {
    author: post.authorName || "星月猫友",
    category: categoryLabel(post.category),
    content: post.content,
    date: formatDate(post.createdAt),
    images,
    linkedCats: post.cats.map((cat) => cat.name),
    linkedLitters: post.litters.map((litter) => litter.name),
    meta: `${post.commentCount} 条评论 · ${post.likeCount} 个喜欢`,
    pinned: post.pinned,
    previewUrls: images.map((item) => item.url),
  };
}

function categoryLabel(value: string) {
  if (value === "cattery_daily") return "猫舍日常";
  if (value === "personal_thoughts") return "碎碎念";
  if (value === "parent_share") return "家长分享";
  return value || "动态详情";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "动态详情加载失败";
}
