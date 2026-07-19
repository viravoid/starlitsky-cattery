import { useEffect, useMemo, useState } from "react";
import { EnvironmentView } from "@/components/mobile/EnvironmentView";
import {
  cloneEnvironmentContent,
  formatEnvironmentAspectRatio,
  normalizeEnvironmentContent,
  sanitizeEnvironmentAspectRatio,
  type EnvironmentContent,
  type EnvironmentZone,
  type EnvironmentZoneImage,
} from "@/lib/environment-content";
import {
  loadSavedEnvironmentContent,
  saveDraftPreviewEnvironmentContent,
  saveEnvironmentContent,
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

type PanelKey = "intro" | "ratio" | "zones";

export function EnvironmentContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<EnvironmentContent>(() => loadSavedEnvironmentContent());
  const [draft, setDraft] = useState<EnvironmentContent>(() => loadSavedEnvironmentContent());
  const [draggingZoneId, setDraggingZoneId] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    intro: true,
    ratio: true,
    zones: true,
  });

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved]);
  const imageUrls = useSitePageImageUrls(
    draft.zones.flatMap((zone) => zone.images.map((image) => image.imageId)),
  );
  const aspectRatio = formatEnvironmentAspectRatio(draft.imageAspectRatio);

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

  const updateDraft = (updater: (content: EnvironmentContent) => EnvironmentContent) => {
    setDraft((current) => normalizeEnvironmentContent(updater(cloneEnvironmentContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveEnvironmentContent(draft);
    const next = cloneEnvironmentContent(draft);
    setSaved(next);
    setDraft(cloneEnvironmentContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的猫舍环境修改都会被放弃。")) return;
    setDraft(cloneEnvironmentContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewEnvironmentContent(draft);
    window.open("/environment?sitePagePreview=environment-draft", "_blank", "noopener,noreferrer");
  };

  const addZone = () => {
    updateDraft((content) => {
      const id = `environment-zone-${createStableId()}`;
      content.zones.push({
        id,
        name: "新环境区域",
        area: "",
        description: "",
        images: [{ id: `${id}-image-${createStableId()}`, focalPoint: { x: 50, y: 50 } }],
      });
      return content;
    });
  };

  const deleteZone = (id: string) => {
    if (!window.confirm("确定删除这个环境区域吗？区域内图片设置也会从草稿中移除。")) return;
    updateDraft((content) => {
      content.zones = content.zones.filter((zone) => zone.id !== id);
      return content;
    });
  };

  const moveZone = (id: string, direction: -1 | 1) => {
    updateDraft((content) => {
      content.zones = moveById(content.zones, id, direction);
      return content;
    });
  };

  const dropZone = (targetId: string) => {
    if (!draggingZoneId) return;
    updateDraft((content) => {
      content.zones = moveToId(content.zones, draggingZoneId, targetId);
      return content;
    });
    setDraggingZoneId(null);
  };

  const updateZone = (id: string, patch: Partial<EnvironmentZone>) => {
    updateDraft((content) => {
      content.zones = content.zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone));
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
            desc="页面标题、英文小字、返回逻辑和四个标签固定；这里只编辑说明正文。"
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
            desc="所有环境区域共用同一个比例；焦点数据继续保留。"
            open={openPanels.ratio}
            onToggle={() => togglePanel("ratio")}
          >
            <AspectRatioEditor
              value={draft.imageAspectRatio}
              sanitize={sanitizeEnvironmentAspectRatio}
              onApply={(imageAspectRatio) =>
                updateDraft((content) => ({ ...content, imageAspectRatio }))
              }
            />
          </EditorSection>

          <EditorSection
            title="环境区域"
            desc="可新增、删除、排序；桌面支持拖拽，同时保留上移和下移。"
            open={openPanels.zones}
            onToggle={() => togglePanel("zones")}
          >
            <div className="grid gap-3">
              <div className="flex justify-end">
                <EditorButton onClick={addZone}>新增环境区域</EditorButton>
              </div>
              {draft.zones.length === 0 && (
                <p className="rounded-[6px] border border-dashed border-border px-3 py-6 text-center text-[13px] text-muted-foreground">
                  暂无环境区域。
                </p>
              )}
              {draft.zones.map((zone, index) => (
                <div
                  key={zone.id}
                  draggable
                  onDragStart={() => setDraggingZoneId(zone.id)}
                  onDragEnd={() => setDraggingZoneId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropZone(zone.id)}
                  className="grid gap-3 rounded-[6px] border border-border/80 bg-background p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-[13px] italic text-warm/80">
                      #{index + 1}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <EditorButton
                        tone="quiet"
                        onClick={() => moveZone(zone.id, -1)}
                        disabled={index === 0}
                      >
                        上移
                      </EditorButton>
                      <EditorButton
                        tone="quiet"
                        onClick={() => moveZone(zone.id, 1)}
                        disabled={index === draft.zones.length - 1}
                      >
                        下移
                      </EditorButton>
                      <EditorButton tone="danger" onClick={() => deleteZone(zone.id)}>
                        删除
                      </EditorButton>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
                    <TextField
                      label="区域名称"
                      value={zone.name}
                      onChange={(name) => updateZone(zone.id, { name })}
                    />
                    <TextField
                      label="面积"
                      value={zone.area}
                      onChange={(area) => updateZone(zone.id, { area })}
                    />
                  </div>
                  <TextareaField
                    label="区域说明"
                    value={zone.description}
                    rows={4}
                    onChange={(description) => updateZone(zone.id, { description })}
                  />
                  <ImageListEditor<EnvironmentZoneImage>
                    pageId="environment"
                    images={zone.images}
                    imageUrls={imageUrls}
                    aspectRatio={aspectRatio}
                    placeholderLabel={`示例图片（${zone.name}照片，待替换）`}
                    onImagesChange={(images) => updateZone(zone.id, { images })}
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
            <EnvironmentView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">猫舍环境预览</p>
            <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </EditorButton>
          </div>
          <EnvironmentView content={draft} />
        </div>
      )}
    </>
  );
}
