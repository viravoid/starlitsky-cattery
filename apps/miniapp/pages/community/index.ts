import type { CommunityPostCategory, CommunityPostData } from "@starlitsky/shared";
import { listCommunityPosts } from "../../utils/public-content";

interface CategoryTab {
  key: "" | CommunityPostCategory;
  label: string;
}

interface LitterFilter {
  id: string;
  name: string;
}

interface CommunityPostCard {
  id: string;
  author: string;
  category: string;
  content: string;
  date: string;
  firstImageUrl: string;
  imageCount: number;
  isPinned: boolean;
  linkedCats: string;
  linkedLitters: string;
  meta: string;
  previewUrls: string[];
}

interface CommunityData {
  activeCategory: "" | CommunityPostCategory;
  activeLitterId: string;
  categoryTabs: CategoryTab[];
  error: string;
  isLoading: boolean;
  litterFilters: LitterFilter[];
  posts: CommunityPostCard[];
}

interface CommunityPage {
  data: CommunityData;
  loadPosts(): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Partial<CommunityData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

const CATEGORY_TABS: CategoryTab[] = [
  { key: "", label: "全部" },
  { key: "cattery_daily", label: "猫舍日常" },
  { key: "personal_thoughts", label: "碎碎念" },
  { key: "parent_share", label: "家长分享" },
];

Page({
  data: {
    activeCategory: "",
    activeLitterId: "",
    categoryTabs: CATEGORY_TABS,
    error: "",
    isLoading: true,
    litterFilters: [{ id: "", name: "全部窝次" }],
    posts: [],
  } as CommunityData,

  async onLoad(this: CommunityPage) {
    await this.loadPosts();
  },

  async onPullDownRefresh(this: CommunityPage) {
    await this.loadPosts();
    wx.stopPullDownRefresh();
  },

  async loadPosts(this: CommunityPage) {
    this.setData({ error: "", isLoading: true });
    try {
      const data = await listCommunityPosts({
        category: this.data.activeCategory || undefined,
        litterId: this.data.activeLitterId || undefined,
        pageSize: 50,
      });
      this.setData({
        error: "",
        isLoading: false,
        litterFilters: deriveLitterFilters(data.items),
        posts: data.items.map(toPostCard),
      });
    } catch (error) {
      this.setData({
        error: getErrorMessage(error),
        isLoading: false,
        posts: [],
      });
    }
  },

  async retryLoad(this: CommunityPage) {
    await this.loadPosts();
  },

  async setCategory(this: CommunityPage, event: TapEvent) {
    const key = event.currentTarget.dataset.key as "" | CommunityPostCategory;
    if (key === this.data.activeCategory) return;
    this.setData({ activeCategory: key, activeLitterId: "" });
    await this.loadPosts();
  },

  async setLitter(this: CommunityPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id || "";
    if (id === this.data.activeLitterId) return;
    this.setData({ activeLitterId: id });
    await this.loadPosts();
  },

  openPost(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/community-detail/index?id=${encodeURIComponent(id)}` });
  },

  previewImage(this: CommunityPage, event: TapEvent) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const post = this.data.posts[index];
    if (!post || post.previewUrls.length === 0) return;
    wx.previewImage({ current: post.firstImageUrl, urls: post.previewUrls });
  },
});

function deriveLitterFilters(posts: CommunityPostData[]) {
  const filters: LitterFilter[] = [{ id: "", name: "全部窝次" }];
  const seen = new Set<string>();
  for (const post of posts) {
    for (const litter of post.litters) {
      if (seen.has(litter.id)) continue;
      seen.add(litter.id);
      filters.push({ id: litter.id, name: litter.name });
    }
  }
  return filters;
}

function toPostCard(post: CommunityPostData): CommunityPostCard {
  const images = post.mediaAssets
    .filter((item) => item.kind === "image")
    .map((item) => item.sourceUrl || item.thumbnailUrl || "")
    .filter(Boolean);
  return {
    id: post.id,
    author: post.authorName || "星月猫友",
    category: categoryLabel(post.category),
    content: post.content,
    date: formatDate(post.createdAt),
    firstImageUrl: images[0] ?? "",
    imageCount: images.length,
    isPinned: post.pinned,
    linkedCats: post.cats.map((cat) => cat.name).join("、"),
    linkedLitters: post.litters.map((litter) => litter.name).join("、"),
    meta: `${post.commentCount} 条评论 · ${post.likeCount} 个喜欢`,
    previewUrls: images,
  };
}

function categoryLabel(value: string) {
  if (value === "cattery_daily") return "猫舍日常";
  if (value === "personal_thoughts") return "碎碎念";
  if (value === "parent_share") return "家长分享";
  return value || "动态";
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
  return error instanceof Error ? error.message : "猫友圈加载失败";
}
