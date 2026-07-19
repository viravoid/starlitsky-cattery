import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { AboutView } from "@/components/mobile/AboutView";
import { Placeholder } from "@/components/mobile/ui";
import {
  cloneAboutContent,
  formatAspectRatio,
  normalizeAboutContent,
  sanitizeAspectRatio,
  type AboutContent,
  type AboutHeroSlide,
  type AspectRatioValue,
  type ImageFocalPoint,
} from "@/lib/about-content";
import {
  getSitePageImageBlob,
  loadSavedAboutContent,
  saveAboutContent,
  saveDraftPreviewAboutContent,
  saveSitePageImage,
} from "@/lib/site-page-storage";
import { cn } from "@/lib/utils";

type PanelKey = "page" | "hero" | "body";

const ASPECT_PRESETS: AspectRatioValue[] = [
  { width: 16, height: 10 },
  { width: 16, height: 9 },
  { width: 4, height: 3 },
  { width: 3, height: 2 },
  { width: 1, height: 1 },
];

export function AboutContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<AboutContent>(() => loadSavedAboutContent());
  const [draft, setDraft] = useState<AboutContent>(() => loadSavedAboutContent());
  const [draggingSlideId, setDraggingSlideId] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [ratioInputs, setRatioInputs] = useState(() => ({
    width: String(draft.hero.aspectRatio.width),
    height: String(draft.hero.aspectRatio.height),
  }));
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    page: true,
    hero: true,
    body: true,
  });
  const imageUrls = useAboutEditorImageUrls(draft);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved]);
  const aspectRatio = formatAspectRatio(draft.hero.aspectRatio);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setRatioInputs({
      width: String(draft.hero.aspectRatio.width),
      height: String(draft.hero.aspectRatio.height),
    });
  }, [draft.hero.aspectRatio.height, draft.hero.aspectRatio.width]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const updateDraft = (updater: (content: AboutContent) => AboutContent) => {
    setDraft((current) => normalizeAboutContent(updater(cloneAboutContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveAboutContent(draft);
    const next = cloneAboutContent(draft);
    setSaved(next);
    setDraft(cloneAboutContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的猫舍介绍修改都会被放弃。")) return;
    setDraft(cloneAboutContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewAboutContent(draft);
    window.open("/about?sitePagePreview=about-draft", "_blank", "noopener,noreferrer");
  };

  const addSlide = () => {
    updateDraft((content) => {
      const nextIndex = content.hero.slides.length + 1;
      content.hero.slides.push({
        id: `about-hero-${Date.now()}`,
        label: `示例图片（猫舍介绍主图 ${nextIndex}，待替换）`,
        focalPoint: { x: 50, y: 50 },
      });
      return content;
    });
  };

  const deleteSlide = (id: string) => {
    if (draft.hero.slides.length <= 1) {
      onNotice("主图轮播至少保留 1 张图片。");
      return;
    }
    if (!window.confirm("确定删除这张主图吗？")) return;
    updateDraft((content) => {
      content.hero.slides = content.hero.slides.filter((slide) => slide.id !== id);
      return content;
    });
  };

  const replaceSlideImage = async (slide: AboutHeroSlide, file: File | null) => {
    if (!file) return;
    try {
      const record = await saveSitePageImage("about", file);
      updateDraft((content) => {
        content.hero.slides = content.hero.slides.map((item) =>
          item.id === slide.id ? { ...item, imageId: record.id, label: record.name } : item,
        );
        return content;
      });
      onNotice("已选择本地图片，保存更改后会应用到正式猫舍介绍页。");
    } catch {
      onNotice("图片保存失败，请确认浏览器支持 IndexedDB 后重试。");
    }
  };

  const moveSlide = (id: string, direction: -1 | 1) => {
    updateDraft((content) => {
      content.hero.slides = moveById(content.hero.slides, id, direction);
      return content;
    });
  };

  const dropSlide = (targetId: string) => {
    if (!draggingSlideId) return;
    updateDraft((content) => {
      content.hero.slides = moveToId(content.hero.slides, draggingSlideId, targetId);
      return content;
    });
    setDraggingSlideId(null);
  };

  const applyAspectRatio = (ratio: AspectRatioValue) => {
    const next = sanitizeAspectRatio(ratio.width, ratio.height);
    updateDraft((content) => ({
      ...content,
      hero: { ...content.hero, aspectRatio: next },
    }));
  };

  const applyCustomAspectRatio = () => {
    applyAspectRatio(sanitizeAspectRatio(ratioInputs.width, ratioInputs.height));
  };

  const updateFocalPoint = (slideId: string, focalPoint: ImageFocalPoint) => {
    updateDraft((content) => {
      content.hero.slides = content.hero.slides.map((slide) =>
        slide.id === slideId ? { ...slide, focalPoint } : slide,
      );
      return content;
    });
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-3">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border border-border/80 bg-card px-3 py-2 shadow-card lg:top-4">
            <div>
              <p className="text-[13px] font-semibold text-heading">
                {dirty ? "有未保存修改" : "当前内容已保存"}
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                已保存内容只在当前浏览器生效；未保存草稿只用于后台预览。
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button tone="quiet" onClick={() => setMobilePreviewOpen(true)}>
                预览
              </Button>
              <Button tone="quiet" onClick={openDraftPreview}>
                预览页面
              </Button>
              <Button tone="quiet" onClick={restoreDraft} disabled={!dirty}>
                恢复本次修改
              </Button>
              <Button onClick={saveAll} disabled={!dirty}>
                保存更改
              </Button>
            </div>
          </div>

          <EditorSection
            title="页面信息"
            desc="只编辑顶部中文标题；路径和返回逻辑固定为 /about。"
            open={openPanels.page}
            onToggle={() => togglePanel("page")}
          >
            <div className="grid gap-3">
              <TextField
                label="顶部中文页面标题"
                value={draft.page.title}
                onChange={(value) =>
                  updateDraft((content) => ({
                    ...content,
                    page: { ...content.page, title: value },
                  }))
                }
              />
              <ReadonlyLine label="固定路径" value="/about" />
            </div>
          </EditorSection>

          <EditorSection
            title="主图轮播"
            desc="所有图片共用同一个轮播比例；每张图可单独拖动调整裁切焦点。"
            open={openPanels.hero}
            onToggle={() => togglePanel("hero")}
          >
            <div className="grid gap-4">
              <div className="grid gap-2 rounded-[6px] border border-border/80 bg-background p-3">
                <span className="text-[12px] font-semibold text-heading lg:text-[13px]">
                  轮播比例
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_PRESETS.map((ratio) => {
                    const active =
                      ratio.width === draft.hero.aspectRatio.width &&
                      ratio.height === draft.hero.aspectRatio.height;
                    return (
                      <Button
                        key={`${ratio.width}:${ratio.height}`}
                        tone={active ? "default" : "quiet"}
                        onClick={() => applyAspectRatio(ratio)}
                      >
                        {ratio.width}:{ratio.height}
                      </Button>
                    );
                  })}
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <TextField
                    label="自定义宽"
                    value={ratioInputs.width}
                    inputMode="decimal"
                    onChange={(value) =>
                      setRatioInputs((current) => ({ ...current, width: value }))
                    }
                  />
                  <TextField
                    label="自定义高"
                    value={ratioInputs.height}
                    inputMode="decimal"
                    onChange={(value) =>
                      setRatioInputs((current) => ({ ...current, height: value }))
                    }
                  />
                  <div className="flex items-end">
                    <Button onClick={applyCustomAspectRatio}>应用比例</Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={addSlide}>新增图片</Button>
              </div>

              <div className="grid gap-3">
                {draft.hero.slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={() => setDraggingSlideId(slide.id)}
                    onDragEnd={() => setDraggingSlideId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropSlide(slide.id)}
                    className="grid gap-3 rounded-[6px] border border-border/80 bg-background p-3 lg:grid-cols-[minmax(180px,260px)_minmax(0,1fr)_auto]"
                  >
                    <FocalPointEditor
                      label={slide.label}
                      imageUrl={slide.imageId ? imageUrls[slide.imageId] : undefined}
                      aspectRatio={aspectRatio}
                      focalPoint={slide.focalPoint}
                      onChange={(focalPoint) => updateFocalPoint(slide.id, focalPoint)}
                    />
                    <div className="grid content-start gap-2">
                      <div>
                        <span className="font-display text-[13px] italic text-warm/80">
                          #{index + 1}
                        </span>
                        <p className="mt-1 break-all text-[12.5px] font-medium text-heading">
                          {slide.label}
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          void replaceSlideImage(slide, event.target.files?.[0] ?? null)
                        }
                        className="text-[12px] text-muted-foreground file:mr-3 file:h-8 file:rounded-[6px] file:border-0 file:bg-primary file:px-3 file:text-[12px] file:font-semibold file:text-primary-foreground"
                      />
                      <Button
                        tone="quiet"
                        onClick={() => updateFocalPoint(slide.id, { x: 50, y: 50 })}
                      >
                        恢复居中
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-start gap-1.5 lg:justify-end">
                      <Button
                        tone="quiet"
                        onClick={() => moveSlide(slide.id, -1)}
                        disabled={index === 0}
                      >
                        上移
                      </Button>
                      <Button
                        tone="quiet"
                        onClick={() => moveSlide(slide.id, 1)}
                        disabled={index === draft.hero.slides.length - 1}
                      >
                        下移
                      </Button>
                      <Button
                        tone="danger"
                        onClick={() => deleteSlide(slide.id)}
                        disabled={draft.hero.slides.length <= 1}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </EditorSection>

          <EditorSection
            title="介绍正文"
            desc="英文小字 About StarlitSky 固定；下方正文作为一个多行文本字段保存。"
            open={openPanels.body}
            onToggle={() => togglePanel("body")}
          >
            <TextareaField
              label="正文"
              value={draft.body}
              onChange={(value) => updateDraft((content) => ({ ...content, body: value }))}
              rows={12}
            />
          </EditorSection>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-heading">实时预览</p>
              <Button tone="quiet" onClick={openDraftPreview}>
                新标签页
              </Button>
            </div>
            <AboutView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">猫舍介绍预览</p>
            <Button tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </Button>
          </div>
          <AboutView content={draft} />
        </div>
      )}
    </>
  );
}

function FocalPointEditor({
  label,
  imageUrl,
  aspectRatio,
  focalPoint,
  onChange,
}: {
  label: string;
  imageUrl?: string;
  aspectRatio: string;
  focalPoint: ImageFocalPoint;
  onChange: (focalPoint: ImageFocalPoint) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    onChange({ x: clampPercent(x), y: clampPercent(y) });
  };

  return (
    <div
      ref={frameRef}
      role="slider"
      tabIndex={0}
      aria-label="拖动调整图片裁切位置"
      aria-valuetext="图片裁切焦点"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return;
        updateFromPointer(event);
      }}
      className="relative cursor-grab overflow-hidden rounded-[8px] bg-muted active:cursor-grabbing"
      style={{ aspectRatio }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full select-none object-cover"
          style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
          draggable={false}
        />
      ) : (
        <Placeholder
          label={label}
          ratio=""
          rounded="rounded-[8px]"
          compact
          style={{ aspectRatio }}
        />
      )}
      <span
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-card"
        style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
      />
    </div>
  );
}

