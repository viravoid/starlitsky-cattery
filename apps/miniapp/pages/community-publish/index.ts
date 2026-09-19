import type {
  CommunityPostCategory,
  CommunityPostOptionsData,
  CreateCommunityPostRequest,
} from "@starlitsky/shared";
import {
  createCommunityPost,
  deleteCommunityPostImage,
  getCommunityPost,
  getCommunityPostOptions,
  updateCommunityPost,
} from "../../utils/public-content/index";
import { loginWithWechat, refreshCurrentUser } from "../../utils/session/auth";
import {
  inferPostImageMimeType,
  toExistingPostImage,
  uploadPostImage,
  type ExistingPostImage,
  type SelectedPostImage,
} from "../../utils/community-post-images";

interface PublishOptions {
  id?: string;
}

interface InputEvent {
  detail: {
    value: string;
  };
}

interface TapEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
}

interface OptionItem {
  color: string;
  id: string;
  name: string;
  selected: boolean;
  visibility: string;
}

interface PublishData {
  canSubmit: boolean;
  categories: Array<{ label: string; value: CommunityPostCategory }>;
  category: CommunityPostCategory | "";
  cats: OptionItem[];
  content: string;
  error: string;
  existingImages: ExistingPostImage[];
  id: string;
  isEditing: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  litters: OptionItem[];
  selectedImages: SelectedPostImage[];
}

interface PublishPage {
  data: PublishData;
  loadPage(id: string): Promise<void>;
  retryLoad(): Promise<void>;
  setData(data: Partial<PublishData>): void;
}

