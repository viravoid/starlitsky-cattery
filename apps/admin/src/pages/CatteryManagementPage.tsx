import type {
  CatData,
  CreateCatRequest,
  CreateLitterRequest,
  FixedPageData,
  LitterData,
  UpdateCatRequest,
  UpdateLitterRequest,
} from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveCat,
  createCat,
  createLitter,
  getCat,
  getLitter,
  listCats,
  listFixedPages,
  listLitters,
  updateCat,
  updateLitter,
} from "../api/cattery";
import { PageContainer } from "../components/PageContainer";
import { getErrorMessage } from "../utils/errors";
import { CatArchivePanel, LitterKittensPanel } from "./CatteryProfilePanels";
import { FixedPagesPanel } from "./FixedPagesPanel";
import { MediaManagementPanel } from "./MediaManagementPanel";

type SectionKey = "cats" | "litters" | "media" | "fixedPages";
type EditorMode = "create" | "edit" | null;

interface CatFormState {
  birthday: string;
  color: string;
  gender: string;
  lifecycleStatus: string;
  name: string;
  personality: string;
  visibility: string;
}

interface LitterFormState {
  birthDate: string;
  colorNote: string;
  expectedBirthDate: string;
  fatherCatId: string;
  motherCatId: string;
  name: string;
  note: string;
  status: string;
  visibility: string;
}

const CAT_STATUS_OPTIONS = [
  { label: "成长中", value: "growing" },
  { label: "繁育中", value: "breeding" },
  { label: "已退休", value: "retired" },
  { label: "已去新家", value: "adopted" },
  { label: "归档", value: "archived" },
];

const LITTER_STATUS_OPTIONS = [
  { label: "计划中", value: "planned" },
  { label: "已出生", value: "born" },
  { label: "观察中", value: "evaluating" },
  { label: "已完成", value: "completed" },
  { label: "归档", value: "archived" },
];

const VISIBILITY_OPTIONS = [
  { label: "可见", value: "visible" },
  { label: "隐藏", value: "hidden" },
  { label: "归档", value: "archived" },
];

const GENDER_OPTIONS = [
  { label: "未设置", value: "" },
  { label: "公", value: "male" },
  { label: "母", value: "female" },
  { label: "未知", value: "unknown" },
];

const DEFAULT_CAT_FORM: CatFormState = {
  birthday: "",
  color: "",
  gender: "",
  lifecycleStatus: "growing",
  name: "",
  personality: "",
  visibility: "visible",
};

const DEFAULT_LITTER_FORM: LitterFormState = {
  birthDate: "",
  colorNote: "",
  expectedBirthDate: "",
  fatherCatId: "",
  motherCatId: "",
  name: "",
  note: "",
  status: "planned",
  visibility: "visible",
};

