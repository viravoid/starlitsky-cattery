import type { CommunityCommentData, CommunityPostData } from "@starlitsky/shared";
import {
  createCommunityComment,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityPost,
  toggleCommunityPostLike,
} from "../../utils/public-content";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";

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
  canDelete: boolean;
  canEdit: boolean;
  category: string;
  commentText: string;
  comments: CommentView[];
  content: string;
  date: string;
  error: string;
  id: string;
  images: DetailImage[];
  isLoading: boolean;
  linkedCats: string[];
  linkedLitters: string[];
  likedByMe: boolean;
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

interface InputEvent {
  detail: {
    value: string;
  };
}

interface CommentView {
  author: string;
  canDelete: boolean;
  content: string;
  date: string;
  id: string;
}

Page({
  data: {
    author: "",
    canDelete: false,
    canEdit: false,
    category: "",
    commentText: "",
    comments: [],
    content: "",
    date: "",
    error: "",
    id: "",
    images: [],
    isLoading: true,
    linkedCats: [],
    linkedLitters: [],
    likedByMe: false,
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

  onCommentInput(this: CommunityDetailPage, event: InputEvent) {
    this.setData({ commentText: event.detail.value });
  },

  async toggleLike(this: CommunityDetailPage) {
    if (!this.data.id) return;
    try {
      await ensureLoggedIn();
      await toggleCommunityPostLike(this.data.id);
      await this.loadPost(this.data.id);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  },

  async submitComment(this: CommunityDetailPage) {
    const content = this.data.commentText.trim();
    if (!content) {
      showToast("请先写下评论");
      return;
    }

    try {
      await ensureLoggedIn();
      await createCommunityComment(this.data.id, content);
      this.setData({ commentText: "" });
      await this.loadPost(this.data.id);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  },

  openEdit(this: CommunityDetailPage) {
    if (!this.data.canEdit || !this.data.id) return;
    wx.navigateTo({ url: `/pages/community-publish/index?id=${encodeURIComponent(this.data.id)}` });
  },

  async deletePost(this: CommunityDetailPage) {
    if (!this.data.canDelete || !this.data.id) return;
    const confirmed = await confirm("确定删除这条动态吗？");
    if (!confirmed) return;

    try {
      await deleteCommunityPost(this.data.id);
      showToast("已删除");
      wx.switchTab({ url: "/pages/community/index" });
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  },

  async deleteComment(this: CommunityDetailPage, event: TapEvent) {
    const commentId = event.currentTarget.dataset.id;
    if (!commentId || !this.data.id) return;
    const confirmed = await confirm("确定删除这条评论吗？");
    if (!confirmed) return;

    try {
      await deleteCommunityComment(this.data.id, commentId);
      await this.loadPost(this.data.id);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
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
    canDelete: post.canDelete,
    canEdit: post.canEdit,
    category: categoryLabel(post.category),
    comments: post.comments.map(toCommentView),
    content: post.content,
    date: formatDate(post.createdAt),
    images,
    linkedCats: post.cats.map((cat) => cat.name),
    linkedLitters: post.litters.map((litter) => litter.name),
    likedByMe: post.likedByMe,
    meta: `${post.commentCount} 条评论 · ${post.likeCount} 个喜欢`,
    pinned: post.pinned,
    previewUrls: images.map((item) => item.url),
  };
}

function toCommentView(comment: CommunityCommentData): CommentView {
  return {
    author: comment.authorName || "星月猫友",
    canDelete: comment.canDelete,
    content: comment.content,
    date: formatDate(comment.createdAt),
    id: comment.id,
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

async function ensureLoggedIn() {
  const user = await refreshCurrentUser();
  if (user) return user;
  const session = await loginWithWechat();
  return session.user;
}

function showToast(title: string) {
  wx.showToast({ icon: "none", title });
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
