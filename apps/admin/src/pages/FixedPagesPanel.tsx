import type { FixedPageData, MediaAssetData, UpdateFixedPageRequest } from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getFixedPage, listMedia, updateFixedPage, uploadFixedPageImage } from "../api/cattery";
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

const STATUS_OPTIONS = [
  { label: "草稿", value: "draft" },
  { label: "已发布", value: "published" },
  { label: "隐藏", value: "hidden" },
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
      pageSize: 20,
      status: "active",
    });
    setImagesByPageId((current) => ({
      ...current,
      [pageId]: mediaList.items,
    }));
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
              <FixedPageImageUploadField
                disabled={isSaving}
                images={selectedPageImages}
                previewUrl={imagePreviewUrl}
                state={imageUploadState}
                onChange={handleImageSelected}
              />
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
