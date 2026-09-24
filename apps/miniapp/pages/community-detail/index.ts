import type { CommunityCommentData, CommunityPostData } from "@starlitsky/shared";
import {
  createCommunityComment,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunityPost,
  toggleCommunityPostLike,
} from "../../utils/public-content/index";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";
import { configureVisualQaAdapter } from "../../utils/visual-qa/adapter";

interface DetailOptions {
  id?: string;
  visualQa?: string;
}

interface DetailImage {
  altText: string;
  id: string;
  title: string;
  url: string;
}

interface CommunityDetailData {
  author: string;
  authorRole: string;
  authorRoleClass: string;
  canDelete: boolean;
  canEdit: boolean;
  category: string;
  commentActionLabel: string;
  commentText: string;
  comments: CommentView[];
  content: string;
  date: string;
  error: string;
  id: string;
  imageGridClass: string;
  images: DetailImage[];
  isLoading: boolean;
  linkedCats: LinkedCatView[];
  linkedLitters: LinkedLitterView[];
  likedByMe: boolean;
  likeActionLabel: string;
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
  authorRole: string;
  authorRoleClass: string;
  canDelete: boolean;
  content: string;
  date: string;
  id: string;
}

interface LinkedCatView {
  id: string;
  name: string;
}

interface LinkedLitterView {
  id: string;
  name: string;
}

Page({
  data: {
    author: "",
    authorRole: "",
    authorRoleClass: "",
    canDelete: false,
    canEdit: false,
    category: "",
    commentActionLabel: "",
    commentText: "",
    comments: [],
    content: "",
    date: "",
    error: "",
    id: "",
    imageGridClass: "",
    images: [],
    isLoading: true,
    linkedCats: [],
    linkedLitters: [],
    likedByMe: false,
    likeActionLabel: "",
    meta: "",
    pinned: false,
    previewUrls: [],
  } as CommunityDetailData,

  async onLoad(this: CommunityDetailPage, options: DetailOptions) {
    if (typeof options.visualQa === "string") {
      configureVisualQaAdapter({ visualQa: options.visualQa });
    }
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
      wx.setNavigationBarTitle({ title: "动态详情" });
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

  scrollToComments() {
    const scrollApi = wx as unknown as {
      pageScrollTo(options: { duration?: number; selector: string }): void;
    };
    scrollApi.pageScrollTo({ selector: "#comments-section", duration: 240 });
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

  openCatTimeline(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name || "TA";
    if (!id) return;
    wx.navigateTo({
      url: `/pages/community-linked/index?catId=${encodeURIComponent(id)}&title=${encodeURIComponent(`${name}的猫友圈动态`)}`,
    });
  },

  openLitterTimeline(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name || "所属窝次";
    if (!id) return;
    wx.navigateTo({
      url: `/pages/community-linked/index?litterId=${encodeURIComponent(id)}&title=${encodeURIComponent(`${name}的动态`)}`,
    });
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
    authorRole: roleLabel(post.authorRole),
    authorRoleClass: roleClass(post.authorRole),
    canDelete: post.canDelete,
    canEdit: post.canEdit,
    category: categoryLabel(post.category),
    commentActionLabel: `${post.commentCount} 条评论`,
    comments: post.comments.map(toCommentView),
    content: post.content,
    date: formatDate(post.createdAt),
    imageGridClass: imageGridClass(images.length),
    images,
    linkedCats: post.cats.map((cat) => ({ id: cat.id, name: cat.name })),
    linkedLitters: post.litters.map((litter) => ({ id: litter.id, name: litter.name })),
    likedByMe: post.likedByMe,
    likeActionLabel: `${post.likeCount} 个爪印`,
    meta: `${post.commentCount} 条评论 · ${post.likeCount} 个喜欢`,
    pinned: post.pinned,
    previewUrls: images.map((item) => item.url),
  };
}

function toCommentView(comment: CommunityCommentData): CommentView {
  return {
    author: comment.authorName || "星月猫友",
    authorRole: roleLabel(comment.authorRole),
    authorRoleClass: roleClass(comment.authorRole),
    canDelete: comment.canDelete,
    content: comment.content,
    date: formatDate(comment.createdAt),
    id: comment.id,
  };
}

function imageGridClass(count: number) {
  if (count <= 1) return "gallery single-image-grid";
  if (count === 2 || count === 4) return "gallery two-image-grid";
  return "gallery three-image-grid";
}

function roleLabel(value: string) {
  if (value === "keeper" || value === "猫舍主理人") return "猫舍主理人";
  if (value === "parent" || value === "星月家长") return "星月家长";
  if (value === "user" || value === "普通用户") return "";
  return value || "";
}

function roleClass(value: string) {
  if (value === "keeper" || value === "猫舍主理人") return "role-pill keeper";
  if (value === "parent" || value === "星月家长") return "role-pill parent";
  return "role-pill";
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
