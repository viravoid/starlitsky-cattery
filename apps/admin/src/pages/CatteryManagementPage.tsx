import type {
  BreedingCatProfileData,
  CatData,
  CatMediaAssetData,
  CreateCatRequest,
  CreateLitterRequest,
  FixedPageData,
  KittenProfileData,
  LitterData,
  MediaAssetData,
  ParentCatLinkData,
  UpdateCatRequest,
  UpdateLitterRequest,
} from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  archiveCat,
  archiveMediaBinding,
  createBreedingProfile,
  createCat,
  createCatWithBreedingProfile,
  createCatWithKittenProfile,
  createKittenProfile,
  createLitter,
  createMediaBinding,
  getCat,
  getLitter,
  listCatParentLinks,
  listCats,
  listFixedPages,
  listLitterKittens,
  listLitters,
  listMedia,
  updateBreedingProfile,
  updateCat,
  updateKittenProfile,
  updateLitter,
  updateMediaBinding,
  uploadCatImage,
  uploadLitterImage,
} from "../api/cattery";
import { PageContainer } from "../components/PageContainer";
import { mergeCatStoryTextFields, readCatStoryText } from "../utils/cat-story-json";
import { getErrorMessage } from "../utils/errors";
import { CommunityModerationPanel } from "./CommunityModerationPanel";
import { DashboardPage } from "./DashboardPage";
import { FixedPagesPanel } from "./FixedPagesPanel";
import { MediaManagementPanel } from "./MediaManagementPanel";
import { ParentApplicationsPanel } from "./ParentInvitationReviewPanel";
import { ParentUsersPanel } from "./ParentUsersPanel";
import { SelectionApplicationsPanel } from "./SelectionApplicationsPanel";

type SectionKey =
  | "dashboard"
  | "kittens"
  | "litters"
  | "studs"
  | "cats"
  | "media"
  | "fixedPages"
  | "communityModeration"
  | "communityComments"
  | "parentUsers"
  | "parentApplications"
  | "selectionApplications";
type EditorMode = "create" | "edit" | null;
type ImageUploadState = "idle" | "pending" | "uploading" | "uploaded";
type Visibility = "visible" | "hidden" | "archived";
type CoverEntry = "listCard" | "breedingPlanCard" | "communityProfile";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EntryCoverSelection {
  imageId: string;
  cropRect?: CropRect;
}

type EntryCoverSelections = Partial<Record<CoverEntry, EntryCoverSelection>>;
type DetailImagePresentations = Record<
  string,
  { mode: "original" } | { mode: "crop"; aspectRatio: number; cropRect: CropRect }
>;
type CoverPresentations = Partial<
  Record<
    CoverEntry | "detailHero",
    { objectPositionX: number; objectPositionY: number; zoom: number }
  >
>;
type DetailCarouselPresentations = Record<
  string,
  { objectPositionX: number; objectPositionY: number; zoom: number }
>;

interface ImagePresentation {
  entryCoverSelections?: EntryCoverSelections;
  coverPresentations?: CoverPresentations;
  detailImagePresentations?: DetailImagePresentations;
  detailCarouselPresentations?: DetailCarouselPresentations;
}

interface CatDraft {
  name: string;
  gender: string;
  color: string;
  birthday: string;
  lifecycleStatus: string;
  visibility: Visibility;
  personality: string;
  storyDetail: string;
  storyPersonality: string;
  diet: string;
  kittenLitterId: string;
  kittenSaleStatus: string;
  kittenPriceText: string;
  structureRatingRaw: string;
  breedingCategory: string;
  breedingReproductiveState: string;
  breedingStatusLabel: string;
  breedingTrait: string;
  breedingSource: string;
  breedingSortOrder: string;
  imagePresentation: ImagePresentation;
}

interface LitterDraft {
  birthDate: string;
  colorNote: string;
  expectedBirthDate: string;
  fatherCatId: string;
  motherCatId: string;
  name: string;
  note: string;
  possibleColorsRaw: string;
  status: string;
  visibility: Visibility;
}

const CAT_STATUS_OPTIONS = [
  { label: "成长中", value: "growing" },
  { label: "繁育中", value: "breeding" },
  { label: "已退休", value: "retired" },
  { label: "已去新家", value: "adopted" },
  { label: "归档", value: "archived" },
];

const KITTEN_STATUS_OPTIONS = [
  { label: "观察中", value: "evaluating" },
  { label: "找家中", value: "available" },
  { label: "已预定", value: "reserved" },
  { label: "已有家", value: "adopted" },
  { label: "保留观察", value: "hold" },
];

const LITTER_STATUS_OPTIONS = [
  { label: "计划中", value: "planned" },
  { label: "已出生", value: "born" },
  { label: "观察中", value: "evaluating" },
  { label: "已完成", value: "completed" },
  { label: "归档", value: "archived" },
];

const VISIBILITY_OPTIONS: Array<{ label: string; value: Visibility }> = [
  { label: "显示", value: "visible" },
  { label: "隐藏", value: "hidden" },
  { label: "归档", value: "archived" },
];

const GENDER_OPTIONS = [
  { label: "未设置", value: "" },
  { label: "公", value: "male" },
  { label: "母", value: "female" },
  { label: "未知", value: "unknown" },
];

const STUD_CATEGORY_OPTIONS = [
  { label: "现役公猫", value: "king" },
  { label: "现役母猫", value: "queen" },
  { label: "预备役种猫", value: "candidate" },
  { label: "退休种猫", value: "retired" },
];

const REPRODUCTIVE_STATE_OPTIONS = [
  { label: "现役", value: "active" },
  { label: "准备中", value: "preparing" },
  { label: "半退休", value: "semiRetired" },
  { label: "退休", value: "retired" },
  { label: "已归档", value: "archived" },
];

const COVER_ENTRY_META: Array<{ key: CoverEntry; label: string; ratio: string }> = [
  { key: "listCard", label: "列表封面", ratio: "16:10" },
  { key: "breedingPlanCard", label: "繁育计划", ratio: "1:1" },
  { key: "communityProfile", label: "家长档案", ratio: "4:3" },
];

const DEFAULT_CAT_DRAFT: CatDraft = {
  birthday: "",
  breedingCategory: "king",
  breedingReproductiveState: "active",
  breedingSortOrder: "0",
  breedingSource: "",
  breedingStatusLabel: "",
  breedingTrait: "",
  color: "",
  diet: "",
  gender: "",
  imagePresentation: {},
  kittenLitterId: "",
  kittenPriceText: "",
  kittenSaleStatus: "evaluating",
  lifecycleStatus: "growing",
  name: "",
  personality: "",
  storyDetail: "",
  storyPersonality: "",
  structureRatingRaw: "",
  visibility: "visible",
};

