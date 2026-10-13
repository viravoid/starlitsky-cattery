import { ENVIRONMENT_MEDIA_USAGES } from "@starlitsky/shared";
import type {
  FixedPageData,
  FixedPageSlug,
  MediaAssetData,
  MediaBindingData,
  UpdateFixedPageRequest,
} from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  archiveMediaBinding,
  getFixedPage,
  listMedia,
  updateFixedPage,
  updateMediaBinding,
  uploadFixedPageImage,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

type ImageUploadState = "idle" | "pending" | "uploading" | "uploaded";
type JsonRecord = Record<string, unknown>;
type EnvironmentSlotKey = keyof typeof ENVIRONMENT_MEDIA_USAGES;

interface FixedPageFormState {
  contentJson: JsonRecord;
  contentJsonText: string;
  contentSchemaVersion: string;
  seoDescription: string;
  seoTitle: string;
  status: string;
  title: string;
}

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

const PAGE_LABELS: Record<FixedPageSlug, { eyebrow: string; title: string; desc: string }> = {
  home: {
    eyebrow: "HomepageContentPanel",
    title: "首页",
    desc: "管理首页入口、介绍和结构化内容；图片继续走固定页媒体绑定。",
  },
  about: {
    eyebrow: "AboutContentPanel",
    title: "猫舍介绍",
    desc: "按 Demo 的主图、名片和正文分组维护真实 contentJson。",
  },
  philosophy: {
    eyebrow: "PhilosophyContentPanel",
    title: "繁育理念",
    desc: "维护理念开场、正文段落和结构化小节。",
  },
  environment: {
    eyebrow: "EnvironmentContentPanel",
    title: "猫舍环境",
    desc: "维护环境事实、空间分区和真实 COS 环境图片位。",
  },
  feeding: {
    eyebrow: "FeedingContentPanel",
    title: "喂养体系",
    desc: "维护喂养事实、正文与项目说明，不恢复文章 CMS。",
  },
  process: {
    eyebrow: "ProcessContentPanel",
    title: "价格与接猫流程",
    desc: "维护价格、流程、福利和礼包等结构化小节。",
  },
  "breeding-plan": {
    eyebrow: "BreedingPlanContentPanel",
    title: "繁育计划",
    desc: "维护计划周期、组合与说明字段。",
  },
  aftercare: {
    eyebrow: "AftercareContentPanel",
    title: "售后保障",
    desc: "维护售后承诺、准备事项和底部提示。",
  },
  questionnaire: {
    eyebrow: "QuestionnaireContentPanel",
    title: "选猫问卷页面",
    desc: "维护问卷页标题、说明和提示，问卷提交仍在独立真实模块处理。",
  },
  contact: {
    eyebrow: "ContactContentPanel",
    title: "联系方式",
    desc: "维护联系账号、介绍和底部提示。",
  },
};

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
  const [savedForm, setSavedForm] = useState<FixedPageFormState>(() => toForm(null));
  const [form, setForm] = useState<FixedPageFormState>(() => toForm(null));
  const [imagesByPageId, setImagesByPageId] = useState<Record<string, MediaAssetData[]>>({});
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imageUploadState, setImageUploadState] = useState<ImageUploadState>("idle");
  const [slotUploadStates, setSlotUploadStates] = useState<Record<string, ImageUploadState>>({});
  const [slotSortDrafts, setSlotSortDrafts] = useState<Record<string, string>>({});
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    body: true,
    facts: true,
    sections: true,
    media: true,
    meta: false,
    advanced: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const currentListPage = useMemo(
    () => pages.find((page) => page.slug === selectedSlug) ?? pages[0] ?? null,
    [pages, selectedSlug],
  );
  const selectedPageImages = selectedPage ? (imagesByPageId[selectedPage.id] ?? []) : [];
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);
  const pageCopy = selectedPage ? PAGE_LABELS[selectedPage.slug] : null;

  useEffect(() => {
    if (!selectedSlug && pages[0]) setSelectedSlug(pages[0].slug);
  }, [pages, selectedSlug]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(imagePreviewUrl);
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
    setImagesByPageId((current) => ({ ...current, [pageId]: mediaList.items }));
    setSlotSortDrafts((current) => mergeSortDrafts(current, mediaList.items, pageId));
    return mediaList.items;
  }, []);

  const clearPendingImage = useCallback(() => {
    setPendingImageFile(null);
    setImagePreviewUrl((current) => {
      if (current.startsWith("blob:")) URL.revokeObjectURL(current);
      return "";
    });
    setImageUploadState("idle");
  }, []);

  const selectPage = useCallback(
    async (slug: string) => {
      if (dirty && !window.confirm("当前页面存在未保存修改，确定要切换页面吗？")) return;
      setSelectedSlug(slug);
      setNotice("");
      setError("");

      try {
        const page = await getFixedPage(slug);
        const nextForm = toForm(page);
        setSelectedPage(page);
        setSavedForm(nextForm);
        setForm(nextForm);
        clearPendingImage();
        await loadPageImages(page.id);
      } catch (selectError) {
        setError(getErrorMessage(selectError));
      }
    },
    [clearPendingImage, dirty, loadPageImages],
  );

  useEffect(() => {
    if (!currentListPage || selectedPage?.slug === currentListPage.slug) return;
    void selectPage(currentListPage.slug);
  }, [currentListPage, selectPage, selectedPage?.slug]);

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
      const nextForm = toForm(updated);
      setSavedForm(nextForm);
      setForm(nextForm);
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

  function restoreDraft() {
    if (!dirty) return;
    if (!window.confirm("确定要放弃当前未保存修改吗？")) return;
    setForm(savedForm);
    clearPendingImage();
    setNotice("已恢复到上一次保存的内容。");
  }

  function updateContent(patch: JsonRecord) {
    setForm((current) => {
      const contentJson = { ...current.contentJson, ...patch };
      return {
        ...current,
        contentJson,
        contentJsonText: JSON.stringify(contentJson, null, 2),
      };
    });
  }

  function updateContentText(contentJsonText: string) {
    setForm((current) => {
      try {
        const parsed = parseContentJsonText(contentJsonText);
        return { ...current, contentJson: parsed, contentJsonText };
      } catch {
        return { ...current, contentJsonText };
      }
    });
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
    const media = await uploadFixedPageImage(pageId, pendingImageFile, { usage: "gallery" });
    setImagesByPageId((current) => ({
      ...current,
      [pageId]: [media, ...(current[pageId] ?? []).filter((item) => item.id !== media.id)],
    }));
    setPendingImageFile(null);
    setImagePreviewUrl(media.thumbnailUrl || media.sourceUrl);
    setImageUploadState("uploaded");
    return media;
  }

  async function handleEnvironmentSlotImageSelected(slot: EnvironmentSlotConfig, file: File | null) {
    if (!selectedPage || !file) return;

    setSlotUploadStates((current) => ({ ...current, [slot.usage]: "uploading" }));
    setNotice("");
    setError("");

    try {
      const currentItems = getEnvironmentSlotItems(selectedPageImages, selectedPage.id, slot.usage);
      await uploadFixedPageImage(selectedPage.id, file, {
        altText: `${slot.label}环境照片`,
        sortOrder: getNextSortOrder(currentItems),
        title: `${slot.label} - ${file.name}`,
        usage: slot.usage,
      });
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
          <h2>站点内容管理</h2>
          <p className="muted compact">
            Demo 字段分组 + 真实 FixedPage API；图片上传继续使用真实媒体 API 和 COS。
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

      <div className="management-grid wide-detail">
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
            <div className="fixed-page-list">
              {pages.map((page) => (
                <button
                  className={`fixed-page-list-item ${selectedPage?.slug === page.slug ? "active" : ""}`}
                  key={page.slug}
                  type="button"
                  onClick={() => void selectPage(page.slug)}
                >
                  <span>
                    <strong>{PAGE_LABELS[page.slug].title}</strong>
                    <small>{PAGE_LABELS[page.slug].eyebrow}</small>
                  </span>
                  <span className={`status-badge status-${page.status}`}>
                    {formatOption(page.status, STATUS_OPTIONS)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="detail-panel" aria-label="固定页面编辑">
          {selectedPage && pageCopy ? (
            <form className="form-stack" onSubmit={handleSubmit}>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{pageCopy.eyebrow}</p>
                  <h3>{pageCopy.title}</h3>
                  <p className="muted compact">{pageCopy.desc}</p>
                </div>
                <span className={`upload-state ${dirty ? "upload-state-pending" : "upload-state-uploaded"}`}>
                  {dirty ? "有未保存修改" : "当前内容已保存"}
                </span>
              </div>

              <EditorSection
                desc="标题、发布状态、SEO 与内容结构版本继续写入真实 FixedPage。"
                open={openPanels.meta}
                title="页面基础信息"
                onToggle={() => setOpenPanels((current) => ({ ...current, meta: !current.meta }))}
              >
                <label>
                  页面标题
                  <input
                    required
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    状态
                    <select
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
                    value={form.seoTitle}
                    onChange={(event) => setForm({ ...form, seoTitle: event.target.value })}
                  />
                </label>
                <label>
                  SEO 描述
                  <textarea
                    rows={3}
                    value={form.seoDescription}
                    onChange={(event) => setForm({ ...form, seoDescription: event.target.value })}
                  />
                </label>
              </EditorSection>

              <StructuredContentEditor
                content={form.contentJson}
                openPanels={openPanels}
                slug={selectedPage.slug}
                onContentChange={updateContent}
                onPanelsChange={setOpenPanels}
              />

              <EditorSection
                desc="保留完整 JSON 往返；结构化面板暂未覆盖的字段可在这里编辑。"
                open={openPanels.advanced}
                title="高级 JSON"
                onToggle={() =>
                  setOpenPanels((current) => ({ ...current, advanced: !current.advanced }))
                }
              >
                <textarea
                  className="code-textarea"
                  rows={14}
                  value={form.contentJsonText}
                  onChange={(event) => updateContentText(event.target.value)}
                />
              </EditorSection>

              <EditorSection
                desc="图片上传继续使用真实媒体接口；环境页保留 Demo 的母婴房、公共区、医疗间位置。"
                open={openPanels.media}
                title="页面图片"
                onToggle={() => setOpenPanels((current) => ({ ...current, media: !current.media }))}
              >
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
              </EditorSection>

              <div className="form-actions">
                <button disabled={isSaving} type="submit">
                  {isSaving ? "保存中..." : "保存更改"}
                </button>
                <button
                  className="secondary-button"
                  disabled={isSaving || !dirty}
                  type="button"
                  onClick={restoreDraft}
                >
                  取消本次修改
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

function StructuredContentEditor({
  content,
  openPanels,
  slug,
  onContentChange,
  onPanelsChange,
}: {
  content: JsonRecord;
  openPanels: Record<string, boolean>;
  slug: FixedPageSlug;
  onContentChange: (patch: JsonRecord) => void;
  onPanelsChange: (panels: Record<string, boolean>) => void;
}) {
  const facts = isRecord(content.facts) ? content.facts : {};
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const primitiveFields = Object.entries(content).filter(
    ([key, value]) =>
      !["facts", "sections"].includes(key) &&
      (typeof value === "string" || typeof value === "number" || typeof value === "boolean"),
  );

  return (
    <>
      <EditorSection
        desc="对应 Demo 面板中的正文、开场说明、标题等主内容字段。"
        open={openPanels.body}
        title="正文与主字段"
        onToggle={() => onPanelsChange({ ...openPanels, body: !openPanels.body })}
      >
        {primitiveFields.length === 0 ? (
          <div className="empty-state">该页面暂无可直接编辑的主字段，可使用高级 JSON。</div>
        ) : (
          <div className="form-stack">
            {primitiveFields.map(([key, value]) =>
              String(value).length > 120 || key.toLowerCase().includes("body") ? (
                <label key={key}>
                  {formatFieldLabel(key)}
                  <textarea
                    rows={key === "body" ? 10 : 5}
                    value={String(value)}
                    onChange={(event) => onContentChange({ [key]: event.target.value })}
                  />
                </label>
              ) : (
                <label key={key}>
                  {formatFieldLabel(key)}
                  <input
                    value={String(value)}
                    onChange={(event) => onContentChange({ [key]: event.target.value })}
                  />
                </label>
              ),
            )}
          </div>
        )}
      </EditorSection>

      <EditorSection
        desc="对应 Demo 的名片、要点、指标类字段。"
        open={openPanels.facts}
        title="事实卡片"
        onToggle={() => onPanelsChange({ ...openPanels, facts: !openPanels.facts })}
      >
        {Object.keys(facts).length === 0 ? (
          <div className="empty-state">该页面暂无 facts 字段。</div>
        ) : (
          <div className="form-grid">
            {Object.entries(facts).map(([key, value]) => (
              <label key={key}>
                {formatFieldLabel(key)}
                <input
                  value={stringifyScalar(value)}
                  onChange={(event) =>
                    onContentChange({ facts: { ...facts, [key]: event.target.value } })
                  }
                />
              </label>
            ))}
          </div>
        )}
      </EditorSection>

      <EditorSection
        desc={slug === "process" ? "价格、福利、购买流程等按 Demo 小节拆分。" : "页面中的可排序内容小节。"}
        open={openPanels.sections}
        title="内容小节"
        onToggle={() => onPanelsChange({ ...openPanels, sections: !openPanels.sections })}
      >
        <SectionListEditor sections={sections} onChange={(next) => onContentChange({ sections: next })} />
      </EditorSection>
    </>
  );
}

function SectionListEditor({
  sections,
  onChange,
}: {
  sections: unknown[];
  onChange: (sections: unknown[]) => void;
}) {
  const normalizedSections = sections.map((section) => (isRecord(section) ? section : { body: section }));

  function updateSection(index: number, patch: JsonRecord) {
    onChange(normalizedSections.map((section, currentIndex) => (currentIndex === index ? { ...section, ...patch } : section)));
  }

  function addSection() {
    onChange([...normalizedSections, { title: "新小节", body: "" }]);
  }

  function removeSection(index: number) {
    if (!window.confirm("确定删除这个小节吗？")) return;
    onChange(normalizedSections.filter((_, currentIndex) => currentIndex !== index));
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= normalizedSections.length) return;
    const next = [...normalizedSections];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <div className="form-stack">
      <div className="form-actions">
        <button className="secondary-button small-button" type="button" onClick={addSection}>
          新增小节
        </button>
      </div>
      {normalizedSections.length === 0 ? (
        <div className="empty-state">暂无小节。</div>
      ) : (
        normalizedSections.map((section, index) => (
          <div className="structured-section-card" key={index}>
            <div className="section-heading">
              <span className="muted">#{index + 1}</span>
              <div className="table-actions">
                <button
                  className="secondary-button small-button"
                  disabled={index === 0}
                  type="button"
                  onClick={() => moveSection(index, -1)}
                >
                  上移
                </button>
                <button
                  className="secondary-button small-button"
                  disabled={index === normalizedSections.length - 1}
                  type="button"
                  onClick={() => moveSection(index, 1)}
                >
                  下移
                </button>
                <button
                  className="danger-button small-button"
                  type="button"
                  onClick={() => removeSection(index)}
                >
                  删除
                </button>
              </div>
            </div>
            <label>
              标题
              <input
                value={stringifyScalar(section.title)}
                onChange={(event) => updateSection(index, { title: event.target.value })}
              />
            </label>
            <label>
              正文
              <textarea
                rows={5}
                value={stringifyScalar(section.body)}
                onChange={(event) => updateSection(index, { body: event.target.value })}
              />
            </label>
          </div>
        ))
      )}
    </div>
  );
}

function EditorSection({
  children,
  desc,
  open,
  title,
  onToggle,
}: {
  children: ReactNode;
  desc: string;
  open: boolean;
  title: string;
  onToggle: () => void;
}) {
  return (
    <section className="editor-section">
      <button className="editor-section-toggle" type="button" onClick={onToggle}>
        <span>
          <strong>{title}</strong>
          <small>{desc}</small>
        </span>
        <span>{open ? "收起" : "展开"}</span>
      </button>
      {open ? <div className="editor-section-body">{children}</div> : null}
    </section>
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
          disabled={disabled}
          type="file"
          onChange={(event) => {
            onChange(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p className="muted compact">
        {state === "pending" ? "图片将在保存固定页面时上传并绑定。" : "保存后会通过媒体绑定持久化到当前固定页面。"}
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
      {ENVIRONMENT_MEDIA_SLOTS.map((slot) => (
        <section className="environment-slot" key={slot.usage}>
          <div className="section-heading">
            <div>
              <h4>{slot.label}</h4>
              <p className="muted compact">{slot.usage}</p>
            </div>
            <span className={`upload-state upload-state-${slotUploadStates[slot.usage] ?? "idle"}`}>
              {formatImageState(slotUploadStates[slot.usage] ?? "idle")}
            </span>
          </div>
          <div className="environment-slot-images">
            {getEnvironmentSlotItems(images, pageId, slot.usage).length === 0 ? (
              <div className="image-placeholder">暂无图片</div>
            ) : (
              getEnvironmentSlotItems(images, pageId, slot.usage).map(({ binding, media }) => (
                <div className="environment-slot-image-row" key={binding.id}>
                  <img
                    alt={media.altText || media.title || `${slot.label}图片`}
                    className="environment-slot-preview"
                    src={media.thumbnailUrl || media.sourceUrl}
                  />
                  <div className="environment-slot-controls">
                    <strong>{media.title || media.sourceUrl}</strong>
                    <label>
                      排序
                      <input
                        disabled={disabled}
                        inputMode="numeric"
                        value={slotSortDrafts[binding.id] ?? String(binding.sortOrder)}
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
              ))
            )}
          </div>
          <label>
            上传到{slot.label}
            <input
              accept="image/*"
              disabled={disabled || slotUploadStates[slot.usage] === "uploading"}
              type="file"
              onChange={(event) => {
                onUpload(slot, event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </section>
      ))}
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

function mergeSortDrafts(current: Record<string, string>, images: MediaAssetData[], pageId: string) {
  const next = { ...current };
  for (const slot of ENVIRONMENT_MEDIA_SLOTS) {
    for (const item of getEnvironmentSlotItems(images, pageId, slot.usage)) {
      next[item.binding.id] = String(item.binding.sortOrder);
    }
  }
  return next;
}

function toForm(page: FixedPageData | null): FixedPageFormState {
  const contentJson = toContentRecord(page?.contentJson);
  return {
    contentJson,
    contentJsonText: JSON.stringify(contentJson, null, 2),
    contentSchemaVersion: String(page?.contentSchemaVersion ?? 1),
    seoDescription: page?.seoDescription ?? "",
    seoTitle: page?.seoTitle ?? "",
    status: page?.status ?? "draft",
    title: page?.title ?? "",
  };
}

function toPayload(form: FixedPageFormState): UpdateFixedPageRequest {
  const contentJson = parseContentJsonText(form.contentJsonText);
  return {
    contentJson,
    contentSchemaVersion: Number(form.contentSchemaVersion),
    seoDescription: emptyToNull(form.seoDescription),
    seoTitle: emptyToNull(form.seoTitle),
    status: form.status as UpdateFixedPageRequest["status"],
    title: form.title.trim(),
  };
}

function parseContentJsonText(value: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value || "{}");
  } catch {
    throw new Error("结构化内容 JSON 格式不正确");
  }
  if (!isRecord(parsed)) throw new Error("结构化内容 JSON 必须是对象");
  return parsed;
}

function toContentRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringifyScalar(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function formatFieldLabel(value: string) {
  const labels: Record<string, string> = {
    body: "正文",
    openingBelief: "开场理念",
    title: "标题",
    subtitle: "副标题",
    description: "说明",
    lead: "引导文案",
    note: "备注",
  };
  return labels[value] ?? value;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

function formatOption(value: string, options: Array<{ label: string; value: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}
