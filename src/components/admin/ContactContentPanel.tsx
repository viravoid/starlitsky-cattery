import { useEffect, useMemo, useState } from "react";
import { ContactView } from "@/components/mobile/ContactView";
import {
  cloneContactContent,
  normalizeContactContent,
  type ContactAccount,
  type ContactContent,
} from "@/lib/contact-content";
import {
  loadSavedContactContent,
  saveContactContent,
  saveDraftPreviewContactContent,
} from "@/lib/site-page-storage";
import {
  EditorButton,
  EditorSection,
  SortableListEditor,
  TextareaField,
  TextField,
} from "./SitePageEditorPrimitives";
import { createStableId } from "./site-page-editor-utils";

type PanelKey = "introduction" | "accounts" | "footerNotice";

export function ContactContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<ContactContent>(() => loadSavedContactContent());
  const [draft, setDraft] = useState<ContactContent>(() => loadSavedContactContent());
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    introduction: true,
    accounts: true,
    footerNotice: true,
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

  const updateDraft = (updater: (content: ContactContent) => ContactContent) => {
    setDraft((current) => normalizeContactContent(updater(cloneContactContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveContactContent(draft);
    const next = cloneContactContent(draft);
    setSaved(next);
    setDraft(cloneContactContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的联系方式修改都会被放弃。")) {
      return;
    }
    setDraft(cloneContactContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewContactContent(draft);
    window.open("/contact?sitePagePreview=contact-draft", "_blank");
  };

  const updateAccounts = (accounts: ContactAccount[]) => {
    updateDraft((content) => ({ ...content, accounts }));
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
            desc="页面标题、插画和主标题固定；这里只编辑主标题下方说明。"
            open={openPanels.introduction}
            onToggle={() => togglePanel("introduction")}
          >
            <TextareaField
              label="说明文字"
              value={draft.introduction}
              rows={4}
              onChange={(introduction) => updateDraft((content) => ({ ...content, introduction }))}
            />
          </EditorSection>

          <EditorSection
            title="联系方式列表"
            desc="平台名称和账号可编辑；账号为空的条目不会显示在用户页。"
            open={openPanels.accounts}
            onToggle={() => togglePanel("accounts")}
          >
            <SortableListEditor<ContactAccount>
              items={draft.accounts}
              addLabel="新增联系方式"
              emptyLabel="暂无联系方式。用户端会隐藏整个列表区。"
              deleteConfirm="确定删除这个联系方式吗？"
              onAdd={() =>
                updateAccounts([
                  ...draft.accounts,
                  {
                    id: `contact-account-${createStableId()}`,
                    label: "新平台",
                    value: "",
                  },
                ])
              }
              onItemsChange={updateAccounts}
              renderItem={(item, _index, updateItem) => (
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <TextField
                    label="平台名称"
                    value={item.label}
                    onChange={(label) => updateItem({ label })}
                  />
                  <TextField
                    label="账号"
                    value={item.value}
                    onChange={(value) => updateItem({ value })}
                  />
                </div>
              )}
            />
          </EditorSection>

          <EditorSection
            title="底部咨询提示"
            desc="提示卡样式固定；文本为空时用户端隐藏底部提示卡。"
            open={openPanels.footerNotice}
            onToggle={() => togglePanel("footerNotice")}
          >
            <TextareaField
              label="咨询提示"
              value={draft.footerNotice}
              rows={5}
              onChange={(footerNotice) => updateDraft((content) => ({ ...content, footerNotice }))}
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
            <ContactView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">联系方式预览</p>
            <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </EditorButton>
          </div>
          <ContactView content={draft} />
        </div>
      )}
    </>
  );
}
