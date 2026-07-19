import { useEffect, useMemo, useState } from "react";
import { FeedingView } from "@/components/mobile/FeedingView";
import {
  cloneFeedingContent,
  formatFeedingAspectRatio,
  normalizeFeedingContent,
  sanitizeFeedingAspectRatio,
  type FeedingContent,
  type FeedingModule,
  type FeedingModuleImage,
} from "@/lib/feeding-content";
import {
  loadSavedFeedingContent,
  saveDraftPreviewFeedingContent,
  saveFeedingContent,
} from "@/lib/site-page-storage";
import { useSitePageImageUrls } from "@/hooks/use-site-page-image-urls";
import {
  AspectRatioEditor,
  EditorButton,
  EditorSection,
  ImageListEditor,
  TextareaField,
  TextField,
} from "./SitePageEditorPrimitives";
import { createStableId, moveById, moveToId } from "./site-page-editor-utils";

type PanelKey = "intro" | "ratio" | "modules";

export function FeedingContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<FeedingContent>(() => loadSavedFeedingContent());
  const [draft, setDraft] = useState<FeedingContent>(() => loadSavedFeedingContent());
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    intro: true,
    ratio: true,
    modules: true,
  });

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved]);
  const imageUrls = useSitePageImageUrls(
    draft.modules.flatMap((module) => module.images.map((image) => image.imageId)),
  );
  const aspectRatio = formatFeedingAspectRatio(draft.imageAspectRatio);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const updateDraft = (updater: (content: FeedingContent) => FeedingContent) => {
    setDraft((current) => normalizeFeedingContent(updater(cloneFeedingContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveFeedingContent(draft);
    const next = cloneFeedingContent(draft);
    setSaved(next);
    setDraft(cloneFeedingContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的喂养体系修改都会被放弃。")) return;
    setDraft(cloneFeedingContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewFeedingContent(draft);
    window.open("/feeding?sitePagePreview=feeding-draft", "_blank", "noopener,noreferrer");
  };

  const addModule = () => {
    updateDraft((content) => {
      const id = `feeding-module-${createStableId()}`;
      content.modules.push({
        id,
        title: "新喂养模块",
        body: "",
        images: [{ id: `${id}-image-${createStableId()}`, focalPoint: { x: 50, y: 50 } }],
      });
      return content;
    });
  };

  const deleteModule = (id: string) => {
    if (!window.confirm("确定删除这个喂养模块吗？模块内图片设置也会从草稿中移除。")) return;
    updateDraft((content) => {
      content.modules = content.modules.filter((module) => module.id !== id);
      return content;
    });
  };

  const moveModule = (id: string, direction: -1 | 1) => {
    updateDraft((content) => {
      content.modules = moveById(content.modules, id, direction);
      return content;
    });
  };

  const dropModule = (targetId: string) => {
    if (!draggingModuleId) return;
    updateDraft((content) => {
      content.modules = moveToId(content.modules, draggingModuleId, targetId);
      return content;
    });
    setDraggingModuleId(null);
  };

  const updateModule = (id: string, patch: Partial<FeedingModule>) => {
    updateDraft((content) => {
      content.modules = content.modules.map((module) =>
        module.id === id ? { ...module, ...patch } : module,
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
                草稿只影响后台预览；用户端只读取上一次保存内容。
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(true)}>
                预览
              </EditorButton>
              <EditorButton tone="quiet" onClick={openDraftPreview}>
                预览页面
              </EditorButton>
              <EditorButton tone="quiet" onClick={restoreDraft} disabled={!dirty}>
                恢复本次修改
              </EditorButton>
              <EditorButton onClick={saveAll} disabled={!dirty}>
                保存更改
              </EditorButton>
            </div>
          </div>

          <EditorSection
            title="开头说明"
            desc="页面标题、英文小字和返回逻辑固定；这里只编辑说明正文。"
            open={openPanels.intro}
            onToggle={() => togglePanel("intro")}
          >
            <TextareaField
              label="说明正文"
              value={draft.intro}
              rows={6}
              onChange={(intro) => updateDraft((content) => ({ ...content, intro }))}
            />
          </EditorSection>

          <EditorSection
            title="图片比例"
            desc="所有喂养模块共用同一个比例；与猫舍环境页互不影响。"
            open={openPanels.ratio}
            onToggle={() => togglePanel("ratio")}
          >
            <AspectRatioEditor
              value={draft.imageAspectRatio}
              sanitize={sanitizeFeedingAspectRatio}
              onApply={(imageAspectRatio) =>
                updateDraft((content) => ({ ...content, imageAspectRatio }))
              }
            />
          </EditorSection>

          <EditorSection
            title="喂养模块"
            desc="可新增、删除、排序；桌面支持拖拽，同时保留上移和下移。"
            open={openPanels.modules}
            onToggle={() => togglePanel("modules")}
          >
            <div className="grid gap-3">
              <div className="flex justify-end">
                <EditorButton onClick={addModule}>新增模块</EditorButton>
              </div>
              {draft.modules.length === 0 && (
                <p className="rounded-[6px] border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
                  暂无喂养模块。
                </p>
              )}
              {draft.modules.map((module, index) => (
                <div
                  key={module.id}
                  draggable
                  onDragStart={() => setDraggingModuleId(module.id)}
                  onDragEnd={() => setDraggingModuleId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropModule(module.id)}
                  className="grid gap-3 rounded-[6px] border border-border/80 bg-background p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-[13px] italic text-warm/80">
                      #{index + 1}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <EditorButton
                        tone="quiet"
                        onClick={() => moveModule(module.id, -1)}
                        disabled={index === 0}
                      >
                        上移
                      </EditorButton>
                      <EditorButton
                        tone="quiet"
                        onClick={() => moveModule(module.id, 1)}
                        disabled={index === draft.modules.length - 1}
                      >
                        下移
                      </EditorButton>
                      <EditorButton tone="danger" onClick={() => deleteModule(module.id)}>
                        删除
                      </EditorButton>
                    </div>
                  </div>
                  <TextField
                    label="模块标题"
                    value={module.title}
                    onChange={(title) => updateModule(module.id, { title })}
                  />
                  <TextareaField
                    label="模块正文"
                    value={module.body}
                    rows={5}
                    onChange={(body) => updateModule(module.id, { body })}
                  />
                  <ImageListEditor<FeedingModuleImage>
                    pageId="feeding"
                    images={module.images}
                    imageUrls={imageUrls}
                    aspectRatio={aspectRatio}
                    placeholderLabel={`示例图片（${module.title}轮播图，待替换）`}
                    onImagesChange={(images) => updateModule(module.id, { images })}
                    onNotice={onNotice}
                  />
                </div>
              ))}
            </div>
          </EditorSection>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-heading">实时预览</p>
              <EditorButton tone="quiet" onClick={openDraftPreview}>
                新标签页
              </EditorButton>
            </div>
            <FeedingView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">喂养体系预览</p>
            <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </EditorButton>
          </div>
          <FeedingView content={draft} />
        </div>
      )}
    </>
  );
}
