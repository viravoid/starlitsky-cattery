import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  KEEPER_YUEQI,
  catteryActions,
  getCatteryDataSnapshot,
  selectKittenRecords,
  selectLitterRecords,
  useCattery,
  type CatteryCat,
  type CatteryUser,
  type KittenRecord,
  type Litter,
  type LitterRecord,
  type Visibility,
} from "@/lib/cattery-store";
import {
  deleteEntityImageBlob,
  deleteEntityImageBlobs,
  saveEntityImage,
} from "@/lib/cattery-images";
import { useCatteryImageUrls } from "@/hooks/use-cattery-image-urls";

const ADMIN_CONTEXT = {
  role: "keeper" as const,
  currentUserId: KEEPER_YUEQI,
};

const KITTEN_STATUS_OPTIONS = ["待找家", "找家中", "已有家"] as const;
const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "visible", label: "显示" },
  { value: "hidden", label: "隐藏" },
  { value: "archived", label: "归档" },
];

type ManagementTab = "kittens" | "litters";

type KittenDraft = {
  name: string;
  gender: string;
  color: string;
  birthday: string;
  status: (typeof KITTEN_STATUS_OPTIONS)[number];
  price: string;
  fatherId: string;
  motherId: string;
  litterId: string;
  ownerId: string;
  personality: string;
  storyText: string;
  visibility: Visibility;
  coverImageId?: string;
  galleryImageIds: string[];
};

type LitterDraft = {
  name: string;
  birthDate: string;
  status: string;
  note: string;
  fatherId: string;
  motherId: string;
  visibility: Visibility;
  kittenIds: string[];
};

