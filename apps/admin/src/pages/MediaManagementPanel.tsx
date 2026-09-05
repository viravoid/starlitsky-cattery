import type {
  CatData,
  CreateMediaAssetRequest,
  CreateMediaBindingRequest,
  FixedPageData,
  LitterData,
  MediaAssetData,
  MediaBindingData,
  UpdateMediaAssetRequest,
} from "@starlitsky/shared";
import { ENVIRONMENT_MEDIA_USAGES } from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  archiveMedia,
  archiveMediaBinding,
  createMedia,
  createMediaBinding,
  getMedia,
  listMedia,
  updateMedia,
  updateMediaBinding,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

type EditorMode = "create" | "edit" | null;

interface MediaFormState {
  altText: string;
  height: string;
  kind: string;
  mimeType: string;
  ownerId: string;
  ownerType: string;
  sortOrder: string;
  sourceUrl: string;
  status: string;
  thumbnailUrl: string;
  title: string;
  usage: string;
  width: string;
}

interface BindingFormState {
  ownerId: string;
  ownerType: string;
  sortOrder: string;
  usage: string;
  visibility: string;
}

const DEFAULT_MEDIA_FORM: MediaFormState = {
  altText: "",
  height: "",
  kind: "image",
  mimeType: "",
  ownerId: "",
  ownerType: "cat",
  sortOrder: "0",
  sourceUrl: "",
  status: "active",
  thumbnailUrl: "",
  title: "",
  usage: "gallery",
  width: "",
};

