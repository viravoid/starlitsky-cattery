import type { CommunityPostCategory, CommunityPostData } from "@starlitsky/shared";
import { listCommunityPosts, toggleCommunityPostLike } from "../../utils/public-content/index";
import { getSessionState } from "../../store/session/index";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";

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
  commentCount: number;
  content: string;
  date: string;
  footerCommentLabel: string;
  footerLikeLabel: string;
  imageCount: number;
  imageGridClass: string;
  images: Array<{ id: string; url: string }>;
  isPinned: boolean;
  likeCount: number;
  likedByMe: boolean;
  linkedCats: Array<{ id: string; name: string }>;
  linkedLitters: Array<{ id: string; name: string }>;
  meta: string;
  previewUrls: string[];
  roleLabel: string;
}

interface CommunityData {
  activeCategory: "" | CommunityPostCategory;
  activeLitterLabel: string;
  activeLitterId: string;
  canPublish: boolean;
  categoryTabs: CategoryTab[];
  error: string;
  isLoading: boolean;
  litterFilters: LitterFilter[];
  litterOpen: boolean;
  posts: CommunityPostCard[];
  showMyCats: boolean;
}

interface CommunityPage {
  data: CommunityData;
  loadPosts(): Promise<void>;
  openMyCats(): void;
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
    activeLitterLabel: "全部窝次",
    activeLitterId: "",
    canPublish: false,
    categoryTabs: CATEGORY_TABS,
    error: "",
    isLoading: true,
    litterFilters: [{ id: "", name: "全部窝次" }],
    litterOpen: false,
    posts: [],
    showMyCats: false,
  } as CommunityData,

  async onLoad(this: CommunityPage) {
    await refreshCurrentUser();
    this.setData({ canPublish: canPublish(), showMyCats: canOpenMyCats() });
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
        activeLitterLabel: deriveActiveLitterLabel(this.data.activeLitterId, data.items),
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
    this.setData({ activeCategory: key, activeLitterLabel: "全部窝次", activeLitterId: "" });
    await this.loadPosts();
  },

  toggleLitter(this: CommunityPage) {
    this.setData({ litterOpen: !this.data.litterOpen });
  },

  async setLitter(this: CommunityPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id || "";
    if (id === this.data.activeLitterId) return;
    this.setData({ activeLitterId: id, litterOpen: false });
    await this.loadPosts();
  },

  openPost(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/community-detail/index?id=${encodeURIComponent(id)}` });
  },

  openPublish() {
    wx.navigateTo({ url: "/pages/community-publish/index" });
  },

  openMyCats() {
    wx.navigateTo({ url: "/pages/my-cats/index" });
  },

  async toggleLike(this: CommunityPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    try {
      await ensureLoggedIn();
      await toggleCommunityPostLike(id);
      await this.loadPosts();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  },

  previewImage(this: CommunityPage, event: TapEvent) {
    const postIndex = Number(event.currentTarget.dataset.postIndex || 0);
    const imageIndex = Number(event.currentTarget.dataset.imageIndex || 0);
    const post = this.data.posts[postIndex];
    if (!post || post.previewUrls.length === 0) return;
    wx.previewImage({ current: post.previewUrls[imageIndex] || post.previewUrls[0], urls: post.previewUrls });
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

function deriveActiveLitterLabel(activeLitterId: string, posts: CommunityPostData[]) {
  if (!activeLitterId) return "全部窝次";
  return (
    posts
      .flatMap((post) => post.litters)
      .find((litter) => litter.id === activeLitterId)?.name || "全部窝次"
  );
}

function toPostCard(post: CommunityPostData): CommunityPostCard {
  const images = post.mediaAssets
    .filter((item) => item.kind === "image")
    .slice(0, 9)
    .map((item) => ({
      id: item.id,
      url: item.sourceUrl || item.thumbnailUrl || "",
    }))
    .filter((item) => item.url);
  const likeCount = post.likeCount;
  const commentCount = post.commentCount;
  return {
    id: post.id,
    author: post.authorName || "星月猫友",
    category: categoryLabel(post.category),
    commentCount,
    content: post.content,
    date: formatDate(post.createdAt),
    footerCommentLabel: String(commentCount),
    footerLikeLabel: String(likeCount),
    imageCount: images.length,
    imageGridClass: imageGridClass(images.length),
    images,
    isPinned: post.pinned,
    likeCount,
    likedByMe: post.likedByMe,
    linkedCats: post.cats.map((cat) => ({ id: cat.id, name: cat.name })),
    linkedLitters: post.litters.map((litter) => ({ id: litter.id, name: litter.name })),
    meta: `${commentCount} 条评论 · ${likeCount} 个喜欢`,
    previewUrls: images.map((image) => image.url),
    roleLabel: post.authorRole || "星月猫友",
  };
}

function imageGridClass(count: number) {
  if (count <= 1) return "post-images single-image-grid";
  if (count === 2 || count === 4) return "post-images two-image-grid";
  return "post-images three-image-grid";
}

function canPublish() {
  const session = getSessionState();
  const roles = session.roles;
  return (
    roles.includes("admin") ||
    roles.includes("keeper") ||
    (roles.includes("parent") && session.user?.parentProfile?.status === "active")
  );
}

function canOpenMyCats() {
  return getSessionState().roles.includes("parent");
}

async function ensureLoggedIn() {
  const user = await refreshCurrentUser();
  if (user) return user;
  const session = await loginWithWechat();
  return session.user;
}

function showToast(title: string) {
  wx.showToast({ icon: "none", title });
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
