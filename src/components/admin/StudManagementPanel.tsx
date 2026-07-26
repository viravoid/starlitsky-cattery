import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import type { StudCategory } from "@/lib/cattery-data";
import {
  KEEPER_YUEQI,
  catteryActions,
  getCatteryDataSnapshot,
  selectStudRecords,
  useCattery,
  type CatteryCat,
  type StudFields,
  type StudRecord,
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

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "visible", label: "显示" },
  { value: "hidden", label: "隐藏" },
  { value: "archived", label: "归档" },
];

const STUD_CATEGORY_OPTIONS: { value: StudCategory; label: string }[] = [
  { value: "现役公猫", label: "现役公猫" },
  { value: "现役母猫", label: "现役母猫" },
  { value: "预备役种猫", label: "预备役种猫" },
];

const REPRODUCTIVE_STATE_OPTIONS: {
  value: StudFields["reproductiveState"];
  label: string;
}[] = [
  { value: "active", label: "现役" },
  { value: "preparing", label: "准备中" },
  { value: "semiRetired", label: "半退役" },
  { value: "retired", label: "退役" },
  { value: "archived", label: "已归档" },
];

type StudPanelMode = "idle" | "view" | "create" | "edit";

type StudDraft = {
  name: string;
  gender: string;
  color: string;
  birthday: string;
  personality: string;
  storyText: string;
  role: string;
  category: StudCategory;
  status: string;
  trait: string;
  source: string;
  reproductiveState: StudFields["reproductiveState"];
  visibility: Visibility;
  coverImageId?: string;
  galleryImageIds: string[];
};