const DEFAULT_LITTER_DRAFT: LitterDraft = {
  birthDate: "",
  colorNote: "",
  expectedBirthDate: "",
  fatherCatId: "",
  motherCatId: "",
  name: "",
  note: "",
  possibleColorsRaw: "",
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
  const [catDraft, setCatDraft] = useState<CatDraft>(DEFAULT_CAT_DRAFT);
  const [catBaseline, setCatBaseline] = useState(serializeDraft(DEFAULT_CAT_DRAFT));
  const [litterDraft, setLitterDraft] = useState<LitterDraft>(DEFAULT_LITTER_DRAFT);
  const [litterBaseline, setLitterBaseline] = useState(serializeDraft(DEFAULT_LITTER_DRAFT));
  const [catImagesByCatId, setCatImagesByCatId] = useState<Record<string, MediaAssetData[]>>({});
  const [litterImagesByLitterId, setLitterImagesByLitterId] = useState<
    Record<string, MediaAssetData[]>
  >({});
  const [parentLinksByCatId, setParentLinksByCatId] = useState<Record<string, ParentCatLinkData[]>>(
    {},
  );
  const [litterKittensByLitterId, setLitterKittensByLitterId] = useState<
    Record<string, KittenProfileData[]>
  >({});
  const [catImagePreviewUrl, setCatImagePreviewUrl] = useState("");
  const [pendingCatImageFile, setPendingCatImageFile] = useState<File | null>(null);
  const [catImageUploadState, setCatImageUploadState] = useState<ImageUploadState>("idle");
  const [litterImagePreviewUrl, setLitterImagePreviewUrl] = useState("");
  const [pendingLitterImageFile, setPendingLitterImageFile] = useState<File | null>(null);
  const [litterImageUploadState, setLitterImageUploadState] = useState<ImageUploadState>("idle");
  const [includeArchivedCats, setIncludeArchivedCats] = useState(false);
  const [includeArchivedLitters, setIncludeArchivedLitters] = useState(false);
  const [confirmingArchiveCatId, setConfirmingArchiveCatId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const activeCats = useMemo(() => cats.filter((cat) => !cat.deletedAt), [cats]);
  const kittens = useMemo(() => cats.filter((cat) => cat.kittenProfile), [cats]);
  const studs = useMemo(() => cats.filter((cat) => cat.breedingProfile), [cats]);
  const generalCats = useMemo(
    () => cats.filter((cat) => !cat.kittenProfile && !cat.breedingProfile),
    [cats],
  );
  const selectedCatImages = selectedCat ? (catImagesByCatId[selectedCat.id] ?? []) : [];
  const selectedLitterImages = selectedLitter
    ? (litterImagesByLitterId[selectedLitter.id] ?? [])
    : [];
  const catDirty = catEditorMode
    ? serializeDraft(catDraft) !== catBaseline || Boolean(pendingCatImageFile)
    : false;
  const litterDirty = litterEditorMode
    ? serializeDraft(litterDraft) !== litterBaseline || Boolean(pendingLitterImageFile)
    : false;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [catList, litterList, fixedPageList] = await Promise.all([
        listCats({ includeDeleted: includeArchivedCats, pageSize: 200 }),
        listLitters({ includeDeleted: includeArchivedLitters, pageSize: 100 }),
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
    return () => {
      if (catImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(catImagePreviewUrl);
    };
  }, [catImagePreviewUrl]);

  useEffect(() => {
    return () => {
      if (litterImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(litterImagePreviewUrl);
    };
  }, [litterImagePreviewUrl]);

  useEffect(() => {
    function handleHashChange() {
      setActiveSection(getSectionFromHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function switchSection(section: SectionKey) {
    if ((catDirty || litterDirty) && !confirm("当前表单有未保存修改，确定切换模块吗？")) return;
    setActiveSection(section);
    setSelectedCat(null);
    setSelectedLitter(null);
    setCatEditorMode(null);
    setLitterEditorMode(null);
    setNotice("");
    setError("");
  }

  function openCreateCat(section: SectionKey) {
    if (catDirty && !confirm("当前猫咪表单有未保存修改，确定新建吗？")) return;
    setActiveSection(section);
    setSelectedCat(null);
    const next = createEmptyCatDraft(section);
    setCatDraft(next);
    setCatBaseline(serializeDraft(next));
    clearPendingCatImage();
    setCatEditorMode("create");
    setConfirmingArchiveCatId("");
    setNotice("");
    setError("");
  }

  async function openEditCat(cat: CatData, section: SectionKey) {
    if (
      catDirty &&
      selectedCat?.id !== cat.id &&
      !confirm("当前猫咪表单有未保存修改，确定切换吗？")
    )
      return;
    setActiveSection(section);
    setConfirmingArchiveCatId("");
    setNotice("");
    setError("");

    try {
      const [freshCat] = await Promise.all([getCat(cat.id), loadCatImages(cat.id)]);
      const links = await listCatParentLinksSafe(cat.id);
      setParentLinksByCatId((current) => ({ ...current, [cat.id]: links }));
      setSelectedCat(freshCat);
      const next = toCatDraft(freshCat);
      setCatDraft(next);
      setCatBaseline(serializeDraft(next));
      clearPendingCatImage();
      setCatEditorMode("edit");
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function selectCat(cat: CatData, section: SectionKey) {
    if (
      catDirty &&
      selectedCat?.id !== cat.id &&
      !confirm("当前猫咪表单有未保存修改，确定切换吗？")
    )
      return;
    setActiveSection(section);
    setCatEditorMode(null);
    setConfirmingArchiveCatId("");
    setNotice("");
    setError("");

    try {
      const [freshCat] = await Promise.all([getCat(cat.id), loadCatImages(cat.id)]);
      const links = await listCatParentLinksSafe(cat.id);
      setParentLinksByCatId((current) => ({ ...current, [cat.id]: links }));
      setSelectedCat(freshCat);
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function loadCatImages(catId: string) {
    const mediaList = await listMedia({
      kind: "image",
      ownerId: catId,
      ownerType: "cat",
      pageSize: 50,
      status: "active",
    });
    const sorted = sortMediaByBinding(mediaList.items, "cat", catId);
    setCatImagesByCatId((current) => ({ ...current, [catId]: sorted }));
    return sorted;
  }

  async function listCatParentLinksSafe(catId: string) {
    try {
      return await listCatParentLinks(catId);
    } catch {
      return [];
    }
  }

  function handleCatImageSelected(file: File | null) {
    clearPendingCatImage();
    if (!file) return;
    setPendingCatImageFile(file);
    setCatImagePreviewUrl(URL.createObjectURL(file));
    setCatImageUploadState("pending");
  }

  function clearPendingCatImage() {
    setPendingCatImageFile(null);
    setCatImagePreviewUrl((current) => {
      if (current.startsWith("blob:")) URL.revokeObjectURL(current);
      return "";
    });
    setCatImageUploadState("idle");
  }

  async function uploadPendingCatImage(catId: string) {
    if (!pendingCatImageFile) return null;
    setCatImageUploadState("uploading");
    const media = await uploadCatImage(catId, pendingCatImageFile);
    setPendingCatImageFile(null);
    setCatImagePreviewUrl(media.thumbnailUrl || media.sourceUrl);
    setCatImageUploadState("uploaded");
    await loadCatImages(catId);
    return media;
  }

  async function loadLitterImages(litterId: string) {
    const mediaList = await listMedia({
      kind: "image",
      ownerId: litterId,
      ownerType: "litter",
      pageSize: 50,
      status: "active",
    });
    const sorted = sortMediaByBinding(mediaList.items, "litter", litterId);
    setLitterImagesByLitterId((current) => ({ ...current, [litterId]: sorted }));
    return sorted;
  }

  async function loadLitterKittens(litterId: string) {
    try {
      const profiles = await listLitterKittens(litterId);
      setLitterKittensByLitterId((current) => ({ ...current, [litterId]: profiles }));
      return profiles;
    } catch {
      return [];
    }
  }

  function handleLitterImageSelected(file: File | null) {
    clearPendingLitterImage();
    if (!file) return;
    setPendingLitterImageFile(file);
    setLitterImagePreviewUrl(URL.createObjectURL(file));
    setLitterImageUploadState("pending");
  }

  function clearPendingLitterImage() {
    setPendingLitterImageFile(null);
    setLitterImagePreviewUrl((current) => {
      if (current.startsWith("blob:")) URL.revokeObjectURL(current);
      return "";
    });
    setLitterImageUploadState("idle");
  }

  async function uploadPendingLitterImage(litterId: string) {
    if (!pendingLitterImageFile) return null;
    setLitterImageUploadState("uploading");
    const media = await uploadLitterImage(litterId, pendingLitterImageFile);
    setPendingLitterImageFile(null);
    setLitterImagePreviewUrl(media.thumbnailUrl || media.sourceUrl);
    setLitterImageUploadState("uploaded");
    await loadLitterImages(litterId);
    return media;
  }

  async function handleCatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = toCatPayload(catDraft, selectedCat);
      let savedCat: CatData;

      if (catEditorMode === "edit" && selectedCat) {
        savedCat = await updateCat(selectedCat.id, payload);
      } else if (activeSection === "kittens") {
        savedCat = await createCatWithKittenProfile({
          cat: payload as CreateCatRequest,
          kittenProfile: toKittenProfilePayload(catDraft),
        });
      } else if (activeSection === "studs") {
        savedCat = await createCatWithBreedingProfile({
          breedingProfile: toBreedingProfilePayload(catDraft),
          cat: payload as CreateCatRequest,
        });
      } else {
        savedCat = await createCat(payload as CreateCatRequest);
      }

      if (catEditorMode === "edit" && activeSection === "kittens") {
        await saveKittenProfile(savedCat.id, catDraft, selectedCat?.kittenProfile ?? null);
      }
      if (catEditorMode === "edit" && activeSection === "studs") {
        await saveBreedingProfile(savedCat.id, catDraft, selectedCat?.breedingProfile ?? null);
      }
      if (pendingCatImageFile) {
        await uploadPendingCatImage(savedCat.id);
      } else {
        await loadCatImages(savedCat.id);
      }

      const fresh = await getCat(savedCat.id);
      setSelectedCat(fresh);
      const next = toCatDraft(fresh);
      setCatDraft(next);
      setCatBaseline(serializeDraft(next));
      setCatEditorMode("edit");
      setNotice(catEditorMode === "edit" ? "猫咪资料已更新" : "猫咪已新增");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveKittenProfile(
    catId: string,
    draft: CatDraft,
    existing: CatData["kittenProfile"],
  ) {
    const payload = toKittenProfilePayload(draft);
    if (existing) await updateKittenProfile(catId, payload);
    else await createKittenProfile(catId, payload);
  }

  async function saveBreedingProfile(
    catId: string,
    draft: CatDraft,
    existing: BreedingCatProfileData | null,
  ) {
    const payload = toBreedingProfilePayload(draft);
    if (existing) await updateBreedingProfile(catId, payload);
    else await createBreedingProfile(catId, payload);
  }

  async function handleArchiveCat(cat: CatData) {
    if (confirmingArchiveCatId !== cat.id) {
      setConfirmingArchiveCatId(cat.id);
      setNotice(`再次点击“确认归档”以归档 ${cat.name}`);
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
    if (litterDirty && !confirm("当前窝次表单有未保存修改，确定新建吗？")) return;
    setActiveSection("litters");
    setSelectedLitter(null);
    const next = {
      ...DEFAULT_LITTER_DRAFT,
      fatherCatId: activeCats.find((cat) => cat.gender === "male")?.id ?? activeCats[0]?.id ?? "",
      motherCatId:
        activeCats.find((cat) => cat.gender === "female")?.id ??
        activeCats.find((cat) => cat.id !== activeCats[0]?.id)?.id ??
        "",
    };
    setLitterDraft(next);
    setLitterBaseline(serializeDraft(next));
    clearPendingLitterImage();
    setLitterEditorMode("create");
    setNotice("");
    setError("");
  }

  async function openEditLitter(litter: LitterData) {
    if (
      litterDirty &&
      selectedLitter?.id !== litter.id &&
      !confirm("当前窝次表单有未保存修改，确定切换吗？")
    )
      return;
    setActiveSection("litters");
    setNotice("");
    setError("");
    try {
      const freshLitter = await getLitter(litter.id);
      setSelectedLitter(freshLitter);
      const next = toLitterDraft(freshLitter);
      setLitterDraft(next);
      setLitterBaseline(serializeDraft(next));
      clearPendingLitterImage();
      setLitterEditorMode("edit");
      await Promise.all([loadLitterImages(freshLitter.id), loadLitterKittens(freshLitter.id)]);
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function selectLitter(litter: LitterData) {
    if (
      litterDirty &&
      selectedLitter?.id !== litter.id &&
      !confirm("当前窝次表单有未保存修改，确定切换吗？")
    )
      return;
    setActiveSection("litters");
    setLitterEditorMode(null);
    setNotice("");
    setError("");
    try {
      const freshLitter = await getLitter(litter.id);
      setSelectedLitter(freshLitter);
      await Promise.all([loadLitterImages(freshLitter.id), loadLitterKittens(freshLitter.id)]);
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
      const payload = toLitterPayload(litterDraft);
      const savedLitter =
        litterEditorMode === "edit" && selectedLitter
          ? await updateLitter(selectedLitter.id, payload)
          : await createLitter(payload as CreateLitterRequest);

      setSelectedLitter(savedLitter);
      if (pendingLitterImageFile) await uploadPendingLitterImage(savedLitter.id);
      else await loadLitterImages(savedLitter.id);
      await loadLitterKittens(savedLitter.id);
      const next = toLitterDraft(savedLitter);
      setLitterDraft(next);
      setLitterBaseline(serializeDraft(next));
      setLitterEditorMode("edit");
      setNotice(litterEditorMode === "edit" ? "窝次资料已更新" : "窝次已新增");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function updateCatMediaBinding(
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) {
    if (!selectedCat) return;
    const binding = media.bindings.find(
      (item) => item.ownerType === "cat" && item.ownerId === selectedCat.id && !item.deletedAt,
    );
    setIsSaving(true);
    setError("");
    try {
      if (binding) {
        await updateMediaBinding(media.id, binding.id, patch);
      } else {
        await createMediaBinding(media.id, {
          ownerId: selectedCat.id,
          ownerType: "cat",
          sortOrder: patch.sortOrder ?? 0,
          usage: patch.usage ?? "gallery",
          visibility: patch.visibility ?? "visible",
        });
      }
      await loadCatImages(selectedCat.id);
      setNotice("图片绑定已更新");
    } catch (mediaError) {
      setError(getErrorMessage(mediaError));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeCatMediaBinding(media: MediaAssetData) {
    if (!selectedCat) return;
    const binding = media.bindings.find(
      (item) => item.ownerType === "cat" && item.ownerId === selectedCat.id && !item.deletedAt,
    );
    if (!binding) return;
    setIsSaving(true);
    setError("");
    try {
      await archiveMediaBinding(media.id, binding.id);
      await loadCatImages(selectedCat.id);
      setNotice("图片已从当前猫咪移除");
    } catch (mediaError) {
      setError(getErrorMessage(mediaError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      {activeSection !== "media" ? (
        <div className="toolbar">
          <div>
            <p className="eyebrow">Cattery Data</p>
            <h2>猫咪管理</h2>
            <p className="muted compact">Demo 管理体验接入真实 Admin API / SQLite / COS 媒体。</p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-button" type="button" onClick={loadData}>
              刷新
            </button>
            <button type="button" onClick={() => openCreateCat("kittens")}>
              新增小猫
            </button>
            <button type="button" onClick={openCreateLitter}>
              新增窝次
            </button>
            <button type="button" onClick={() => openCreateCat("studs")}>
              新增种猫
            </button>
          </div>
        </div>
      ) : null}

      {activeSection !== "media" ? (
        <div className="tabs" role="tablist" aria-label="管理模块">
          {[
            ["kittens", "小猫"],
            ["litters", "窝次"],
            ["studs", "种猫"],
            ["cats", "其它猫咪"],
            ["media", "媒体"],
            ["fixedPages", "固定页面"],
            ["communityModeration", "动态"],
            ["communityComments", "评论"],
            ["parentUsers", "家长"],
            ["parentApplications", "申请审核"],
            ["selectionApplications", "选猫问卷"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-selected={activeSection === key}
              className={activeSection === key ? "active-tab" : ""}
              type="button"
              onClick={() => switchSection(key as SectionKey)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {activeSection !== "media" && notice ? <div className="notice">{notice}</div> : null}
      {activeSection !== "media" && error ? <div className="error-banner">{error}</div> : null}
      {activeSection !== "media" && isLoading ? <p className="muted">正在加载真实数据...</p> : null}

      {activeSection === "dashboard" && <DashboardPage />}
      {activeSection === "kittens" && (
        <CatManagementWorkspace
          cats={kittens}
          catDraft={catDraft}
          catDirty={catDirty}
          catEditorMode={catEditorMode}
          confirmingArchiveCatId={confirmingArchiveCatId}
          imagePreviewUrl={catImagePreviewUrl}
          imageUploadState={catImageUploadState}
          includeArchived={includeArchivedCats}
          isSaving={isSaving}
          litters={litters}
          mode="kittens"
          parentLinks={selectedCat ? (parentLinksByCatId[selectedCat.id] ?? []) : []}
          selectedCat={selectedCat}
          selectedCatImages={selectedCatImages}
          onArchive={handleArchiveCat}
          onCancel={() => setCatEditorMode(null)}
          onChange={setCatDraft}
          onEdit={(cat) => openEditCat(cat, "kittens")}
          onImageChange={handleCatImageSelected}
          onMediaBindingChange={updateCatMediaBinding}
          onMediaBindingRemove={removeCatMediaBinding}
          onNew={() => openCreateCat("kittens")}
          onSelect={(cat) => selectCat(cat, "kittens")}
          onSubmit={handleCatSubmit}
          onToggleArchived={setIncludeArchivedCats}
        />
      )}
      {activeSection === "litters" && (
        <LitterWorkspace
          activeCats={activeCats}
          draft={litterDraft}
          editorMode={litterEditorMode}
          imagePreviewUrl={litterImagePreviewUrl}
          imageUploadState={litterImageUploadState}
          includeArchived={includeArchivedLitters}
          isSaving={isSaving}
          kittens={selectedLitter ? (litterKittensByLitterId[selectedLitter.id] ?? []) : []}
          litters={litters}
          selectedImages={selectedLitterImages}
          selectedLitter={selectedLitter}
          onCancel={() => setLitterEditorMode(null)}
          onChange={setLitterDraft}
          onEdit={openEditLitter}
          onImageChange={handleLitterImageSelected}
          onNew={openCreateLitter}
          onSelect={selectLitter}
          onSubmit={handleLitterSubmit}
          onToggleArchived={setIncludeArchivedLitters}
        />
      )}
      {activeSection === "studs" && (
        <CatManagementWorkspace
          cats={studs}
          catDraft={catDraft}
          catDirty={catDirty}
          catEditorMode={catEditorMode}
          confirmingArchiveCatId={confirmingArchiveCatId}
          imagePreviewUrl={catImagePreviewUrl}
          imageUploadState={catImageUploadState}
          includeArchived={includeArchivedCats}
          isSaving={isSaving}
          litters={litters}
          mode="studs"
          parentLinks={selectedCat ? (parentLinksByCatId[selectedCat.id] ?? []) : []}
          selectedCat={selectedCat}
          selectedCatImages={selectedCatImages}
          onArchive={handleArchiveCat}
          onCancel={() => setCatEditorMode(null)}
          onChange={setCatDraft}
          onEdit={(cat) => openEditCat(cat, "studs")}
          onImageChange={handleCatImageSelected}
          onMediaBindingChange={updateCatMediaBinding}
          onMediaBindingRemove={removeCatMediaBinding}
          onNew={() => openCreateCat("studs")}
          onSelect={(cat) => selectCat(cat, "studs")}
          onSubmit={handleCatSubmit}
          onToggleArchived={setIncludeArchivedCats}
        />
      )}
      {activeSection === "cats" && (
        <CatManagementWorkspace
          cats={generalCats}
          catDraft={catDraft}
          catDirty={catDirty}
          catEditorMode={catEditorMode}
          confirmingArchiveCatId={confirmingArchiveCatId}
          imagePreviewUrl={catImagePreviewUrl}
          imageUploadState={catImageUploadState}
          includeArchived={includeArchivedCats}
          isSaving={isSaving}
          litters={litters}
          mode="cats"
          parentLinks={selectedCat ? (parentLinksByCatId[selectedCat.id] ?? []) : []}
          selectedCat={selectedCat}
          selectedCatImages={selectedCatImages}
          onArchive={handleArchiveCat}
          onCancel={() => setCatEditorMode(null)}
          onChange={setCatDraft}
          onEdit={(cat) => openEditCat(cat, "cats")}
          onImageChange={handleCatImageSelected}
          onMediaBindingChange={updateCatMediaBinding}
          onMediaBindingRemove={removeCatMediaBinding}
          onNew={() => openCreateCat("cats")}
          onSelect={(cat) => selectCat(cat, "cats")}
          onSubmit={handleCatSubmit}
          onToggleArchived={setIncludeArchivedCats}
        />
      )}
      {activeSection === "media" && (
        <MediaManagementPanel cats={cats} fixedPages={fixedPages} litters={litters} />
      )}
      {activeSection === "fixedPages" && (
        <FixedPagesPanel isLoading={isLoading} pages={fixedPages} onReload={loadData} />
      )}
      {activeSection === "communityModeration" && <CommunityModerationPanel initialView="posts" />}
      {activeSection === "communityComments" && <CommunityModerationPanel initialView="comments" />}
      {activeSection === "parentUsers" && <ParentUsersPanel />}
      {activeSection === "parentApplications" && <ParentApplicationsPanel />}
      {activeSection === "selectionApplications" && <SelectionApplicationsPanel />}
    </PageContainer>
  );
}

function CatManagementWorkspace({
  cats,
  catDraft,
  catDirty,
  catEditorMode,
  confirmingArchiveCatId,
  imagePreviewUrl,
  imageUploadState,
  includeArchived,
  isSaving,
  litters,
  mode,
  parentLinks,
  selectedCat,
  selectedCatImages,
  onArchive,
  onCancel,
  onChange,
  onEdit,
  onImageChange,
  onMediaBindingChange,
  onMediaBindingRemove,
  onNew,
  onSelect,
  onSubmit,
  onToggleArchived,
}: {
  cats: CatData[];
  catDraft: CatDraft;
  catDirty: boolean;
  catEditorMode: EditorMode;
  confirmingArchiveCatId: string;
  imagePreviewUrl: string;
  imageUploadState: ImageUploadState;
  includeArchived: boolean;
  isSaving: boolean;
  litters: LitterData[];
  mode: "kittens" | "studs" | "cats";
  parentLinks: ParentCatLinkData[];
  selectedCat: CatData | null;
  selectedCatImages: MediaAssetData[];
  onArchive: (cat: CatData) => void;
  onCancel: () => void;
  onChange: (draft: CatDraft) => void;
  onEdit: (cat: CatData) => void;
  onImageChange: (file: File | null) => void;
  onMediaBindingChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onMediaBindingRemove: (media: MediaAssetData) => void;
  onNew: () => void;
  onSelect: (cat: CatData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleArchived: (value: boolean) => void;
}) {
  const title = mode === "kittens" ? "小猫管理" : mode === "studs" ? "种猫管理" : "其它猫咪";
  return (
    <section className="management-grid wide-detail">
      <div className="table-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {mode === "studs" ? "Studs" : mode === "kittens" ? "Kittens" : "Cats"}
            </p>
            <h3>{title}</h3>
          </div>
          <div className="table-actions">
            <label className="toggle-row">
              <input
                checked={includeArchived}
                type="checkbox"
                onChange={(event) => onToggleArchived(event.target.checked)}
              />
              显示归档
            </label>
            <button type="button" onClick={onNew}>
              新增
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>封面</th>
                <th>名字</th>
                <th>状态</th>
                {mode === "kittens" ? <th>窝次 / 父母</th> : null}
                {mode === "studs" ? <th>繁育角色</th> : null}
                <th>家长/归属</th>
                <th>可见性</th>
                <th>图片</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {cats.map((cat) => (
                <tr key={cat.id} className={cat.deletedAt ? "archived-row" : ""}>
                  <td>
                    <CatThumb cat={cat} />
                  </td>
                  <td>
                    <strong>{cat.name}</strong>
                    <br />
                    <span className="muted">{cat.color || "未填颜色"}</span>
                  </td>
                  <td>{formatCatStatus(cat, mode)}</td>
                  {mode === "kittens" ? (
                    <td>
                      {cat.kittenProfile?.litter?.name ?? "-"}
                      <br />
                      <span className="muted">
                        {cat.kittenProfile?.litter?.fatherCat?.name ?? "父未填"} /{" "}
                        {cat.kittenProfile?.litter?.motherCat?.name ?? "母未填"}
                      </span>
                    </td>
                  ) : null}
                  {mode === "studs" ? (
                    <td>
                      {cat.breedingProfile?.category ?? "-"}
                      <br />
                      <span className="muted">{cat.breedingProfile?.reproductiveState ?? "-"}</span>
                    </td>
                  ) : null}
                  <td>{formatParentOwnership(cat)}</td>
                  <td>{formatOption(cat.visibility, VISIBILITY_OPTIONS)}</td>
                  <td>{cat.mediaAssets.length}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="secondary-button small-button"
                        type="button"
                        onClick={() => onSelect(cat)}
                      >
                        查看
                      </button>
                      <button className="small-button" type="button" onClick={() => onEdit(cat)}>
                        编辑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="detail-panel" aria-label={`${title}详情`}>
        {catEditorMode ? (
          <CatEditor
            draft={catDraft}
            imagePreviewUrl={imagePreviewUrl}
            imageUploadState={imageUploadState}
            isDirty={catDirty}
            isSaving={isSaving}
            litters={litters}
            mode={mode}
            selectedCat={selectedCat}
            selectedCatImages={selectedCatImages}
            onCancel={onCancel}
            onChange={onChange}
            onImageChange={onImageChange}
            onMediaBindingChange={onMediaBindingChange}
            onMediaBindingRemove={onMediaBindingRemove}
            onSubmit={onSubmit}
          />
        ) : selectedCat ? (
          <CatDetail
            cat={selectedCat}
            confirmingArchiveCatId={confirmingArchiveCatId}
            images={selectedCatImages}
            parentLinks={parentLinks}
            onArchive={onArchive}
            onEdit={onEdit}
          />
        ) : (
          <div className="empty-state">
            <strong>选择一只猫查看详情</strong>
            <button type="button" onClick={onNew}>
              新增
            </button>
          </div>
        )}
      </aside>
    </section>
  );
}

function CatEditor({
  draft,
  imagePreviewUrl,
  imageUploadState,
  isDirty,
  isSaving,
  litters,
  mode,
  selectedCat,
  selectedCatImages,
  onCancel,
  onChange,
  onImageChange,
  onMediaBindingChange,
  onMediaBindingRemove,
  onSubmit,
}: {
  draft: CatDraft;
  imagePreviewUrl: string;
  imageUploadState: ImageUploadState;
  isDirty: boolean;
  isSaving: boolean;
  litters: LitterData[];
  mode: "kittens" | "studs" | "cats";
  selectedCat: CatData | null;
  selectedCatImages: MediaAssetData[];
  onCancel: () => void;
  onChange: (draft: CatDraft) => void;
  onImageChange: (file: File | null) => void;
  onMediaBindingChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onMediaBindingRemove: (media: MediaAssetData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{selectedCat ? "Edit Cat" : "New Cat"}</p>
          <h3>{mode === "kittens" ? "小猫档案" : mode === "studs" ? "种猫档案" : "猫咪档案"}</h3>
        </div>
        {isDirty ? <span className="status-badge status-pinned">未保存</span> : null}
      </div>
      <div className="editor-section-body">
        <h4>基础信息</h4>
        <label>
          名字
          <input
            required
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </label>
        <div className="form-grid">
          <SelectField
            label="性别"
            options={GENDER_OPTIONS}
            value={draft.gender}
            onChange={(value) => onChange({ ...draft, gender: value })}
          />
          <label>
            生日
            <input
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={draft.birthday}
              onChange={(event) => onChange({ ...draft, birthday: event.target.value })}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            颜色
            <input
              value={draft.color}
              onChange={(event) => onChange({ ...draft, color: event.target.value })}
            />
          </label>
          <SelectField
            label="生命周期"
            options={CAT_STATUS_OPTIONS}
            value={draft.lifecycleStatus}
            onChange={(value) => onChange({ ...draft, lifecycleStatus: value })}
          />
        </div>
        <SelectField
          label="可见性"
          options={VISIBILITY_OPTIONS}
          value={draft.visibility}
          onChange={(value) => onChange({ ...draft, visibility: value as Visibility })}
        />
      </div>

      {mode === "kittens" ? (
        <div className="editor-section-body">
          <h4>小猫与窝次</h4>
          <div className="form-grid">
            <SelectField
              label="所属窝次"
              options={[
                { label: "请选择窝次", value: "" },
                ...litters.map((litter) => ({ label: litter.name, value: litter.id })),
              ]}
              value={draft.kittenLitterId}
              onChange={(value) => onChange({ ...draft, kittenLitterId: value })}
            />
            <SelectField
              label="找家状态"
              options={KITTEN_STATUS_OPTIONS}
              value={draft.kittenSaleStatus}
              onChange={(value) => onChange({ ...draft, kittenSaleStatus: value })}
            />
          </div>
          <label>
            价格 / 说明
            <input
              value={draft.kittenPriceText}
              onChange={(event) => onChange({ ...draft, kittenPriceText: event.target.value })}
            />
          </label>
          <label>
            结构评分 JSON 或文本
            <textarea
              className="code-textarea"
              rows={4}
              value={draft.structureRatingRaw}
              onChange={(event) => onChange({ ...draft, structureRatingRaw: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      {mode === "studs" ? (
        <div className="editor-section-body">
          <h4>种猫信息</h4>
          <div className="form-grid">
            <SelectField
              label="分类 / 角色"
              options={STUD_CATEGORY_OPTIONS}
              value={draft.breedingCategory}
              onChange={(value) => onChange({ ...draft, breedingCategory: value })}
            />
            <SelectField
              label="繁育状态"
              options={REPRODUCTIVE_STATE_OPTIONS}
              value={draft.breedingReproductiveState}
              onChange={(value) => onChange({ ...draft, breedingReproductiveState: value })}
            />
          </div>
          <div className="form-grid">
            <label>
              状态文案
              <input
                value={draft.breedingStatusLabel}
                onChange={(event) =>
                  onChange({ ...draft, breedingStatusLabel: event.target.value })
                }
              />
            </label>
            <label>
              排序
              <input
                inputMode="numeric"
                value={draft.breedingSortOrder}
                onChange={(event) => onChange({ ...draft, breedingSortOrder: event.target.value })}
              />
            </label>
          </div>
          <label>
            特质
            <input
              value={draft.breedingTrait}
              onChange={(event) => onChange({ ...draft, breedingTrait: event.target.value })}
            />
          </label>
          <label>
            来源
            <input
              value={draft.breedingSource}
              onChange={(event) => onChange({ ...draft, breedingSource: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      <div className="editor-section-body">
        <h4>故事内容</h4>
        <label>
          性格备注
          <textarea
            rows={3}
            value={draft.personality}
            onChange={(event) => onChange({ ...draft, personality: event.target.value })}
          />
        </label>
        <label>
          storyJson.detail
          <textarea
            rows={4}
            value={draft.storyDetail}
            onChange={(event) => onChange({ ...draft, storyDetail: event.target.value })}
          />
        </label>
        <label>
          storyJson.personality
          <textarea
            rows={3}
            value={draft.storyPersonality}
            onChange={(event) => onChange({ ...draft, storyPersonality: event.target.value })}
          />
        </label>
        <label>
          storyJson.diet
          <textarea
            rows={3}
            value={draft.diet}
            onChange={(event) => onChange({ ...draft, diet: event.target.value })}
          />
        </label>
      </div>

      <CatImageManager
        draft={draft}
        imagePreviewUrl={imagePreviewUrl}
        imageUploadState={imageUploadState}
        images={selectedCatImages}
        isSaving={isSaving}
        mode={mode}
        onChange={onChange}
        onImageChange={onImageChange}
        onMediaBindingChange={onMediaBindingChange}
        onMediaBindingRemove={onMediaBindingRemove}
      />

      <FormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  );
}

function CatImageManager({
  draft,
  imagePreviewUrl,
  imageUploadState,
  images,
  isSaving,
  mode,
  onChange,
  onImageChange,
  onMediaBindingChange,
  onMediaBindingRemove,
}: {
  draft: CatDraft;
  imagePreviewUrl: string;
  imageUploadState: ImageUploadState;
  images: MediaAssetData[];
  isSaving: boolean;
  mode: "kittens" | "studs" | "cats";
  onChange: (draft: CatDraft) => void;
  onImageChange: (file: File | null) => void;
  onMediaBindingChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onMediaBindingRemove: (media: MediaAssetData) => void;
}) {
  const visibleImages = images.filter((media) =>
    media.bindings.some((binding) => binding.visibility === "visible"),
  );
  return (
    <div className="cat-image-uploader">
      <div className="subsection-heading">
        <h4>图片 / 封面 / 展示参数</h4>
        <span className={`upload-state upload-state-${imageUploadState}`}>
          {formatImageState(imageUploadState)}
        </span>
      </div>
      <label>
        上传新图片
        <input
          accept="image/*"
          disabled={isSaving}
          type="file"
          onChange={(event) => {
            onImageChange(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {imagePreviewUrl ? (
        <img alt="待上传图片预览" className="cat-image-preview" src={imagePreviewUrl} />
      ) : null}
      <MediaBindingEditor
        images={images}
        onChange={onMediaBindingChange}
        onRemove={onMediaBindingRemove}
      />
      <EntryCoverEditor
        entries={
          mode === "studs"
            ? ["listCard", "breedingPlanCard", "communityProfile"]
            : ["listCard", "communityProfile"]
        }
        images={visibleImages}
        value={draft.imagePresentation.entryCoverSelections}
        onChange={(entryCoverSelections) =>
          onChange({
            ...draft,
            imagePresentation: { ...draft.imagePresentation, entryCoverSelections },
          })
        }
      />
      <DetailPresentationEditor
        images={visibleImages}
        value={draft.imagePresentation.detailImagePresentations}
        onChange={(detailImagePresentations) =>
          onChange({
            ...draft,
            imagePresentation: { ...draft.imagePresentation, detailImagePresentations },
          })
        }
      />
    </div>
  );
}

function MediaBindingEditor({
  images,
  onChange,
  onRemove,
}: {
  images: MediaAssetData[];
  onChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onRemove: (media: MediaAssetData) => void;
}) {
  if (images.length === 0) return <div className="cat-image-placeholder">暂无已绑定图片</div>;
  return (
    <div className="image-gallery-editor">
      {images.map((media) => {
        const binding = media.bindings[0];
        return (
          <div className="image-gallery-row" key={media.id}>
            <img
              alt={media.altText || media.title || media.id}
              src={media.thumbnailUrl || media.sourceUrl}
            />
            <div className="form-grid">
              <label>
                用途
                <select
                  value={binding?.usage ?? "gallery"}
                  onChange={(event) => onChange(media, { usage: event.target.value })}
                >
                  <option value="cover">封面</option>
                  <option value="gallery">相册</option>
                </select>
              </label>
              <label>
                排序
                <input
                  inputMode="numeric"
                  value={binding?.sortOrder ?? 0}
                  onChange={(event) =>
                    onChange(media, { sortOrder: Number.parseInt(event.target.value, 10) || 0 })
                  }
                />
              </label>
              <label>
                可见性
                <select
                  value={binding?.visibility ?? "visible"}
                  onChange={(event) => onChange(media, { visibility: event.target.value })}
                >
                  <option value="visible">显示</option>
                  <option value="hidden">隐藏</option>
                  <option value="archived">归档</option>
                </select>
              </label>
              <button className="secondary-button" type="button" onClick={() => onRemove(media)}>
                移除绑定
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EntryCoverEditor({
  entries,
  images,
  value,
  onChange,
}: {
  entries: CoverEntry[];
  images: MediaAssetData[];
  value?: EntryCoverSelections;
  onChange: (value: EntryCoverSelections | undefined) => void;
}) {
  const [activeEntry, setActiveEntry] = useState<CoverEntry>(entries[0]);
  useEffect(() => {
    if (!entries.includes(activeEntry)) setActiveEntry(entries[0]);
  }, [activeEntry, entries]);
  const selection = value?.[activeEntry];
  const selectedImageId = selection?.imageId ?? images[0]?.id ?? "";
  const currentCrop = selection?.cropRect ?? defaultCropRect();

  function patchSelection(patch: Partial<EntryCoverSelection> | null) {
    const next = { ...(value ?? {}) };
    if (!patch) delete next[activeEntry];
    else if (patch.imageId || selectedImageId) {
      next[activeEntry] = {
        imageId: patch.imageId ?? selectedImageId,
        cropRect: patch.cropRect ?? currentCrop,
      };
    }
    onChange(Object.keys(next).length ? next : undefined);
  }

  return (
    <div className="presentation-editor">
      <div className="subsection-heading">
        <h4>入口封面构图</h4>
      </div>
      <div className="tabs">
        {entries.map((entry) => (
          <button
            key={entry}
            className={activeEntry === entry ? "active-tab" : ""}
            type="button"
            onClick={() => setActiveEntry(entry)}
          >
            {COVER_ENTRY_META.find((item) => item.key === entry)?.label ?? entry}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <SelectField
          label="展示图片"
          options={
            images.length
              ? images.map((image, index) => ({
                  label: image.title || `图片 ${index + 1}`,
                  value: image.id,
                }))
              : [{ label: "暂无图片", value: "" }]
          }
          value={selectedImageId}
          onChange={(imageId) => patchSelection({ imageId })}
        />
        <div className="presentation-preview">
          <CroppedPreview
            cropRect={currentCrop}
            image={images.find((item) => item.id === selectedImageId)}
          />
        </div>
      </div>
      <CropInputs value={currentCrop} onChange={(cropRect) => patchSelection({ cropRect })} />
      <button
        className="secondary-button small-button"
        type="button"
        onClick={() => patchSelection(null)}
      >
        重置当前入口
      </button>
    </div>
  );
}

function DetailPresentationEditor({
  images,
  value,
  onChange,
}: {
  images: MediaAssetData[];
  value?: DetailImagePresentations;
  onChange: (value: DetailImagePresentations | undefined) => void;
}) {
  const [activeImageId, setActiveImageId] = useState("");
  useEffect(() => {
    if (activeImageId && images.some((image) => image.id === activeImageId)) return;
    setActiveImageId(images[0]?.id ?? "");
  }, [activeImageId, images]);

  const image = images.find((item) => item.id === activeImageId);
  const presentation = activeImageId ? value?.[activeImageId] : undefined;
  const cropRect = presentation?.mode === "crop" ? presentation.cropRect : defaultCropRect();

  function patchPresentation(nextPresentation: DetailImagePresentations[string] | null) {
    if (!activeImageId) return;
    const next = { ...(value ?? {}) };
    if (!nextPresentation) delete next[activeImageId];
    else next[activeImageId] = nextPresentation;
    onChange(Object.keys(next).length ? next : undefined);
  }

  return (
    <div className="presentation-editor">
      <div className="subsection-heading">
        <h4>详情轮播展示参数</h4>
      </div>
      <SelectField
        label="轮播图片"
        options={
          images.length
            ? images.map((item, index) => ({
                label: item.title || `轮播图 ${index + 1}`,
                value: item.id,
              }))
            : [{ label: "暂无图片", value: "" }]
        }
        value={activeImageId}
        onChange={setActiveImageId}
      />
      <div className="presentation-preview presentation-preview-tall">
        <CroppedPreview cropRect={cropRect} image={image} />
      </div>
      <div className="table-actions">
        <button type="button" onClick={() => patchPresentation({ mode: "original" })}>
          使用原图
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => patchPresentation({ mode: "crop", aspectRatio: 4 / 5, cropRect })}
        >
          使用 4:5 裁剪
        </button>
        <button className="secondary-button" type="button" onClick={() => patchPresentation(null)}>
          重置当前图片
        </button>
      </div>
      <CropInputs
        value={cropRect}
        onChange={(next) => patchPresentation({ mode: "crop", aspectRatio: 4 / 5, cropRect: next })}
      />
    </div>
  );
}

function CropInputs({ value, onChange }: { value: CropRect; onChange: (value: CropRect) => void }) {
  return (
    <div className="form-grid">
      {(["x", "y", "width", "height"] as const).map((key) => (
        <label key={key}>
          {key}
          <input
            max="1"
            min="0"
            step="0.01"
            type="number"
            value={value[key]}
            onChange={(event) =>
              onChange({
                ...value,
                [key]: clampUnit(
                  Number.parseFloat(event.target.value),
                  key === "width" || key === "height" ? 1 : 0,
                ),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}

function CroppedPreview({ cropRect, image }: { cropRect: CropRect; image?: MediaAssetData }) {
  if (!image) return <div className="cat-image-placeholder">暂无图片</div>;
  const scale = 1 / Math.max(cropRect.width, 0.01);
  return (
    <div className="cropped-preview-frame">
      <img
        alt={image.altText || image.title || image.id}
        src={image.thumbnailUrl || image.sourceUrl}
        style={{
          height: `${scale * 100}%`,
          left: `${-cropRect.x * scale * 100}%`,
          top: `${-cropRect.y * scale * 100}%`,
          width: `${scale * 100}%`,
        }}
      />
    </div>
  );
}

function LitterWorkspace({
  activeCats,
  draft,
  editorMode,
  imagePreviewUrl,
  imageUploadState,
  includeArchived,
  isSaving,
  kittens,
  litters,
  selectedImages,
  selectedLitter,
  onCancel,
  onChange,
  onEdit,
  onImageChange,
  onNew,
  onSelect,
  onSubmit,
  onToggleArchived,
}: {
  activeCats: CatData[];
  draft: LitterDraft;
  editorMode: EditorMode;
  imagePreviewUrl: string;
  imageUploadState: ImageUploadState;
  includeArchived: boolean;
  isSaving: boolean;
  kittens: KittenProfileData[];
  litters: LitterData[];
  selectedImages: MediaAssetData[];
  selectedLitter: LitterData | null;
  onCancel: () => void;
  onChange: (draft: LitterDraft) => void;
  onEdit: (litter: LitterData) => void;
  onImageChange: (file: File | null) => void;
  onNew: () => void;
  onSelect: (litter: LitterData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleArchived: (value: boolean) => void;
}) {
  return (
    <section className="management-grid wide-detail">
      <div className="table-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Litters</p>
            <h3>窝次管理</h3>
          </div>
          <div className="table-actions">
            <label className="toggle-row">
              <input
                checked={includeArchived}
                type="checkbox"
                onChange={(event) => onToggleArchived(event.target.checked)}
              />
              显示归档
            </label>
            <button type="button" onClick={onNew}>
              新增窝次
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>状态</th>
                <th>父母</th>
                <th>日期</th>
                <th>可见性</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {litters.map((litter) => (
                <tr key={litter.id} className={litter.deletedAt ? "archived-row" : ""}>
                  <td>
                    <strong>{litter.name}</strong>
                    <br />
                    <span className="muted">{litter.colorNote || "颜色待补充"}</span>
                  </td>
                  <td>{formatOption(litter.status, LITTER_STATUS_OPTIONS)}</td>
                  <td>
                    {litter.fatherCat?.name ?? litter.fatherCatId} /{" "}
                    {litter.motherCat?.name ?? litter.motherCatId}
                  </td>
                  <td>{formatDate(litter.birthDate || litter.expectedBirthDate)}</td>
                  <td>{formatOption(litter.visibility, VISIBILITY_OPTIONS)}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="secondary-button small-button"
                        type="button"
                        onClick={() => onSelect(litter)}
                      >
                        查看
                      </button>
                      <button className="small-button" type="button" onClick={() => onEdit(litter)}>
                        编辑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="detail-panel" aria-label="窝次详情">
        {editorMode ? (
          <LitterForm
            activeCats={activeCats}
            draft={draft}
            imagePreviewUrl={imagePreviewUrl}
            imageUploadState={imageUploadState}
            isSaving={isSaving}
            selectedImages={selectedImages}
            onCancel={onCancel}
            onChange={onChange}
            onImageChange={onImageChange}
            onSubmit={onSubmit}
          />
        ) : selectedLitter ? (
          <LitterDetail
            litter={selectedLitter}
            images={selectedImages}
            kittens={kittens}
            onEdit={onEdit}
          />
        ) : (
          <div className="empty-state">
            <strong>选择一个窝次查看详情</strong>
            <button type="button" onClick={onNew}>
              新增窝次
            </button>
          </div>
        )}
      </aside>
    </section>
  );
}

function LitterForm({
  activeCats,
  draft,
  imagePreviewUrl,
  imageUploadState,
  isSaving,
  selectedImages,
  onCancel,
  onChange,
  onImageChange,
  onSubmit,
}: {
  activeCats: CatData[];
  draft: LitterDraft;
  imagePreviewUrl: string;
  imageUploadState: ImageUploadState;
  isSaving: boolean;
  selectedImages: MediaAssetData[];
  onCancel: () => void;
  onChange: (draft: LitterDraft) => void;
  onImageChange: (file: File | null) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const catOptions = [
    { label: "请选择", value: "" },
    ...activeCats.map((cat) => ({ label: cat.name, value: cat.id })),
  ];
  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <div>
        <p className="eyebrow">Litter Editor</p>
        <h3>窝次编辑</h3>
      </div>
      <label>
        窝次名称
        <input
          required
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <div className="form-grid">
        <SelectField
          label="父亲"
          options={catOptions}
          value={draft.fatherCatId}
          onChange={(value) => onChange({ ...draft, fatherCatId: value })}
        />
        <SelectField
          label="母亲"
          options={catOptions}
          value={draft.motherCatId}
          onChange={(value) => onChange({ ...draft, motherCatId: value })}
        />
      </div>
      <div className="form-grid">
        <label>
          预产期
          <input
            value={draft.expectedBirthDate}
            onChange={(event) => onChange({ ...draft, expectedBirthDate: event.target.value })}
          />
        </label>
        <label>
          出生日期
          <input
            value={draft.birthDate}
            onChange={(event) => onChange({ ...draft, birthDate: event.target.value })}
          />
        </label>
      </div>
      <div className="form-grid">
        <SelectField
          label="状态"
          options={LITTER_STATUS_OPTIONS}
          value={draft.status}
          onChange={(value) => onChange({ ...draft, status: value })}
        />
        <SelectField
          label="可见性"
          options={VISIBILITY_OPTIONS}
          value={draft.visibility}
          onChange={(value) => onChange({ ...draft, visibility: value as Visibility })}
        />
      </div>
      <label>
        可能颜色 JSON 或文本
        <textarea
          className="code-textarea"
          rows={3}
          value={draft.possibleColorsRaw}
          onChange={(event) => onChange({ ...draft, possibleColorsRaw: event.target.value })}
        />
      </label>
      <label>
        颜色备注
        <input
          value={draft.colorNote}
          onChange={(event) => onChange({ ...draft, colorNote: event.target.value })}
        />
      </label>
      <label>
        备注
        <textarea
          rows={4}
          value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
        />
      </label>
      <div className="cat-image-uploader">
        <div className="subsection-heading">
          <h4>窝次图片</h4>
          <span className={`upload-state upload-state-${imageUploadState}`}>
            {formatImageState(imageUploadState)}
          </span>
        </div>
        {imagePreviewUrl ? (
          <img alt="待上传窝次图片" className="cat-image-preview" src={imagePreviewUrl} />
        ) : null}
        <label>
          上传图片
          <input
            accept="image/*"
            disabled={isSaving}
            type="file"
            onChange={(event) => {
              onImageChange(event.target.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div className="community-media-strip">
          {selectedImages.map((image) => (
            <img
              key={image.id}
              alt={image.altText || image.title || image.id}
              className="community-media-preview"
              src={image.thumbnailUrl || image.sourceUrl}
            />
          ))}
        </div>
      </div>
      <FormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  );
}

function CatDetail({
  cat,
  confirmingArchiveCatId,
  images,
  parentLinks,
  onArchive,
  onEdit,
}: {
  cat: CatData;
  confirmingArchiveCatId: string;
  images: MediaAssetData[];
  parentLinks: ParentCatLinkData[];
  onArchive: (cat: CatData) => void;
  onEdit: (cat: CatData) => void;
}) {
  const primaryImage = getPrimaryCatImageData(cat, images);
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
      {primaryImage ? (
        <img
          alt={primaryImage.altText || primaryImage.title || cat.name}
          className="cat-image-preview"
          src={primaryImage.thumbnailUrl || primaryImage.sourceUrl}
        />
      ) : null}
      <DescriptionList
        items={[
          ["性别", formatGender(cat.gender)],
          ["颜色", cat.color || "-"],
          ["生日", formatDate(cat.birthday)],
          ["生命周期", formatOption(cat.lifecycleStatus, CAT_STATUS_OPTIONS)],
          ["可见性", formatOption(cat.visibility, VISIBILITY_OPTIONS)],
          ["窝次", cat.kittenProfile?.litter?.name ?? "-"],
          [
            "父母",
            `${cat.kittenProfile?.litter?.fatherCat?.name ?? "-"} / ${cat.kittenProfile?.litter?.motherCat?.name ?? "-"}`,
          ],
          [
            "家长/归属",
            parentLinks
              .map((link) => link.parentProfile?.displayName ?? link.parentProfileId)
              .join("、") || "-",
          ],
          ["动态数量", "当前 API 未提供可靠计数"],
          ["性格", cat.personality || readCatStoryText(cat.storyJson, "personality") || "-"],
        ]}
      />
      <div className="community-media-strip">
        {images.map((image) => (
          <img
            key={image.id}
            alt={image.altText || image.title || image.id}
            className="community-media-preview"
            src={image.thumbnailUrl || image.sourceUrl}
          />
        ))}
      </div>
    </div>
  );
}

function LitterDetail({
  images,
  kittens,
  litter,
  onEdit,
}: {
  images: MediaAssetData[];
  kittens: KittenProfileData[];
  litter: LitterData;
  onEdit: (litter: LitterData) => void;
}) {
  const primaryImage = getPrimaryMedia(images);
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
      {primaryImage ? (
        <img
          alt={primaryImage.altText || primaryImage.title || litter.name}
          className="cat-image-preview"
          src={primaryImage.thumbnailUrl || primaryImage.sourceUrl}
        />
      ) : null}
      <DescriptionList
        items={[
          ["父亲", litter.fatherCat?.name ?? litter.fatherCatId],
          ["母亲", litter.motherCat?.name ?? litter.motherCatId],
          ["状态", formatOption(litter.status, LITTER_STATUS_OPTIONS)],
          ["预产期", formatDate(litter.expectedBirthDate)],
          ["出生日期", formatDate(litter.birthDate)],
          ["可见性", formatOption(litter.visibility, VISIBILITY_OPTIONS)],
          ["可能颜色", stringifyJson(litter.possibleColorsJson) || litter.colorNote || "-"],
          ["备注", litter.note || "-"],
        ]}
      />
      <div className="mini-list">
        {kittens.length ? (
          kittens.map((kitten) => (
            <div className="mini-list-row" key={kitten.catId}>
              <strong>{kitten.cat?.name ?? kitten.catId}</strong>
              <span>{kitten.saleStatus}</span>
              <span>{kitten.priceText ?? "-"}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">当前窝次还没有关联小猫</div>
        )}
      </div>
      <div className="community-media-strip">
        {images.map((image) => (
          <img
            key={image.id}
            alt={image.altText || image.title || image.id}
            className="community-media-preview"
            src={image.thumbnailUrl || image.sourceUrl}
          />
        ))}
      </div>
    </div>
  );
}

function CatThumb({ cat }: { cat: CatData }) {
  const image = getPrimaryCatImageDto(cat);
  if (!image) return <div className="community-thumbnail-placeholder">无图</div>;
  return (
    <img
      alt={image.altText || image.title || cat.name}
      className="community-thumbnail"
      src={image.thumbnailUrl || image.sourceUrl}
    />
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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

function toCatPayload(
  draft: CatDraft,
  existing: CatData | null,
): CreateCatRequest | UpdateCatRequest {
  const storyJson = mergeCatStoryJson(existing?.storyJson, draft);
  return {
    birthday: draft.birthday || null,
    color: emptyToNull(draft.color),
    gender: emptyToNull(draft.gender),
    lifecycleStatus: draft.lifecycleStatus,
    name: draft.name.trim(),
    personality: emptyToNull(draft.personality),
    storyJson,
    visibility: draft.visibility,
  };
}

function toKittenProfilePayload(draft: CatDraft) {
  if (!draft.kittenLitterId) throw new Error("小猫必须选择窝次");
  return {
    adoptedAt: null,
    litterId: draft.kittenLitterId,
    priceText: emptyToNull(draft.kittenPriceText),
    saleStatus: draft.kittenSaleStatus,
    structureRatingJson: parseJsonOrString(draft.structureRatingRaw),
  };
}

function toBreedingProfilePayload(draft: CatDraft) {
  return {
    category: draft.breedingCategory,
    reproductiveState: draft.breedingReproductiveState,
    sortOrder: Number.parseInt(draft.breedingSortOrder, 10) || 0,
    source: emptyToNull(draft.breedingSource),
    statusLabel: emptyToNull(draft.breedingStatusLabel),
    trait: emptyToNull(draft.breedingTrait),
  };
}

function mergeCatStoryJson(existing: unknown, draft: CatDraft) {
  const base = mergeCatStoryTextFields(existing, {
    detail: draft.storyDetail,
    diet: draft.diet,
    personality: draft.storyPersonality,
  });
  const imagePresentation = compactImagePresentation({
    ...(isRecord(base.imagePresentation) ? (base.imagePresentation as ImagePresentation) : {}),
    ...draft.imagePresentation,
  });
  return removeUndefinedObject({
    ...base,
    imagePresentation,
  });
}

function compactImagePresentation(value: ImagePresentation): ImagePresentation | undefined {
  const next = removeUndefinedObject({
    coverPresentations: value.coverPresentations,
    detailCarouselPresentations: value.detailCarouselPresentations,
    detailImagePresentations: value.detailImagePresentations,
    entryCoverSelections: value.entryCoverSelections,
  }) as ImagePresentation;
  return Object.keys(next).length ? next : undefined;
}

function toCatDraft(cat: CatData): CatDraft {
  const storyJson = isRecord(cat.storyJson) ? cat.storyJson : {};
  const imagePresentation = readImagePresentation(cat);
  return {
    birthday: toDateInputValue(cat.birthday),
    breedingCategory: cat.breedingProfile?.category ?? "king",
    breedingReproductiveState: cat.breedingProfile?.reproductiveState ?? "active",
    breedingSortOrder: String(cat.breedingProfile?.sortOrder ?? 0),
    breedingSource: cat.breedingProfile?.source ?? "",
    breedingStatusLabel: cat.breedingProfile?.statusLabel ?? "",
    breedingTrait: cat.breedingProfile?.trait ?? "",
    color: cat.color ?? "",
    diet: readCatStoryText(storyJson, "diet"),
    gender: cat.gender ?? "",
    imagePresentation,
    kittenLitterId: cat.kittenProfile?.litterId ?? "",
    kittenPriceText: cat.kittenProfile?.priceText ?? "",
    kittenSaleStatus: cat.kittenProfile?.saleStatus ?? "evaluating",
    lifecycleStatus: cat.lifecycleStatus,
    name: cat.name,
    personality: cat.personality ?? "",
    storyDetail: readCatStoryText(storyJson, "detail"),
    storyPersonality: readCatStoryText(storyJson, "personality"),
    structureRatingRaw: stringifyJson(cat.kittenProfile?.structureRatingJson),
    visibility: cat.visibility as Visibility,
  };
}

function createEmptyCatDraft(section: SectionKey): CatDraft {
  return {
    ...DEFAULT_CAT_DRAFT,
    lifecycleStatus: section === "studs" ? "breeding" : "growing",
    visibility: "visible",
  };
}

function toLitterDraft(litter: LitterData): LitterDraft {
  return {
    birthDate: toDateInputValue(litter.birthDate),
    colorNote: litter.colorNote ?? "",
    expectedBirthDate: toDateInputValue(litter.expectedBirthDate),
    fatherCatId: litter.fatherCatId,
    motherCatId: litter.motherCatId,
    name: litter.name,
    note: litter.note ?? "",
    possibleColorsRaw: stringifyJson(litter.possibleColorsJson),
    status: litter.status,
    visibility: litter.visibility as Visibility,
  };
}

function toLitterPayload(form: LitterDraft): CreateLitterRequest | UpdateLitterRequest {
  return {
    birthDate: form.birthDate || null,
    colorNote: emptyToNull(form.colorNote),
    expectedBirthDate: form.expectedBirthDate || null,
    fatherCatId: form.fatherCatId,
    motherCatId: form.motherCatId,
    name: form.name.trim(),
    note: emptyToNull(form.note),
    possibleColorsJson: parseJsonOrString(form.possibleColorsRaw),
    status: form.status,
    visibility: form.visibility,
  };
}

function readImagePresentation(cat: CatData): ImagePresentation {
  const source =
    isRecord(cat.storyJson) && isRecord(cat.storyJson.imagePresentation)
      ? cat.storyJson.imagePresentation
      : {};
  return removeUndefinedObject({
    coverPresentations: asObject<CoverPresentations>(
      cat.coverPresentations ?? source.coverPresentations,
    ),
    detailCarouselPresentations: asObject<DetailCarouselPresentations>(
      cat.detailCarouselPresentations ?? source.detailCarouselPresentations,
    ),
    detailImagePresentations: asObject<DetailImagePresentations>(
      cat.detailImagePresentations ?? source.detailImagePresentations,
    ),
    entryCoverSelections: asObject<EntryCoverSelections>(
      cat.entryCoverSelections ?? source.entryCoverSelections,
    ),
  }) as ImagePresentation;
}

function sortMediaByBinding(items: MediaAssetData[], ownerType: string, ownerId: string) {
  return [...items].sort((a, b) => {
    const aBinding = a.bindings.find(
      (binding) => binding.ownerType === ownerType && binding.ownerId === ownerId,
    );
    const bBinding = b.bindings.find(
      (binding) => binding.ownerType === ownerType && binding.ownerId === ownerId,
    );
    return (aBinding?.sortOrder ?? 0) - (bBinding?.sortOrder ?? 0) || a.id.localeCompare(b.id);
  });
}

function getPrimaryCatImageDto(cat: CatData) {
  return (
    cat.mediaAssets.find((media) => media.usage === "cover") ??
    cat.mediaAssets.find((media) => media.usage === "gallery") ??
    cat.mediaAssets[0]
  );
}

function getPrimaryCatImageData(cat: CatData, images: MediaAssetData[]) {
  return getPrimaryMedia(images) ?? mediaDtoToAsset(getPrimaryCatImageDto(cat));
}

function getPrimaryMedia(images: MediaAssetData[]) {
  return (
    images.find((media) =>
      media.bindings.some(
        (binding) => binding.usage === "cover" && binding.visibility === "visible",
      ),
    ) ??
    images.find((media) => media.bindings.some((binding) => binding.visibility === "visible")) ??
    images[0]
  );
}

function mediaDtoToAsset(media?: CatMediaAssetData): MediaAssetData | undefined {
  if (!media) return undefined;
  return {
    ...media,
    bindings: [],
    checksum: null,
    createdAt: "",
    deletedAt: null,
    durationSeconds: null,
    metadataJson: null,
    mimeType: media.mimeType ?? null,
    sizeBytes: null,
    status: "active",
    updatedAt: "",
    width: media.width ?? null,
    height: media.height ?? null,
  };
}

function formatCatStatus(cat: CatData, mode: "kittens" | "studs" | "cats") {
  if (mode === "kittens") return cat.kittenProfile?.saleStatus ?? cat.lifecycleStatus;
  if (mode === "studs")
    return (
      cat.breedingProfile?.statusLabel ||
      cat.breedingProfile?.reproductiveState ||
      cat.lifecycleStatus
    );
  return formatOption(cat.lifecycleStatus, CAT_STATUS_OPTIONS);
}

function formatParentOwnership(cat: CatData) {
  const links = cat.parentCatLinks ?? [];
  const link = links.find((item) => item.status === "active") ?? links[0];
  if (!link) return "-";
  const parentName = link.parentProfile?.displayName || link.parentProfileId;
  return `${parentName} / ${formatParentRelationship(link.relationship)}`;
}

function formatParentRelationship(value: string) {
  switch (value) {
    case "owner":
      return "家长";
    case "co_owner":
      return "共同家长";
    case "caregiver":
      return "照护人";
    default:
      return value;
  }
}

function formatImageState(state: ImageUploadState) {
  switch (state) {
    case "pending":
      return "待保存";
    case "uploading":
      return "上传中";
    case "uploaded":
      return "已上传";
    default:
      return "未选择";
  }
}

function parseJsonOrString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return trimmed;
  }
}

function stringifyJson(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function serializeDraft(value: unknown) {
  return JSON.stringify(value);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asObject<T>(value: unknown): T | undefined {
  return isRecord(value) ? (value as T) : undefined;
}

function removeUndefinedObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

function defaultCropRect(): CropRect {
  return { height: 1, width: 1, x: 0, y: 0 };
}

function clampUnit(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function getSectionFromHash(): SectionKey {
  if (window.location.hash === "#dashboard") return "dashboard";
  if (window.location.hash === "#kittens") return "kittens";
  if (window.location.hash === "#litters") return "litters";
  if (window.location.hash === "#studs") return "studs";
  if (window.location.hash === "#cats") return "cats";
  if (window.location.hash === "#media") return "media";
  if (window.location.hash === "#fixed-pages") return "fixedPages";
  if (window.location.hash === "#community") return "communityModeration";
  if (window.location.hash === "#community-comments") return "communityComments";
  if (window.location.hash === "#parent-users") return "parentUsers";
  if (window.location.hash === "#parent-applications") return "parentApplications";
  if (window.location.hash === "#selection-applications") return "selectionApplications";
  return "kittens";
}