const DEFAULT_BINDING_FORM: BindingFormState = {
  ownerId: "",
  ownerType: "cat",
  sortOrder: "0",
  usage: "gallery",
  visibility: "visible",
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
  { label: "猫", value: "cat" },
  { label: "窝次", value: "litter" },
  { label: "固定页面", value: "fixed_page" },
  { label: "动态", value: "post" },
  { label: "家长", value: "parent_profile" },
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
  { label: "可见", value: "visible" },
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
  const [selectedMedia, setSelectedMedia] = useState<MediaAssetData | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [form, setForm] = useState<MediaFormState>(DEFAULT_MEDIA_FORM);
  const [bindingForm, setBindingForm] = useState<BindingFormState>(DEFAULT_BINDING_FORM);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [confirmingArchiveId, setConfirmingArchiveId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadMedia = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const mediaList = await listMedia({
        includeDeleted: includeArchived,
        pageSize: 100,
      });
      setMediaItems(mediaList.items);
      setSelectedMedia((current) =>
        current ? (mediaList.items.find((item) => item.id === current.id) ?? null) : null,
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  function openCreateMedia() {
    setSelectedMedia(null);
    setForm({
      ...DEFAULT_MEDIA_FORM,
      ownerId:
        buildOwnerOptions(DEFAULT_MEDIA_FORM.ownerType, cats, litters, fixedPages)[0]?.value ?? "",
    });
    setEditorMode("create");
    setConfirmingArchiveId("");
    setNotice("");
    setError("");
  }

  function openEditMedia(media: MediaAssetData) {
    setSelectedMedia(media);
    setForm(toMediaForm(media));
    setEditorMode("edit");
    setConfirmingArchiveId("");
    setNotice("");
    setError("");
  }

  async function selectMedia(media: MediaAssetData) {
    setEditorMode(null);
    setConfirmingArchiveId("");
    setNotice("");
    setError("");

    try {
      const freshMedia = await getMedia(media.id);
      setSelectedMedia(freshMedia);
      setBindingForm({
        ...DEFAULT_BINDING_FORM,
        ownerId:
          buildOwnerOptions(DEFAULT_BINDING_FORM.ownerType, cats, litters, fixedPages)[0]?.value ??
          "",
      });
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function handleMediaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = toMediaPayload(form, editorMode === "create");
      const savedMedia =
        editorMode === "edit" && selectedMedia
          ? await updateMedia(selectedMedia.id, payload as UpdateMediaAssetRequest)
          : await createMedia(payload as CreateMediaAssetRequest);

      setSelectedMedia(savedMedia);
      setEditorMode(null);
      setNotice(editorMode === "edit" ? "媒体记录已更新" : "媒体记录已创建");
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
      setNotice(`再次点击“确认归档”以归档 ${media.title || media.sourceUrl}`);
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const archived = await archiveMedia(media.id);
      setSelectedMedia(archived);
      setEditorMode(null);
      setConfirmingArchiveId("");
      setNotice("媒体记录已归档");
      await loadMedia();
    } catch (archiveError) {
      setError(getErrorMessage(archiveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBindingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMedia) return;

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const binding = await createMediaBinding(selectedMedia.id, toBindingPayload(bindingForm));
      setSelectedMedia({
        ...selectedMedia,
        bindings: [...selectedMedia.bindings, binding].sort(sortBindings),
      });
      setNotice("媒体业务绑定已新增");
      await loadMedia();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBindingVisibilityChange(binding: MediaBindingData, visibility: string) {
    if (!selectedMedia) return;

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const updated = await updateMediaBinding(selectedMedia.id, binding.id, { visibility });
      setSelectedMedia({
        ...selectedMedia,
        bindings: selectedMedia.bindings.map((item) => (item.id === updated.id ? updated : item)),
      });
      setNotice("媒体绑定状态已更新");
      await loadMedia();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveBinding(binding: MediaBindingData) {
    if (!selectedMedia) return;

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      await archiveMediaBinding(selectedMedia.id, binding.id);
      setSelectedMedia({
        ...selectedMedia,
        bindings: selectedMedia.bindings.filter((item) => item.id !== binding.id),
      });
      setNotice("媒体绑定已归档");
      await loadMedia();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Media Library</p>
          <h2>媒体基础管理</h2>
          <p className="muted compact">只维护媒体元数据和业务绑定，不包含上传或对象存储。</p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={loadMedia}>
            刷新
          </button>
          <button type="button" onClick={openCreateMedia}>
            新增媒体
          </button>
        </div>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="management-grid">
        <section className="table-panel" aria-label="媒体列表">
          <div className="section-heading">
            <div>
              <h3>媒体列表</h3>
              <p className="muted compact">当前 {mediaItems.length} 条记录</p>
            </div>
            <label className="toggle-row">
              <input
                checked={includeArchived}
                type="checkbox"
                onChange={(event) => setIncludeArchived(event.target.checked)}
              />
              显示归档
            </label>
          </div>
          {isLoading ? (
            <div className="empty-state">正在加载媒体记录...</div>
          ) : mediaItems.length === 0 ? (
            <div className="empty-state">
              暂无媒体记录
              <button type="button" onClick={openCreateMedia}>
                新增第一条媒体
              </button>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>标题</th>
                    <th>类型</th>
                    <th>状态</th>
                    <th>绑定</th>
                    <th>地址</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaItems.map((media) => (
                    <tr key={media.id} className={media.deletedAt ? "archived-row" : ""}>
                      <td>
                        <button
                          className="link-button"
                          type="button"
                          onClick={() => void selectMedia(media)}
                        >
                          {media.title || media.sourceUrl}
                        </button>
                      </td>
                      <td>{formatOption(media.kind, KIND_OPTIONS)}</td>
                      <td>{formatOption(media.status, STATUS_OPTIONS)}</td>
                      <td>{media.bindings.length}</td>
                      <td className="truncate-cell">{media.sourceUrl}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="secondary-button small-button"
                            type="button"
                            onClick={() => openEditMedia(media)}
                          >
                            编辑
                          </button>
                          {!media.deletedAt ? (
                            <button
                              className="danger-button small-button"
                              type="button"
                              onClick={() => void handleArchiveMedia(media)}
                            >
                              {confirmingArchiveId === media.id ? "确认归档" : "归档"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="detail-panel" aria-label="媒体详情">
          {editorMode ? (
            <MediaForm
              cats={cats}
              fixedPages={fixedPages}
              form={form}
              isSaving={isSaving}
              litters={litters}
              mode={editorMode}
              onCancel={() => setEditorMode(null)}
              onChange={setForm}
              onSubmit={handleMediaSubmit}
            />
          ) : selectedMedia ? (
            <div className="detail-stack">
              <MediaDetail
                confirmingArchiveId={confirmingArchiveId}
                media={selectedMedia}
                onArchive={handleArchiveMedia}
                onEdit={openEditMedia}
              />
              <form className="inline-form" onSubmit={handleBindingSubmit}>
                <h4>新增业务绑定</h4>
                <OwnerFields
                  cats={cats}
                  fixedPages={fixedPages}
                  form={bindingForm}
                  litters={litters}
                  onChange={setBindingForm}
                />
                <div className="form-grid">
                  <FieldSelect
                    label="用途"
                    options={USAGE_OPTIONS}
                    value={bindingForm.usage}
                    onChange={(usage) => setBindingForm({ ...bindingForm, usage })}
                  />
                  <FieldInput
                    label="排序"
                    value={bindingForm.sortOrder}
                    onChange={(sortOrder) => setBindingForm({ ...bindingForm, sortOrder })}
                  />
                </div>
                <button disabled={isSaving || !bindingForm.ownerId} type="submit">
                  新增绑定
                </button>
              </form>
              <MediaBindingsList
                bindings={selectedMedia.bindings}
                isSaving={isSaving}
                onArchive={handleArchiveBinding}
                onVisibilityChange={handleBindingVisibilityChange}
              />
            </div>
          ) : (
            <div className="empty-state">选择一条媒体记录查看详情，或新增媒体元数据。</div>
          )}
        </aside>
      </div>
    </>
  );
}

function MediaForm({
  cats,
  fixedPages,
  form,
  isSaving,
  litters,
  mode,
  onCancel,
  onChange,
  onSubmit,
}: {
  cats: CatData[];
  fixedPages: FixedPageData[];
  form: MediaFormState;
  isSaving: boolean;
  litters: LitterData[];
  mode: Exclude<EditorMode, null>;
  onCancel: () => void;
  onChange: (form: MediaFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">{mode === "edit" ? "Edit Media" : "New Media"}</p>
        <h3>{mode === "edit" ? "编辑媒体" : "新增媒体"}</h3>
      </div>
      <label>
        源地址
        <input
          aria-label="源地址"
          placeholder="https://... 或业务占位地址"
          required
          value={form.sourceUrl}
          onChange={(event) => onChange({ ...form, sourceUrl: event.target.value })}
        />
      </label>
      <div className="form-grid">
        <FieldSelect
          label="类型"
          options={KIND_OPTIONS}
          value={form.kind}
          onChange={(kind) => onChange({ ...form, kind })}
        />
        <FieldSelect
          label="状态"
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(status) => onChange({ ...form, status })}
        />
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
      <div className="form-grid">
        <FieldInput
          label="缩略图地址"
          value={form.thumbnailUrl}
          onChange={(thumbnailUrl) => onChange({ ...form, thumbnailUrl })}
        />
        <FieldInput
          label="MIME 类型"
          value={form.mimeType}
          onChange={(mimeType) => onChange({ ...form, mimeType })}
        />
      </div>
      <div className="form-grid">
        <FieldInput
          label="宽度"
          value={form.width}
          onChange={(width) => onChange({ ...form, width })}
        />
        <FieldInput
          label="高度"
          value={form.height}
          onChange={(height) => onChange({ ...form, height })}
        />
      </div>
      {mode === "create" ? (
        <div className="inline-form">
          <h4>初始业务绑定</h4>
          <OwnerFields
            cats={cats}
            fixedPages={fixedPages}
            form={form}
            litters={litters}
            onChange={onChange}
          />
          <div className="form-grid">
            <FieldSelect
              label="用途"
              options={USAGE_OPTIONS}
              value={form.usage}
              onChange={(usage) => onChange({ ...form, usage })}
            />
            <FieldInput
              label="排序"
              value={form.sortOrder}
              onChange={(sortOrder) => onChange({ ...form, sortOrder })}
            />
          </div>
        </div>
      ) : null}
      <div className="form-actions">
        <button disabled={isSaving} type="submit">
          {isSaving ? "保存中..." : "保存"}
        </button>
        <button className="secondary-button" disabled={isSaving} type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
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
  const usesSelect = ownerOptions.length > 0;

  return (
    <div className="form-grid">
      <FieldSelect
        label="业务对象"
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
      {usesSelect ? (
        <FieldSelect
          label="对象"
          options={ownerOptions}
          value={form.ownerId}
          onChange={(ownerId) => onChange({ ...form, ownerId })}
        />
      ) : (
        <FieldInput
          label="对象 ID"
          value={form.ownerId}
          onChange={(ownerId) => onChange({ ...form, ownerId })}
        />
      )}
    </div>
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
    <div className="detail-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Media Detail</p>
          <h3>{media.title || media.sourceUrl}</h3>
        </div>
        <div className="table-actions">
          <button
            className="secondary-button small-button"
            type="button"
            onClick={() => onEdit(media)}
          >
            编辑
          </button>
          {!media.deletedAt ? (
            <button
              className="danger-button small-button"
              type="button"
              onClick={() => onArchive(media)}
            >
              {confirmingArchiveId === media.id ? "确认归档" : "归档"}
            </button>
          ) : null}
        </div>
      </div>
      {media.kind === "image" ? (
        <img
          alt={media.altText || media.title || "媒体预览"}
          className="media-preview"
          src={media.thumbnailUrl || media.sourceUrl}
        />
      ) : null}
      <dl className="description-list">
        {[
          ["类型", formatOption(media.kind, KIND_OPTIONS)],
          ["状态", formatOption(media.status, STATUS_OPTIONS)],
          ["源地址", media.sourceUrl],
          ["缩略图", media.thumbnailUrl || "-"],
          ["替代文本", media.altText || "-"],
          ["MIME", media.mimeType || "-"],
          ["尺寸", formatDimensions(media)],
          ["创建时间", formatDateTime(media.createdAt)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MediaBindingsList({
  bindings,
  isSaving,
  onArchive,
  onVisibilityChange,
}: {
  bindings: MediaBindingData[];
  isSaving: boolean;
  onArchive: (binding: MediaBindingData) => void;
  onVisibilityChange: (binding: MediaBindingData, visibility: string) => void;
}) {
  return (
    <div className="archive-stack">
      <div className="subsection-heading">
        <h4>业务绑定</h4>
      </div>
      <div className="mini-list">
        {bindings.length === 0 ? (
          <p className="muted compact">暂无业务绑定</p>
        ) : (
          bindings.map((binding) => (
            <div className="media-binding-row" key={binding.id}>
              <span>{formatOption(binding.ownerType, OWNER_TYPE_OPTIONS)}</span>
              <span>{binding.ownerId}</span>
              <span>{formatOption(binding.usage, USAGE_OPTIONS)}</span>
              <select
                aria-label={`绑定可见性 ${binding.id}`}
                disabled={isSaving}
                value={binding.visibility}
                onChange={(event) => onVisibilityChange(binding, event.target.value)}
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                className="danger-button small-button"
                disabled={isSaving}
                type="button"
                onClick={() => onArchive(binding)}
              >
                归档
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FieldInput({
  label,
  onChange,
  placeholder,
  required,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        placeholder={placeholder}
        required={required}
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
        <option value="">请选择</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toMediaForm(media: MediaAssetData): MediaFormState {
  return {
    ...DEFAULT_MEDIA_FORM,
    altText: media.altText ?? "",
    height: media.height == null ? "" : String(media.height),
    kind: media.kind,
    mimeType: media.mimeType ?? "",
    sourceUrl: media.sourceUrl,
    status: media.status,
    thumbnailUrl: media.thumbnailUrl ?? "",
    title: media.title ?? "",
    width: media.width == null ? "" : String(media.width),
  };
}

function toMediaPayload(
  form: MediaFormState,
  includeInitialBinding: boolean,
): CreateMediaAssetRequest | UpdateMediaAssetRequest {
  return {
    altText: emptyToNull(form.altText),
    height: optionalNumber(form.height),
    kind: form.kind,
    mimeType: emptyToNull(form.mimeType),
    ownerId: includeInitialBinding ? emptyToUndefined(form.ownerId) : undefined,
    ownerType: includeInitialBinding && form.ownerId ? form.ownerType : undefined,
    sortOrder: includeInitialBinding && form.ownerId ? optionalNumber(form.sortOrder) : undefined,
    sourceUrl: form.sourceUrl.trim(),
    status: form.status,
    thumbnailUrl: emptyToNull(form.thumbnailUrl),
    title: emptyToNull(form.title),
    usage: includeInitialBinding && form.ownerId ? form.usage : undefined,
    width: optionalNumber(form.width),
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
    return cats.map((cat) => ({ label: cat.name, value: cat.id }));
  }
  if (ownerType === "litter") {
    return litters.map((litter) => ({ label: litter.name, value: litter.id }));
  }
  if (ownerType === "fixed_page") {
    return fixedPages.map((page) => ({ label: page.title, value: page.id }));
  }
  return [];
}

function sortBindings(left: MediaBindingData, right: MediaBindingData) {
  return left.sortOrder - right.sortOrder || right.createdAt.localeCompare(left.createdAt);
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  return Number(value);
}

function formatOption(value: string, options: Array<{ label: string; value: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatDimensions(media: MediaAssetData) {
  if (media.width == null && media.height == null) return "-";
  return `${media.width ?? "?"} x ${media.height ?? "?"}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}