export function StudManagementPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const state = useCattery((snapshot) => snapshot);
  const studRecords = useMemo(() => selectStudRecords(state, "all"), [state]);
  const studRawMap = useMemo(
    () =>
      new Map(
        state.cats.filter((cat) => cat.kind === "stud" && cat.stud).map((cat) => [cat.id, cat]),
      ),
    [state.cats],
  );

  const [selectedStudId, setSelectedStudId] = useState("");
  const [mode, setMode] = useState<StudPanelMode>("idle");
  const [draft, setDraft] = useState<StudDraft>(createEmptyStudDraft());
  const [baseline, setBaseline] = useState(serializeDraft(createEmptyStudDraft()));

  const selectedStud = studRecords.find((stud) => stud.id === selectedStudId) ?? null;
  const formDirty = (mode === "create" || mode === "edit") && serializeDraft(draft) !== baseline;

  useEffect(() => {
    if (selectedStudId && !studRecords.some((stud) => stud.id === selectedStudId)) {
      setSelectedStudId("");
      setMode("idle");
      const empty = createEmptyStudDraft();
      setDraft(empty);
      setBaseline(serializeDraft(empty));
    }
  }, [selectedStudId, studRecords]);

  useEffect(() => {
    if (mode !== "view" || !selectedStud) return;
    const next = createStudDraft(selectedStud);
    setDraft(next);
    setBaseline(serializeDraft(next));
  }, [mode, selectedStud]);

  const openStudDetail = (stud: StudRecord) => {
    if (formDirty && !confirm("当前种猫表单有未保存修改，确定切换吗？")) return;
    startTransition(() => {
      setSelectedStudId(stud.id);
      setMode("view");
      const next = createStudDraft(stud);
      setDraft(next);
      setBaseline(serializeDraft(next));
    });
  };

  const openStudEditor = (stud: StudRecord) => {
    if (formDirty && !confirm("当前种猫表单有未保存修改，确定切换吗？")) return;
    startTransition(() => {
      setSelectedStudId(stud.id);
      setMode("edit");
      const next = createStudDraft(stud);
      setDraft(next);
      setBaseline(serializeDraft(next));
    });
  };

  const openNewStud = () => {
    if (formDirty && !confirm("当前种猫表单有未保存修改，确定新建吗？")) return;
    startTransition(() => {
      setSelectedStudId("");
      setMode("create");
      const next = createEmptyStudDraft();
      setDraft(next);
      setBaseline(serializeDraft(next));
    });
  };

  const cancelEdit = () => {
    if (formDirty && !confirm("确定放弃当前种猫表单修改吗？")) return;
    if (selectedStud) {
      const next = createStudDraft(selectedStud);
      setDraft(next);
      setBaseline(serializeDraft(next));
      setMode("view");
      return;
    }
    const empty = createEmptyStudDraft();
    setDraft(empty);
    setBaseline(serializeDraft(empty));
    setMode("idle");
  };

  const saveStud = () => {
    const validation = validateStudDraft(draft);
    if (validation) {
      onNotice(validation);
      return;
    }

    const payload = createStudPayload(
      draft,
      selectedStud ? (studRawMap.get(selectedStud.id) ?? null) : null,
    );

    if (mode === "create") {
      const id = catteryActions.addStud(payload, ADMIN_CONTEXT);
      if (!id) {
        onNotice("新增种猫失败，请重试。");
        return;
      }
      const created = selectStudRecords(catterySnapshot(), "all").find((item) => item.id === id);
      const nextDraft = created ? createStudDraft(created) : draft;
      setSelectedStudId(id);
      setMode("edit");
      setDraft(nextDraft);
      setBaseline(serializeDraft(nextDraft));
      onNotice("已新增种猫并写入本地数据。");
      return;
    }

    if (!selectedStud) {
      onNotice("未找到要保存的种猫。");
      return;
    }

    const updated = catteryActions.updateStud(selectedStud.id, payload, ADMIN_CONTEXT);
    if (!updated) {
      onNotice("保存种猫失败，请重试。");
      return;
    }

    const nextDraft = createStudDraft(
      selectStudRecords(catterySnapshot(), "all").find((item) => item.id === selectedStud.id) ??
        selectedStud,
    );
    setDraft(nextDraft);
    setBaseline(serializeDraft(nextDraft));
    onNotice("已保存种猫资料。");
  };

  const setStudVisibility = (id: string, visibility: Visibility) => {
    const ok = catteryActions.setCatVisibility(id, visibility, ADMIN_CONTEXT);
    if (ok) onNotice(`已将种猫设为${visibilityLabel(visibility)}。`);
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(420px,1fr)]">
      <section className={cn(mode !== "idle" ? "hidden md:block" : "")}>
        <PanelCard>
          <PanelHeader
            title="种猫列表"
            desc="真实读取 cattery-store；支持新增、查看、编辑、图片管理、可见性切换和本地持久化。"
            action={
              <SmallButton onClick={openNewStud}>
                {mode === "create" ? "正在新增" : "新增种猫"}
              </SmallButton>
            }
          />
          <DesktopTable
            columns={["名字", "分类", "状态", "颜色", "繁育状态", "可见性", "关联", "操作"]}
          >
            {studRecords.map((stud) => (
              <tr key={stud.id} className="text-card-foreground">
                <td className="px-3 py-2.5 font-semibold text-heading">{stud.name}</td>
                <td className="px-3 py-2.5">{stud.category}</td>
                <td className="px-3 py-2.5">{stud.status || "未填写"}</td>
                <td className="px-3 py-2.5">{stud.color || "未填写"}</td>
                <td className="px-3 py-2.5">{reproductiveStateLabel(stud.reproductiveState)}</td>
                <td className="px-3 py-2.5">
                  <VisibilityBadge visibility={stud.visibility} />
                </td>
                <td className="px-3 py-2.5">
                  小猫 {stud.linkedKittenCount} / 窝次 {stud.linkedLitterCount} / 动态{" "}
                  {stud.linkedPostCount}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <SmallButton tone="quiet" onClick={() => openStudDetail(stud)}>
                      查看
                    </SmallButton>
                    <SmallButton tone="quiet" onClick={() => openStudEditor(stud)}>
                      编辑
                    </SmallButton>
                    <SmallButton
                      tone="quiet"
                      onClick={() =>
                        setStudVisibility(
                          stud.id,
                          stud.visibility === "hidden" ? "visible" : "hidden",
                        )
                      }
                    >
                      {stud.visibility === "hidden" ? "显示" : "隐藏"}
                    </SmallButton>
                    <SmallButton
                      tone="danger"
                      onClick={() => {
                        const nextVisibility =
                          stud.visibility === "archived" ? "visible" : "archived";
                        if (
                          !confirm(
                            nextVisibility === "archived"
                              ? `确定将 ${stud.name} 设为归档吗？`
                              : `确定恢复 ${stud.name} 吗？`,
                          )
                        ) {
                          return;
                        }
                        setStudVisibility(stud.id, nextVisibility);
                      }}
                    >
                      {stud.visibility === "archived" ? "恢复" : "归档"}
                    </SmallButton>
                  </div>
                </td>
              </tr>
            ))}
          </DesktopTable>
          <div className="md:hidden">
            {studRecords.map((stud) => (
              <MobileItem
                key={stud.id}
                title={stud.name}
                meta={`${stud.category} · ${stud.status || "未填写状态"} · ${visibilityLabel(stud.visibility)}`}
                actions={
                  <div className="flex flex-wrap gap-1.5">
                    <SmallButton tone="quiet" onClick={() => openStudDetail(stud)}>
                      查看
                    </SmallButton>
                    <SmallButton tone="quiet" onClick={() => openStudEditor(stud)}>
                      编辑
                    </SmallButton>
                  </div>
                }
              >
                <span>颜色：{stud.color || "未填写"}</span>
                <span>繁育状态：{reproductiveStateLabel(stud.reproductiveState)}</span>
                <span>
                  关联：小猫 {stud.linkedKittenCount} / 窝次 {stud.linkedLitterCount} / 动态{" "}
                  {stud.linkedPostCount}
                </span>
              </MobileItem>
            ))}
          </div>
        </PanelCard>
      </section>

      <section className={cn(mode === "idle" ? "hidden md:block" : "")}>
        {mode === "view" && selectedStud ? (
          <StudDetailCard
            stud={selectedStud}
            onEdit={() => openStudEditor(selectedStud)}
            onBack={() => setMode("idle")}
            onSetVisibility={(visibility) => setStudVisibility(selectedStud.id, visibility)}
          />
        ) : (
          <StudEditor
            mode={mode}
            draft={draft}
            onDraftChange={setDraft}
            onCancel={cancelEdit}
            onSave={saveStud}
            onNotice={onNotice}
            entityId={mode === "edit" ? selectedStudId : ""}
            onApplyImages={(next) => {
              const nextDraft = { ...draft, ...next };
              setDraft(nextDraft);
              if (mode !== "edit" || !selectedStudId) return true;
              return catteryActions.updateStud(selectedStudId, next, ADMIN_CONTEXT);
            }}
          />
        )}
      </section>
    </div>
  );
}

