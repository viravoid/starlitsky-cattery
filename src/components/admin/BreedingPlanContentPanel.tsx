import { useEffect, useMemo, useState } from "react";
import { BreedingPlanView } from "@/components/mobile/BreedingPlanView";
import {
  cloneBreedingPlanContent,
  normalizeBreedingPlanContent,
  type BreedingPlanContent,
  type BreedingPlanGroup,
  type BreedingPlanPairing,
} from "@/lib/breeding-plan-content";
import { STUDS, type Stud } from "@/lib/cattery-data";
import {
  loadSavedBreedingPlanContent,
  saveBreedingPlanContent,
  saveDraftPreviewBreedingPlanContent,
} from "@/lib/site-page-storage";
import {
  EditorButton,
  EditorSection,
  SortableListEditor,
  TextareaField,
  TextField,
} from "./SitePageEditorPrimitives";
import { createStableId } from "./site-page-editor-utils";

type PanelKey = "basic" | "groups";
type StudRole = "male" | "female";

const MISSING_STUD_WARNING = "当前 ID 不在种猫资料中，已保留 legacy 值。";
const PREPARING_STUD_WARNING = "预备役种猫：性别分类需确认。";
const INCOMPLETE_STUD_WARNING = "资料待补充。";

export function BreedingPlanContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<BreedingPlanContent>(() => loadSavedBreedingPlanContent());
  const [draft, setDraft] = useState<BreedingPlanContent>(() => loadSavedBreedingPlanContent());
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    basic: true,
    groups: true,
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

  const updateDraft = (updater: (content: BreedingPlanContent) => BreedingPlanContent) => {
    setDraft((current) => normalizeBreedingPlanContent(updater(cloneBreedingPlanContent(current))));
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveBreedingPlanContent(draft);
    const next = cloneBreedingPlanContent(draft);
    setSaved(next);
    setDraft(cloneBreedingPlanContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的繁育计划修改都会被放弃。")) {
      return;
    }
    setDraft(cloneBreedingPlanContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewBreedingPlanContent(draft);
    window.open(
      "/breeding-plan?sitePagePreview=breeding-plan-draft",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const updateGroups = (groups: BreedingPlanGroup[]) => {
    updateDraft((content) => ({ ...content, groups }));
  };

  const addGroup = () => {
    updateGroups([
      ...draft.groups,
      {
        id: `breeding-plan-group-${createStableId()}`,
        eyebrow: "New Group",
        title: "新计划分组",
        description: "",
        pairings: [],
      },
    ]);
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
                普通用户页只读取已保存内容；草稿只影响后台和草稿预览。
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
            title="基本信息"
            desc="页面标题、英文小字、查看种猫提示、图标和 SEO 固定；这里只编辑业务内容。"
            open={openPanels.basic}
            onToggle={() => togglePanel("basic")}
          >
            <div className="grid gap-3">
              <TextField
                label="计划周期"
                value={draft.period}
                onChange={(period) => updateDraft((content) => ({ ...content, period }))}
              />
              <TextareaField
                label="开头介绍"
                value={draft.introduction}
                rows={4}
                onChange={(introduction) =>
                  updateDraft((content) => ({ ...content, introduction }))
                }
              />
              <TextareaField
                label="底部免责声明"
                value={draft.disclaimer}
                rows={4}
                onChange={(disclaimer) => updateDraft((content) => ({ ...content, disclaimer }))}
              />
            </div>
          </EditorSection>

          <EditorSection
            title="计划分组与繁育组合"
            desc="分组、组合和预计花色支持新增、删除和排序；种猫名称始终来自种猫资料。"
            open={openPanels.groups}
            onToggle={() => togglePanel("groups")}
          >
            <SortableListEditor<BreedingPlanGroup>
              items={draft.groups}
              addLabel="新增分组"
              emptyLabel="暂无计划分组。用户端不会显示空壳列表。"
              deleteConfirm="确定删除这个计划分组吗？分组内组合也会一起删除。"
              onAdd={addGroup}
              onItemsChange={updateGroups}
              renderItem={(group, _index, updateGroup) => (
                <GroupEditor group={group} onChange={(patch) => updateGroup(patch)} />
              )}
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
            <BreedingPlanView content={draft} studs={STUDS} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">繁育计划预览</p>
            <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </EditorButton>
          </div>
          <BreedingPlanView content={draft} studs={STUDS} />
        </div>
      )}
    </>
  );
}

function GroupEditor({
  group,
  onChange,
}: {
  group: BreedingPlanGroup;
  onChange: (patch: Partial<BreedingPlanGroup>) => void;
}) {
  const updatePairings = (pairings: BreedingPlanPairing[]) => {
    onChange({ pairings });
  };

  const addPairing = () => {
    updatePairings([
      ...group.pairings,
      {
        id: `breeding-plan-pairing-${createStableId()}`,
        maleStudId: getDefaultStudId("male"),
        femaleStudId: getDefaultStudId("female"),
        timeLabel: "",
        expectedColors: [],
      },
    ]);
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TextField label="分组标题" value={group.title} onChange={(title) => onChange({ title })} />
        <TextField
          label="分组英文小标题"
          value={group.eyebrow}
          onChange={(eyebrow) => onChange({ eyebrow })}
        />
      </div>
      <TextareaField
        label="分组说明"
        value={group.description}
        rows={3}
        onChange={(description) => onChange({ description })}
      />

      <div className="grid gap-2">
        <div>
          <p className="text-[12px] font-semibold text-heading lg:text-[13px]">繁育组合</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            没有组合的分组会保留在后台，但用户端自动隐藏。
          </p>
        </div>
        <SortableListEditor<BreedingPlanPairing>
          items={group.pairings}
          addLabel="新增组合"
          emptyLabel="这个分组暂无繁育组合。"
          deleteConfirm="确定删除这组繁育组合吗？"
          onAdd={addPairing}
          onItemsChange={updatePairings}
          renderItem={(pairing, _index, updatePairing) => (
            <PairingEditor pairing={pairing} onChange={(patch) => updatePairing(patch)} />
          )}
        />
      </div>
    </div>
  );
}