export function KittenLitterManagementPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const state = useCattery((snapshot) => snapshot);
  const kittenRecords = useMemo(() => selectKittenRecords(state, "all"), [state]);
  const litterRecords = useMemo(() => selectLitterRecords(state, "all"), [state]);
  const parentUsers = useMemo(
    () => state.users.filter((user) => user.role === "parent"),
    [state.users],
  );
  const studCats = useMemo(
    () =>
      state.cats.filter((cat) => cat.kind === "stud" && cat.stud && cat.visibility !== "archived"),
    [state.cats],
  );
  const maleStuds = useMemo(
    () => studCats.filter((cat) => cat.stud?.category === "现役公猫"),
    [studCats],
  );
  const femaleStuds = useMemo(
    () => studCats.filter((cat) => cat.stud?.category !== "现役公猫"),
    [studCats],
  );
  const kittenRawMap = useMemo(
    () =>
      new Map(
        state.cats.filter((cat) => cat.kind === "kitten" && cat.kitten).map((cat) => [cat.id, cat]),
      ),
    [state.cats],
  );
  const litterNameOptions = useMemo(
    () => litterRecords.map((litter) => ({ value: litter.id, label: litter.name })),
    [litterRecords],
  );

  const [tab, setTab] = useState<ManagementTab>("kittens");
  const [selectedKittenId, setSelectedKittenId] = useState<string>("");
  const [selectedLitterId, setSelectedLitterId] = useState<string>("");
  const [kittenMode, setKittenMode] = useState<"idle" | "create" | "edit">("idle");
  const [litterMode, setLitterMode] = useState<"idle" | "create" | "edit">("idle");
  const [kittenDraft, setKittenDraft] = useState<KittenDraft>(createEmptyKittenDraft());
  const [litterDraft, setLitterDraft] = useState<LitterDraft>(createEmptyLitterDraft());
  const [kittenBaseline, setKittenBaseline] = useState(serializeDraft(createEmptyKittenDraft()));
  const [litterBaseline, setLitterBaseline] = useState(serializeDraft(createEmptyLitterDraft()));

  const selectedKitten = kittenRecords.find((kitten) => kitten.id === selectedKittenId) ?? null;
  const selectedLitter = litterRecords.find((litter) => litter.id === selectedLitterId) ?? null;
  const kittenDirty = serializeDraft(kittenDraft) !== kittenBaseline;
  const litterDirty = serializeDraft(litterDraft) !== litterBaseline;
  const showKittenForm = kittenMode !== "idle";
  const showLitterForm = litterMode !== "idle";

  useEffect(() => {
    if (selectedKittenId && !kittenRecords.some((kitten) => kitten.id === selectedKittenId)) {
      setSelectedKittenId("");
      setKittenMode("idle");
      const empty = createEmptyKittenDraft();
      setKittenDraft(empty);
      setKittenBaseline(serializeDraft(empty));
    }
  }, [kittenRecords, selectedKittenId]);

  useEffect(() => {
    if (selectedLitterId && !litterRecords.some((litter) => litter.id === selectedLitterId)) {
      setSelectedLitterId("");
      setLitterMode("idle");
      const empty = createEmptyLitterDraft();
      setLitterDraft(empty);
      setLitterBaseline(serializeDraft(empty));
    }
  }, [litterRecords, selectedLitterId]);

  const openKittenEditor = (kitten: KittenRecord) => {
    if (kittenDirty && !confirm("当前小猫表单有未保存修改，确定切换吗？")) return;
    startTransition(() => {
      setSelectedKittenId(kitten.id);
      setKittenMode("edit");
      const next = createKittenDraft(kitten);
      setKittenDraft(next);
      setKittenBaseline(serializeDraft(next));
    });
  };

  const openNewKitten = () => {
    if (kittenDirty && !confirm("当前小猫表单有未保存修改，确定新建吗？")) return;
    startTransition(() => {
      setSelectedKittenId("");
      setKittenMode("create");
      const next = createEmptyKittenDraft();
      setKittenDraft(next);
      setKittenBaseline(serializeDraft(next));
    });
  };

  const openLitterEditor = (litter: LitterRecord) => {
    if (litterDirty && !confirm("当前窝次表单有未保存修改，确定切换吗？")) return;
    startTransition(() => {
      setSelectedLitterId(litter.id);
      setLitterMode("edit");
      const next = createLitterDraft(litter);
      setLitterDraft(next);
      setLitterBaseline(serializeDraft(next));
    });
  };

  const openNewLitter = () => {
    if (litterDirty && !confirm("当前窝次表单有未保存修改，确定新建吗？")) return;
    startTransition(() => {
      setSelectedLitterId("");
      setLitterMode("create");
      const next = createEmptyLitterDraft();
      setLitterDraft(next);
      setLitterBaseline(serializeDraft(next));
    });
  };

  const cancelKittenEdit = () => {
    if (kittenDirty && !confirm("确定放弃当前小猫表单修改吗？")) return;
    setKittenMode("idle");
    if (selectedKitten) {
      const next = createKittenDraft(selectedKitten);
      setKittenDraft(next);
      setKittenBaseline(serializeDraft(next));
    } else {
      const empty = createEmptyKittenDraft();
      setKittenDraft(empty);
      setKittenBaseline(serializeDraft(empty));
    }
  };

  const cancelLitterEdit = () => {
    if (litterDirty && !confirm("确定放弃当前窝次表单修改吗？")) return;
    setLitterMode("idle");
    if (selectedLitter) {
      const next = createLitterDraft(selectedLitter);
      setLitterDraft(next);
      setLitterBaseline(serializeDraft(next));
    } else {
      const empty = createEmptyLitterDraft();
      setLitterDraft(empty);
      setLitterBaseline(serializeDraft(empty));
    }
  };

  const saveKitten = () => {
    const validation = validateKittenDraft(kittenDraft);
    if (validation) {
      onNotice(validation);
      return;
    }

    const payload = createKittenPayload(
      kittenDraft,
      selectedKitten ? (kittenRawMap.get(selectedKitten.id) ?? null) : null,
    );
    if (kittenMode === "create") {
      const id = catteryActions.addKitten(payload, ADMIN_CONTEXT);
      if (!id) {
        onNotice("新增小猫失败，请重试。");
        return;
      }
      const created = kittenRecords.find((item) => item.id === id);
      const nextDraft = created ? createKittenDraft(created) : kittenDraft;
      setSelectedKittenId(id);
      setKittenMode("edit");
      setKittenDraft(nextDraft);
      setKittenBaseline(serializeDraft(nextDraft));
      onNotice("已新增小猫并写入本地数据。");
      return;
    }

    if (!selectedKitten) {
      onNotice("未找到要保存的小猫。");
      return;
    }

    const updated = catteryActions.updateKitten(selectedKitten.id, payload, ADMIN_CONTEXT);
    if (!updated) {
      onNotice("保存小猫失败，请重试。");
      return;
    }

    const nextDraft = createKittenDraft(
      selectKittenRecords(catterySnapshot(), "all").find((item) => item.id === selectedKitten.id) ??
        selectedKitten,
    );
    setKittenDraft(nextDraft);
    setKittenBaseline(serializeDraft(nextDraft));
    onNotice("已保存小猫资料。");
  };

  const saveLitter = () => {
    const validation = validateLitterDraft(litterDraft);
    if (validation) {
      onNotice(validation);
      return;
    }

    const payload = createLitterPayload(litterDraft);
    if (litterMode === "create") {
      const id = catteryActions.addLitter(payload, ADMIN_CONTEXT);
      if (!id) {
        onNotice("新增窝次失败，请重试。");
        return;
      }
      updateLinkedKittensForLitter(id, litterDraft.kittenIds, kittenRawMap);
      const created = selectLitterRecords(catterySnapshot(), "all").find((item) => item.id === id);
      const nextDraft = created ? createLitterDraft(created) : litterDraft;
      setSelectedLitterId(id);
      setLitterMode("edit");
      setLitterDraft(nextDraft);
      setLitterBaseline(serializeDraft(nextDraft));
      onNotice("已新增窝次并更新关联小猫。");
      return;
    }

    if (!selectedLitter) {
      onNotice("未找到要保存的窝次。");
      return;
    }

    const updated = catteryActions.updateLitter(selectedLitter.id, payload, ADMIN_CONTEXT);
    if (!updated) {
      onNotice("保存窝次失败，请重试。");
      return;
    }
    updateLinkedKittensForLitter(selectedLitter.id, litterDraft.kittenIds, kittenRawMap);
    const nextDraft = createLitterDraft(
      selectLitterRecords(catterySnapshot(), "all").find((item) => item.id === selectedLitter.id) ??
        selectedLitter,
    );
    setLitterDraft(nextDraft);
    setLitterBaseline(serializeDraft(nextDraft));
    onNotice("已保存窝次资料。");
  };

  const setKittenVisibility = (id: string, visibility: Visibility) => {
    const ok = catteryActions.setCatVisibility(id, visibility, ADMIN_CONTEXT);
    if (ok) onNotice(`已将小猫设为${visibilityLabel(visibility)}。`);
  };

  const setLitterVisibility = (id: string, visibility: Visibility) => {
    const ok = catteryActions.setLitterVisibility(id, visibility, ADMIN_CONTEXT);
    if (ok) onNotice(`已将窝次设为${visibilityLabel(visibility)}。`);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {[
          ["kittens", "小猫管理"],
          ["litters", "窝次管理"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              if (
                ((tab === "kittens" && kittenDirty) || (tab === "litters" && litterDirty)) &&
                !confirm("当前表单有未保存修改，确定切换模块吗？")
              ) {
                return;
              }
              setTab(value as ManagementTab);
            }}
            className={cn(
              "pressable h-8 rounded-[6px] px-3 text-[12.5px] font-semibold lg:text-[13px]",
              tab === value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "kittens" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(420px,1fr)]">
          <section className={cn(showKittenForm ? "hidden md:block" : "")}>
            <PanelCard>
              <PanelHeader
                title="小猫列表"
                desc="真实读取 cattery-store；支持新增、编辑、父母/窝次/家长关联、可见性和图片管理。"
                action={
                  <SmallButton onClick={openNewKitten}>
                    {kittenMode === "create" ? "正在新增" : "新增小猫"}
                  </SmallButton>
                }
              />
              <DesktopTable
                columns={["名字", "状态", "窝次", "家长", "父母", "动态", "可见性", "操作"]}
              >
                {kittenRecords.map((kitten) => (
                  <tr key={kitten.id} className="text-card-foreground">
                    <td className="px-3 py-2.5 font-semibold text-heading">{kitten.name}</td>
                    <td className="px-3 py-2.5">{kitten.status}</td>
                    <td className="px-3 py-2.5">{kitten.litterName ?? "未分配"}</td>
                    <td className="px-3 py-2.5">{kitten.ownerName ?? "未关联"}</td>
                    <td className="px-3 py-2.5">
                      {kitten.fatherName || "未设置"} / {kitten.motherName || "未设置"}
                    </td>
                    <td className="px-3 py-2.5">{kitten.linkedPostCount}</td>
                    <td className="px-3 py-2.5">
                      <VisibilityBadge visibility={kitten.visibility} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <SmallButton tone="quiet" onClick={() => openKittenEditor(kitten)}>
                          编辑
                        </SmallButton>
                        <SmallButton
                          tone="quiet"
                          onClick={() =>
                            setKittenVisibility(
                              kitten.id,
                              kitten.visibility === "hidden" ? "visible" : "hidden",
                            )
                          }
                        >
                          {kitten.visibility === "hidden" ? "显示" : "隐藏"}
                        </SmallButton>
                        <SmallButton
                          tone="danger"
                          onClick={() => {
                            if (!confirm(`确定将 ${kitten.name} 设为归档吗？`)) return;
                            setKittenVisibility(
                              kitten.id,
                              kitten.visibility === "archived" ? "visible" : "archived",
                            );
                          }}
                        >
                          {kitten.visibility === "archived" ? "恢复" : "归档"}
                        </SmallButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </DesktopTable>
              <div className="md:hidden">
                {kittenRecords.map((kitten) => (
                  <MobileItem
                    key={kitten.id}
                    title={kitten.name}
                    meta={`${kitten.status} · ${kitten.litterName ?? "未分配"} · ${visibilityLabel(kitten.visibility)}`}
                    actions={
                      <SmallButton tone="quiet" onClick={() => openKittenEditor(kitten)}>
                        编辑
                      </SmallButton>
                    }
                  >
                    <span>家长：{kitten.ownerName ?? "未关联"}</span>
                    <span>
                      父母：{kitten.fatherName || "未设置"} / {kitten.motherName || "未设置"}
                    </span>
                    <span>动态：{kitten.linkedPostCount} 条</span>
                  </MobileItem>
                ))}
              </div>
            </PanelCard>
          </section>

          <section className={cn(!showKittenForm ? "hidden md:block" : "")}>
            <KittenEditor
              mode={kittenMode}
              draft={kittenDraft}
              onDraftChange={setKittenDraft}
              onCancel={cancelKittenEdit}
              onSave={saveKitten}
              parentUsers={parentUsers}
              maleStuds={maleStuds}
              femaleStuds={femaleStuds}
              litterOptions={litterNameOptions}
              onNotice={onNotice}
              entityId={kittenMode === "edit" ? selectedKittenId : ""}
              onApplyImages={(next) => {
                const nextDraft = { ...kittenDraft, ...next };
                setKittenDraft(nextDraft);
                if (kittenMode !== "edit" || !selectedKittenId) return true;
                return catteryActions.updateKitten(selectedKittenId, next, ADMIN_CONTEXT);
              }}
            />
          </section>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(420px,1fr)]">
          <section className={cn(showLitterForm ? "hidden md:block" : "")}>
            <PanelCard>
              <PanelHeader
                title="窝次列表"
                desc="真实读取 cattery-store；支持新增、编辑、父母设置、关联小猫维护和可见性。"
                action={
                  <SmallButton onClick={openNewLitter}>
                    {litterMode === "create" ? "正在新增" : "新增窝次"}
                  </SmallButton>
                }
              />
              <DesktopTable
                columns={["名称", "生日", "父母", "小猫数", "动态数", "状态", "可见性", "操作"]}
              >
                {litterRecords.map((litter) => (
                  <tr key={litter.id} className="text-card-foreground">
                    <td className="px-3 py-2.5 font-semibold text-heading">{litter.name}</td>
                    <td className="px-3 py-2.5">{litter.birthDate || "未填写"}</td>
                    <td className="px-3 py-2.5">
                      {litter.fatherName || "未设置"} / {litter.motherName || "未设置"}
                    </td>
                    <td className="px-3 py-2.5">{litter.kittenCount}</td>
                    <td className="px-3 py-2.5">{litter.linkedPostCount}</td>
                    <td className="px-3 py-2.5">{litter.status || "未填写"}</td>
                    <td className="px-3 py-2.5">
                      <VisibilityBadge visibility={litter.visibility} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <SmallButton tone="quiet" onClick={() => openLitterEditor(litter)}>
                          编辑
                        </SmallButton>
                        <SmallButton
                          tone="quiet"
                          onClick={() =>
                            setLitterVisibility(
                              litter.id,
                              litter.visibility === "hidden" ? "visible" : "hidden",
                            )
                          }
                        >
                          {litter.visibility === "hidden" ? "显示" : "隐藏"}
                        </SmallButton>
                        <SmallButton
                          tone="danger"
                          onClick={() => {
                            if (!confirm(`确定将 ${litter.name} 设为归档吗？`)) return;
                            setLitterVisibility(
                              litter.id,
                              litter.visibility === "archived" ? "visible" : "archived",
                            );
                          }}
                        >
                          {litter.visibility === "archived" ? "恢复" : "归档"}
                        </SmallButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </DesktopTable>
              <div className="md:hidden">
                {litterRecords.map((litter) => (
                  <MobileItem
                    key={litter.id}
                    title={litter.name}
                    meta={`${litter.birthDate || "未填写生日"} · ${litter.status || "未填写状态"} · ${visibilityLabel(litter.visibility)}`}
                    actions={
                      <SmallButton tone="quiet" onClick={() => openLitterEditor(litter)}>
                        编辑
                      </SmallButton>
                    }
                  >
                    <span>
                      父母：{litter.fatherName || "未设置"} / {litter.motherName || "未设置"}
                    </span>
                    <span>关联小猫：{litter.kittenNames.join("、") || "暂无"}</span>
                    <span>动态：{litter.linkedPostCount} 条</span>
                  </MobileItem>
                ))}
              </div>
            </PanelCard>
          </section>

          <section className={cn(!showLitterForm ? "hidden md:block" : "")}>
            <LitterEditor
              mode={litterMode}
              draft={litterDraft}
              onDraftChange={setLitterDraft}
              onCancel={cancelLitterEdit}
              onSave={saveLitter}
              maleStuds={maleStuds}
              femaleStuds={femaleStuds}
              kittenOptions={kittenRecords}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function KittenEditor({
  mode,
  draft,
  onDraftChange,
  onCancel,
  onSave,
  parentUsers,
  maleStuds,
  femaleStuds,
  litterOptions,
  onNotice,
  entityId,
  onApplyImages,
}: {
  mode: "idle" | "create" | "edit";
  draft: KittenDraft;
  onDraftChange: (draft: KittenDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  parentUsers: CatteryUser[];
  maleStuds: CatteryCat[];
  femaleStuds: CatteryCat[];
  litterOptions: { value: string; label: string }[];
  onNotice: (message: string) => void;
  entityId: string;
  onApplyImages: (next: { coverImageId?: string; galleryImageIds: string[] }) => boolean;
}) {
  if (mode === "idle") {
    return (
      <EmptyEditorCard
        title="小猫表单"
        desc="从左侧选择一只小猫开始编辑，或点击“新增小猫”创建新记录。"
      />
    );
  }

  return (
    <PanelCard>
      <PanelHeader
        title={mode === "create" ? "新增小猫" : "编辑小猫"}
        desc="保存后写入 cattery-store，本地刷新后仍会保留。小猫永久删除本轮不开放，使用归档控制。"
        action={
          <SmallButton tone="quiet" onClick={onCancel}>
            取消
          </SmallButton>
        }
      />
      <div className="space-y-3 px-3 py-3 lg:px-4">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField
            label="名字"
            value={draft.name}
            required
            onChange={(name) => onDraftChange({ ...draft, name })}
          />
          <SelectField
            label="可见性"
            value={draft.visibility}
            options={VISIBILITY_OPTIONS}
            onChange={(visibility) =>
              onDraftChange({ ...draft, visibility: visibility as Visibility })
            }
          />
          <SelectField
            label="性别"
            value={draft.gender}
            options={[
              { value: "弟弟", label: "弟弟" },
              { value: "妹妹", label: "妹妹" },
            ]}
            onChange={(gender) => onDraftChange({ ...draft, gender })}
          />
          <TextField
            label="花色"
            value={draft.color}
            onChange={(color) => onDraftChange({ ...draft, color })}
          />
          <TextField
            label="生日"
            value={draft.birthday}
            type="date"
            onChange={(birthday) => onDraftChange({ ...draft, birthday })}
          />
          <SelectField
            label="状态"
            value={draft.status}
            options={KITTEN_STATUS_OPTIONS.map((item) => ({ value: item, label: item }))}
            onChange={(status) =>
              onDraftChange({ ...draft, status: status as (typeof KITTEN_STATUS_OPTIONS)[number] })
            }
          />
          <TextField
            label="价格"
            value={draft.price}
            onChange={(price) => onDraftChange({ ...draft, price })}
          />
          <SelectField
            label="所属窝次"
            value={draft.litterId}
            options={[{ value: "", label: "未分配" }, ...litterOptions]}
            onChange={(litterId) => onDraftChange({ ...draft, litterId })}
          />
          <SelectField
            label="父亲"
            value={draft.fatherId}
            options={[
              { value: "", label: "未设置" },
              ...maleStuds.map((cat) => ({ value: cat.id, label: cat.name })),
            ]}
            onChange={(fatherId) => onDraftChange({ ...draft, fatherId })}
          />
          <SelectField
            label="母亲"
            value={draft.motherId}
            options={[
              { value: "", label: "未设置" },
              ...femaleStuds.map((cat) => ({ value: cat.id, label: cat.name })),
            ]}
            onChange={(motherId) => onDraftChange({ ...draft, motherId })}
          />
          <SelectField
            label="家长"
            value={draft.ownerId}
            options={[
              { value: "", label: "未关联" },
              ...parentUsers.map((user) => ({ value: user.id, label: user.name })),
            ]}
            onChange={(ownerId) => onDraftChange({ ...draft, ownerId })}
          />
        </div>

        <TextAreaField
          label="性格"
          value={draft.personality}
          rows={3}
          onChange={(personality) => onDraftChange({ ...draft, personality })}
        />
        <TextAreaField
          label="故事"
          value={draft.storyText}
          rows={5}
          hint="一行一段；留空时不写入 story。"
          onChange={(storyText) => onDraftChange({ ...draft, storyText })}
        />

        <EntityImageEditor
          entityId={entityId}
          coverImageId={draft.coverImageId}
          galleryImageIds={draft.galleryImageIds}
          onNotice={onNotice}
          onApply={onApplyImages}
        />

        <div className="flex gap-2">
          <SmallButton tone="quiet" className="flex-1 justify-center" onClick={onCancel}>
            取消
          </SmallButton>
          <SmallButton className="flex-1 justify-center" onClick={onSave}>
            保存小猫
          </SmallButton>
        </div>
      </div>
    </PanelCard>
  );
}

function LitterEditor({
  mode,
  draft,
  onDraftChange,
  onCancel,
  onSave,
  maleStuds,
  femaleStuds,
  kittenOptions,
}: {
  mode: "idle" | "create" | "edit";
  draft: LitterDraft;
  onDraftChange: (draft: LitterDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  maleStuds: CatteryCat[];
  femaleStuds: CatteryCat[];
  kittenOptions: KittenRecord[];
}) {
  if (mode === "idle") {
    return (
      <EmptyEditorCard
        title="窝次表单"
        desc="从左侧选择一个窝次开始编辑，或点击“新增窝次”创建新记录。"
      />
    );
  }

  return (
    <PanelCard>
      <PanelHeader
        title={mode === "create" ? "新增窝次" : "编辑窝次"}
        desc="可同时维护父母、备注、可见性和关联小猫。保存时会同步更新相关小猫的所属窝次。"
        action={
          <SmallButton tone="quiet" onClick={onCancel}>
            取消
          </SmallButton>
        }
      />
      <div className="space-y-3 px-3 py-3 lg:px-4">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField
            label="窝次名称"
            value={draft.name}
            required
            onChange={(name) => onDraftChange({ ...draft, name })}
          />
          <SelectField
            label="可见性"
            value={draft.visibility}
            options={VISIBILITY_OPTIONS}
            onChange={(visibility) =>
              onDraftChange({ ...draft, visibility: visibility as Visibility })
            }
          />
          <TextField
            label="出生日期"
            value={draft.birthDate}
            type="date"
            onChange={(birthDate) => onDraftChange({ ...draft, birthDate })}
          />
          <TextField
            label="状态"
            value={draft.status}
            onChange={(status) => onDraftChange({ ...draft, status })}
          />
          <SelectField
            label="父亲"
            value={draft.fatherId}
            options={[
              { value: "", label: "未设置" },
              ...maleStuds.map((cat) => ({ value: cat.id, label: cat.name })),
            ]}
            onChange={(fatherId) => onDraftChange({ ...draft, fatherId })}
          />
          <SelectField
            label="母亲"
            value={draft.motherId}
            options={[
              { value: "", label: "未设置" },
              ...femaleStuds.map((cat) => ({ value: cat.id, label: cat.name })),
            ]}
            onChange={(motherId) => onDraftChange({ ...draft, motherId })}
          />
        </div>

        <TextAreaField
          label="备注"
          value={draft.note}
          rows={4}
          onChange={(note) => onDraftChange({ ...draft, note })}
        />

        <div className="rounded-[10px] border border-border/80 bg-card px-3 py-3">
          <div className="mb-2">
            <p className="text-[12px] font-semibold text-heading">关联小猫</p>
            <p className="text-[11px] text-muted-foreground">
              选中后保存，会把这些小猫的所属窝次更新到当前窝次。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {kittenOptions.map((kitten) => {
              const active = draft.kittenIds.includes(kitten.id);
              return (
                <button
                  key={kitten.id}
                  type="button"
                  onClick={() =>
                    onDraftChange({
                      ...draft,
                      kittenIds: active
                        ? draft.kittenIds.filter((id) => id !== kitten.id)
                        : [...draft.kittenIds, kitten.id],
                    })
                  }
                  className={cn(
                    "pressable rounded-full px-3 py-1.5 text-[12px] font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground",
                  )}
                >
                  {kitten.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <SmallButton tone="quiet" className="flex-1 justify-center" onClick={onCancel}>
            取消
          </SmallButton>
          <SmallButton className="flex-1 justify-center" onClick={onSave}>
            保存窝次
          </SmallButton>
        </div>
      </div>
    </PanelCard>
  );
}

function EntityImageEditor({
  entityId,
  coverImageId,
  galleryImageIds,
  onNotice,
  onApply,
}: {
  entityId: string;
  coverImageId?: string;
  galleryImageIds: string[];
  onNotice: (message: string) => void;
  onApply: (next: { coverImageId?: string; galleryImageIds: string[] }) => boolean;
}) {
  const urls = useCatteryImageUrls([coverImageId, ...galleryImageIds]);

  const requireSavedRecord = () => {
    if (entityId) return true;
    onNotice("请先保存当前记录，再上传封面或相册。");
    return false;
  };

  const replaceCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !requireSavedRecord()) return;

    const record = await saveEntityImage("cat", entityId, "cover", file);
    const ok = onApply({ coverImageId: record.id, galleryImageIds });
    if (!ok) {
      await deleteEntityImageBlob(record.id);
      onNotice("封面保存失败，请重试。");
      return;
    }
    if (coverImageId) await deleteEntityImageBlob(coverImageId);
    onNotice("已更新封面。");
  };

  const addGallery = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || !requireSavedRecord()) return;

    const records = await Promise.all(
      files.map((file) => saveEntityImage("cat", entityId, "gallery", file)),
    );
    const nextIds = [...galleryImageIds, ...records.map((record) => record.id)];
    const ok = onApply({ coverImageId, galleryImageIds: nextIds });
    if (!ok) {
      await deleteEntityImageBlobs(records.map((record) => record.id));
      onNotice("相册保存失败，请重试。");
      return;
    }
    onNotice("已添加相册图片。");
  };

  const replaceGalleryImage = async (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !requireSavedRecord()) return;

    const record = await saveEntityImage("cat", entityId, "gallery", file);
    const previousId = galleryImageIds[index];
    const nextIds = galleryImageIds.map((item, itemIndex) =>
      itemIndex === index ? record.id : item,
    );
    const ok = onApply({ coverImageId, galleryImageIds: nextIds });
    if (!ok) {
      await deleteEntityImageBlob(record.id);
      onNotice("替换相册图片失败，请重试。");
      return;
    }
    if (previousId) await deleteEntityImageBlob(previousId);
    onNotice("已替换相册图片。");
  };

  const deleteCover = async () => {
    if (!coverImageId) return;
    const ok = onApply({ coverImageId: undefined, galleryImageIds });
    if (!ok) {
      onNotice("封面删除失败，请重试。");
      return;
    }
    await deleteEntityImageBlob(coverImageId);
    onNotice("已删除封面。");
  };

  const deleteGalleryImage = async (index: number) => {
    const previousId = galleryImageIds[index];
    const nextIds = galleryImageIds.filter((_, itemIndex) => itemIndex !== index);
    const ok = onApply({ coverImageId, galleryImageIds: nextIds });
    if (!ok) {
      onNotice("删除相册图片失败，请重试。");
      return;
    }
    if (previousId) await deleteEntityImageBlob(previousId);
    onNotice("已删除相册图片。");
  };

  return (
    <div className="rounded-[10px] border border-border/80 bg-card px-3 py-3">
      <div className="mb-2">
        <p className="text-[12px] font-semibold text-heading">图片管理</p>
        <p className="text-[11px] text-muted-foreground">
          封面和相册都写入 IndexedDB，本地刷新后会保留。
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[10px] border border-border/70 bg-background p-3">
          <p className="mb-2 text-[11.5px] font-semibold text-heading">封面</p>
          <ImagePreview imageUrl={coverImageId ? urls[coverImageId] : undefined} label="暂无封面" />
          <div className="mt-2 flex flex-wrap gap-2">
            <LabelButton text={coverImageId ? "替换封面" : "上传封面"}>
              <input type="file" accept="image/*" className="hidden" onChange={replaceCover} />
            </LabelButton>
            <SmallButton tone="quiet" disabled={!coverImageId} onClick={() => void deleteCover()}>
              删除封面
            </SmallButton>
          </div>
        </div>

        <div className="rounded-[10px] border border-border/70 bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11.5px] font-semibold text-heading">相册</p>
            <LabelButton text="添加图片">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={addGallery}
              />
            </LabelButton>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {galleryImageIds.length === 0 && (
              <div className="col-span-2 rounded-[8px] border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                暂无相册图片
              </div>
            )}
            {galleryImageIds.map((imageId, index) => (
              <div key={imageId} className="rounded-[8px] border border-border/70 bg-card p-2">
                <ImagePreview imageUrl={urls[imageId]} label={`相册 ${index + 1}`} compact />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <LabelButton text="替换">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void replaceGalleryImage(index, event)}
                    />
                  </LabelButton>
                  <SmallButton tone="quiet" onClick={() => void deleteGalleryImage(index)}>
                    删除
                  </SmallButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelCard({ children }: { children: ReactNode }) {
  return <div className="rounded-[10px] border border-border bg-card shadow-card">{children}</div>;
}

function PanelHeader({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 px-3 py-3 lg:px-4">
      <div>
        <p className="text-[13px] font-semibold text-heading lg:text-[14px]">{title}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      {action}
    </div>
  );
}

function DesktopTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full text-left text-[12px]">
        <thead className="bg-cream/60 text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-2 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function MobileItem({
  title,
  meta,
  children,
  actions,
}: {
  title: string;
  meta: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border/70 px-3 py-3 last:border-b-0 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-heading">{title}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{meta}</p>
        </div>
        {actions}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[12px] text-card-foreground">{children}</div>
    </div>
  );
}

function EmptyEditorCard({ title, desc }: { title: string; desc: string }) {
  return (
    <PanelCard>
      <PanelHeader title={title} desc={desc} />
      <div className="px-4 py-8 text-[13px] text-muted-foreground">请选择或新建一条记录。</div>
    </PanelCard>
  );
}

function SmallButton({
  children,
  onClick,
  tone = "default",
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "quiet" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "pressable inline-flex items-center gap-1 rounded-[7px] px-2.5 py-1.5 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-50",
        tone === "default" && "bg-primary text-primary-foreground",
        tone === "quiet" && "border border-border bg-background text-heading",
        tone === "danger" && "border border-border bg-background text-[#9a5c5c]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const tone =
    visibility === "visible"
      ? "bg-[#edf7ef] text-[#4f7a58]"
      : visibility === "hidden"
        ? "bg-[#f8efe0] text-[#9a6a2a]"
        : "bg-[#f2e8ea] text-[#8a5f69]";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>
      {visibilityLabel(visibility)}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11.5px] font-semibold text-heading">
        {label}
        {required && <span className="ml-1 text-[#b35e5e]">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-[8px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11.5px] font-semibold text-heading">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-[8px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  rows,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  rows: number;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11.5px] font-semibold text-heading">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
      />
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function LabelButton({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="pressable inline-flex cursor-pointer items-center gap-1 rounded-[7px] border border-border bg-background px-2.5 py-1.5 text-[12px] font-medium text-heading">
      {text}
      {children}
    </label>
  );
}

function ImagePreview({
  imageUrl,
  label,
  compact = false,
}: {
  imageUrl?: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[8px] border border-border/60 bg-cream/40",
        compact ? "aspect-square" : "aspect-[4/3]",
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] text-muted-foreground">
          {label}
        </div>
      )}
    </div>
  );
}

function createEmptyKittenDraft(): KittenDraft {
  return {
    name: "",
    gender: "妹妹",
    color: "",
    birthday: "",
    status: "待找家",
    price: "",
    fatherId: "",
    motherId: "",
    litterId: "",
    ownerId: "",
    personality: "",
    storyText: "",
    visibility: "visible",
    coverImageId: undefined,
    galleryImageIds: [],
  };
}

function createEmptyLitterDraft(): LitterDraft {
  return {
    name: "",
    birthDate: "",
    status: "已建档",
    note: "",
    fatherId: "",
    motherId: "",
    visibility: "visible",
    kittenIds: [],
  };
}

function createKittenDraft(kitten: KittenRecord): KittenDraft {
  return {
    name: kitten.name,
    gender: kitten.gender,
    color: kitten.color,
    birthday: kitten.birthday,
    status: kitten.status,
    price: kitten.price,
    fatherId: kitten.fatherId ?? "",
    motherId: kitten.motherId ?? "",
    litterId: kitten.litterId ?? "",
    ownerId: kitten.ownerId ?? "",
    personality: kitten.personality,
    storyText: (kitten.story ?? []).join("\n"),
    visibility: kitten.visibility,
    coverImageId: kitten.coverImageId,
    galleryImageIds: [...kitten.galleryImageIds],
  };
}

function createLitterDraft(litter: LitterRecord): LitterDraft {
  return {
    name: litter.name,
    birthDate: litter.birthDate ?? "",
    status: litter.status,
    note: litter.note ?? "",
    fatherId: litter.fatherId ?? "",
    motherId: litter.motherId ?? "",
    visibility: litter.visibility,
    kittenIds: [...litter.kittenIds],
  };
}

function createKittenPayload(draft: KittenDraft, existing: CatteryCat | null) {
  return {
    name: draft.name.trim(),
    gender: draft.gender,
    color: draft.color.trim(),
    birthday: draft.birthday || undefined,
    ownerId: draft.ownerId || undefined,
    personality: draft.personality.trim(),
    story: splitStory(draft.storyText),
    coverImageId: draft.coverImageId,
    galleryImageIds: [...draft.galleryImageIds],
    visibility: draft.visibility,
    kitten: {
      status: draft.status,
      price: draft.price.trim(),
      litterId: draft.litterId || undefined,
      fatherId: draft.fatherId || undefined,
      motherId: draft.motherId || undefined,
      legacyFatherName:
        draft.fatherId || !existing?.kitten?.legacyFatherName
          ? undefined
          : existing.kitten.legacyFatherName,
      legacyMotherName:
        draft.motherId || !existing?.kitten?.legacyMotherName
          ? undefined
          : existing.kitten.legacyMotherName,
      structureRating: existing?.kitten?.structureRating,
    },
  } satisfies Partial<CatteryCat>;
}

function createLitterPayload(draft: LitterDraft) {
  return {
    name: draft.name.trim(),
    birthDate: draft.birthDate || undefined,
    status: draft.status.trim(),
    note: draft.note.trim() || undefined,
    fatherId: draft.fatherId || undefined,
    motherId: draft.motherId || undefined,
    visibility: draft.visibility,
  } satisfies Partial<Litter>;
}

function updateLinkedKittensForLitter(
  litterId: string,
  selectedKittenIds: string[],
  kittenRawMap: Map<string, CatteryCat>,
) {
  const linkedSet = new Set(selectedKittenIds);
  kittenRawMap.forEach((cat, kittenId) => {
    const currentLitterId = cat.kitten?.litterId ?? "";
    if (!linkedSet.has(kittenId) && currentLitterId !== litterId) return;
    const nextLitterId = linkedSet.has(kittenId) ? litterId : undefined;
    catteryActions.updateKitten(
      kittenId,
      {
        kitten: {
          ...cat.kitten,
          status: cat.kitten?.status ?? "待找家",
          price: cat.kitten?.price ?? "",
          litterId: nextLitterId,
        },
      },
      ADMIN_CONTEXT,
    );
  });
}

function validateKittenDraft(draft: KittenDraft) {
  if (!draft.name.trim()) return "请填写小猫名字。";
  return "";
}

function validateLitterDraft(draft: LitterDraft) {
  if (!draft.name.trim()) return "请填写窝次名称。";
  return "";
}

function splitStory(value: string) {
  const items = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function serializeDraft(value: unknown) {
  return JSON.stringify(value);
}

function visibilityLabel(visibility: Visibility) {
  switch (visibility) {
    case "visible":
      return "显示";
    case "hidden":
      return "隐藏";
    case "archived":
      return "归档";
  }
}

function catterySnapshot() {
  return getCatteryDataSnapshot();
}