function StudDetailCard({
  stud,
  onEdit,
  onBack,
  onSetVisibility,
}: {
  stud: StudRecord;
  onEdit: () => void;
  onBack: () => void;
  onSetVisibility: (visibility: Visibility) => void;
}) {
  const imageIds = [stud.coverImageId, ...stud.galleryImageIds].filter(
    (imageId): imageId is string => Boolean(imageId),
  );
  const urls = useCatteryImageUrls(imageIds);
  const story = stud.story?.length ? stud.story : splitStory(stud.personality);

  return (
    <PanelCard>
      <PanelHeader
        title={`${stud.name} 详情`}
        desc="后台可查看当前资料、图片和被关联情况；普通用户端只展示 visible 的种猫。"
        action={
          <SmallButton tone="quiet" onClick={onBack}>
            返回列表
          </SmallButton>
        }
      />
      <div className="space-y-3 px-3 py-3 lg:px-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
          <ImagePreview
            imageUrl={stud.coverImageId ? urls[stud.coverImageId] : undefined}
            label="暂无封面"
          />
          <div className="space-y-2">
            <FieldLine label="分类" value={stud.category} />
            <FieldLine label="身份" value={stud.role || "未填写"} />
            <FieldLine label="状态" value={stud.status || "未填写"} />
            <FieldLine label="繁育状态" value={reproductiveStateLabel(stud.reproductiveState)} />
            <FieldLine label="颜色" value={stud.color || "未填写"} />
            <FieldLine label="生日" value={stud.birthday || "未填写"} />
            <FieldLine label="性别" value={stud.gender || "未填写"} />
            <FieldLine label="来源 / 血线" value={stud.source || "未填写"} />
            <FieldLine label="一句话介绍" value={stud.trait || "未填写"} />
            <FieldLine
              label="关联情况"
              value={`小猫 ${stud.linkedKittenCount} / 窝次 ${stud.linkedLitterCount} / 动态 ${stud.linkedPostCount}`}
            />
            <FieldLine label="可见性" value={visibilityLabel(stud.visibility)} />
          </div>
        </div>

        <div className="rounded-[10px] border border-border/80 bg-card px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-heading">相册</p>
            <span className="text-[11px] text-muted-foreground">
              {stud.galleryImageIds.length} 张
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stud.galleryImageIds.length === 0 && (
              <div className="col-span-2 rounded-[8px] border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                暂无相册图片
              </div>
            )}
            {stud.galleryImageIds.map((imageId, index) => (
              <ImagePreview
                key={imageId}
                imageUrl={urls[imageId]}
                label={`相册 ${index + 1}`}
                compact
              />
            ))}
          </div>
        </div>

        <TextBlock label="性格" value={stud.personality} />
        <StoryBlock story={story} />

        <div className="flex flex-wrap gap-2">
          <SmallButton onClick={onEdit}>编辑资料</SmallButton>
          <SmallButton
            tone="quiet"
            onClick={() => onSetVisibility(stud.visibility === "hidden" ? "visible" : "hidden")}
          >
            {stud.visibility === "hidden" ? "改为显示" : "改为隐藏"}
          </SmallButton>
          <SmallButton
            tone="danger"
            onClick={() => onSetVisibility(stud.visibility === "archived" ? "visible" : "archived")}
          >
            {stud.visibility === "archived" ? "恢复种猫" : "归档种猫"}
          </SmallButton>
        </div>
      </div>
    </PanelCard>
  );
}

