import type { CommunityPostData } from "@starlitsky/shared";
import { listCommunityPosts, toggleCommunityPostLike } from "../../utils/public-content/index";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";

interface LinkedOptions {
  catId?: string;
  litterId?: string;
  title?: string;
}

interface PostCard {
  author: string;
  category: string;
  content: string;
  date: string;
  footerCommentLabel: string;
  footerLikeLabel: string;
  id: string;
  imageGridClass: string;
  images: Array<{ id: string; url: string }>;
  isPinned: boolean;
  likedByMe: boolean;
  linkedCats: Array<{ id: string; name: string }>;
  linkedLitters: Array<{ id: string; name: string }>;
  previewUrls: string[];
  roleLabel: string;
}

interface LinkedData {
  catId: string;
  emptyText: string;
  error: string;
  isLoading: boolean;
  litterId: string;
  posts: PostCard[];
  title: string;
}

interface LinkedPage {
  data: LinkedData;
  loadPosts(): Promise<void>;
  setData(data: Partial<LinkedData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    catId: "",
    emptyText: "这只猫还没有动态。",
    error: "",
    isLoading: true,
    litterId: "",
    posts: [],
    title: "猫友圈动态",
  } as LinkedData,

  async onLoad(this: LinkedPage, options: LinkedOptions) {
    const catId = options.catId ? decodeURIComponent(options.catId) : "";
    const litterId = options.litterId ? decodeURIComponent(options.litterId) : "";
    const title = normalizeTitle(options.title, catId);
    this.setData({
      catId,
      emptyText: catId ? "这只猫还没有动态。" : "当前还没有关联动态。",
      litterId,
      title,
    });
    wx.setNavigationBarTitle({ title });
    await this.loadPosts();
  },

  async onPullDownRefresh(this: LinkedPage) {
    await this.loadPosts();
    wx.stopPullDownRefresh();
  },

  async loadPosts(this: LinkedPage) {
    this.setData({ error: "", isLoading: true });
    try {
      const data = await listCommunityPosts({
        catId: this.data.catId || undefined,
        litterId: this.data.litterId || undefined,
        pageSize: 50,
      });
      this.setData({ error: "", isLoading: false, posts: data.items.map(toPostCard) });
    } catch (error) {
      this.setData({ error: getErrorMessage(error), isLoading: false, posts: [] });
    }
  },

  async retryLoad(this: LinkedPage) {
    await this.loadPosts();
  },

  openPost(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/community-detail/index?id=${encodeURIComponent(id)}` });
  },

  openCatTimeline(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name || "TA";
    if (!id) return;
    wx.navigateTo({
      url: `/pages/community-linked/index?catId=${encodeURIComponent(id)}&title=${encodeURIComponent(`${name}的动态`)}`,
    });
  },

  stopLitterTap() {},

  async toggleLike(this: LinkedPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    try {
      await ensureLoggedIn();
      await toggleCommunityPostLike(id);
      await this.loadPosts();
    } catch (error) {
      wx.showToast({ icon: "none", title: getErrorMessage(error) });
    }
  },

  previewImage(this: LinkedPage, event: TapEvent) {
    const postIndex = Number(event.currentTarget.dataset.postIndex || 0);
    const imageIndex = Number(event.currentTarget.dataset.imageIndex || 0);
    const post = this.data.posts[postIndex];
    if (!post || post.previewUrls.length === 0) return;
    wx.previewImage({ current: post.previewUrls[imageIndex] || post.previewUrls[0], urls: post.previewUrls });
  },
});

function toPostCard(post: CommunityPostData): PostCard {
  const images = post.mediaAssets
    .filter((item) => item.kind === "image")
    .slice(0, 9)
    .map((item) => ({ id: item.id, url: item.sourceUrl || item.thumbnailUrl || "" }))
    .filter((item) => item.url);
  return {
    author: post.authorName || "星月猫友",
    category: categoryLabel(post.category),
    content: post.content,
    date: formatDate(post.createdAt),
    footerCommentLabel: String(post.commentCount),
    footerLikeLabel: String(post.likeCount),
    id: post.id,
    imageGridClass: imageGridClass(images.length),
    images,
    isPinned: post.pinned,
    likedByMe: post.likedByMe,
    linkedCats: post.cats.map((cat) => ({ id: cat.id, name: cat.name })),
    linkedLitters: post.litters.map((litter) => ({ id: litter.id, name: litter.name })),
    previewUrls: images.map((image) => image.url),
    roleLabel: roleLabel(post.authorRole),
  };
}

function normalizeTitle(value: string | undefined, catId: string) {
  if (value) return decodeURIComponent(value).replace("的猫友圈动态", "的动态");
  return catId ? "猫咪动态" : "猫友圈动态";
}

function imageGridClass(count: number) {
  if (count <= 1) return "post-images single-image-grid";
  if (count === 2 || count === 4) return "post-images two-image-grid";
  return "post-images three-image-grid";
}

async function ensureLoggedIn() {
  const user = await refreshCurrentUser();
  if (user) return user;
  const session = await loginWithWechat();
  return session.user;
}

function categoryLabel(value: string) {
  if (value === "cattery_daily") return "猫舍日常";
  if (value === "personal_thoughts") return "碎碎念";
  if (value === "parent_share") return "家长分享";
  return value || "动态";
}

function roleLabel(value: string) {
  if (value === "keeper") return "猫舍主理人";
  if (value === "parent") return "家长";
  return value || "星月猫友";
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
  return error instanceof Error ? error.message : "猫友圈动态加载失败";
}
