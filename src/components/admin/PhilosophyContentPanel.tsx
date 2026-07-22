import { useEffect, useMemo, useState } from "react";
import { PhilosophyView } from "@/components/mobile/PhilosophyView";
import {
  clonePhilosophyContent,
  normalizePhilosophyContent,
  type PhilosophyContent,
  type PhilosophyMilestone,
} from "@/lib/philosophy-content";
import {
  loadSavedPhilosophyContent,
  saveDraftPreviewPhilosophyContent,
  savePhilosophyContent,
} from "@/lib/site-page-storage";
import { EditorButton, EditorSection, TextareaField, TextField } from "./SitePageEditorPrimitives";

type PanelKey =
  | "opening"
  | "growth"
  | "milestones"
  | "stage"
  | "style"
  | "highlight"
  | "direction"
  | "closing";

export function PhilosophyContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<PhilosophyContent>(() => loadSavedPhilosophyContent());
  const [draft, setDraft] = useState<PhilosophyContent>(() => loadSavedPhilosophyContent());
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    opening: true,
    growth: true,
    milestones: true,
    stage: true,
    style: true,
    highlight: true,
    direction: true,
    closing: true,
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

  const updateDraft = (updater: (content: PhilosophyContent) => PhilosophyContent) => {
    setDraft((current) => normalizePhilosophyContent(updater(clonePhilosophyContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    savePhilosophyContent(draft);
    const next = clonePhilosophyContent(draft);
    setSaved(next);
    setDraft(clonePhilosophyContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的繁育理念修改都会被放弃。")) {
      return;
    }
    setDraft(clonePhilosophyContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewPhilosophyContent(draft);
    window.open("/philosophy?sitePagePreview=philosophy-draft", "_blank", "noopener,noreferrer");
  };

  const updateMilestone = (
    key: keyof PhilosophyContent["milestones"],
    patch: Partial<PhilosophyMilestone>,
  ) => {
    updateDraft((content) => ({
      ...content,
      milestones: {
        ...content.milestones,
        [key]: {
          ...content.milestones[key],
          ...patch,
          value:
            typeof patch.value === "string"
              ? patch.value.slice(0, 4)
              : content.milestones[key].value,
        },
      },
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
            title="开篇理念"
            desc="页面标题和英文小字固定；这里只编辑黄色框中的理念正文。"
            open={openPanels.opening}
            onToggle={() => togglePanel("opening")}
          >
            <TextareaField
              label="开篇理念正文"
              value={draft.openingBelief}
              rows={5}
              onChange={(openingBelief) =>
                updateDraft((content) => ({ ...content, openingBelief }))
              }
            />
          </EditorSection>

          <EditorSection
            title="成长与繁育经历"
            desc="三个正文位置固定；不提供新增、删除或排序。"
            open={openPanels.growth}
            onToggle={() => togglePanel("growth")}
          >
            <div className="grid gap-3">
              <TextareaField
                label="成长经历第 1 段"
                value={draft.growthEffortParagraph}
                rows={4}
                onChange={(growthEffortParagraph) =>
                  updateDraft((content) => ({ ...content, growthEffortParagraph }))
                }
              />
              <TextareaField
                label="成长经历第 2 段"
                value={draft.growthCommunityParagraph}
                rows={4}
                onChange={(growthCommunityParagraph) =>
                  updateDraft((content) => ({ ...content, growthCommunityParagraph }))
                }
              />
              <TextareaField
                label="成长经历第 3 段"
                value={draft.growthFuturePlanParagraph}
                rows={3}
                onChange={(growthFuturePlanParagraph) =>
                  updateDraft((content) => ({ ...content, growthFuturePlanParagraph }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="繁育年限"
            desc="固定为两个节点；英文 Years、顺序、布局和颜色不开放编辑。"
            open={openPanels.milestones}
            onToggle={() => togglePanel("milestones")}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <MilestoneEditor
                title="主理人年限节点"
                milestone={draft.milestones.founder}
                onChange={(patch) => updateMilestone("founder", patch)}
              />
              <MilestoneEditor
                title="月七年限节点"
                milestone={draft.milestones.yueqi}
                onChange={(patch) => updateMilestone("yueqi", patch)}
              />
            </div>
          </EditorSection>

          <EditorSection
            title="搬入新家后的阶段变化"
            desc="第二段会继续使用用户端当前的强调样式。"
            open={openPanels.stage}
            onToggle={() => togglePanel("stage")}
          >
            <div className="grid gap-3">
              <TextareaField
                label="阶段变化第 1 段"
                value={draft.stageNewHomeParagraph}
                rows={3}
                onChange={(stageNewHomeParagraph) =>
                  updateDraft((content) => ({ ...content, stageNewHomeParagraph }))
                }
              />
              <TextareaField
                label="阶段变化第 2 段"
                value={draft.stageClearGoalParagraph}
                rows={3}
                onChange={(stageClearGoalParagraph) =>
                  updateDraft((content) => ({ ...content, stageClearGoalParagraph }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="血线与风格理解"
            desc="区块英文和中文标题固定；这里只编辑标题下方两段正文。"
            open={openPanels.style}
            onToggle={() => togglePanel("style")}
          >
            <div className="grid gap-3">
              <TextareaField
                label="血线理解第 1 段"
                value={draft.styleBloodlineParagraph}
                rows={4}
                onChange={(styleBloodlineParagraph) =>
                  updateDraft((content) => ({ ...content, styleBloodlineParagraph }))
                }
              />
              <TextareaField
                label="血线理解第 2 段"
                value={draft.styleBeyondLabelsParagraph}
                rows={3}
                onChange={(styleBeyondLabelsParagraph) =>
                  updateDraft((content) => ({ ...content, styleBeyondLabelsParagraph }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="高亮观点"
            desc="高亮样式和两行结构固定；这里只编辑两行文字。"
            open={openPanels.highlight}
            onToggle={() => togglePanel("highlight")}
          >
            <div className="grid gap-3">
              <TextField
                label="高亮第 1 行"
                value={draft.highlightLineOne}
                onChange={(highlightLineOne) =>
                  updateDraft((content) => ({ ...content, highlightLineOne }))
                }
              />
              <TextField
                label="高亮第 2 行"
                value={draft.highlightLineTwo}
                onChange={(highlightLineTwo) =>
                  updateDraft((content) => ({ ...content, highlightLineTwo }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="当前繁育方向"
            desc="两个正文位置固定；不提供新增、删除或排序。"
            open={openPanels.direction}
            onToggle={() => togglePanel("direction")}
          >
            <div className="grid gap-3">
              <TextareaField
                label="繁育方向第 1 段"
                value={draft.directionGlobalBreedersParagraph}
                rows={4}
                onChange={(directionGlobalBreedersParagraph) =>
                  updateDraft((content) => ({ ...content, directionGlobalBreedersParagraph }))
                }
              />
              <TextareaField
                label="繁育方向第 2 段"
                value={draft.directionGoalParagraph}
                rows={4}
                onChange={(directionGoalParagraph) =>
                  updateDraft((content) => ({ ...content, directionGoalParagraph }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="收尾理念"
            desc="底部三个短句固定；这里只编辑收尾四段正文。"
            open={openPanels.closing}
            onToggle={() => togglePanel("closing")}
          >
            <div className="grid gap-3">
              <TextareaField
                label="收尾第 1 段"
                value={draft.closingLifeParagraph}
                rows={3}
                onChange={(closingLifeParagraph) =>
                  updateDraft((content) => ({ ...content, closingLifeParagraph }))
                }
              />
              <TextareaField
                label="收尾第 2 段"
                value={draft.closingCareerParagraph}
                rows={3}
                onChange={(closingCareerParagraph) =>
                  updateDraft((content) => ({ ...content, closingCareerParagraph }))
                }
              />
              <TextareaField
                label="收尾第 3 段"
                value={draft.closingParentParagraph}
                rows={4}
                onChange={(closingParentParagraph) =>
                  updateDraft((content) => ({ ...content, closingParentParagraph }))
                }
              />
              <TextareaField
                label="收尾第 4 段"
                value={draft.closingAftercareParagraph}
                rows={4}
                onChange={(closingAftercareParagraph) =>
                  updateDraft((content) => ({ ...content, closingAftercareParagraph }))
                }
              />
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
            <PhilosophyView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">繁育理念预览</p>
            <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </EditorButton>
          </div>
          <PhilosophyView content={draft} />
        </div>
      )}
    </>
  );
}

function MilestoneEditor({
  title,
  milestone,
  onChange,
}: {
  title: string;
  milestone: PhilosophyMilestone;
  onChange: (patch: Partial<PhilosophyMilestone>) => void;
}) {
  return (
    <div className="grid gap-3 rounded-[6px] border border-border/80 bg-background p-3">
      <p className="text-[13px] font-semibold text-heading">{title}</p>
      <LimitedTextField
        label="年限数值"
        value={milestone.value}
        maxLength={4}
        onChange={(value) => onChange({ value })}
      />
      <TextField
        label="年限说明"
        value={milestone.description}
        onChange={(description) => onChange({ description })}
      />
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        用户端固定显示英文 Years；数值最多 4 个字符，留空时节点仍保留原位置。
      </p>
    </div>
  );
}

function LimitedTextField({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        className="h-9 rounded-[7px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
      />
    </label>
  );
}
