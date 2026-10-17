import type {
  CatData,
  CreateMediaBindingRequest,
  FixedPageData,
  LitterData,
  MediaAssetData,
  MediaBindingData,
  UpdateMediaAssetRequest,
  UpdateMediaBindingRequest,
} from "@starlitsky/shared";
import { ENVIRONMENT_MEDIA_USAGES } from "@starlitsky/shared";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Link2,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveMedia,
  archiveMediaBinding,
  createMediaBinding,
  getMedia,
  listMedia,
  updateMedia,
  updateMediaBinding,
  uploadMediaImage,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

interface MediaFilters {
  includeArchived: boolean;
  kind: string;
  ownerType: string;
  page: number;
  q: string;
  status: string;
}

interface MediaFormState {
  altText: string;
  status: string;
  title: string;
}

interface BindingFormState {
  ownerId: string;
  ownerType: string;
  sortOrder: string;
  usage: string;
  visibility: string;
}

interface UploadFormState extends BindingFormState {
  altText: string;
  title: string;
}

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 40;

const DEFAULT_FILTERS: MediaFilters = {
  includeArchived: false,
  kind: "",
  ownerType: "",
  page: 1,
  q: "",
  status: "",
};

const DEFAULT_BINDING_FORM: BindingFormState = {
  ownerId: "",
  ownerType: "cat",
  sortOrder: "0",
  usage: "gallery",
  visibility: "visible",
};

const DEFAULT_UPLOAD_FORM: UploadFormState = {
  ...DEFAULT_BINDING_FORM,
  altText: "",
  title: "",
};

const KIND_OPTIONS = [
  { label: "图片", value: "image" },
  { label: "视频", value: "video" },
  { label: "文档", value: "document" },
  { label: "音频", value: "audio" },
];

const STATUS_OPTIONS = [
  { label: "待处理", value: "pending" },
  { label: "可用", value: "active" },
  { label: "驳回", value: "rejected" },
  { label: "归档", value: "archived" },
];

const OWNER_TYPE_OPTIONS = [
  { label: "猫咪", value: "cat" },
  { label: "窝次", value: "litter" },
  { label: "固定页面", value: "fixed_page" },
  { label: "猫友圈动态", value: "post" },
  { label: "家长资料", value: "parent_profile" },
];

const USAGE_OPTIONS = [
  { label: "封面", value: "cover" },
  { label: "相册", value: "gallery" },
  { label: "正文", value: "content" },
  { label: "头像", value: "avatar" },
  { label: "环境页 / 母婴房", value: ENVIRONMENT_MEDIA_USAGES.maternity },
  { label: "环境页 / 公共活动区", value: ENVIRONMENT_MEDIA_USAGES.publicArea },
  { label: "环境页 / 医疗间", value: ENVIRONMENT_MEDIA_USAGES.medical },
];

const VISIBILITY_OPTIONS = [
  { label: "显示", value: "visible" },
  { label: "隐藏", value: "hidden" },
  { label: "归档", value: "archived" },
];

