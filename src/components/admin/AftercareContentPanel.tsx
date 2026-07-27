import { useEffect, useMemo, useState } from "react";
import { AftercareView } from "@/components/mobile/AftercareView";
import {
  cloneAftercareContent,
  normalizeAftercareContent,
  type AftercareContent,
  type TextListItem,
} from "@/lib/aftercare-content";
import {
  loadSavedAftercareContent,
  saveAftercareContent,
  saveSitePageAsset,
  saveDraftPreviewAftercareContent,
} from "@/lib/site-page-storage";
import {
  EditorButton,
  EditorSection,
  SortableListEditor,
  TextareaField,
} from "./SitePageEditorPrimitives";
import { createStableId } from "./site-page-editor-utils";

type PanelKey = "promises" | "healthItems" | "contractFile" | "contractNotice";

export function AftercareContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<AftercareContent>(() => loadSavedAftercareContent());
  const [draft, setDraft] = useState<AftercareContent>(() => loadSavedAftercareContent());
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    promises: true,
    healthItems: true,
    contractFile: true,
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

  const updateDraft = (updater: (content: AftercareContent) => AftercareContent) => {
    setDraft((current) => normalizeAftercareContent(updater(cloneAftercareContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveAftercareContent(draft);
    const next = cloneAftercareContent(draft);
    setSaved(next);
    setDraft(cloneAftercareContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的售后保障修改都会被放弃。")) return;
    setDraft(cloneAftercareContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewAftercareContent(draft);
    window.open("/aftercare?sitePagePreview=aftercare-draft", "_blank", "noopener,noreferrer");
  };

  const updateTextList = (key: "promises" | "healthItems", items: TextListItem[]) => {
    updateDraft((content) => ({ ...content, [key]: items }));
  };

  const addTextItem = (key: "promises" | "healthItems", idPrefix: string, text: string) => {
    updateDraft((content) => ({
      ...content,
      [key]: [...content[key], { id: `${idPrefix}-${createStableId()}`, text }],
    }));
  };

  const replaceContractFile = async (file: File | null) => {
    if (!file) return;
    try {
      const record = await saveSitePageAsset("aftercare-contract", file);
      updateDraft((content) => ({
        ...content,
        contractFile: {
          ...content.contractFile,
          assetId: record.id,
          fileName: record.name,
          mimeType: record.type,
        },
      }));
      onNotice("已选择合同文件，保存更改后会同步到前台售后保障页。");
    } catch {
      onNotice("合同文件保存失败，请确认浏览器支持 IndexedDB 后重试。");
    }
  };

  const clearContractFile = () => {
    updateDraft((content) => ({
      ...content,
      contractFile: {
        ...content.contractFile,
        assetId: undefined,
        fileName: undefined,
        mimeType: undefined,
      },
    }));
    onNotice("已从草稿中移除合同文件。");
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
            title="繁育与售后承诺"
            desc="分区标题和英文小字固定；承诺卡图标按当前位置固定轮换，后台不编辑图标。"
            open={openPanels.promises}
            onToggle={() => togglePanel("promises")}
          >
            <SortableListEditor<TextListItem>
              items={draft.promises}
              addLabel="新增承诺"
              emptyLabel="暂无承诺。用户端会隐藏整个分区。"
              deleteConfirm="确定删除这条售后承诺吗？"
              onAdd={() =>
                addTextItem("promises", "aftercare-promise", "新售后承诺内容，可在这里编辑。")
              }
              onItemsChange={(items) => updateTextList("promises", items)}
              renderItem={(item, _index, updateItem) => (
                <TextareaField
                  label="承诺文字"
                  value={item.text}
                  rows={3}
                  onChange={(text) => updateItem({ text })}
                />
              )}
            />
          </EditorSection>

          <EditorSection
            title="去新家前项目"
            desc="分区标题、英文小字和圆点列表样式固定；这里只编辑项目文字。"
            open={openPanels.healthItems}
            onToggle={() => togglePanel("healthItems")}
          >
            <SortableListEditor<TextListItem>
              items={draft.healthItems}
              addLabel="新增项目"
              emptyLabel="暂无去新家前项目。用户端会隐藏整个分区。"
              deleteConfirm="确定删除这个去新家前项目吗？"
              onAdd={() =>
                addTextItem("healthItems", "aftercare-health", "新去新家前项目，可在这里编辑。")
              }
              onItemsChange={(items) => updateTextList("healthItems", items)}
              renderItem={(item, _index, updateItem) => (
                <TextareaField
                  label="项目文字"
                  value={item.text}
                  rows={3}
                  onChange={(text) => updateItem({ text })}
                />
              )}
            />
          </EditorSection>

          <EditorSection
            title="合同文件"
            desc="支持单个合同文件，优先 PDF；文件保存在当前浏览器本地，保存后前台可查看和下载。"
            open={openPanels.contractFile}
            onToggle={() => togglePanel("contractFile")}
          >
            <div className="grid gap-3">
              <TextareaField
                label="文件标题"
                value={draft.contractFile.title}
                rows={2}
                onChange={(title) =>
                  updateDraft((content) => ({
                    ...content,
                    contractFile: {
                      ...content.contractFile,
                      title,
                    },
                  }))
                }
              />
              <div className="rounded-[6px] border border-border/80 bg-background p-3">
                <p className="text-[12px] font-semibold text-heading lg:text-[13px]">当前文件</p>
                <p className="mt-1 break-all text-[12px] leading-relaxed text-muted-foreground">
                  {draft.contractFile.fileName
                    ? `${draft.contractFile.fileName}${draft.contractFile.mimeType ? ` · ${draft.contractFile.mimeType}` : ""}`
                    : "尚未上传合同文件。"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="pressable inline-flex h-8 cursor-pointer items-center justify-center rounded-[6px] bg-primary px-3 text-[12px] font-semibold text-primary-foreground lg:text-[13px]">
                    上传 / 替换文件
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(event) =>
                        void replaceContractFile(event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  <EditorButton
                    tone="quiet"
                    onClick={clearContractFile}
                    disabled={!draft.contractFile.assetId}
                  >
                    移除文件
                  </EditorButton>
                </div>
              </div>
            </div>
          </EditorSection>

          <EditorSection
            title="底部合同提示"
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
            <AftercareView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">售后保障预览</p>
            <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </EditorButton>
          </div>
          <AftercareView content={draft} />
        </div>
      )}
    </>
  );
}