function EditorSection({
  title,
  desc,
  open,
  onToggle,
  children,
}: {
  title: string;
  desc: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[6px] border border-border/80 bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left lg:px-4 lg:py-3"
      >
        <span>
          <span className="block text-[14px] font-semibold text-heading lg:text-[16px]">
            {title}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-muted-foreground lg:text-[13px]">
            {desc}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open && <div className="border-t border-border/80 px-3 py-3 lg:px-4">{children}</div>}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal";
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-[7px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-[7px] border border-border bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-primary"
      />
    </label>
  );
}

function ReadonlyLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-border/60 py-1.5 text-[12px] last:border-0 lg:grid-cols-[100px_minmax(0,1fr)] lg:py-2.5 lg:text-[13.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-card-foreground">{value}</span>
    </div>
  );
}

function Button({
  children,
  onClick,
  tone = "default",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "quiet" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "pressable inline-flex h-8 items-center justify-center rounded-[6px] px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 lg:text-[13px]",
        tone === "default" && "bg-primary text-primary-foreground",
        tone === "quiet" && "border border-border bg-background text-muted-foreground",
        tone === "danger" && "border border-wine/35 bg-wine/10 text-wine",
      )}
    >
      {children}
    </button>
  );
}

function useAboutEditorImageUrls(content: AboutContent) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const imageKey = useMemo(
    () => content.hero.slides.map((slide) => slide.imageId ?? "").join("|"),
    [content.hero.slides],
  );

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    async function load() {
      const next: Record<string, string> = {};
      for (const slide of content.hero.slides) {
        if (!slide.imageId) continue;
        const blob = await getSitePageImageBlob(slide.imageId);
        if (!blob || !active) continue;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        next[slide.imageId] = url;
      }
      if (active) setUrls(next);
    }

    void load();

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [content.hero.slides, imageKey]);

  return urls;
}

function moveById<T extends { id: string }>(items: T[], id: string, direction: -1 | 1) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  return moveValueTo(items, items[index], items[target]);
}

function moveToId<T extends { id: string }>(items: T[], id: string, targetId: string) {
  const item = items.find((current) => current.id === id);
  const target = items.find((current) => current.id === targetId);
  if (!item || !target || item.id === target.id) return items;
  return moveValueTo(items, item, target);
}

function moveValueTo<T>(items: T[], item: T, target: T) {
  const from = items.indexOf(item);
  const to = items.indexOf(target);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, value));
}
