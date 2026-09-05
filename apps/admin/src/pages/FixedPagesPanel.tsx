import { ENVIRONMENT_MEDIA_USAGES } from "@starlitsky/shared";
import type {
  FixedPageData,
  MediaAssetData,
  MediaBindingData,
  UpdateFixedPageRequest,
} from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveMediaBinding,
  getFixedPage,
  listMedia,
  updateFixedPage,
  updateMediaBinding,
  uploadFixedPageImage,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

interface FixedPageFormState {
  contentJson: string;
  contentSchemaVersion: string;
  seoDescription: string;
  seoTitle: string;
  status: string;
  title: string;
}

type ImageUploadState = "idle" | "pending" | "uploading" | "uploaded";
type EnvironmentSlotKey = keyof typeof ENVIRONMENT_MEDIA_USAGES;

interface EnvironmentSlotConfig {
  key: EnvironmentSlotKey;
  label: string;
  usage: string;
}

interface EnvironmentSlotItem {
  binding: MediaBindingData;
  media: MediaAssetData;
}

const STATUS_OPTIONS = [
  { label: "草稿", value: "draft" },
  { label: "已发布", value: "published" },
  { label: "隐藏", value: "hidden" },
];

const ENVIRONMENT_MEDIA_SLOTS: EnvironmentSlotConfig[] = [
  { key: "maternity", label: "母婴房", usage: ENVIRONMENT_MEDIA_USAGES.maternity },
  { key: "publicArea", label: "公共活动区", usage: ENVIRONMENT_MEDIA_USAGES.publicArea },
  { key: "medical", label: "医疗间", usage: ENVIRONMENT_MEDIA_USAGES.medical },
];

