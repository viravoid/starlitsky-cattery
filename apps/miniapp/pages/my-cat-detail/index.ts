import type { CommunityPostData, MyCatData } from "@starlitsky/shared";
import { getMyCat } from "../../utils/public-content/index";
import { refreshCurrentUser } from "../../utils/session/auth";

interface DetailOptions {
  id?: string;
}

interface TimelineCard {
  author: string;
  category: string;
  commentCount: number;
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
  roleClass: string;
}

interface MyCatDetailData {
  birthday: string;
  color: string;
  error: string;
  gender: string;
  genderClass: string;
  id: string;
  imageUrl: string;
  isLoading: boolean;
  litterName: string;
  name: string;
  needsParentAuth: boolean;
  personality: string;
  relationship: string;
  relationshipStartedAt: string;
  secondaryMeta: string;
  status: string;
  timelinePosts: TimelineCard[];
}

interface MyCatDetailPage {
  data: MyCatDetailData;
  loadCat(id: string): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Partial<MyCatDetailData>): void;
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

Page({
  data: {
    birthday: "",
    color: "",
    error: "",
    gender: "",
    genderClass: "",
    id: "",
    imageUrl: "",
    isLoading: true,
    litterName: "",
    name: "",
    needsParentAuth: false,
    personality: "",
    relationship: "",
    relationshipStartedAt: "",
    secondaryMeta: "",
    status: "",
    timelinePosts: [],
  } as MyCatDetailData,

  async onLoad(this: MyCatDetailPage, options: DetailOptions) {
    const id = typeof options.id === "string" ? decodeURIComponent(options.id) : "";
    this.setData({ id });
    await this.loadCat(id);
  },

  async onPullDownRefresh(this: MyCatDetailPage) {
    await this.loadCat(this.data.id);
    wx.stopPullDownRefresh();
  },

  async loadCat(this: MyCatDetailPage, id: string) {
    if (!id) {
      this.setData({ error: "缺少猫咪 ID", isLoading: false });
      return;
    }

    this.setData({ error: "", isLoading: true, needsParentAuth: false });
    const user = await refreshCurrentUser();
    if (!user || user.parentProfile?.status !== "active" || !user.roles.includes("parent")) {
      this.setData({ isLoading: false, needsParentAuth: true });
      return;
    }

    try {
      const cat = await getMyCat(id);
      this.setData({ ...toDetailView(cat), error: "", isLoading: false });
      wx.setNavigationBarTitle({ title: cat.name });
    } catch (error) {
      this.setData({ error: getErrorMessage(error), isLoading: false });
    }
  },

  async retryLoad(this: MyCatDetailPage) {
    await this.loadCat(this.data.id);
  },

  openParentAuth() {
    wx.navigateTo({ url: "/pages/parent-auth/index" });
  },

  openPost(event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/community-detail/index?id=${encodeURIComponent(id)}` });
  },

  previewPostImage(this: MyCatDetailPage, event: TapEvent) {
    const postIndex = Number(event.currentTarget.dataset.postIndex || 0);
    const imageIndex = Number(event.currentTarget.dataset.imageIndex || 0);
    const post = this.data.timelinePosts[postIndex];
    if (!post || post.previewUrls.length === 0) return;
    wx.previewImage({ current: post.previewUrls[imageIndex] || post.previewUrls[0], urls: post.previewUrls });
  },
});

function toDetailView(cat: MyCatData): Partial<MyCatDetailData> {
  const cover = cat.mediaAssets.find((item) => item.usage === "cover") ?? cat.mediaAssets[0];
  return {
    birthday: formatDate(cat.birthday),
    color: cat.color || "颜色待补充",
    gender: genderLabel(cat.gender),
    genderClass: cat.gender === "female" ? "gender-pill female" : "gender-pill male",
    imageUrl: cover?.thumbnailUrl || cover?.sourceUrl || "",
    litterName: cat.litter?.name || "暂无窝次信息",
    name: cat.name,
    personality: cat.personality || "性格记录待补充",
    relationship: relationshipLabel(cat.relationship),
    relationshipStartedAt: formatDate(cat.relationshipStartedAt),
    secondaryMeta: secondaryMeta(cat),
    status: statusLabel(cat.lifecycleStatus),
    timelinePosts: cat.timelinePosts.map(toTimelineCard),
  };
}

function toTimelineCard(post: CommunityPostData): TimelineCard {
  const images = post.mediaAssets
    .filter((item) => item.kind === "image")
    .slice(0, 9)
    .map((item) => ({
      id: item.id,
      url: item.sourceUrl || item.thumbnailUrl || "",
    }))
    .filter((item) => item.url);
  return {
    author: post.authorName || "星月猫友",
    category: categoryLabel(post.category),
    commentCount: post.commentCount,
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
    roleClass: roleClass(post.authorRole),
    roleLabel: roleLabel(post.authorRole),
  };
}

function imageGridClass(count: number) {
  if (count <= 1) return "post-images single-image-grid";
  if (count === 2 || count === 4) return "post-images two-image-grid";
  return "post-images three-image-grid";
}

function genderLabel(value: string | null) {
  if (value === "male") return "弟弟";
  if (value === "female") return "妹妹";
  return "未设置";
}

function relationshipLabel(value: string) {
  if (value === "owner") return "家长";
  if (value === "co_owner") return "共同家长";
  if (value === "caregiver") return "照护人";
  return value || "家长";
}

function statusLabel(value: string) {
  if (value === "adopted") return "已到家";
  if (value === "retired") return "退休";
  if (value === "growing") return "成长中";
  return value || "猫咪";
}

function categoryLabel(value: string) {
  if (value === "cattery_daily") return "猫舍日常";
  if (value === "personal_thoughts") return "碎碎念";
  if (value === "parent_share") return "家长分享";
  return value || "动态";
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

function secondaryMeta(cat: MyCatData) {
  return [relationshipLabel(cat.relationship), cat.litter?.name, statusLabel(cat.lifecycleStatus)]
    .filter(Boolean)
    .join(" · ");
}

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "猫咪详情加载失败";
}