export function CatteryManagementPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>(getSectionFromHash());
  const [cats, setCats] = useState<CatData[]>([]);
  const [fixedPages, setFixedPages] = useState<FixedPageData[]>([]);
  const [litters, setLitters] = useState<LitterData[]>([]);
  const [selectedCat, setSelectedCat] = useState<CatData | null>(null);
  const [selectedLitter, setSelectedLitter] = useState<LitterData | null>(null);
  const [catEditorMode, setCatEditorMode] = useState<EditorMode>(null);
  const [litterEditorMode, setLitterEditorMode] = useState<EditorMode>(null);
  const [catForm, setCatForm] = useState<CatFormState>(DEFAULT_CAT_FORM);
  const [litterForm, setLitterForm] = useState<LitterFormState>(DEFAULT_LITTER_FORM);
  const [includeArchivedCats, setIncludeArchivedCats] = useState(false);
  const [includeArchivedLitters, setIncludeArchivedLitters] = useState(false);
  const [confirmingArchiveCatId, setConfirmingArchiveCatId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeCats = useMemo(() => cats.filter((cat) => !cat.deletedAt), [cats]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [catList, litterList, fixedPageList] = await Promise.all([
        listCats({
          includeDeleted: includeArchivedCats,
          pageSize: 100,
        }),
        listLitters({
          includeDeleted: includeArchivedLitters,
          pageSize: 100,
        }),
        listFixedPages(),
      ]);

      setCats(catList.items);
      setFixedPages(fixedPageList);
      setLitters(litterList.items);
      setSelectedCat((current) =>
        current ? (catList.items.find((cat) => cat.id === current.id) ?? null) : null,
      );
      setSelectedLitter((current) =>
        current ? (litterList.items.find((litter) => litter.id === current.id) ?? null) : null,
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [includeArchivedCats, includeArchivedLitters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function handleHashChange() {
      setActiveSection(getSectionFromHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function openCreateCat() {
    setActiveSection("cats");
    setSelectedCat(null);
    setCatForm(DEFAULT_CAT_FORM);
    setCatEditorMode("create");
    setConfirmingArchiveCatId("");
    setNotice("");
    setError("");
  }

  function openEditCat(cat: CatData) {
    setActiveSection("cats");
    setSelectedCat(cat);
    setCatForm(toCatForm(cat));
    setCatEditorMode("edit");
    setConfirmingArchiveCatId("");
    setNotice("");
    setError("");
  }

  async function selectCat(cat: CatData) {
    setActiveSection("cats");
    setCatEditorMode(null);
    setConfirmingArchiveCatId("");
    setNotice("");
    setError("");

    try {
      setSelectedCat(await getCat(cat.id));
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function handleCatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = toCatPayload(catForm);
      const savedCat =
        catEditorMode === "edit" && selectedCat
          ? await updateCat(selectedCat.id, payload)
          : await createCat(payload as CreateCatRequest);

      setSelectedCat(savedCat);
      setCatEditorMode(null);
      setNotice(catEditorMode === "edit" ? "猫咪资料已更新" : "猫咪已新增");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchiveCat(cat: CatData) {
    if (confirmingArchiveCatId !== cat.id) {
      setConfirmingArchiveCatId(cat.id);
      setNotice(`再次点击「确认归档」以归档 ${cat.name}`);
      return;
    }

    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const archivedCat = await archiveCat(cat.id);
      setSelectedCat(archivedCat);
      setCatEditorMode(null);
      setConfirmingArchiveCatId("");
      setNotice("猫咪已归档");
      await loadData();
    } catch (archiveError) {
      setError(getErrorMessage(archiveError));
    } finally {
      setIsSaving(false);
    }
  }

  function openCreateLitter() {
    setActiveSection("litters");
    setSelectedLitter(null);
    setLitterForm({
      ...DEFAULT_LITTER_FORM,
      fatherCatId: activeCats[0]?.id ?? "",
      motherCatId: activeCats[1]?.id ?? "",
    });
    setLitterEditorMode("create");
    setNotice("");
    setError("");
  }

  function openEditLitter(litter: LitterData) {
    setActiveSection("litters");
    setSelectedLitter(litter);
    setLitterForm(toLitterForm(litter));
    setLitterEditorMode("edit");
    setNotice("");
    setError("");
  }

  async function selectLitter(litter: LitterData) {
    setActiveSection("litters");
    setLitterEditorMode(null);
    setNotice("");
    setError("");

    try {
      setSelectedLitter(await getLitter(litter.id));
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function handleLitterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = toLitterPayload(litterForm);
      const savedLitter =
        litterEditorMode === "edit" && selectedLitter
          ? await updateLitter(selectedLitter.id, payload)
          : await createLitter(payload as CreateLitterRequest);

      setSelectedLitter(savedLitter);
      setLitterEditorMode(null);
      setNotice(litterEditorMode === "edit" ? "窝次资料已更新" : "窝次已新增");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Cattery Data</p>
          <h2>猫咪与窝次管理</h2>
          <p className="muted compact">通过 Admin API 管理基础猫咪档案和窝次资料。</p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={loadData}>
            刷新
          </button>
          <button type="button" onClick={openCreateCat}>
            新增猫
          </button>
          <button type="button" onClick={openCreateLitter}>
            新增窝次
          </button>
          <button type="button" onClick={() => setActiveSection("media")}>
            媒体管理
          </button>
          <button type="button" onClick={() => setActiveSection("fixedPages")}>
            固定页面
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="管理模块">
        <button
          aria-selected={activeSection === "cats"}
          className={activeSection === "cats" ? "active-tab" : ""}
          type="button"
          onClick={() => setActiveSection("cats")}
        >
          猫列表
        </button>
        <button
          aria-selected={activeSection === "litters"}
          className={activeSection === "litters" ? "active-tab" : ""}
          type="button"
          onClick={() => setActiveSection("litters")}
        >
          窝次列表
        </button>
        <button
          aria-selected={activeSection === "media"}
          className={activeSection === "media" ? "active-tab" : ""}
          type="button"
          onClick={() => setActiveSection("media")}
        >
          媒体列表
        </button>
        <button
          aria-selected={activeSection === "fixedPages"}
          className={activeSection === "fixedPages" ? "active-tab" : ""}
          type="button"
          onClick={() => setActiveSection("fixedPages")}
        >
          固定页面
        </button>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {activeSection === "fixedPages" ? (
        <FixedPagesPanel isLoading={isLoading} pages={fixedPages} onReload={loadData} />
      ) : activeSection === "media" ? (
        <MediaManagementPanel
          cats={activeCats}
          fixedPages={fixedPages}
          litters={litters.filter((litter) => !litter.deletedAt)}
        />
      ) : activeSection === "cats" ? (
        <CatManagementSection
          cats={cats}
          confirmingArchiveCatId={confirmingArchiveCatId}
          editorMode={catEditorMode}
          form={catForm}
          includeArchived={includeArchivedCats}
          isLoading={isLoading}
          isSaving={isSaving}
          litters={litters}
          selectedCat={selectedCat}
          onArchive={handleArchiveCat}
          onCancelEditor={() => setCatEditorMode(null)}
          onCreate={openCreateCat}
          onEdit={openEditCat}
          onFormChange={setCatForm}
          onIncludeArchivedChange={setIncludeArchivedCats}
          onSelect={selectCat}
          onSubmit={handleCatSubmit}
        />
      ) : (
        <LitterManagementSection
          cats={activeCats}
          editorMode={litterEditorMode}
          form={litterForm}
          includeArchived={includeArchivedLitters}
          isLoading={isLoading}
          isSaving={isSaving}
          litters={litters}
          selectedLitter={selectedLitter}
          onCancelEditor={() => setLitterEditorMode(null)}
          onCreate={openCreateLitter}
          onEdit={openEditLitter}
          onFormChange={setLitterForm}
          onIncludeArchivedChange={setIncludeArchivedLitters}
          onSelect={selectLitter}
          onSubmit={handleLitterSubmit}
        />
      )}
    </PageContainer>
  );
}

function CatManagementSection({
  cats,
  confirmingArchiveCatId,
  editorMode,
  form,
  includeArchived,
  isLoading,
  isSaving,
  litters,
  selectedCat,
  onArchive,
  onCancelEditor,
  onCreate,
  onEdit,
  onFormChange,
  onIncludeArchivedChange,
  onSelect,
  onSubmit,
}: {
  cats: CatData[];
  confirmingArchiveCatId: string;
  editorMode: EditorMode;
  form: CatFormState;
  includeArchived: boolean;
  isLoading: boolean;
  isSaving: boolean;
  litters: LitterData[];
  selectedCat: CatData | null;
  onArchive: (cat: CatData) => void;
  onCancelEditor: () => void;
  onCreate: () => void;
  onEdit: (cat: CatData) => void;
  onFormChange: (form: CatFormState) => void;
  onIncludeArchivedChange: (value: boolean) => void;
  onSelect: (cat: CatData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="management-grid">
      <section className="table-panel" aria-label="猫列表">
        <div className="section-heading">
          <div>
            <h3>猫列表</h3>
            <p className="muted compact">当前 {cats.length} 条记录</p>
          </div>
          <label className="toggle-row">
            <input
              checked={includeArchived}
              type="checkbox"
              onChange={(event) => onIncludeArchivedChange(event.target.checked)}
            />
            显示归档
          </label>
        </div>
        {isLoading ? (
          <div className="empty-state">正在加载猫咪资料...</div>
        ) : cats.length === 0 ? (
          <div className="empty-state">
            暂无猫咪资料
            <button type="button" onClick={onCreate}>
              新增第一只猫
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>名字</th>
                  <th>性别</th>
                  <th>颜色</th>
                  <th>状态</th>
                  <th>可见性</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((cat) => (
                  <tr key={cat.id} className={cat.deletedAt ? "archived-row" : ""}>
                    <td>
                      <button className="link-button" type="button" onClick={() => onSelect(cat)}>
                        {cat.name}
                      </button>
                    </td>
                    <td>{formatGender(cat.gender)}</td>
                    <td>{cat.color || "-"}</td>
                    <td>{formatOption(cat.lifecycleStatus, CAT_STATUS_OPTIONS)}</td>
                    <td>{formatOption(cat.visibility, VISIBILITY_OPTIONS)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="secondary-button small-button"
                          type="button"
                          onClick={() => onEdit(cat)}
                        >
                          编辑
                        </button>
                        {!cat.deletedAt ? (
                          <button
                            className="danger-button small-button"
                            type="button"
                            onClick={() => onArchive(cat)}
                          >
                            {confirmingArchiveCatId === cat.id ? "确认归档" : "归档"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="detail-panel" aria-label="猫详情">
        {editorMode ? (
          <CatForm
            form={form}
            isSaving={isSaving}
            mode={editorMode}
            onCancel={onCancelEditor}
            onChange={onFormChange}
            onSubmit={onSubmit}
          />
        ) : selectedCat ? (
          <div className="detail-stack">
            <CatDetail
              cat={selectedCat}
              confirmingArchiveCatId={confirmingArchiveCatId}
              onArchive={onArchive}
              onEdit={onEdit}
            />
            <CatArchivePanel cat={selectedCat} litters={litters} />
          </div>
        ) : (
          <div className="empty-state">选择一只猫查看详情，或新增猫咪资料。</div>
        )}
      </aside>
    </div>
  );
}

function LitterManagementSection({
  cats,
  editorMode,
  form,
  includeArchived,
  isLoading,
  isSaving,
  litters,
  selectedLitter,
  onCancelEditor,
  onCreate,
  onEdit,
  onFormChange,
  onIncludeArchivedChange,
  onSelect,
  onSubmit,
}: {
  cats: CatData[];
  editorMode: EditorMode;
  form: LitterFormState;
  includeArchived: boolean;
  isLoading: boolean;
  isSaving: boolean;
  litters: LitterData[];
  selectedLitter: LitterData | null;
  onCancelEditor: () => void;
  onCreate: () => void;
  onEdit: (litter: LitterData) => void;
  onFormChange: (form: LitterFormState) => void;
  onIncludeArchivedChange: (value: boolean) => void;
  onSelect: (litter: LitterData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="management-grid">
      <section className="table-panel" aria-label="窝次列表">
        <div className="section-heading">
          <div>
            <h3>窝次列表</h3>
            <p className="muted compact">当前 {litters.length} 条记录</p>
          </div>
          <label className="toggle-row">
            <input
              checked={includeArchived}
              type="checkbox"
              onChange={(event) => onIncludeArchivedChange(event.target.checked)}
            />
            显示归档
          </label>
        </div>
        {isLoading ? (
          <div className="empty-state">正在加载窝次资料...</div>
        ) : litters.length === 0 ? (
          <div className="empty-state">
            暂无窝次资料
            <button type="button" onClick={onCreate}>
              新增第一个窝次
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>窝次</th>
                  <th>父亲</th>
                  <th>母亲</th>
                  <th>状态</th>
                  <th>预产/出生</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {litters.map((litter) => (
                  <tr key={litter.id} className={litter.deletedAt ? "archived-row" : ""}>
                    <td>
                      <button
                        className="link-button"
                        type="button"
                        onClick={() => onSelect(litter)}
                      >
                        {litter.name}
                      </button>
                    </td>
                    <td>{litter.fatherCat?.name ?? litter.fatherCatId}</td>
                    <td>{litter.motherCat?.name ?? litter.motherCatId}</td>
                    <td>{formatOption(litter.status, LITTER_STATUS_OPTIONS)}</td>
                    <td>{formatDate(litter.birthDate || litter.expectedBirthDate)}</td>
                    <td>
                      <button
                        className="secondary-button small-button"
                        type="button"
                        onClick={() => onEdit(litter)}
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="detail-panel" aria-label="窝次详情">
        {editorMode ? (
          <LitterForm
            cats={cats}
            form={form}
            isSaving={isSaving}
            mode={editorMode}
            onCancel={onCancelEditor}
            onChange={onFormChange}
            onSubmit={onSubmit}
          />
        ) : selectedLitter ? (
          <div className="detail-stack">
            <LitterDetail litter={selectedLitter} onEdit={onEdit} />
            <LitterKittensPanel cats={cats} litter={selectedLitter} />
          </div>
        ) : (
          <div className="empty-state">选择一个窝次查看详情，或新增窝次资料。</div>
        )}
      </aside>
    </div>
  );
}

function CatForm({
  form,
  isSaving,
  mode,
  onCancel,
  onChange,
  onSubmit,
}: {
  form: CatFormState;
  isSaving: boolean;
  mode: Exclude<EditorMode, null>;
  onCancel: () => void;
  onChange: (form: CatFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">{mode === "edit" ? "Edit Cat" : "New Cat"}</p>
        <h3>{mode === "edit" ? "编辑猫咪" : "新增猫咪"}</h3>
      </div>
      <label>
        名字
        <input
          aria-label="名字"
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </label>
      <div className="form-grid">
        <label>
          性别
          <select
            aria-label="性别"
            value={form.gender}
            onChange={(event) => onChange({ ...form, gender: event.target.value })}
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          生日
          <input
            aria-label="生日"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={form.birthday}
            onChange={(event) => onChange({ ...form, birthday: event.target.value })}
          />
        </label>
      </div>
      <label>
        颜色
        <input
          aria-label="颜色"
          value={form.color}
          onChange={(event) => onChange({ ...form, color: event.target.value })}
        />
      </label>
      <div className="form-grid">
        <label>
          生命周期
          <select
            aria-label="生命周期"
            value={form.lifecycleStatus}
            onChange={(event) => onChange({ ...form, lifecycleStatus: event.target.value })}
          >
            {CAT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          可见性
          <select
            aria-label="可见性"
            value={form.visibility}
            onChange={(event) => onChange({ ...form, visibility: event.target.value })}
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        性格备注
        <textarea
          aria-label="性格备注"
          rows={4}
          value={form.personality}
          onChange={(event) => onChange({ ...form, personality: event.target.value })}
        />
      </label>
      <FormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  );
}

function LitterForm({
  cats,
  form,
  isSaving,
  mode,
  onCancel,
  onChange,
  onSubmit,
}: {
  cats: CatData[];
  form: LitterFormState;
  isSaving: boolean;
  mode: Exclude<EditorMode, null>;
  onCancel: () => void;
  onChange: (form: LitterFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">{mode === "edit" ? "Edit Litter" : "New Litter"}</p>
        <h3>{mode === "edit" ? "编辑窝次" : "新增窝次"}</h3>
      </div>
      <label>
        窝次名称
        <input
          aria-label="窝次名称"
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
        />
      </label>
      <div className="form-grid">
        <label>
          父亲
          <select
            aria-label="父亲"
            required
            value={form.fatherCatId}
            onChange={(event) => onChange({ ...form, fatherCatId: event.target.value })}
          >
            <option value="">请选择</option>
            {cats.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          母亲
          <select
            aria-label="母亲"
            required
            value={form.motherCatId}
            onChange={(event) => onChange({ ...form, motherCatId: event.target.value })}
          >
            <option value="">请选择</option>
            {cats.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          预产期
          <input
            aria-label="预产期"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={form.expectedBirthDate}
            onChange={(event) => onChange({ ...form, expectedBirthDate: event.target.value })}
          />
        </label>
        <label>
          出生日
          <input
            aria-label="出生日"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={form.birthDate}
            onChange={(event) => onChange({ ...form, birthDate: event.target.value })}
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          状态
          <select
            aria-label="状态"
            value={form.status}
            onChange={(event) => onChange({ ...form, status: event.target.value })}
          >
            {LITTER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          可见性
          <select
            aria-label="窝次可见性"
            value={form.visibility}
            onChange={(event) => onChange({ ...form, visibility: event.target.value })}
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        颜色备注
        <input
          aria-label="颜色备注"
          value={form.colorNote}
          onChange={(event) => onChange({ ...form, colorNote: event.target.value })}
        />
      </label>
      <label>
        备注
        <textarea
          aria-label="备注"
          rows={4}
          value={form.note}
          onChange={(event) => onChange({ ...form, note: event.target.value })}
        />
      </label>
      <FormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  );
}

function FormActions({ isSaving, onCancel }: { isSaving: boolean; onCancel: () => void }) {
  return (
    <div className="form-actions">
      <button disabled={isSaving} type="submit">
        {isSaving ? "保存中..." : "保存"}
      </button>
      <button className="secondary-button" disabled={isSaving} type="button" onClick={onCancel}>
        取消
      </button>
    </div>
  );
}

function CatDetail({
  cat,
  confirmingArchiveCatId,
  onArchive,
  onEdit,
}: {
  cat: CatData;
  confirmingArchiveCatId: string;
  onArchive: (cat: CatData) => void;
  onEdit: (cat: CatData) => void;
}) {
  return (
    <div className="detail-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cat Detail</p>
          <h3>{cat.name}</h3>
        </div>
        <div className="table-actions">
          <button
            className="secondary-button small-button"
            type="button"
            onClick={() => onEdit(cat)}
          >
            编辑
          </button>
          {!cat.deletedAt ? (
            <button
              className="danger-button small-button"
              type="button"
              onClick={() => onArchive(cat)}
            >
              {confirmingArchiveCatId === cat.id ? "确认归档" : "归档"}
            </button>
          ) : null}
        </div>
      </div>
      <DescriptionList
        items={[
          ["性别", formatGender(cat.gender)],
          ["颜色", cat.color || "-"],
          ["生日", formatDate(cat.birthday)],
          ["生命周期", formatOption(cat.lifecycleStatus, CAT_STATUS_OPTIONS)],
          ["可见性", formatOption(cat.visibility, VISIBILITY_OPTIONS)],
          ["归档时间", formatDateTime(cat.deletedAt)],
          ["性格备注", cat.personality || "-"],
        ]}
      />
    </div>
  );
}

function LitterDetail({
  litter,
  onEdit,
}: {
  litter: LitterData;
  onEdit: (litter: LitterData) => void;
}) {
  return (
    <div className="detail-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Litter Detail</p>
          <h3>{litter.name}</h3>
        </div>
        <button
          className="secondary-button small-button"
          type="button"
          onClick={() => onEdit(litter)}
        >
          编辑
        </button>
      </div>
      <DescriptionList
        items={[
          ["父亲", litter.fatherCat?.name ?? litter.fatherCatId],
          ["母亲", litter.motherCat?.name ?? litter.motherCatId],
          ["状态", formatOption(litter.status, LITTER_STATUS_OPTIONS)],
          ["预产期", formatDate(litter.expectedBirthDate)],
          ["出生日", formatDate(litter.birthDate)],
          ["可见性", formatOption(litter.visibility, VISIBILITY_OPTIONS)],
          ["颜色备注", litter.colorNote || "-"],
          ["备注", litter.note || "-"],
        ]}
      />
    </div>
  );
}

function DescriptionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="description-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function toCatForm(cat: CatData): CatFormState {
  return {
    birthday: toDateInputValue(cat.birthday),
    color: cat.color ?? "",
    gender: cat.gender ?? "",
    lifecycleStatus: cat.lifecycleStatus,
    name: cat.name,
    personality: cat.personality ?? "",
    visibility: cat.visibility,
  };
}

function toCatPayload(form: CatFormState): CreateCatRequest | UpdateCatRequest {
  return {
    birthday: form.birthday || null,
    color: emptyToNull(form.color),
    gender: emptyToNull(form.gender),
    lifecycleStatus: form.lifecycleStatus,
    name: form.name.trim(),
    personality: emptyToNull(form.personality),
    visibility: form.visibility,
  };
}

function toLitterForm(litter: LitterData): LitterFormState {
  return {
    birthDate: toDateInputValue(litter.birthDate),
    colorNote: litter.colorNote ?? "",
    expectedBirthDate: toDateInputValue(litter.expectedBirthDate),
    fatherCatId: litter.fatherCatId,
    motherCatId: litter.motherCatId,
    name: litter.name,
    note: litter.note ?? "",
    status: litter.status,
    visibility: litter.visibility,
  };
}

function toLitterPayload(form: LitterFormState): CreateLitterRequest | UpdateLitterRequest {
  return {
    birthDate: form.birthDate || null,
    colorNote: emptyToNull(form.colorNote),
    expectedBirthDate: form.expectedBirthDate || null,
    fatherCatId: form.fatherCatId,
    motherCatId: form.motherCatId,
    name: form.name.trim(),
    note: emptyToNull(form.note),
    status: form.status,
    visibility: form.visibility,
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function formatGender(value: string | null) {
  if (!value) return "-";
  return formatOption(value, GENDER_OPTIONS);
}

function formatOption(value: string, options: Array<{ label: string; value: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return toDateInputValue(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function getSectionFromHash(): SectionKey {
  if (window.location.hash === "#litters") return "litters";
  if (window.location.hash === "#media") return "media";
  if (window.location.hash === "#fixed-pages") return "fixedPages";
  return "cats";
}
