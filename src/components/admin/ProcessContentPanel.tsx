import { useEffect, useMemo, useState } from "react";
import { ProcessView } from "@/components/mobile/ProcessView";
import type { TextListItem } from "@/lib/aftercare-content";
import {
  cloneProcessContent,
  normalizeProcessContent,
  type ProcessContent,
  type ProcessPriceCard,
  type ProcessSimpleCard,
  type ProcessStep,
} from "@/lib/process-content";
import {
  loadSavedProcessContent,
  saveDraftPreviewProcessContent,
  saveProcessContent,
} from "@/lib/site-page-storage";
import {
  EditorButton,
  EditorSection,
  SortableListEditor,
  TextareaField,
  TextField,
} from "./SitePageEditorPrimitives";
import { createStableId } from "./site-page-editor-utils";

type PanelKey =
  | "pricing"
  | "breeding"
  | "returningFamilies"
  | "steps"
  | "welcomeKit"
  | "contractNotice";

export function ProcessContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<ProcessContent>(() => loadSavedProcessContent());
  const [draft, setDraft] = useState<ProcessContent>(() => loadSavedProcessContent());
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    pricing: true,
    breeding: true,
    returningFamilies: true,
    steps: true,
    welcomeKit: true,
    contractNotice: true,
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

  const updateDraft = (updater: (content: ProcessContent) => ProcessContent) => {
    setDraft((current) => normalizeProcessContent(updater(cloneProcessContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveProcessContent(draft);
    const next = cloneProcessContent(draft);
    setSaved(next);
    setDraft(cloneProcessContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的价格与接猫流程修改都会被放弃。")) {
      return;
    }
    setDraft(cloneProcessContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewProcessContent(draft);
    window.open("/process?sitePagePreview=process-draft", "_blank", "noopener,noreferrer");
  };

  const updatePriceCards = (priceCards: ProcessPriceCard[]) => {
    updateDraft((content) => ({ ...content, priceCards }));
  };

  const updateSimpleCards = (
    key: "breedingCards" | "returningBenefits",
    cards: ProcessSimpleCard[],
  ) => {
    updateDraft((content) => ({ ...content, [key]: cards }));
  };

  const updateSteps = (steps: ProcessStep[]) => {
    updateDraft((content) => ({ ...content, steps }));
  };

  const updateWelcomeKitItems = (welcomeKitItems: TextListItem[]) => {
    updateDraft((content) => ({ ...content, welcomeKitItems }));
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
            title="价格区间"
            desc="标题、英文小字和图标固定；价格卡颜色由前端按顺序自动分配。"
            open={openPanels.pricing}
            onToggle={() => togglePanel("pricing")}
          >
            <div className="grid gap-4">
              <TextareaField
                label="价格区间开头说明"
                value={draft.pricingIntro}
                rows={4}
                onChange={(pricingIntro) =>
                  updateDraft((content) => ({ ...content, pricingIntro }))
                }
              />
              <SortableListEditor<ProcessPriceCard>
                items={draft.priceCards}
                addLabel="新增价格卡"
                emptyLabel="暂无价格卡。说明为空时用户端会隐藏价格区间分区。"
                deleteConfirm="确定删除这张价格卡吗？"
                onAdd={() =>
                  updatePriceCards([
                    ...draft.priceCards,
                    {
                      id: `process-price-${createStableId()}`,
                      label: "新价格类型",
                      value: "价格待定",
                      note: "补充这类小猫的定价说明。",
                    },
                  ])
                }
                onItemsChange={updatePriceCards}
                renderItem={(item, _index, updateItem) => (
                  <div className="grid gap-2">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
                      <TextField
                        label="名称"
                        value={item.label}
                        onChange={(label) => updateItem({ label })}
                      />
                      <TextField
                        label="价格"
                        value={item.value}
                        onChange={(value) => updateItem({ value })}
                      />
                    </div>
                    <TextareaField
                      label="说明"
                      value={item.note}
                      rows={3}
                      onChange={(note) => updateItem({ note })}
                    />
                  </div>
                )}
              />
            </div>
          </EditorSection>

          <EditorSection
            title="繁育权"
            desc="标题、英文小字、图标和两列布局固定；只编辑说明和卡片内容。"
            open={openPanels.breeding}
            onToggle={() => togglePanel("breeding")}
          >
            <div className="grid gap-4">
              <TextareaField
                label="繁育权开头说明"
                value={draft.breedingIntro}
                rows={4}
                onChange={(breedingIntro) =>
                  updateDraft((content) => ({ ...content, breedingIntro }))
                }
              />
              <SortableListEditor<ProcessSimpleCard>
                items={draft.breedingCards}
                addLabel="新增繁育权卡"
                emptyLabel="暂无繁育权卡。说明为空时用户端会隐藏繁育权分区。"
                deleteConfirm="确定删除这张繁育权卡片吗？"
                onAdd={() =>
                  updateSimpleCards("breedingCards", [
                    ...draft.breedingCards,
                    {
                      id: `process-breeding-${createStableId()}`,
                      label: "新繁育权类型",
                      value: "价格待定",
                    },
                  ])
                }
                onItemsChange={(items) => updateSimpleCards("breedingCards", items)}
                renderItem={(item, _index, updateItem) => (
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
                    <TextField
                      label="名称"
                      value={item.label}
                      onChange={(label) => updateItem({ label })}
                    />
                    <TextField
                      label="价格"
                      value={item.value}
                      onChange={(value) => updateItem({ value })}
                    />
                  </div>
                )}
              />
            </div>
          </EditorSection>

          <EditorSection
            title="老家长福利"
            desc="标题、英文小字、图标和紧凑网格固定；内容支持换行。"
            open={openPanels.returningFamilies}
            onToggle={() => togglePanel("returningFamilies")}
          >
            <div className="grid gap-4">
              <TextareaField
                label="老家长福利开头说明"
                value={draft.returningFamiliesIntro}
                rows={4}
                onChange={(returningFamiliesIntro) =>
                  updateDraft((content) => ({ ...content, returningFamiliesIntro }))
                }
              />
              <SortableListEditor<ProcessSimpleCard>
                items={draft.returningBenefits}
                addLabel="新增福利"
                emptyLabel="暂无老家长福利。说明为空时用户端会隐藏老家长福利分区。"
                deleteConfirm="确定删除这项老家长福利吗？"
                onAdd={() =>
                  updateSimpleCards("returningBenefits", [
                    ...draft.returningBenefits,
                    {
                      id: `process-returning-${createStableId()}`,
                      label: "新福利",
                      value: "福利内容",
                    },
                  ])
                }
                onItemsChange={(items) => updateSimpleCards("returningBenefits", items)}
                renderItem={(item, _index, updateItem) => (
                  <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)]">
                    <TextField
                      label="名称"
                      value={item.label}
                      onChange={(label) => updateItem({ label })}
                    />
                    <TextareaField
                      label="内容"
                      value={item.value}
                      rows={3}
                      onChange={(value) => updateItem({ value })}
                    />
                  </div>
                )}
              />
            </div>
          </EditorSection>

          <EditorSection
            title="购买流程"
            desc="流程编号不保存，始终按当前排序自动显示。"
            open={openPanels.steps}
            onToggle={() => togglePanel("steps")}
          >
            <SortableListEditor<ProcessStep>
              items={draft.steps}
              addLabel="新增步骤"
              emptyLabel="暂无购买流程步骤。用户端会隐藏整个分区。"
              deleteConfirm="确定删除这个购买流程步骤吗？"
              onAdd={() =>
                updateSteps([
                  ...draft.steps,
                  {
                    id: `process-step-${createStableId()}`,
                    title: "新流程步骤",
                    description: "补充这一步需要说明的内容。",
                  },
                ])
              }
              onItemsChange={updateSteps}
              renderItem={(item, _index, updateItem) => (
                <div className="grid gap-2">
                  <TextField
                    label="步骤标题"
                    value={item.title}
                    onChange={(title) => updateItem({ title })}
                  />
                  <TextareaField
                    label="步骤说明"
                    value={item.description}
                    rows={4}
                    onChange={(description) => updateItem({ description })}
                  />
                </div>
              )}
            />
          </EditorSection>

          <EditorSection
            title="新家礼包"
            desc="标签样式固定；标签和补充说明都为空时用户端隐藏整个分区。"
            open={openPanels.welcomeKit}
            onToggle={() => togglePanel("welcomeKit")}
          >
            <div className="grid gap-4">
              <SortableListEditor<TextListItem>
                items={draft.welcomeKitItems}
                addLabel="新增礼包标签"
                emptyLabel="暂无新家礼包标签。"
                deleteConfirm="确定删除这个新家礼包标签吗？"
                onAdd={() =>
                  updateWelcomeKitItems([
                    ...draft.welcomeKitItems,
                    {
                      id: `process-kit-${createStableId()}`,
                      text: "新礼包内容",
                    },
                  ])
                }
                onItemsChange={updateWelcomeKitItems}
                renderItem={(item, _index, updateItem) => (
                  <TextareaField
                    label="标签文字"
                    value={item.text}
                    rows={2}
                    onChange={(text) => updateItem({ text })}
                  />
                )}
              />
              <TextareaField
                label="新家礼包补充说明"
                value={draft.welcomeKitNote}
                rows={4}
                onChange={(welcomeKitNote) =>
                  updateDraft((content) => ({ ...content, welcomeKitNote }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="页面底部合同提示"
            desc="提示块样式和图标固定；文本为空时用户端隐藏提示块。"
            open={openPanels.contractNotice}
            onToggle={() => togglePanel("contractNotice")}
          >
            <TextareaField
              label="合同提示"
              value={draft.contractNotice}
              rows={5}
              onChange={(contractNotice) =>
                updateDraft((content) => ({ ...content, contractNotice }))
              }
            />
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
            <ProcessView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">价格与接猫流程预览</p>
            <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </EditorButton>
          </div>
          <ProcessView content={draft} />
        </div>
      )}
    </>
  );
}
