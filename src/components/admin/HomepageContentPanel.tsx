import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HomepageView } from "@/components/mobile/HomepageView";
import {
  cloneHomepageContent,
  getHomepageEntryNo,
  normalizeHomepageContent,
  type HomepageContent,
  type HomepageEntryId,
  type HomepageGroupId,
  type HomepageSlide,
} from "@/lib/homepage-content";
import {
  loadSavedHomepageContent,
  saveDraftPreviewHomepageContent,
  saveHomepageContent,
  saveHomepageImage,
} from "@/lib/homepage-storage";
import { cn } from "@/lib/utils";

type PanelKey = "hero" | "intro" | "groups" | "entries" | "cats";

type DragState =
  | { type: "slide"; id: string }
  | { type: "group"; id: HomepageGroupId }
  | { type: "entry"; id: HomepageEntryId; groupId: HomepageGroupId };

export function HomepageContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<HomepageContent>(() => loadSavedHomepageContent());
  const [draft, setDraft] = useState<HomepageContent>(() => loadSavedHomepageContent());
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    hero: true,
    intro: false,
    groups: false,
    entries: false,
    cats: false,
  });

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved]);

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

  const updateDraft = (updater: (content: HomepageContent) => HomepageContent) => {
    setDraft((current) => normalizeHomepageContent(updater(cloneHomepageContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveHomepageContent(draft);
    const next = cloneHomepageContent(draft);
    setSaved(next);
    setDraft(cloneHomepageContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的首页修改都会被放弃。")) return;
    setDraft(cloneHomepageContent(saved));
    onNotice("已恢复到上一次成功保存的首页内容。");
  };

  const openDraftPreview = () => {
    saveDraftPreviewHomepageContent(draft);
    window.open("/?homepagePreview=draft", "_blank", "noopener,noreferrer");
  };

  const addSlide = () => {
    updateDraft((content) => {
      const nextIndex = content.hero.slides.length + 1;
      content.hero.slides.push({
        id: `hero-${Date.now()}`,
        label: `示例图片（首页轮播照片 ${nextIndex}，待替换）`,
      });
      return content;
    });
  };

  const deleteSlide = (id: string) => {
    if (draft.hero.slides.length <= 1) {
      onNotice("轮播区域至少保留 1 张图片。");
      return;
    }
    if (!window.confirm("确定删除这张轮播图片吗？")) return;
    updateDraft((content) => {
      content.hero.slides = content.hero.slides.filter((slide) => slide.id !== id);
      return content;
    });
  };

  const replaceSlideImage = async (slide: HomepageSlide, file: File | null) => {
    if (!file) return;
    try {
      const record = await saveHomepageImage(file);
      updateDraft((content) => {
        content.hero.slides = content.hero.slides.map((item) =>
          item.id === slide.id ? { ...item, imageId: record.id, label: record.name } : item,
        );
        return content;
      });
      onNotice("已选择本地图片，保存更改后会应用到正式首页。");
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

  const moveGroup = (id: HomepageGroupId, direction: -1 | 1) => {
    updateDraft((content) => {
      content.groups = moveById(content.groups, id, direction);
      return content;
    });
  };

  const moveEntry = (groupId: HomepageGroupId, id: HomepageEntryId, direction: -1 | 1) => {
    updateDraft((content) => {
      content.groups = content.groups.map((group) =>
        group.id === groupId
          ? { ...group, entryOrder: moveValue(group.entryOrder, id, direction) }
          : group,
      );
      return content;
    });
  };

  const dropSlide = (targetId: string) => {
    if (!dragging || dragging.type !== "slide") return;
    updateDraft((content) => {
      content.hero.slides = moveToId(content.hero.slides, dragging.id, targetId);
      return content;
    });
    setDragging(null);
  };

  const dropGroup = (targetId: HomepageGroupId) => {
    if (!dragging || dragging.type !== "group") return;
    updateDraft((content) => {
      content.groups = moveToId(content.groups, dragging.id, targetId);
      return content;
    });
    setDragging(null);
  };

  const dropEntry = (groupId: HomepageGroupId, targetId: HomepageEntryId) => {
    if (!dragging || dragging.type !== "entry" || dragging.groupId !== groupId) return;
    updateDraft((content) => {
      content.groups = content.groups.map((group) =>
        group.id === groupId
          ? { ...group, entryOrder: moveValueTo(group.entryOrder, dragging.id, targetId) }
          : group,
      );
      return content;
    });
    setDragging(null);
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
                预览首页
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
            title="首页头图与轮播"
            desc="建议图片比例 4:5；用户端按固定容器裁切填充。"
            open={openPanels.hero}
            onToggle={() => togglePanel("hero")}
          >
            <div className="grid gap-3">
              <TextField
                label="中文主标题"
                value={draft.hero.title}
                onChange={(value) =>
                  updateDraft((content) => ({
                    ...content,
                    hero: { ...content.hero, title: value },
                  }))
                }
              />
              <TextField
                label="英文副标题"
                value={draft.hero.subtitle}
                onChange={(value) =>
                  updateDraft((content) => ({
                    ...content,
                    hero: { ...content.hero, subtitle: value },
                  }))
                }
              />
              <div className="flex justify-end">
                <Button onClick={addSlide}>新增轮播</Button>
              </div>
              <div className="grid gap-2">
                {draft.hero.slides.map((slide, index) => (
                  <div
                    key={slide.id}
                    draggable
                    onDragStart={() => setDragging({ type: "slide", id: slide.id })}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => dropSlide(slide.id)}
                    className="grid gap-2 rounded-[6px] border border-border/80 bg-background p-3 lg:grid-cols-[54px_minmax(0,1fr)_auto]"
                  >
                    <div className="font-display text-[13px] italic text-warm/80">#{index + 1}</div>
                    <div className="grid gap-2">
                      <TextField
                        label="图片占位文字"
                        value={slide.label}
                        onChange={(value) =>
                          updateDraft((content) => {
                            content.hero.slides = content.hero.slides.map((item) =>
                              item.id === slide.id ? { ...item, label: value } : item,
                            );
                            return content;
                          })
                        }
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) =>
                          void replaceSlideImage(slide, event.target.files?.[0] ?? null)
                        }
                        className="text-[12px] text-muted-foreground file:mr-3 file:h-8 file:rounded-[6px] file:border-0 file:bg-primary file:px-3 file:text-[12px] file:font-semibold file:text-primary-foreground"
                      />
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
            title="首页品牌简介"
            desc="成立年份、城市和协会信息固定展示，不提供编辑。"
            open={openPanels.intro}
            onToggle={() => togglePanel("intro")}
          >
            <div className="grid gap-3">
              <TextField
                label="标题前小字"
                value={draft.intro.eyebrowPrefix}
                onChange={(value) =>
                  updateDraft((content) => ({
                    ...content,
                    intro: { ...content.intro, eyebrowPrefix: value },
                  }))
                }
              />
              <ReadonlyLine label="固定信息" value={draft.intro.fixedMeta} />
              <TextareaField
                label="首页简介正文"
                value={draft.intro.body}
                onChange={(value) =>
                  updateDraft((content) => ({
                    ...content,
                    intro: { ...content.intro, body: value },
                  }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="首页内容分组"
            desc="两个分组固定保留，可调整前后顺序。"
            open={openPanels.groups}
            onToggle={() => togglePanel("groups")}
          >
            <div className="grid gap-3">
              {draft.groups.map((group, index) => (
                <div
                  key={group.id}
                  draggable
                  onDragStart={() => setDragging({ type: "group", id: group.id })}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropGroup(group.id)}
                  className="rounded-[6px] border border-border/80 bg-background p-3"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-heading">{group.cn}</span>
                    <div className="flex gap-1.5">
                      <Button
                        tone="quiet"
                        onClick={() => moveGroup(group.id, -1)}
                        disabled={index === 0}
                      >
                        上移
                      </Button>
                      <Button
                        tone="quiet"
                        onClick={() => moveGroup(group.id, 1)}
                        disabled={index === draft.groups.length - 1}
                      >
                        下移
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <TextField
                      label="英文小标题"
                      value={group.en}
                      onChange={(value) => updateGroup(group.id, { en: value }, updateDraft)}
                    />
                    <TextField
                      label="中文标题"
                      value={group.cn}
                      onChange={(value) => updateGroup(group.id, { cn: value }, updateDraft)}
                    />
                    <TextareaField
                      label="分组介绍"
                      value={group.lead}
                      onChange={(value) => updateGroup(group.id, { lead: value }, updateDraft)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </EditorSection>

          <EditorSection
            title="首页二级页面入口"
            desc="入口只能在所属分组内排序；编号、路径和可见性固定。"
            open={openPanels.entries}
            onToggle={() => togglePanel("entries")}
          >
            <div className="grid gap-4">
              {draft.groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-[6px] border border-border/80 bg-background p-3"
                >
                  <h3 className="mb-3 text-[13px] font-semibold text-heading">{group.cn}</h3>
                  <div className="grid gap-2">
                    {group.entryOrder.map((entryId, index) => {
                      const entry = draft.entries[entryId];
                      return (
                        <div
                          key={entry.id}
                          draggable
                          onDragStart={() =>
                            setDragging({ type: "entry", id: entry.id, groupId: group.id })
                          }
                          onDragEnd={() => setDragging(null)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => dropEntry(group.id, entry.id)}
                          className="grid gap-2 border-t border-dashed border-border/70 pt-3 first:border-t-0 first:pt-0 lg:grid-cols-[54px_minmax(0,1fr)_auto]"
                        >
                          <div className="font-display text-[13px] italic text-warm/80">
                            {getHomepageEntryNo(index)}
                          </div>
                          <div className="grid gap-2">
                            <TextField
                              label="入口标题"
                              value={entry.title}
                              onChange={(value) =>
                                updateEntry(entry.id, { title: value }, updateDraft)
                              }
                            />
                            <TextareaField
                              label="简短介绍"
                              value={entry.desc}
                              onChange={(value) =>
                                updateEntry(entry.id, { desc: value }, updateDraft)
                              }
                              rows={3}
                            />
                            <ReadonlyLine
                              label="固定路径"
                              value={entry.to ?? entry.statusLabel ?? "内容准备中"}
                            />
                          </div>
                          <div className="flex flex-wrap items-start gap-1.5 lg:justify-end">
                            <Button
                              tone="quiet"
                              onClick={() => moveEntry(group.id, entry.id, -1)}
                              disabled={index === 0}
                            >
                              上移
                            </Button>
                            <Button
                              tone="quiet"
                              onClick={() => moveEntry(group.id, entry.id, 1)}
                              disabled={index === group.entryOrder.length - 1}
                            >
                              下移
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </EditorSection>

          <EditorSection
            title="我们的猫入口"
            desc="本轮只编辑入口简介，标题、按钮和链接固定。"
            open={openPanels.cats}
            onToggle={() => togglePanel("cats")}
          >
            <div className="grid gap-3">
              <ReadonlyLine label="英文小字" value={draft.catsPreview.eyebrow} />
              <ReadonlyLine label="中文标题" value={draft.catsPreview.title} />
              <TextareaField
                label="入口简介"
                value={draft.catsPreview.description}
                onChange={(value) =>
                  updateDraft((content) => ({
                    ...content,
                    catsPreview: { ...content.catsPreview, description: value },
                  }))
                }
              />
              <ReadonlyLine label="按钮文字" value={draft.catsPreview.buttonText} />
              <ReadonlyLine label="固定路径" value={draft.catsPreview.to} />
            </div>
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
            <HomepageView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">首页预览</p>
            <Button tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </Button>
          </div>
          <HomepageView content={draft} />
        </div>
      )}
    </>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">{label}</span>
      <input
        value={value}
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

function updateGroup(
  id: HomepageGroupId,
  patch: Partial<HomepageContent["groups"][number]>,
  updateDraft: (updater: (content: HomepageContent) => HomepageContent) => void,
) {
  updateDraft((content) => {
    content.groups = content.groups.map((group) =>
      group.id === id ? { ...group, ...patch } : group,
    );
    return content;
  });
}

function updateEntry(
  id: HomepageEntryId,
  patch: Partial<HomepageContent["entries"][HomepageEntryId]>,
  updateDraft: (updater: (content: HomepageContent) => HomepageContent) => void,
) {
  updateDraft((content) => {
    content.entries[id] = { ...content.entries[id], ...patch };
    return content;
  });
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

function moveValue<T>(items: T[], item: T, direction: -1 | 1) {
  const index = items.indexOf(item);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  return moveValueTo(items, item, items[target]);
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
