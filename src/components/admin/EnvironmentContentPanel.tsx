import { useEffect, useMemo, useState } from "react";
import { EnvironmentView } from "@/components/mobile/EnvironmentView";
import {
  cloneEnvironmentContent,
  formatEnvironmentAspectRatio,
  getEnvironmentSectionImages,
  normalizeEnvironmentContent,
  sanitizeEnvironmentAspectRatio,
  type EnvironmentContent,
  type EnvironmentRoom,
  type EnvironmentRoomImage,
  type EnvironmentSection,
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
  SortableListEditor,
  TextareaField,
  TextField,
} from "./SitePageEditorPrimitives";
import { createStableId } from "./site-page-editor-utils";

type PanelKey = "intro" | "ratio" | "sections";

export function EnvironmentContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<EnvironmentContent>(() => loadSavedEnvironmentContent());
  const [draft, setDraft] = useState<EnvironmentContent>(() => loadSavedEnvironmentContent());
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    intro: true,
    ratio: true,
    sections: true,
  });

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved]);
  const imageUrls = useSitePageImageUrls(
    draft.sections.flatMap((section) =>
      getEnvironmentSectionImages(section).map(({ image }) => image.imageId),
    ),
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
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的猫舍环境修改都会被放弃。")) {
      return;
    }
    setDraft(cloneEnvironmentContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewEnvironmentContent(draft);
    window.open("/environment?sitePagePreview=environment-draft", "_blank", "noopener,noreferrer");
  };

  const updateSection = (
    sectionId: string,
    updater: (section: EnvironmentSection) => EnvironmentSection,
  ) => {
    updateDraft((content) => ({
      ...content,
      sections: content.sections.map((section) =>
        section.id === sectionId ? syncSectionCoverImage(updater(section)) : section,
      ),
    }));
  };

  const addRoom = (sectionId: string) => {
    updateSection(sectionId, (section) => ({
      ...section,
      rooms: [
        ...section.rooms,
        createEnvironmentRoom(
          section.id,
          section.rooms.length + 1,
          `新增房间 ${section.rooms.length + 1}`,
        ),
      ],
    }));
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
            desc="页面标题、英文小字、返回逻辑和固定标签继续沿用；这里只编辑总览页顶部说明。"
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
            desc="环境总览、详情房间图片和大图预览共用统一比例；焦点数据继续保留。"
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
            title="环境分区"
            desc="保留单一“猫舍环境”页面结构；每个分区单独维护概览信息、房间顺序、房间说明和多张图片。"
            open={openPanels.sections}
            onToggle={() => togglePanel("sections")}
          >
            <div className="grid gap-4">
              {draft.sections.map((section) => {
                const imageOptions = getSectionImageOptions(section);
                const currentCoverImage =
                  imageOptions.find((option) => option.value === section.coverImageId)?.value ?? "";

                return (
                  <div
                    key={section.id}
                    className="rounded-[6px] border border-border/80 bg-background p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-heading">{section.title}</p>
                        <p className="mt-1 text-[11.5px] text-muted-foreground">
                          路径：/environment/{section.id}
                        </p>
                      </div>
                      <EditorButton tone="quiet" onClick={() => addRoom(section.id)}>
                        新增房间
                      </EditorButton>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
                      <TextField
                        label="分区标题"
                        value={section.title}
                        onChange={(title) =>
                          updateSection(section.id, (current) => ({ ...current, title }))
                        }
                      />
                      <TextField
                        label="概览信息"
                        value={section.meta}
                        onChange={(meta) =>
                          updateSection(section.id, (current) => ({ ...current, meta }))
                        }
                      />
                    </div>

                    <div className="mt-3">
                      <TextareaField
                        label="总览摘要"
                        value={section.summary}
                        rows={3}
                        onChange={(summary) =>
                          updateSection(section.id, (current) => ({ ...current, summary }))
                        }
                      />
                    </div>

                    <label className="mt-3 grid gap-1.5">
                      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">
                        总览封面
                      </span>
                      <select
                        value={currentCoverImage}
                        onChange={(event) =>
                          updateSection(section.id, (current) => ({
                            ...current,
                            coverImageId: event.target.value || undefined,
                          }))
                        }
                        className="h-9 rounded-[7px] border border-border bg-card px-3 text-[13px] outline-none focus:border-primary"
                      >
                        <option value="">自动使用首张已上传图片</option>
                        {imageOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11.5px] leading-relaxed text-muted-foreground">
                        如果未手动指定，前台会自动使用当前分区第一张已上传图片作为封面。
                      </span>
                    </label>

                    <div className="mt-4">
                      <SortableListEditor<EnvironmentRoom>
                        items={section.rooms}
                        addLabel="新增房间"
                        emptyLabel="当前分区还没有房间。"
                        deleteConfirm="确定删除这个房间吗？该房间下的图片设置也会一起从草稿中移除。"
                        onAdd={() => addRoom(section.id)}
                        onItemsChange={(rooms) =>
                          updateSection(section.id, (current) => ({ ...current, rooms }))
                        }
                        renderItem={(room, roomIndex, updateRoom) => (
                          <div className="grid gap-3">
                            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
                              <TextField
                                label="房间名称"
                                value={room.title}
                                onChange={(title) => updateRoom({ title })}
                              />
                              <TextField
                                label="房间序号说明"
                                value={`第 ${roomIndex + 1} 个房间 / 子区域`}
                                onChange={() => {}}
                              />
                            </div>
                            <TextareaField
                              label="房间说明"
                              value={room.description}
                              rows={3}
                              onChange={(description) => updateRoom({ description })}
                            />
                            <ImageListEditor<EnvironmentRoomImage>
                              pageId={`environment-${section.id}-${room.id}`}
                              images={room.images}
                              imageUrls={imageUrls}
                              aspectRatio={aspectRatio}
                              placeholderLabel={`示例图片（${room.title}照片，待替换）`}
                              minItems={0}
                              onImagesChange={(images) => updateRoom({ images })}
                              onNotice={onNotice}
                            />
                          </div>
                        )}
                      />
                    </div>
                  </div>
                );
              })}
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
          <EnvironmentView content={draft} preview />
        </div>
      )}
    </>
  );
}

function createEnvironmentRoom(sectionId: string, index: number, title: string): EnvironmentRoom {
  return {
    id: `${sectionId}-room-${createStableId()}`,
    title,
    description: "",
    images: [],
  };
}

function getSectionImageOptions(section: EnvironmentSection) {
  return getEnvironmentSectionImages(section)
    .filter(({ image }) => typeof image.imageId === "string" && image.imageId)
    .map(({ roomTitle, image }, index) => ({
      value: image.imageId as string,
      label: `${roomTitle} · 第 ${index + 1} 张`,
    }));
}

function syncSectionCoverImage(section: EnvironmentSection): EnvironmentSection {
  const imageIds = getEnvironmentSectionImages(section)
    .map(({ image }) => image.imageId)
    .filter((imageId): imageId is string => typeof imageId === "string" && imageId.length > 0);

  if (imageIds.length === 0) {
    return {
      ...section,
      coverImageId: undefined,
    };
  }

  if (section.coverImageId && imageIds.includes(section.coverImageId)) {
    return section;
  }

  return {
    ...section,
    coverImageId: imageIds[0],
  };
}