function StudEditor({
  mode,
  draft,
  onDraftChange,
  onCancel,
  onSave,
  onNotice,
  entityId,
  onApplyImages,
}: {
  mode: StudPanelMode;
  draft: StudDraft;
  onDraftChange: (draft: StudDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  onNotice: (message: string) => void;
  entityId: string;
  onApplyImages: (next: { coverImageId?: string; galleryImageIds: string[] }) => boolean;
}) {
  if (mode === "idle") {
    return (
      <EmptyEditorCard
        title="种猫面板"
        desc="从左侧选择一只种猫查看详情，或点击“新增种猫”创建新记录。"
      />
    );
  }

  return (
    <PanelCard>
      <PanelHeader
        title={mode === "create" ? "新增种猫" : "编辑种猫"}
        desc="保存后写入 cattery-store，本地刷新后仍会保留。种猫永久删除本轮不开放，使用 hidden / archived 控制。"
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
            label="分类"
            value={draft.category}
            options={STUD_CATEGORY_OPTIONS}
            onChange={(category) => onDraftChange({ ...draft, category: category as StudCategory })}
          />
          <SelectField
            label="繁育状态"
            value={draft.reproductiveState}
            options={REPRODUCTIVE_STATE_OPTIONS}
            onChange={(reproductiveState) =>
              onDraftChange({
                ...draft,
                reproductiveState: reproductiveState as StudFields["reproductiveState"],
              })
            }
          />
          <TextField
            label="身份"
            value={draft.role}
            onChange={(role) => onDraftChange({ ...draft, role })}
          />
          <TextField
            label="状态"
            value={draft.status}
            required
            onChange={(status) => onDraftChange({ ...draft, status })}
          />
          <SelectField
            label="性别"
            value={draft.gender}
            options={[
              { value: "", label: "未填写" },
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
            label="出生日期"
            value={draft.birthday}
            type="date"
            onChange={(birthday) => onDraftChange({ ...draft, birthday })}
          />
          <TextField
            label="来源 / 血线"
            value={draft.source}
            onChange={(source) => onDraftChange({ ...draft, source })}
          />
        </div>

        <TextAreaField
          label="一句话介绍"
          value={draft.trait}
          rows={3}
          onChange={(trait) => onDraftChange({ ...draft, trait })}
        />
        <TextAreaField
          label="性格"
          value={draft.personality}
          rows={3}
          onChange={(personality) => onDraftChange({ ...draft, personality })}
        />
        <TextAreaField
          label="故事 / 介绍"
          value={draft.storyText}
          rows={6}
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
            保存种猫
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
    onNotice("请先保存当前种猫，再上传封面或相册。");
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
          封面和相册都写入 IndexedDB；替换和删除会清理对应 Blob。
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

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-card-foreground">{value}</span>
    </div>
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

function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-[10px] border border-border/80 bg-card px-3 py-3">
      <p className="text-[12px] font-semibold text-heading">{label}</p>
      <p className="mt-2 whitespace-pre-line text-[12.5px] leading-relaxed text-card-foreground">
        {value}
      </p>
    </div>
  );
}

function StoryBlock({ story }: { story?: string[] }) {
  if (!story?.length) return null;
  return (
    <div className="rounded-[10px] border border-border/80 bg-card px-3 py-3">
      <p className="text-[12px] font-semibold text-heading">故事 / 介绍</p>
      <div className="mt-2 space-y-2">
        {story.map((paragraph, index) => (
          <p
            key={`${index}-${paragraph}`}
            className="text-[12.5px] leading-relaxed text-card-foreground"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
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

function createEmptyStudDraft(): StudDraft {
  return {
    name: "",
    gender: "弟弟",
    color: "",
    birthday: "",
    personality: "",
    storyText: "",
    role: "",
    category: "现役公猫",
    status: "",
    trait: "",
    source: "",
    reproductiveState: "active",
    visibility: "visible",
    coverImageId: undefined,
    galleryImageIds: [],
  };
}

function createStudDraft(stud: StudRecord): StudDraft {
  return {
    name: stud.name,
    gender: stud.gender,
    color: stud.color,
    birthday: stud.birthday,
    personality: stud.personality,
    storyText: (stud.story ?? []).join("\n"),
    role: stud.role,
    category: stud.category,
    status: stud.status,
    trait: stud.trait,
    source: stud.source,
    reproductiveState: stud.reproductiveState,
    visibility: stud.visibility,
    coverImageId: stud.coverImageId,
    galleryImageIds: [...stud.galleryImageIds],
  };
}

function createStudPayload(draft: StudDraft, existing: CatteryCat | null) {
  return {
    name: draft.name.trim(),
    gender: optionalText(draft.gender),
    color: optionalText(draft.color),
    birthday: draft.birthday || undefined,
    personality: optionalText(draft.personality),
    story: splitStory(draft.storyText),
    coverImageId: draft.coverImageId,
    galleryImageIds: [...draft.galleryImageIds],
    visibility: draft.visibility,
    stud: {
      role: draft.role.trim(),
      category: draft.category,
      status: draft.status.trim(),
      trait: draft.trait.trim(),
      source: draft.source.trim(),
      reproductiveState: draft.reproductiveState,
    },
    updatedAt: existing?.updatedAt,
  } satisfies Partial<CatteryCat>;
}

function validateStudDraft(draft: StudDraft) {
  if (!draft.name.trim()) return "请填写种猫名字。";
  if (!draft.status.trim()) return "请填写种猫状态。";
  return "";
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
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

function reproductiveStateLabel(value: StudFields["reproductiveState"]) {
  switch (value) {
    case "active":
      return "现役";
    case "preparing":
      return "准备中";
    case "semiRetired":
      return "半退役";
    case "retired":
      return "退役";
    case "archived":
      return "已归档";
  }
}

function catterySnapshot() {
  return getCatteryDataSnapshot();
}