export function FixedPagesPanel({
  isLoading,
  pages,
  onReload,
}: {
  isLoading: boolean;
  pages: FixedPageData[];
  onReload: () => Promise<void>;
}) {
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedPage, setSelectedPage] = useState<FixedPageData | null>(null);
  const [form, setForm] = useState<FixedPageFormState>(() => toForm(null));
  const [imagesByPageId, setImagesByPageId] = useState<Record<string, MediaAssetData[]>>({});
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imageUploadState, setImageUploadState] = useState<ImageUploadState>("idle");
  const [slotUploadStates, setSlotUploadStates] = useState<Record<string, ImageUploadState>>({});
  const [slotSortDrafts, setSlotSortDrafts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const currentListPage = useMemo(
    () => pages.find((page) => page.slug === selectedSlug) ?? pages[0] ?? null,
    [pages, selectedSlug],
  );
  const selectedPageImages = selectedPage ? (imagesByPageId[selectedPage.id] ?? []) : [];

  useEffect(() => {
    if (!selectedSlug && pages[0]) setSelectedSlug(pages[0].slug);
  }, [pages, selectedSlug]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const loadPageImages = useCallback(async (pageId: string) => {
    const mediaList = await listMedia({
      kind: "image",
      ownerId: pageId,
      ownerType: "fixed_page",
      pageSize: 100,
      status: "active",
    });
    setImagesByPageId((current) => ({
      ...current,
      [pageId]: mediaList.items,
    }));
    setSlotSortDrafts((current) => mergeSortDrafts(current, mediaList.items, pageId));
    return mediaList.items;
  }, []);

  const clearPendingImage = useCallback(() => {
    setPendingImageFile(null);
    setImagePreviewUrl((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }
      return "";
    });
    setImageUploadState("idle");
  }, []);

  const selectPage = useCallback(
    async (slug: string) => {
      setSelectedSlug(slug);
      setNotice("");
      setError("");

      try {
        const page = await getFixedPage(slug);
        setSelectedPage(page);
        setForm(toForm(page));
        clearPendingImage();
        await loadPageImages(page.id);
      } catch (selectError) {
        setError(getErrorMessage(selectError));
      }
    },
    [clearPendingImage, loadPageImages],
  );

  useEffect(() => {
    if (!currentListPage) return;
    void selectPage(currentListPage.slug);
  }, [currentListPage, selectPage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPage) return;

    setIsSaving(true);
    setNotice("");
    setError("");

    try {
      const payload = toPayload(form);
      const updated = await updateFixedPage(selectedPage.slug, payload);
      setSelectedPage(updated);
      setForm(toForm(updated));
      const hadPendingImage = Boolean(pendingImageFile);

      if (pendingImageFile) {
        try {
          await uploadPendingImage(updated.id);
        } catch (uploadError) {
          setError(`固定页面内容已保存，但图片上传失败：${getErrorMessage(uploadError)}`);
          setImageUploadState("pending");
          await onReload();
          return;
        }
      } else {
        await loadPageImages(updated.id);
      }

      setNotice(hadPendingImage ? "固定页面内容和图片已保存" : "固定页面内容已保存");
      await onReload();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  function handleImageSelected(file: File | null) {
    clearPendingImage();

    if (!file) return;

    setPendingImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageUploadState("pending");
  }

  async function uploadPendingImage(pageId: string) {
    if (!pendingImageFile) return null;

    setImageUploadState("uploading");
    const media = await uploadFixedPageImage(pageId, pendingImageFile);
    setImagesByPageId((current) => ({
      ...current,
      [pageId]: [media, ...(current[pageId] ?? []).filter((item) => item.id !== media.id)],
    }));
    setPendingImageFile(null);
    setImagePreviewUrl(media.thumbnailUrl || media.sourceUrl);
    setImageUploadState("uploaded");
    return media;
  }

  async function handleEnvironmentSlotImageSelected(
    slot: EnvironmentSlotConfig,
    file: File | null,
  ) {
    if (!selectedPage || !file) return;

    setSlotUploadStates((current) => ({ ...current, [slot.usage]: "uploading" }));
    setNotice("");
    setError("");

    try {
      const currentItems = getEnvironmentSlotItems(selectedPageImages, selectedPage.id, slot.usage);
      const media = await uploadFixedPageImage(selectedPage.id, file, {
        altText: `${slot.label}环境照片`,
        sortOrder: getNextSortOrder(currentItems),
        title: `${slot.label} - ${file.name}`,
        usage: slot.usage,
      });
      setImagesByPageId((current) => ({
        ...current,
        [selectedPage.id]: [
          media,
          ...(current[selectedPage.id] ?? []).filter((item) => item.id !== media.id),
        ],
      }));
      await loadPageImages(selectedPage.id);
      setSlotUploadStates((current) => ({ ...current, [slot.usage]: "uploaded" }));
      setNotice(`${slot.label}图片已上传并绑定到该位置`);
    } catch (uploadError) {
      setSlotUploadStates((current) => ({ ...current, [slot.usage]: "idle" }));
      setError(`${slot.label}图片上传失败：${getErrorMessage(uploadError)}`);
    }
  }

  async function handleEnvironmentSortSave(media: MediaAssetData, binding: MediaBindingData) {
    if (!selectedPage) return;

    const sortOrder = Number(slotSortDrafts[binding.id] ?? binding.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError("排序必须是非负整数");
      return;
    }

    setIsSaving(true);
    setNotice("");
    setError("");

    try {
      await updateMediaBinding(media.id, binding.id, { sortOrder });
      await loadPageImages(selectedPage.id);
      setNotice("图片排序已更新");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEnvironmentBindingArchive(media: MediaAssetData, binding: MediaBindingData) {
    if (!selectedPage) return;

    setIsSaving(true);
    setNotice("");
    setError("");

    try {
      await archiveMediaBinding(media.id, binding.id);
      await loadPageImages(selectedPage.id);
      setNotice("图片已移出该位置，底层媒体文件未删除");
    } catch (archiveError) {
      setError(getErrorMessage(archiveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Fixed Pages</p>
          <h2>固定页面内容管理</h2>
          <p className="muted compact">
            只维护预定义页面的结构化内容，不提供文章、新增栏目或通用 CMS 能力。
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={() => void onReload()}>
            刷新
          </button>
        </div>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="management-grid">
        <section className="table-panel" aria-label="固定页面列表">
          <div className="section-heading">
            <div>
              <h3>固定页面</h3>
              <p className="muted compact">当前 {pages.length} 个预定义页面</p>
            </div>
          </div>
          {isLoading ? (
            <div className="empty-state">正在加载固定页面...</div>
          ) : pages.length === 0 ? (
            <div className="empty-state">暂无固定页面配置，请先运行数据库迁移。</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>页面</th>
                    <th>Slug</th>
                    <th>状态</th>
                    <th>版本</th>
                    <th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.slug}>
                      <td>
                        <button
                          className="link-button"
                          type="button"
                          onClick={() => void selectPage(page.slug)}
                        >
                          {page.title}
                        </button>
                      </td>
                      <td>{page.slug}</td>
                      <td>{formatOption(page.status, STATUS_OPTIONS)}</td>
                      <td>v{page.contentSchemaVersion}</td>
                      <td>{formatDateTime(page.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="detail-panel" aria-label="固定页面编辑">
          {selectedPage ? (
            <form className="form-stack" onSubmit={handleSubmit}>
              <div>
                <p className="eyebrow">Edit Fixed Page</p>
                <h3>{selectedPage.slug}</h3>
              </div>
              <label>
                页面标题
                <input
                  aria-label="页面标题"
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  状态
                  <select
                    aria-label="状态"
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  内容结构版本
                  <input
                    aria-label="内容结构版本"
                    inputMode="numeric"
                    value={form.contentSchemaVersion}
                    onChange={(event) =>
                      setForm({ ...form, contentSchemaVersion: event.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                SEO 标题
                <input
                  aria-label="SEO 标题"
                  value={form.seoTitle}
                  onChange={(event) => setForm({ ...form, seoTitle: event.target.value })}
                />
              </label>
              <label>
                SEO 描述
                <textarea
                  aria-label="SEO 描述"
                  rows={3}
                  value={form.seoDescription}
                  onChange={(event) => setForm({ ...form, seoDescription: event.target.value })}
                />
              </label>
              <label>
                结构化内容 JSON
                <textarea
                  aria-label="结构化内容 JSON"
                  className="code-textarea"
                  rows={14}
                  value={form.contentJson}
                  onChange={(event) => setForm({ ...form, contentJson: event.target.value })}
                />
              </label>
              {selectedPage.slug === "environment" ? (
                <EnvironmentFixedPageMediaSlots
                  disabled={isSaving}
                  images={selectedPageImages}
                  pageId={selectedPage.id}
                  slotSortDrafts={slotSortDrafts}
                  slotUploadStates={slotUploadStates}
                  onArchive={handleEnvironmentBindingArchive}
                  onSortDraftChange={(bindingId, sortOrder) =>
                    setSlotSortDrafts((current) => ({ ...current, [bindingId]: sortOrder }))
                  }
                  onSortSave={handleEnvironmentSortSave}
                  onUpload={handleEnvironmentSlotImageSelected}
                />
              ) : (
                <FixedPageImageUploadField
                  disabled={isSaving}
                  images={selectedPageImages}
                  previewUrl={imagePreviewUrl}
                  state={imageUploadState}
                  onChange={handleImageSelected}
                />
              )}
              <div className="form-actions">
                <button disabled={isSaving} type="submit">
                  {isSaving ? "保存中..." : "保存固定页面"}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-state">选择一个固定页面查看和编辑内容。</div>
          )}
        </aside>
      </div>
    </>
  );
}

function FixedPageImageUploadField({
  disabled,
  images,
  previewUrl,
  state,
  onChange,
}: {
  disabled: boolean;
  images: MediaAssetData[];
  previewUrl: string;
  state: ImageUploadState;
  onChange: (file: File | null) => void;
}) {
  const currentImage = getPrimaryPageImage(images);
  const displayUrl = previewUrl || currentImage?.thumbnailUrl || currentImage?.sourceUrl || "";

  return (
    <div className="image-uploader">
      <div className="subsection-heading">
        <h4>页面图片</h4>
        <span className={`upload-state upload-state-${state}`}>{formatImageState(state)}</span>
      </div>
      {displayUrl ? (
        <img
          alt={currentImage?.altText || currentImage?.title || "固定页面图片预览"}
          className="image-preview"
          src={displayUrl}
        />
      ) : (
        <div className="image-placeholder">暂无图片</div>
      )}
      <label>
        选择图片
        <input
          accept="image/*"
          aria-label="选择固定页面图片"
          disabled={disabled}
          type="file"
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p className="muted compact">
        {state === "pending"
          ? "图片将在保存固定页面时上传并绑定。"
          : "保存后会通过媒体绑定持久化到当前固定页面。"}
      </p>
    </div>
  );
}

function EnvironmentFixedPageMediaSlots({
  disabled,
  images,
  pageId,
  slotSortDrafts,
  slotUploadStates,
  onArchive,
  onSortDraftChange,
  onSortSave,
  onUpload,
}: {
  disabled: boolean;
  images: MediaAssetData[];
  pageId: string;
  slotSortDrafts: Record<string, string>;
  slotUploadStates: Record<string, ImageUploadState>;
  onArchive: (media: MediaAssetData, binding: MediaBindingData) => void;
  onSortDraftChange: (bindingId: string, sortOrder: string) => void;
  onSortSave: (media: MediaAssetData, binding: MediaBindingData) => void;
  onUpload: (slot: EnvironmentSlotConfig, file: File | null) => void;
}) {
  return (
    <div className="environment-slot-stack">
      <div className="subsection-heading">
        <h4>环境页图片位置</h4>
        <span className="upload-state">fixed_page slots</span>
      </div>
      {ENVIRONMENT_MEDIA_SLOTS.map((slot) => (
        <EnvironmentFixedPageMediaSlot
          disabled={disabled}
          items={getEnvironmentSlotItems(images, pageId, slot.usage)}
          key={slot.usage}
          slot={slot}
          sortDrafts={slotSortDrafts}
          uploadState={slotUploadStates[slot.usage] ?? "idle"}
          onArchive={onArchive}
          onSortDraftChange={onSortDraftChange}
          onSortSave={onSortSave}
          onUpload={onUpload}
        />
      ))}
    </div>
  );
}

function EnvironmentFixedPageMediaSlot({
  disabled,
  items,
  slot,
  sortDrafts,
  uploadState,
  onArchive,
  onSortDraftChange,
  onSortSave,
  onUpload,
}: {
  disabled: boolean;
  items: EnvironmentSlotItem[];
  slot: EnvironmentSlotConfig;
  sortDrafts: Record<string, string>;
  uploadState: ImageUploadState;
  onArchive: (media: MediaAssetData, binding: MediaBindingData) => void;
  onSortDraftChange: (bindingId: string, sortOrder: string) => void;
  onSortSave: (media: MediaAssetData, binding: MediaBindingData) => void;
  onUpload: (slot: EnvironmentSlotConfig, file: File | null) => void;
}) {
  return (
    <section className="environment-slot" aria-label={`${slot.label}图片`}>
      <div className="section-heading">
        <div>
          <h4>{slot.label}</h4>
          <p className="muted compact">{slot.usage}</p>
        </div>
        <span className={`upload-state upload-state-${uploadState}`}>
          {formatImageState(uploadState)}
        </span>
      </div>

      <div className="environment-slot-images">
        {items.length === 0 ? (
          <div className="image-placeholder">暂无图片</div>
        ) : (
          items.map(({ binding, media }) => {
            const imageUrl = media.thumbnailUrl || media.sourceUrl;
            return (
              <div className="environment-slot-image-row" key={binding.id}>
                <img
                  alt={media.altText || media.title || `${slot.label}图片`}
                  className="environment-slot-preview"
                  src={imageUrl}
                />
                <div className="environment-slot-controls">
                  <div>
                    <strong>{media.title || media.sourceUrl}</strong>
                    <p className="muted compact">当前排序：{binding.sortOrder}</p>
                  </div>
                  <label>
                    排序
                    <input
                      aria-label={`${slot.label}图片排序`}
                      disabled={disabled}
                      inputMode="numeric"
                      value={sortDrafts[binding.id] ?? String(binding.sortOrder)}
                      onChange={(event) => onSortDraftChange(binding.id, event.target.value)}
                    />
                  </label>
                  <div className="table-actions">
                    <button
                      className="secondary-button small-button"
                      disabled={disabled}
                      type="button"
                      onClick={() => onSortSave(media, binding)}
                    >
                      保存排序
                    </button>
                    <button
                      className="danger-button small-button"
                      disabled={disabled}
                      type="button"
                      onClick={() => onArchive(media, binding)}
                    >
                      移出该位置
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <label>
        上传到{slot.label}
        <input
          accept="image/*"
          aria-label={`上传到${slot.label}`}
          disabled={disabled || uploadState === "uploading"}
          type="file"
          onChange={(event) => {
            onUpload(slot, event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p className="muted compact">移出只会归档该页面位置绑定，不删除媒体记录或对象存储文件。</p>
    </section>
  );
}

function getPrimaryPageImage(images: MediaAssetData[]) {
  return (
    images.find((media) =>
      media.bindings.some(
        (binding) => binding.usage === "cover" && binding.visibility === "visible",
      ),
    ) ??
    images.find((media) => media.bindings.some((binding) => binding.visibility === "visible")) ??
    images[0]
  );
}

function getEnvironmentSlotItems(images: MediaAssetData[], pageId: string, usage: string) {
  return images
    .flatMap((media) =>
      media.bindings
        .filter(
          (binding) =>
            binding.ownerType === "fixed_page" &&
            binding.ownerId === pageId &&
            binding.usage === usage &&
            binding.visibility === "visible" &&
            !binding.deletedAt,
        )
        .map((binding) => ({ binding, media })),
    )
    .sort(
      (left, right) =>
        left.binding.sortOrder - right.binding.sortOrder ||
        left.media.createdAt.localeCompare(right.media.createdAt) ||
        left.media.id.localeCompare(right.media.id),
    );
}

function getNextSortOrder(items: EnvironmentSlotItem[]) {
  if (items.length === 0) return 10;
  return Math.max(...items.map((item) => item.binding.sortOrder)) + 10;
}

function mergeSortDrafts(
  current: Record<string, string>,
  images: MediaAssetData[],
  pageId: string,
) {
  const next = { ...current };
  for (const slot of ENVIRONMENT_MEDIA_SLOTS) {
    for (const item of getEnvironmentSlotItems(images, pageId, slot.usage)) {
      next[item.binding.id] = String(item.binding.sortOrder);
    }
  }
  return next;
}

function formatImageState(state: ImageUploadState) {
  switch (state) {
    case "pending":
      return "待保存";
    case "uploading":
      return "上传中";
    case "uploaded":
      return "已上传";
    default:
      return "未选择";
  }
}

function toForm(page: FixedPageData | null): FixedPageFormState {
  return {
    contentJson: JSON.stringify(page?.contentJson ?? {}, null, 2),
    contentSchemaVersion: String(page?.contentSchemaVersion ?? 1),
    seoDescription: page?.seoDescription ?? "",
    seoTitle: page?.seoTitle ?? "",
    status: page?.status ?? "draft",
    title: page?.title ?? "",
  };
}

function toPayload(form: FixedPageFormState): UpdateFixedPageRequest {
  let contentJson: unknown;
  try {
    contentJson = JSON.parse(form.contentJson || "{}");
  } catch {
    throw new Error("结构化内容 JSON 格式不正确");
  }

  return {
    contentJson,
    contentSchemaVersion: Number(form.contentSchemaVersion),
    seoDescription: emptyToNull(form.seoDescription),
    seoTitle: emptyToNull(form.seoTitle),
    status: form.status as UpdateFixedPageRequest["status"],
    title: form.title.trim(),
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatOption(value: string, options: Array<{ label: string; value: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}
