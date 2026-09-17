import type { CommunityPostData } from "@starlitsky/shared";
import {
  deleteCommunityPost,
  listMyCommunityPosts,
} from "../../utils/public-content/index";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";
import { getSessionState } from "../../store/session/index";

interface PostCard {
  author: string;
  canDelete: boolean;
  canEdit: boolean;
  category: string;
  content: string;
  date: string;
  id: string;
  imageGridClass: string;
  images: Array<{ id: string; url: string }>;
  meta: string;
  previewUrls: string[];
}

interface MyPostsData {
  canPublish: boolean;
  error: string;
  isLoading: boolean;
  parentInactive: boolean;
  posts: PostCard[];
}

interface MyPostsPage {
  data: MyPostsData;
  loadPosts(): Promise<void>;
  setData(data: Partial<MyPostsData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    canPublish: false,
    error: "",
    isLoading: true,
    parentInactive: false,
    posts: [],
  } as MyPostsData,

  async onLoad(this: MyPostsPage) {
    await this.loadPosts();
  },

  async onShow(this: MyPostsPage) {
    await this.loadPosts();
  },

  async onPullDownRefresh(this: MyPostsPage) {
    await this.loadPosts();
    wx.stopPullDownRefresh();
  },

  async loadPosts(this: MyPostsPage) {
    this.setData({ error: "", isLoading: true });
    try {
      await ensureLoggedIn();
      const data = await listMyCommunityPosts({ pageSize: 100 });
      this.setData({
        canPublish: canPublish(),
        error: "",
        isLoading: false,
        parentInactive: isParentInactive(),
        posts: data.items.map(toPostCard),
      });
    } catch (error) {
      this.setData({ error: getErrorMessage(error), isLoading: false, posts: [] });
    }
  },

  async retryLoad(this: MyPostsPage) {
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

  openEdit(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/community-publish/index?id=${encodeURIComponent(id)}` });
  },

  async deletePost(this: MyPostsPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const confirmed = await confirm("确定删除这条动态吗？");
    if (!confirmed) return;
    try {
      await deleteCommunityPost(id);
      showToast("已删除");
      await this.loadPosts();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  },

  previewImage(this: MyPostsPage, event: TapEvent) {
    const postIndex = Number(event.currentTarget.dataset.postIndex || 0);
    const imageIndex = Number(event.currentTarget.dataset.imageIndex || 0);
    const post = this.data.posts[postIndex];
    if (!post || post.previewUrls.length === 0) return;
    wx.previewImage({ current: post.previewUrls[imageIndex] || post.previewUrls[0], urls: post.previewUrls });
  },
});

async function ensureLoggedIn() {
  const user = await refreshCurrentUser();
  if (user) return user;
  const session = await loginWithWechat();
  return session.user;
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

function isParentInactive() {
  const session = getSessionState();
  return (
    session.roles.includes("parent") &&
    Boolean(session.user?.parentProfile?.status) &&
    session.user?.parentProfile?.status !== "active"
  );
}

function toPostCard(post: CommunityPostData): PostCard {
  const images = post.mediaAssets
    .filter((item) => item.kind === "image")
    .slice(0, 9)
    .map((item) => ({ id: item.id, url: item.sourceUrl || item.thumbnailUrl || "" }))
    .filter((item) => item.url);
  return {
    author: post.authorName || "星月猫友",
    canDelete: post.canDelete,
    canEdit: post.canEdit,
    category: categoryLabel(post.category),
    content: post.content,
    date: formatDate(post.createdAt),
    id: post.id,
    imageGridClass: imageGridClass(images.length),
    images,
    meta: `${post.commentCount} 条评论 · ${post.likeCount} 个喜欢`,
    previewUrls: images.map((image) => image.url),
  };
}

function imageGridClass(count: number) {
  if (count <= 1) return "post-images single-image-grid";
  if (count === 2 || count === 4) return "post-images two-image-grid";
  return "post-images three-image-grid";
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

function showToast(title: string) {
  wx.showToast({ icon: "none", title });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "我的发布加载失败";
}

function confirm(content: string) {
  return new Promise<boolean>((resolve) => {
    wx.showModal({
      title: "确认操作",
      content,
      confirmText: "确定",
      cancelText: "取消",
      success(response) {
        resolve(response.confirm);
      },
      fail() {
        resolve(false);
      },
    });
  });
}