export function MediaManagementPanel({
  cats,
  fixedPages,
  litters,
}: {
  cats: CatData[];
  fixedPages: FixedPageData[];
  litters: LitterData[];
}) {
  const [mediaItems, setMediaItems] = useState<MediaAssetData[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [selectedMedia, setSelectedMedia] = useState<MediaAssetData | null>(null);
  const [filters, setFilters] = useState<MediaFilters>(DEFAULT_FILTERS);
  const [searchDraft, setSearchDraft] = useState("");
  const [mediaForm, setMediaForm] = useState<MediaFormState | null>(null);
  const [bindingForm, setBindingForm] = useState<BindingFormState>(DEFAULT_BINDING_FORM);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(DEFAULT_UPLOAD_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState("");
  const [uploadDimensions, setUploadDimensions] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [confirmingArchiveId, setConfirmingArchiveId] = useState("");
  const [confirmingBindingId, setConfirmingBindingId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const ownerNameMaps = useMemo(
    () => ({
      cat: new Map(cats.map((cat) => [cat.id, cat.name])),
      fixed_page: new Map(fixedPages.map((page) => [page.id, page.title])),
      litter: new Map(litters.map((litter) => [litter.id, litter.name])),
    }),
    [cats, fixedPages, litters],
  );

  const loadMedia = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const mediaList = await listMedia({
        includeDeleted: filters.includeArchived,
        kind: filters.kind,
        ownerType: filters.ownerType,
        page: filters.page,
        pageSize: PAGE_SIZE,
        q: filters.q,
        status: filters.status,
      });
      setMediaItems(mediaList.items);
      setPagination(mediaList.pagination);
      setSelectedMedia((current) =>
        current ? (mediaList.items.find((item) => item.id === current.id) ?? current) : null,
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    return () => {
      if (uploadPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(uploadPreviewUrl);
    };
  }, [uploadPreviewUrl]);

  function updateFilters(patch: Partial<MediaFilters>) {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({ q: searchDraft.trim() });
  }

  async function selectMedia(media: MediaAssetData) {
    setShowUpload(false);
    setMediaForm(null);
    setConfirmingArchiveId("");
    setConfirmingBindingId("");
    setNotice("");
    setError("");
    try {
      const freshMedia = await getMedia(media.id);
      setSelectedMedia(freshMedia);
      setBindingForm(createDefaultBindingForm(cats, litters, fixedPages));
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  function openUpload() {
    setSelectedMedia(null);
    setMediaForm(null);
    setUploadFile(null);
    setUploadPreviewUrl("");
    setUploadDimensions(null);
    setUploadForm({
      ...DEFAULT_UPLOAD_FORM,
      ownerId: buildOwnerOptions("cat", cats, litters, fixedPages)[0]?.value ?? "",
    });
    setShowUpload(true);
    setNotice("");
    setError("");
  }

  async function handleUploadFile(file: File | null) {
    setUploadFile(file);
    setUploadDimensions(null);
    setUploadPreviewUrl(file ? URL.createObjectURL(file) : "");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadFile(null);
      setUploadPreviewUrl("");
      setError("只能上传图片文件");
      return;
    }
    setError("");
    try {
      setUploadDimensions(await readImageDimensions(file));
      setUploadForm((current) => ({
        ...current,
        altText: current.altText || file.name,
        title: current.title || stripFileExtension(file.name),
      }));
    } catch {
      setError("无法读取图片尺寸，请换一张有效图片");
    }
  }

  async function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile || !uploadForm.ownerId) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const savedMedia = await uploadMediaImage({
        altText: emptyToNull(uploadForm.altText),
        bindingVisibility: uploadForm.visibility,
        file: uploadFile,
        height: uploadDimensions?.height,
        ownerId: uploadForm.ownerId,
        ownerType: uploadForm.ownerType,
        sortOrder: optionalNumber(uploadForm.sortOrder) ?? 0,
        title: emptyToNull(uploadForm.title),
        usage: uploadForm.usage,
        width: uploadDimensions?.width,
      });
      setSelectedMedia(savedMedia);
      setShowUpload(false);
      setUploadFile(null);
      setUploadPreviewUrl("");
      setNotice("图片已上传到 COS，并完成媒体记录和业务绑定");
      await loadMedia();
    } catch (uploadError) {
      setError(`图片上传失败：${getErrorMessage(uploadError)}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMediaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMedia || !mediaForm) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: UpdateMediaAssetRequest = {
        altText: emptyToNull(mediaForm.altText),
        status: mediaForm.status,
        title: emptyToNull(mediaForm.title),
      };
      const savedMedia = await updateMedia(selectedMedia.id, payload);
      setSelectedMedia(savedMedia);
      setMediaForm(null);
      setNotice("媒体信息已保存");
      await loadMedia();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveMedia(media: MediaAssetData) {
    if (confirmingArchiveId !== media.id) {
      setConfirmingArchiveId(media.id);
      setNotice(
        `再次点击“确认归档媒体”会归档媒体记录及其 ${media.bindings.length} 个有效绑定；不会删除 COS 文件。`,
      );
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const archived = await archiveMedia(media.id);
      setSelectedMedia(archived);
      setMediaForm(null);
      setConfirmingArchiveId("");
      setNotice("媒体已归档，所有有效绑定也已归档；COS 对象未删除");
      await loadMedia();
    } catch (archiveError) {
      setError(getErrorMessage(archiveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBindingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMedia || !bindingForm.ownerId) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await createMediaBinding(selectedMedia.id, toBindingPayload(bindingForm));
      await refreshSelectedMedia(selectedMedia.id);
      setNotice("已新增真实业务绑定");
      await loadMedia();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBindingUpdate(binding: MediaBindingData, patch: UpdateMediaBindingRequest) {
    if (!selectedMedia) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await updateMediaBinding(selectedMedia.id, binding.id, patch);
      await refreshSelectedMedia(selectedMedia.id);
      setNotice("绑定用途、排序和可见性已保存");
      await loadMedia();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveBinding(binding: MediaBindingData) {
    if (!selectedMedia) return;
    if (confirmingBindingId !== binding.id) {
      setConfirmingBindingId(binding.id);
      setNotice("再次点击“确认移除绑定”只会移除此引用，不会删除媒体或其它引用。");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await archiveMediaBinding(selectedMedia.id, binding.id);
      await refreshSelectedMedia(selectedMedia.id);
      setConfirmingBindingId("");
      setNotice("绑定已移除；媒体文件和其它内容引用保持不变");
      await loadMedia();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function refreshSelectedMedia(mediaId: string) {
    const freshMedia = await getMedia(mediaId);
    setSelectedMedia(freshMedia);
    return freshMedia;
  }

  const activeFilterCount =
    [filters.kind, filters.ownerType, filters.status, filters.q].filter(Boolean).length +
    (filters.includeArchived ? 1 : 0);

  return (
    <div className={`media-library ${selectedMedia || showUpload ? "has-detail" : ""}`}>
      <header className="media-library-header">
        <div>
          <p className="eyebrow">Media Library</p>
          <h2>媒体管理</h2>
          <p className="muted compact">集中查看图片文件、状态与真实内容引用。</p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button icon-button" type="button" onClick={loadMedia}>
            <RefreshCw aria-hidden="true" size={15} />
            刷新
          </button>
          <button className="icon-button" type="button" onClick={openUpload}>
            <Upload aria-hidden="true" size={15} />
            上传图片
          </button>
        </div>
      </header>

      {notice ? (
        <div className="notice" role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="error-banner" role="alert">
          {error}
        </div>
      ) : null}

      <section className="media-filter-panel" aria-label="媒体筛选">
        <form className="media-search" onSubmit={handleSearch}>
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="搜索媒体"
            placeholder="搜索标题、替代文本、地址或校验值"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <button className="secondary-button small-button" type="submit">
            搜索
          </button>
        </form>
        <div className="media-filter-grid">
          <CompactSelect
            ariaLabel="媒体类型"
            options={KIND_OPTIONS}
            placeholder="全部类型"
            value={filters.kind}
            onChange={(kind) => updateFilters({ kind })}
          />
          <CompactSelect
            ariaLabel="媒体状态"
            options={STATUS_OPTIONS}
            placeholder="全部状态"
            value={filters.status}
            onChange={(status) => updateFilters({ status })}
          />
          <CompactSelect
            ariaLabel="引用类型"
            options={OWNER_TYPE_OPTIONS}
            placeholder="全部引用"
            value={filters.ownerType}
            onChange={(ownerType) => updateFilters({ ownerType })}
          />
          <label className="media-archive-toggle">
            <input
              checked={filters.includeArchived}
              type="checkbox"
              onChange={(event) => updateFilters({ includeArchived: event.target.checked })}
            />
            包含已归档
          </label>
          {activeFilterCount > 0 ? (
            <button
              className="link-button media-clear-filters"
              type="button"
              onClick={() => {
                setSearchDraft("");
                setFilters(DEFAULT_FILTERS);
              }}
            >
              清除筛选 ({activeFilterCount})
            </button>
          ) : null}
        </div>
      </section>

      <div className="media-management-grid">
        <section className="media-list-panel" aria-label="媒体列表">
          <div className="media-panel-heading">
            <div>
              <h3>全部媒体</h3>
              <p className="muted compact">共 {pagination.total} 个文件</p>
            </div>
            <span className="media-page-count">
              第 {pagination.totalPages === 0 ? 0 : pagination.page} / {pagination.totalPages} 页
            </span>
          </div>

          {isLoading ? (
            <div className="empty-state">正在加载媒体...</div>
          ) : mediaItems.length === 0 ? (
            <div className="empty-state media-empty-state">
              <ImageIcon aria-hidden="true" size={28} />
              <strong>没有符合条件的媒体</strong>
              <span>调整搜索或筛选条件，也可以上传第一张图片。</span>
            </div>
          ) : (
            <>
              <div className="media-table-wrap">
                <table className="media-table">
                  <thead>
                    <tr>
                      <th>媒体</th>
                      <th>文件信息</th>
                      <th>状态</th>
                      <th>引用</th>
                      <th aria-label="操作" />
                    </tr>
                  </thead>
                  <tbody>
                    {mediaItems.map((media) => (
                      <MediaTableRow
                        key={media.id}
                        media={media}
                        selected={selectedMedia?.id === media.id}
                        onSelect={selectMedia}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="media-mobile-list">
                {mediaItems.map((media) => (
                  <MediaMobileRow key={media.id} media={media} onSelect={selectMedia} />
                ))}
              </div>
              {pagination.totalPages > 1 ? (
                <div className="media-pagination">
                  <button
                    className="secondary-button small-button"
                    disabled={pagination.page <= 1}
                    type="button"
                    onClick={() => updateFilters({ page: filters.page - 1 })}
                  >
                    上一页
                  </button>
                  <span>
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    className="secondary-button small-button"
                    disabled={pagination.page >= pagination.totalPages}
                    type="button"
                    onClick={() => updateFilters({ page: filters.page + 1 })}
                  >
                    下一页
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="media-detail-panel" aria-label="媒体详情">
          {(selectedMedia || showUpload) && (
            <button
              className="secondary-button small-button media-back-button"
              type="button"
              onClick={() => {
                setSelectedMedia(null);
                setShowUpload(false);
                setMediaForm(null);
              }}
            >
              <ArrowLeft aria-hidden="true" size={14} />
              返回列表
            </button>
          )}
          {showUpload ? (
            <MediaUploadForm
              cats={cats}
              dimensions={uploadDimensions}
              file={uploadFile}
              fixedPages={fixedPages}
              form={uploadForm}
              isSaving={isSaving}
              litters={litters}
              previewUrl={uploadPreviewUrl}
              onCancel={() => setShowUpload(false)}
              onChange={setUploadForm}
              onFileChange={(file) => void handleUploadFile(file)}
              onSubmit={handleUploadSubmit}
            />
          ) : selectedMedia ? (
            mediaForm ? (
              <MediaEditForm
                form={mediaForm}
                isSaving={isSaving}
                onCancel={() => setMediaForm(null)}
                onChange={setMediaForm}
                onSubmit={handleMediaSubmit}
              />
            ) : (
              <div className="media-detail-stack">
                <MediaDetail
                  confirmingArchiveId={confirmingArchiveId}
                  media={selectedMedia}
                  onArchive={handleArchiveMedia}
                  onEdit={(media) =>
                    setMediaForm({
                      altText: media.altText ?? "",
                      status: media.status,
                      title: media.title ?? "",
                    })
                  }
                />
                <MediaBindingsList
                  bindings={selectedMedia.bindings}
                  confirmingBindingId={confirmingBindingId}
                  isSaving={isSaving}
                  ownerNameMaps={ownerNameMaps}
                  onArchive={handleArchiveBinding}
                  onUpdate={handleBindingUpdate}
                />
                {!selectedMedia.deletedAt ? (
                  <form className="media-add-binding" onSubmit={handleBindingSubmit}>
                    <div className="media-subheading">
                      <h4>新增引用</h4>
                      <span>同一文件可以安全用于多个内容对象</span>
                    </div>
                    <OwnerFields
                      cats={cats}
                      fixedPages={fixedPages}
                      form={bindingForm}
                      litters={litters}
                      onChange={setBindingForm}
                    />
                    <div className="form-grid media-binding-fields">
                      <FieldSelect
                        label="用途"
                        options={USAGE_OPTIONS}
                        value={bindingForm.usage}
                        onChange={(usage) => setBindingForm({ ...bindingForm, usage })}
                      />
                      <FieldInput
                        label="排序"
                        type="number"
                        value={bindingForm.sortOrder}
                        onChange={(sortOrder) => setBindingForm({ ...bindingForm, sortOrder })}
                      />
                    </div>
                    <button disabled={isSaving || !bindingForm.ownerId} type="submit">
                      {isSaving ? "保存中..." : "新增绑定"}
                    </button>
                  </form>
                ) : null}
              </div>
            )
          ) : (
            <div className="media-detail-empty">
              <ImageIcon aria-hidden="true" size={32} />
              <h3>选择媒体查看详情</h3>
              <p>可查看文件信息、预览和所有真实内容引用。</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MediaTableRow({
  media,
  onSelect,
  selected,
}: {
  media: MediaAssetData;
  onSelect: (media: MediaAssetData) => void;
  selected: boolean;
}) {
  return (
    <tr className={`${selected ? "selected-row" : ""} ${media.deletedAt ? "archived-row" : ""}`}>
      <td>
        <button className="media-table-identity" type="button" onClick={() => void onSelect(media)}>
          <MediaThumbnail media={media} />
          <span>
            <strong>{getMediaTitle(media)}</strong>
            <small>{formatOption(media.kind, KIND_OPTIONS)}</small>
          </span>
        </button>
      </td>
      <td>
        <span className="media-file-meta">{media.mimeType || "未知格式"}</span>
        <span className="media-file-meta">{formatFileSize(media.sizeBytes)}</span>
      </td>
      <td>
        <MediaStatusBadge media={media} />
      </td>
      <td>
        <span className="media-reference-count">
          <Link2 aria-hidden="true" size={13} />
          {media.bindings.length}
        </span>
      </td>
      <td>
        <button
          className="secondary-button small-button"
          type="button"
          onClick={() => void onSelect(media)}
        >
          查看
        </button>
      </td>
    </tr>
  );
}

function MediaMobileRow({
  media,
  onSelect,
}: {
  media: MediaAssetData;
  onSelect: (media: MediaAssetData) => void;
}) {
  return (
    <button className="media-mobile-row" type="button" onClick={() => void onSelect(media)}>
      <MediaThumbnail media={media} />
      <span className="media-mobile-copy">
        <strong>{getMediaTitle(media)}</strong>
        <small>
          {media.mimeType || formatOption(media.kind, KIND_OPTIONS)} ·{" "}
          {formatFileSize(media.sizeBytes)}
        </small>
        <span>
          <MediaStatusBadge media={media} />
          <em>{media.bindings.length} 个引用</em>
        </span>
      </span>
    </button>
  );
}

function MediaThumbnail({ media }: { media: MediaAssetData }) {
  const previewUrl = media.thumbnailUrl || media.sourceUrl;
  if (media.kind === "image" && previewUrl) {
    return <img alt="" className="media-thumbnail" loading="lazy" src={previewUrl} />;
  }
  return (
    <span className="media-thumbnail media-thumbnail-fallback">
      <FileText aria-hidden="true" size={20} />
    </span>
  );
}

function MediaStatusBadge({ media }: { media: MediaAssetData }) {
  const status = media.deletedAt ? "archived" : media.status;
  return (
    <span className={`media-status media-status-${status}`}>
      {formatOption(status, STATUS_OPTIONS)}
    </span>
  );
}

function MediaDetail({
  confirmingArchiveId,
  media,
  onArchive,
  onEdit,
}: {
  confirmingArchiveId: string;
  media: MediaAssetData;
  onArchive: (media: MediaAssetData) => void;
  onEdit: (media: MediaAssetData) => void;
}) {
  return (
    <section className="media-detail-card">
      <div className="media-panel-heading">
        <div>
          <p className="eyebrow">Media Detail</p>
          <h3>{getMediaTitle(media)}</h3>
        </div>
        <MediaStatusBadge media={media} />
      </div>
      <MediaPreview media={media} />
      <div className="media-detail-actions">
        {!media.deletedAt ? (
          <>
            <button
              className="secondary-button small-button"
              type="button"
              onClick={() => onEdit(media)}
            >
              编辑信息
            </button>
            <button
              className="danger-button small-button"
              type="button"
              onClick={() => onArchive(media)}
            >
              {confirmingArchiveId === media.id ? "确认归档媒体" : "归档媒体"}
            </button>
          </>
        ) : null}
      </div>
      <dl className="media-file-details">
        {[
          ["文件类型", media.mimeType || formatOption(media.kind, KIND_OPTIONS)],
          ["文件大小", formatFileSize(media.sizeBytes)],
          ["像素尺寸", formatDimensions(media)],
          ["替代文本", media.altText || "未填写"],
          ["创建时间", formatDateTime(media.createdAt)],
          ["更新时间", formatDateTime(media.updatedAt)],
          ["存储地址", getStoredSourceUrl(media)],
          ["校验值", media.checksum || "未记录"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd title={value}>{value}</dd>
          </div>
        ))}
      </dl>
      {!media.deletedAt ? (
        <p className="media-danger-note">
          归档媒体会同时归档所有有效绑定。若只想从某处移除，请在下方使用“移除绑定”。
        </p>
      ) : null}
    </section>
  );
}

function MediaPreview({ media }: { media: MediaAssetData }) {
  if (media.kind === "image") {
    return (
      <a
        className="media-preview-link"
        href={media.sourceUrl}
        rel="noreferrer"
        target="_blank"
        title="在新窗口查看原图"
      >
        <img
          alt={media.altText || media.title || "媒体预览"}
          className="media-detail-preview"
          src={media.thumbnailUrl || media.sourceUrl}
        />
      </a>
    );
  }
  return (
    <div className="media-detail-preview media-detail-preview-fallback">
      <FileText aria-hidden="true" size={34} />
      <span>{formatOption(media.kind, KIND_OPTIONS)}文件</span>
    </div>
  );
}

function MediaEditForm({
  form,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: {
  form: MediaFormState;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (form: MediaFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="media-form-card" onSubmit={onSubmit}>
      <div className="media-panel-heading">
        <div>
          <p className="eyebrow">Edit Media</p>
          <h3>编辑媒体信息</h3>
        </div>
      </div>
      <FieldInput
        label="标题"
        value={form.title}
        onChange={(title) => onChange({ ...form, title })}
      />
      <FieldInput
        label="替代文本"
        value={form.altText}
        onChange={(altText) => onChange({ ...form, altText })}
      />
      <FieldSelect
        label="状态"
        options={STATUS_OPTIONS.filter((option) => option.value !== "archived")}
        value={form.status}
        onChange={(status) => onChange({ ...form, status })}
      />
      <p className="media-form-hint">文件地址和存储信息来自真实上传流程，不在此处手工改写。</p>
      <div className="form-actions">
        <button disabled={isSaving} type="submit">
          {isSaving ? "保存中..." : "保存修改"}
        </button>
        <button className="secondary-button" disabled={isSaving} type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

function MediaUploadForm({
  cats,
  dimensions,
  file,
  fixedPages,
  form,
  isSaving,
  litters,
  onCancel,
  onChange,
  onFileChange,
  onSubmit,
  previewUrl,
}: {
  cats: CatData[];
  dimensions: { height: number; width: number } | null;
  file: File | null;
  fixedPages: FixedPageData[];
  form: UploadFormState;
  isSaving: boolean;
  litters: LitterData[];
  onCancel: () => void;
  onChange: (form: UploadFormState) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  previewUrl: string;
}) {
  return (
    <form className="media-form-card" onSubmit={onSubmit}>
      <div className="media-panel-heading">
        <div>
          <p className="eyebrow">Upload Image</p>
          <h3>上传图片</h3>
          <p className="muted compact">选择文件后将通过真实 COS 上传流程保存。</p>
        </div>
      </div>
      <label className={`media-upload-dropzone ${previewUrl ? "has-preview" : ""}`}>
        {previewUrl ? (
          <img alt="待上传图片预览" src={previewUrl} />
        ) : (
          <span>
            <Upload aria-hidden="true" size={24} />
            <strong>选择图片文件</strong>
            <small>上传前可预览并设置首个内容绑定</small>
          </span>
        )}
        <input
          accept="image/*"
          aria-label="选择上传图片"
          type="file"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </label>
      {file ? (
        <div className="media-upload-meta">
          <span>{file.name}</span>
          <span>{formatFileSize(file.size)}</span>
          <span>{dimensions ? `${dimensions.width} × ${dimensions.height}` : "读取尺寸中"}</span>
        </div>
      ) : null}
      <FieldInput
        label="标题"
        value={form.title}
        onChange={(title) => onChange({ ...form, title })}
      />
      <FieldInput
        label="替代文本"
        value={form.altText}
        onChange={(altText) => onChange({ ...form, altText })}
      />
      <div className="media-form-section">
        <div className="media-subheading">
          <h4>首次绑定</h4>
          <span>上传成功后立即关联到真实内容</span>
        </div>
        <OwnerFields
          cats={cats}
          fixedPages={fixedPages}
          form={form}
          litters={litters}
          onChange={onChange}
        />
        <div className="form-grid media-binding-fields">
          <FieldSelect
            label="用途"
            options={USAGE_OPTIONS}
            value={form.usage}
            onChange={(usage) => onChange({ ...form, usage })}
          />
          <FieldInput
            label="排序"
            type="number"
            value={form.sortOrder}
            onChange={(sortOrder) => onChange({ ...form, sortOrder })}
          />
          <FieldSelect
            label="可见性"
            options={VISIBILITY_OPTIONS}
            value={form.visibility}
            onChange={(visibility) => onChange({ ...form, visibility })}
          />
        </div>
      </div>
      <div className="form-actions">
        <button disabled={isSaving || !file || !form.ownerId || !dimensions} type="submit">
          {isSaving ? "上传并保存中..." : "上传并创建绑定"}
        </button>
        <button className="secondary-button" disabled={isSaving} type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}

function MediaBindingsList({
  bindings,
  confirmingBindingId,
  isSaving,
  onArchive,
  onUpdate,
  ownerNameMaps,
}: {
  bindings: MediaBindingData[];
  confirmingBindingId: string;
  isSaving: boolean;
  onArchive: (binding: MediaBindingData) => void;
  onUpdate: (binding: MediaBindingData, patch: UpdateMediaBindingRequest) => void;
  ownerNameMaps: {
    cat: Map<string, string>;
    fixed_page: Map<string, string>;
    litter: Map<string, string>;
  };
}) {
  return (
    <section className="media-bindings-card">
      <div className="media-subheading media-bindings-heading">
        <div>
          <h4>内容引用</h4>
          <span>当前 {bindings.length} 个有效绑定</span>
        </div>
        <Link2 aria-hidden="true" size={17} />
      </div>
      {bindings.length === 0 ? (
        <div className="media-bindings-empty">该媒体当前没有被任何内容引用</div>
      ) : (
        <div className="media-bindings-list">
          {bindings.map((binding) => (
            <MediaBindingRow
              key={binding.id}
              binding={binding}
              confirming={confirmingBindingId === binding.id}
              isSaving={isSaving}
              ownerLabel={formatOwnerLabel(binding, ownerNameMaps)}
              onArchive={onArchive}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MediaBindingRow({
  binding,
  confirming,
  isSaving,
  onArchive,
  onUpdate,
  ownerLabel,
}: {
  binding: MediaBindingData;
  confirming: boolean;
  isSaving: boolean;
  onArchive: (binding: MediaBindingData) => void;
  onUpdate: (binding: MediaBindingData, patch: UpdateMediaBindingRequest) => void;
  ownerLabel: string;
}) {
  const [draft, setDraft] = useState({
    sortOrder: String(binding.sortOrder),
    usage: binding.usage,
    visibility: binding.visibility,
  });

  useEffect(() => {
    setDraft({
      sortOrder: String(binding.sortOrder),
      usage: binding.usage,
      visibility: binding.visibility,
    });
  }, [binding]);

  const dirty =
    draft.sortOrder !== String(binding.sortOrder) ||
    draft.usage !== binding.usage ||
    draft.visibility !== binding.visibility;

  return (
    <div className="media-binding-card">
      <div className="media-binding-owner">
        <span>{formatOption(binding.ownerType, OWNER_TYPE_OPTIONS)}</span>
        <strong>{ownerLabel}</strong>
        <small title={binding.ownerId}>{binding.ownerId}</small>
      </div>
      <div className="media-binding-editor">
        <FieldSelect
          label="用途"
          options={USAGE_OPTIONS}
          value={draft.usage}
          onChange={(usage) => setDraft({ ...draft, usage })}
        />
        <FieldInput
          label="排序"
          type="number"
          value={draft.sortOrder}
          onChange={(sortOrder) => setDraft({ ...draft, sortOrder })}
        />
        <FieldSelect
          label="可见性"
          options={VISIBILITY_OPTIONS}
          value={draft.visibility}
          onChange={(visibility) => setDraft({ ...draft, visibility })}
        />
      </div>
      <div className="media-binding-actions">
        <button
          className="secondary-button small-button"
          disabled={isSaving || !dirty}
          type="button"
          onClick={() =>
            onUpdate(binding, {
              sortOrder: optionalNumber(draft.sortOrder) ?? 0,
              usage: draft.usage,
              visibility: draft.visibility,
            })
          }
        >
          保存绑定
        </button>
        <button
          className="danger-link-button"
          disabled={isSaving}
          type="button"
          onClick={() => onArchive(binding)}
        >
          {confirming ? "确认移除绑定" : "移除绑定"}
        </button>
      </div>
    </div>
  );
}

function OwnerFields<TForm extends { ownerId: string; ownerType: string }>({
  cats,
  fixedPages,
  form,
  litters,
  onChange,
}: {
  cats: CatData[];
  fixedPages: FixedPageData[];
  form: TForm;
  litters: LitterData[];
  onChange: (form: TForm) => void;
}) {
  const ownerOptions = buildOwnerOptions(form.ownerType, cats, litters, fixedPages);
  return (
    <div className="form-grid">
      <FieldSelect
        label="内容类型"
        options={OWNER_TYPE_OPTIONS}
        value={form.ownerType}
        onChange={(ownerType) =>
          onChange({
            ...form,
            ownerType,
            ownerId: buildOwnerOptions(ownerType, cats, litters, fixedPages)[0]?.value ?? "",
          })
        }
      />
      {ownerOptions.length > 0 ? (
        <FieldSelect
          label="关联内容"
          options={ownerOptions}
          value={form.ownerId}
          onChange={(ownerId) => onChange({ ...form, ownerId })}
        />
      ) : (
        <FieldInput
          label="内容 ID"
          placeholder="输入真实对象 ID"
          required
          value={form.ownerId}
          onChange={(ownerId) => onChange({ ...form, ownerId })}
        />
      )}
    </div>
  );
}

function FieldInput({
  label,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "number" | "text";
  value: string;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FieldSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {!options.some((option) => option.value === value) ? (
          <option value={value}>{value}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompactSelect({
  ariaLabel,
  onChange,
  options,
  placeholder,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  value: string;
}) {
  return (
    <select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function createDefaultBindingForm(
  cats: CatData[],
  litters: LitterData[],
  fixedPages: FixedPageData[],
) {
  return {
    ...DEFAULT_BINDING_FORM,
    ownerId: buildOwnerOptions("cat", cats, litters, fixedPages)[0]?.value ?? "",
  };
}

function toBindingPayload(form: BindingFormState): CreateMediaBindingRequest {
  return {
    ownerId: form.ownerId,
    ownerType: form.ownerType,
    sortOrder: optionalNumber(form.sortOrder) ?? 0,
    usage: form.usage,
    visibility: form.visibility,
  };
}

function buildOwnerOptions(
  ownerType: string,
  cats: CatData[],
  litters: LitterData[],
  fixedPages: FixedPageData[],
) {
  if (ownerType === "cat") {
    return cats.filter((cat) => !cat.deletedAt).map((cat) => ({ label: cat.name, value: cat.id }));
  }
  if (ownerType === "litter") {
    return litters
      .filter((litter) => !litter.deletedAt)
      .map((litter) => ({ label: litter.name, value: litter.id }));
  }
  if (ownerType === "fixed_page") {
    return fixedPages
      .filter((page) => !page.deletedAt)
      .map((page) => ({ label: page.title, value: page.id }));
  }
  return [];
}

function formatOwnerLabel(
  binding: MediaBindingData,
  ownerNameMaps: {
    cat: Map<string, string>;
    fixed_page: Map<string, string>;
    litter: Map<string, string>;
  },
) {
  if (binding.ownerType === "cat") return ownerNameMaps.cat.get(binding.ownerId) ?? "未知猫咪";
  if (binding.ownerType === "litter")
    return ownerNameMaps.litter.get(binding.ownerId) ?? "未知窝次";
  if (binding.ownerType === "fixed_page")
    return ownerNameMaps.fixed_page.get(binding.ownerId) ?? "未知固定页面";
  if (binding.ownerType === "post") return "猫友圈动态";
  if (binding.ownerType === "parent_profile") return "家长资料";
  return binding.ownerType;
}

function getMediaTitle(media: MediaAssetData) {
  return media.title || getFileName(getStoredSourceUrl(media)) || media.id;
}

function getStoredSourceUrl(media: MediaAssetData) {
  return media.storedSourceUrl ?? media.sourceUrl;
}

function getFileName(value: string) {
  const withoutQuery = value.split(/[?#]/)[0];
  const candidate = withoutQuery.split("/").filter(Boolean).at(-1);
  if (!candidate) return "";
  try {
    return decodeURIComponent(candidate);
  } catch {
    return candidate;
  }
}

function stripFileExtension(value: string) {
  return value.replace(/\.[^.]+$/, "");
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatOption(value: string, options: Array<{ label: string; value: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatDimensions(media: MediaAssetData) {
  if (media.width == null && media.height == null) return "未记录";
  return `${media.width ?? "?"} × ${media.height ?? "?"}`;
}

function formatFileSize(value: number | null) {
  if (value == null) return "大小未知";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string | null) {
  if (!value) return "未记录";
  return new Date(value).toLocaleString("zh-CN");
}

function readImageDimensions(file: File) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      resolve({ height: image.naturalHeight, width: image.naturalWidth });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error("Invalid image"));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}