Page({
  data: {
    canSubmit: false,
    categories: [],
    category: "",
    cats: [],
    content: "",
    error: "",
    existingImages: [],
    id: "",
    isEditing: false,
    isLoading: true,
    isSubmitting: false,
    litters: [],
    selectedImages: [],
  } as PublishData,

  async onLoad(this: PublishPage, options: PublishOptions) {
    const id = typeof options.id === "string" ? decodeURIComponent(options.id) : "";
    await this.loadPage(id);
  },

  async loadPage(this: PublishPage, id: string) {
    this.setData({ error: "", id, isEditing: Boolean(id), isLoading: true });
    try {
      await ensureLoggedIn();
      const options = await getCommunityPostOptions();
      let post = null;
      if (id) {
        post = await getCommunityPost(id);
        if (!post.canEdit) throw new Error("当前账号不能编辑这条动态");
      }

      const categories = options.categories.map((value) => ({ value, label: categoryLabel(value) }));
      const category = post?.category || categories[0]?.value || "";
      this.setData({
        canSubmit: categories.length > 0,
        categories,
        category: category as CommunityPostCategory | "",
        cats: toOptionItems(options, "cats", post?.cats.map((cat) => cat.id) ?? []),
        content: post?.content ?? "",
        existingImages:
          post?.mediaAssets
            .filter((item) => item.kind === "image")
            .map(toExistingPostImage)
            .filter((item): item is ExistingPostImage => Boolean(item)) ?? [],
        isLoading: false,
        litters: toOptionItems(options, "litters", post?.litters.map((litter) => litter.id) ?? []),
      });
      wx.setNavigationBarTitle({ title: id ? "编辑动态" : "发布动态" });
    } catch (error) {
      this.setData({ error: getErrorMessage(error), isLoading: false });
    }
  },

  async retryLoad(this: PublishPage) {
    await this.loadPage(this.data.id);
  },

  onContentInput(this: PublishPage, event: InputEvent) {
    this.setData({ content: event.detail.value });
  },

  setCategory(this: PublishPage, event: TapEvent) {
    const value = event.currentTarget.dataset.value as CommunityPostCategory;
    if (!value) return;
    this.setData({ category: value });
  },

  toggleCat(this: PublishPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    this.setData({ cats: toggleOption(this.data.cats, id) });
  },

  toggleLitter(this: PublishPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    this.setData({ litters: toggleOption(this.data.litters, id) });
  },

  chooseImages(this: PublishPage) {
    const keptExistingCount = this.data.existingImages.filter((image) => !image.removed).length;
    const remaining = Math.max(0, 9 - keptExistingCount - this.data.selectedImages.length);
    if (remaining === 0) {
      showToast("最多 9 张图片");
      return;
    }

    wx.chooseMedia({
      count: remaining,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (response) => {
        const images = response.tempFiles.map((file) => ({
          fileName: file.tempFilePath.split(/[\\/]/).pop() || "post-image.jpg",
          mimeType: inferPostImageMimeType(file.tempFilePath),
          sizeBytes: file.size,
          tempFilePath: file.tempFilePath,
        }));
        this.setData({ selectedImages: [...this.data.selectedImages, ...images] });
      },
      fail: (error) => {
        if (!error.errMsg?.includes("cancel")) showToast(error.errMsg || "选择图片失败");
      },
    });
  },

  removeSelectedImage(this: PublishPage, event: TapEvent) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) return;
    this.setData({
      selectedImages: this.data.selectedImages.filter((_, itemIndex) => itemIndex !== index),
    });
  },

  removeExistingImage(this: PublishPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    this.setData({
      existingImages: this.data.existingImages.map((image) =>
        image.id === id ? { ...image, removed: true } : image,
      ),
    });
  },

  restoreExistingImage(this: PublishPage, event: TapEvent) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const keptExistingCount = this.data.existingImages.filter((image) => !image.removed).length;
    if (keptExistingCount + this.data.selectedImages.length >= 9) {
      showToast("最多 9 张图片");
      return;
    }
    this.setData({
      existingImages: this.data.existingImages.map((image) =>
        image.id === id ? { ...image, removed: false } : image,
      ),
    });
  },

  async submit(this: PublishPage) {
    if (!this.data.category) {
      showToast("请选择分类");
      return;
    }
    if (!this.data.content.trim()) {
      showToast("请写一点内容");
      return;
    }

    this.setData({ isSubmitting: true });
    try {
      await ensureLoggedIn();
      const payload: CreateCommunityPostRequest = {
        category: this.data.category,
        content: this.data.content.trim(),
        catIds: this.data.cats.filter((item) => item.selected).map((item) => item.id),
        litterIds: this.data.litters.filter((item) => item.selected).map((item) => item.id),
      };
      const post = this.data.isEditing
        ? await updateCommunityPost(this.data.id, payload)
        : await createCommunityPost(payload);

      try {
        const removedImages = this.data.existingImages.filter((image) => image.removed);
        for (const image of removedImages) {
          await deleteCommunityPostImage(post.id, image.id);
        }

        const keptExistingCount = this.data.existingImages.filter((image) => !image.removed).length;
        for (let index = 0; index < this.data.selectedImages.length; index += 1) {
          await uploadPostImage(post.id, this.data.selectedImages[index], keptExistingCount + index);
        }
      } catch (imageError) {
        showToast(`动态已保存，图片更新失败：${getErrorMessage(imageError)}`);
        this.setData({ isSubmitting: false });
        return;
      }

      showToast(this.data.isEditing ? "已保存" : "已发布");
      wx.navigateTo({ url: `/pages/community-detail/index?id=${encodeURIComponent(post.id)}` });
    } catch (error) {
      showToast(getErrorMessage(error));
      this.setData({ isSubmitting: false });
    }
  },
});

function toOptionItems(
  options: CommunityPostOptionsData,
  key: "cats" | "litters",
  selectedIds: string[],
): OptionItem[] {
  const selected = new Set(selectedIds);
  return options[key].map((item) => ({
    color: "color" in item && item.color ? item.color : "",
    id: item.id,
    name: item.name,
    selected: selected.has(item.id),
    visibility: item.visibility || "visible",
  }));
}

function toggleOption(items: OptionItem[], id = "") {
  if (!id) return items;
  return items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item));
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

function showToast(title: string) {
  wx.showToast({ icon: "none", title });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}