function PairingEditor({
  pairing,
  onChange,
}: {
  pairing: BreedingPlanPairing;
  onChange: (patch: Partial<BreedingPlanPairing>) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <StudSelect
          label="公猫"
          role="male"
          value={pairing.maleStudId}
          onChange={(maleStudId) => onChange({ maleStudId })}
        />
        <StudSelect
          label="母猫"
          role="female"
          value={pairing.femaleStudId}
          onChange={(femaleStudId) => onChange({ femaleStudId })}
        />
      </div>
      <TextField
        label="预计时间"
        value={pairing.timeLabel}
        onChange={(timeLabel) => onChange({ timeLabel })}
      />
      <ExpectedColorsEditor
        colors={pairing.expectedColors}
        onChange={(expectedColors) => onChange({ expectedColors })}
      />
    </div>
  );
}

function StudSelect({
  label,
  role,
  value,
  onChange,
}: {
  label: string;
  role: StudRole;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = getStudOptions(role);
  const selectedStud = STUDS.find((stud) => stud.id === value);
  const unknown = Boolean(value && !selectedStud);
  const warnings = getStudWarnings(value, selectedStud);

  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-[7px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
      >
        {unknown && <option value={value}>未知 ID：{value}</option>}
        {options.map((stud) => (
          <option key={stud.id} value={stud.id}>
            {formatStudOption(stud)}
          </option>
        ))}
      </select>
      {warnings.length > 0 && (
        <div className="grid gap-1">
          {warnings.map((warning) => (
            <p
              key={warning}
              className="rounded-[6px] border border-sunflower/40 bg-sunny/25 px-2 py-1 text-[11px] leading-relaxed text-[#9b7927]"
            >
              {warning}
            </p>
          ))}
        </div>
      )}
    </label>
  );
}

function ExpectedColorsEditor({
  colors,
  onChange,
}: {
  colors: string[];
  onChange: (colors: string[]) => void;
}) {
  const [newColor, setNewColor] = useState("");

  const addColor = () => {
    const color = newColor.trim();
    if (!color) return;
    onChange([...colors, color]);
    setNewColor("");
  };

  const updateColor = (index: number, value: string) => {
    onChange(colors.map((color, currentIndex) => (currentIndex === index ? value : color)));
  };

  const deleteColor = (index: number) => {
    onChange(colors.filter((_, currentIndex) => currentIndex !== index));
  };

  const moveColor = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= colors.length) return;
    const next = [...colors];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <div className="grid gap-2">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">预计花色</span>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={newColor}
          onChange={(event) => setNewColor(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addColor();
          }}
          placeholder="输入花色后添加"
          className="h-9 rounded-[7px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
        />
        <EditorButton onClick={addColor}>新增花色</EditorButton>
      </div>
      {colors.length === 0 && (
        <p className="rounded-[6px] border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">
          暂无预计花色。用户端会显示固定待补充状态。
        </p>
      )}
      {colors.map((color, index) => (
        <div
          key={`${index}-${color}`}
          className="grid gap-2 rounded-[6px] border border-border/80 bg-background p-2 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <input
            value={color}
            onChange={(event) => updateColor(index, event.target.value)}
            className="h-9 rounded-[7px] border border-border bg-card px-3 text-[13px] outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-1.5">
            <EditorButton tone="quiet" onClick={() => moveColor(index, -1)} disabled={index === 0}>
              上移
            </EditorButton>
            <EditorButton
              tone="quiet"
              onClick={() => moveColor(index, 1)}
              disabled={index === colors.length - 1}
            >
              下移
            </EditorButton>
            <EditorButton tone="danger" onClick={() => deleteColor(index)}>
              删除
            </EditorButton>
          </div>
        </div>
      ))}
    </div>
  );
}

function getStudOptions(role: StudRole) {
  return STUDS.filter((stud) =>
    role === "male"
      ? stud.category === "现役公猫" || stud.category === "预备役种猫"
      : stud.category === "现役母猫" || stud.category === "预备役种猫",
  );
}

function getDefaultStudId(role: StudRole) {
  return getStudOptions(role)[0]?.id ?? "";
}

function getStudWarnings(value: string, stud: Stud | undefined) {
  if (value && !stud) return [MISSING_STUD_WARNING];
  if (!stud) return [];

  const warnings: string[] = [];
  if (stud.category === "预备役种猫") warnings.push(PREPARING_STUD_WARNING);
  if (hasIncompleteStudData(stud)) warnings.push(INCOMPLETE_STUD_WARNING);
  return warnings;
}

function hasIncompleteStudData(stud: Stud) {
  return (
    stud.status.includes("资料待补充") ||
    stud.color.includes("示例文字") ||
    stud.trait.includes("示例文字") ||
    stud.source.includes("示例文字")
  );
}

function formatStudOption(stud: Stud) {
  const suffixes: string[] = [];
  if (stud.category === "预备役种猫") suffixes.push("性别分类需确认");
  if (hasIncompleteStudData(stud)) suffixes.push("资料待补充");
  return suffixes.length > 0 ? `${stud.name}（${suffixes.join("，")}）` : stud.name;
}
