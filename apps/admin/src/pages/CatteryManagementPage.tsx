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
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { listAllPages } from "../api/pagination";
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
type PendingCatPhoto = { id: string; file: File; url: string };
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
  { key: "communityProfile", label: "猫友圈展示", ratio: "4:3" },
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
  const [activeHash, setActiveHash] = useState(() => window.location.hash);
  const [cats, setCats] = useState<CatData[]>([]);
  const [fixedPages, setFixedPages] = useState<FixedPageData[]>([]);
  const [litters, setLitters] = useState<LitterData[]>([]);
  const [selectedCat, setSelectedCat] = useState<CatData | null>(null);
  const selectedCatIdRef = useRef<string | null>(null);
  const litterCreateRequestRef = useRef<{ payload: string; key: string } | null>(null);
  const catSubmitInFlightRef = useRef(false);
  const internalNavigationRef = useRef(false);
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
  const [pendingCatPhotos, setPendingCatPhotos] = useState<PendingCatPhoto[]>([]);
  const [pendingCatCoverId, setPendingCatCoverId] = useState("");
  const [catImageUploadState, setCatImageUploadState] = useState<ImageUploadState>("idle");
  const [litterImagePreviewUrl, setLitterImagePreviewUrl] = useState("");
  const [pendingLitterImageFile, setPendingLitterImageFile] = useState<File | null>(null);
  const [litterImageUploadState, setLitterImageUploadState] = useState<ImageUploadState>("idle");
  const [includeArchivedCats, setIncludeArchivedCats] = useState(false);
  const [includeArchivedLitters, setIncludeArchivedLitters] = useState(false);
  const [confirmingArchiveCatId, setConfirmingArchiveCatId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [createdKittenLitterId, setCreatedKittenLitterId] = useState("");
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
    ? serializeDraft(catDraft) !== catBaseline || pendingCatPhotos.length > 0
    : false;
  const litterDirty = litterEditorMode
    ? serializeDraft(litterDraft) !== litterBaseline || Boolean(pendingLitterImageFile)
    : false;

  useEffect(() => {
    selectedCatIdRef.current = selectedCat?.id ?? null;
  }, [selectedCat]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const [catList, litterList, fixedPageList] = await Promise.all([
        listAllPages((page) =>
          listCats({ includeDeleted: includeArchivedCats, page, pageSize: 100 }),
        ),
        listAllPages((page) =>
          listLitters({ includeDeleted: includeArchivedLitters, page, pageSize: 100 }),
        ),
        listFixedPages(),
      ]);

      setCats(catList);
      setFixedPages(fixedPageList);
      setLitters(litterList);
      setHasLoaded(true);
      setSelectedCat((current) =>
        current ? (catList.find((cat) => cat.id === current.id) ?? null) : null,
      );
      setSelectedLitter((current) =>
        current ? (litterList.find((litter) => litter.id === current.id) ?? null) : null,
      );
    } catch (loadError) {
      setLoadError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [includeArchivedCats, includeArchivedLitters]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (litterImagePreviewUrl.startsWith("blob:")) URL.revokeObjectURL(litterImagePreviewUrl);
    };
  }, [litterImagePreviewUrl]);

  useEffect(() => {
    function handleHashChange() {
      const nextSection = getSectionFromHash();
      if (internalNavigationRef.current) {
        internalNavigationRef.current = false;
        setActiveHash(window.location.hash);
        setActiveSection(nextSection);
        return;
      }
      if (nextSection !== activeSection) {
        if (
          (catDirty || litterDirty) &&
          !window.confirm("当前表单有未保存修改，确定切换模块吗？")
        ) {
          window.history.replaceState(null, "", SECTION_HASHES[activeSection]);
          window.dispatchEvent(new HashChangeEvent("hashchange"));
          return;
        }
        setSelectedCat(null);
        setSelectedLitter(null);
        setCatEditorMode(null);
        setLitterEditorMode(null);
        setNotice("");
        setError("");
        setCreatedKittenLitterId("");
      }
      setActiveHash(window.location.hash);
      setActiveSection(nextSection);
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [activeSection, catDirty, litterDirty]);

  useEffect(() => {
    if (!catDirty && !litterDirty) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [catDirty, litterDirty]);

  function cancelCatEditor() {
    if (catDirty && !confirm("当前档案或待上传照片尚未保存，确定离开吗？")) return;
    clearPendingCatImages();
    setCatEditorMode(null);
  }

  function navigateWithinPage(section: SectionKey) {
    if (window.location.hash !== SECTION_HASHES[section]) {
      internalNavigationRef.current = true;
      window.location.hash = SECTION_HASHES[section];
    }
    setActiveSection(section);
  }

  function openCreateCat(section: SectionKey, litter?: LitterData) {
    if ((catDirty || litterDirty) && !confirm("当前表单有未保存修改，确定新建吗？")) return;
    if (litter && !isUsableLitter(litter)) {
      setError("此窝次已归档，不能用于新增小猫");
      return;
    }
    navigateWithinPage(section);
    setSelectedCat(null);
    const next = { ...createEmptyCatDraft(section), kittenLitterId: litter?.id ?? "" };
    setCatDraft(next);
    setCatBaseline(serializeDraft(next));
    clearPendingCatImages();
    setCatEditorMode("create");
    setCreatedKittenLitterId("");
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
    setCreatedKittenLitterId("");
    setError("");

    try {
      const [freshCat] = await Promise.all([getCat(cat.id), loadCatImages(cat.id)]);
      const links = await listCatParentLinksSafe(cat.id);
      setParentLinksByCatId((current) => ({ ...current, [cat.id]: links }));
      setSelectedCat(freshCat);
      const next = toCatDraft(freshCat);
      setCatDraft(next);
      setCatBaseline(serializeDraft(next));
      clearPendingCatImages();
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
    setCreatedKittenLitterId("");
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
    const mediaList = await listAllPages((page) =>
      listMedia({
        kind: "image",
        ownerId: catId,
        ownerType: "cat",
        page,
        pageSize: 100,
        status: "active",
      }),
    );
    const sorted = sortMediaByBinding(mediaList, "cat", catId);
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

  function handleCatImagesSelected(files: File[]) {
    if (!files.length) return;
    const added = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));
    setPendingCatPhotos((current) => [...current, ...added]);
    if (!pendingCatCoverId && selectedCatImages.length === 0) setPendingCatCoverId(added[0].id);
    setCatImageUploadState("pending");
  }

  function removePendingCatPhoto(id: string) {
    setPendingCatPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((photo) => photo.id !== id);
    });
    if (pendingCatCoverId === id) setPendingCatCoverId("");
  }

  function clearPendingCatImages() {
    setPendingCatPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.url));
      return [];
    });
    setPendingCatCoverId("");
    setCatImageUploadState("idle");
  }

  async function uploadPendingCatImages(catId: string) {
    if (!pendingCatPhotos.length) return;
    setCatImageUploadState("uploading");
    let nextSortOrder = selectedCatImages.reduce(
      (max, media) => Math.max(max, (media.bindings[0]?.sortOrder ?? -1) + 1),
      0,
    );
    for (const photo of pendingCatPhotos) {
      const isCover = photo.id === pendingCatCoverId;
      const media = await uploadCatImage(catId, photo.file, {
        usage: isCover ? "cover" : "gallery",
        sortOrder: nextSortOrder++,
      });
      setPendingCatPhotos((current) => current.filter((item) => item.id !== photo.id));
      URL.revokeObjectURL(photo.url);
      setNotice(`已上传 ${media.title || photo.file.name}`);
      if (isCover) {
        setPendingCatCoverId("");
        try {
          for (const other of selectedCatImages) {
            if (other.bindings[0]?.usage === "cover") {
              await updateMediaBinding(other.id, other.bindings[0].id, { usage: "gallery" });
            }
          }
          const fresh = await getCat(catId);
          const presentation = readImagePresentation(fresh);
          await updateCat(catId, {
            storyJson: {
              ...(isRecord(fresh.storyJson) ? fresh.storyJson : {}),
              imagePresentation: {
                ...presentation,
                entryCoverSelections: {
                  ...presentation.entryCoverSelections,
                  listCard: { imageId: media.id, cropRect: defaultCropRect() },
                },
              },
            },
          });
          setCatDraft((current) => ({
            ...current,
            imagePresentation: {
              ...current.imagePresentation,
              entryCoverSelections: {
                ...current.imagePresentation.entryCoverSelections,
                listCard: { imageId: media.id, cropRect: defaultCropRect() },
              },
            },
          }));
        } catch (coverError) {
          throw new Error(
            `照片已上传，但封面尚未完成：${getErrorMessage(coverError)}。可在照片墙重新点击“设为封面”。`,
          );
        }
      }
    }
    setCatImageUploadState("uploaded");
    await loadCatImages(catId);
  }

  async function loadLitterImages(litterId: string) {
    const mediaList = await listAllPages((page) =>
      listMedia({
        kind: "image",
        ownerId: litterId,
        ownerType: "litter",
        page,
        pageSize: 100,
        status: "active",
      }),
    );
    const sorted = sortMediaByBinding(mediaList, "litter", litterId);
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
    if (catSubmitInFlightRef.current) return;
    catSubmitInFlightRef.current = true;
    setIsSaving(true);
    setError("");
    setNotice("");

    let recordSaved = false;
    let savedCatId = selectedCat?.id ?? "";
    let photoUploadIncomplete = false;
    try {
      const wasCreating = catEditorMode === "create";
      if (
        activeSection === "kittens" &&
        (catEditorMode === "create" ||
          selectedCat?.kittenProfile?.litterId !== catDraft.kittenLitterId)
      ) {
        const selected = litters.find((litter) => litter.id === catDraft.kittenLitterId);
        if (!selected || !isUsableLitter(selected)) {
          throw new Error("请选择一个可用的窝次后再保存小猫");
        }
      }
      const payload = toCatPayload(catDraft, selectedCat);
      let savedCat: CatData;

      if (catEditorMode === "edit" && selectedCat) {
        savedCat = await updateCat(selectedCat.id, payload);
      } else if (activeSection === "kittens") {
        savedCat = await createCatWithKittenProfile({
          cat: payload as CreateCatRequest,
          kittenProfile: toKittenProfilePayload(catDraft),
        });
        setCreatedKittenLitterId(catDraft.kittenLitterId);
      } else if (activeSection === "studs") {
        savedCat = await createCatWithBreedingProfile({
          breedingProfile: toBreedingProfilePayload(catDraft),
          cat: payload as CreateCatRequest,
        });
      } else {
        savedCat = await createCat(payload as CreateCatRequest);
      }
      recordSaved = true;
      savedCatId = savedCat.id;
      // Once creation succeeds, every retry updates this record, even if a later upload fails.
      setSelectedCat(savedCat);
      setCatEditorMode("edit");

      if (catEditorMode === "edit" && activeSection === "kittens") {
        await saveKittenProfile(savedCat.id, catDraft, selectedCat?.kittenProfile ?? null);
      }
      if (catEditorMode === "edit" && activeSection === "studs") {
        await saveBreedingProfile(savedCat.id, catDraft, selectedCat?.breedingProfile ?? null);
      }
      if (pendingCatPhotos.length) {
        photoUploadIncomplete = true;
        await uploadPendingCatImages(savedCat.id);
        photoUploadIncomplete = false;
      } else {
        await loadCatImages(savedCat.id);
      }

      const fresh = await getCat(savedCat.id);
      setSelectedCat(fresh);
      const next = toCatDraft(fresh);
      setCatDraft(next);
      setCatBaseline(serializeDraft(next));
      setCatEditorMode("edit");
      setCreatedKittenLitterId(
        activeSection === "kittens" && (wasCreating || createdKittenLitterId)
          ? catDraft.kittenLitterId
          : "",
      );
      setNotice(
        wasCreating
          ? activeSection === "kittens"
            ? "小猫已新增"
            : "猫咪已新增"
          : "猫咪资料已更新",
      );
      await loadData();
    } catch (saveError) {
      if (recordSaved && savedCatId) {
        try {
          await loadCatImages(savedCatId);
        } catch {
          /* The original error remains actionable. */
        }
      }
      if (photoUploadIncomplete) setCatImageUploadState("pending");
      setError(
        recordSaved
          ? `档案已保存，但后续步骤未完成：${getErrorMessage(saveError)}。保留待上传照片，可点击保存重试；不会再新建一只猫。`
          : getErrorMessage(saveError),
      );
    } finally {
      catSubmitInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  async function returnToLitter(litterId: string) {
    if (catDirty && !confirm("当前小猫表单有未保存修改，确定返回窝次吗？")) return;
    try {
      const litter = await getLitter(litterId);
      navigateWithinPage("litters");
      setSelectedLitter(litter);
      setLitterEditorMode(null);
      setCreatedKittenLitterId("");
      setNotice("");
      setError("");
      await Promise.all([loadLitterImages(litter.id), loadLitterKittens(litter.id)]);
    } catch (returnError) {
      setError(getErrorMessage(returnError));
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
    litterCreateRequestRef.current = null;
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
    litterCreateRequestRef.current = null;
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
      const isCreate = litterEditorMode !== "edit";
      const payloadSignature = JSON.stringify(payload);
      if (isCreate && litterCreateRequestRef.current?.payload !== payloadSignature) {
        litterCreateRequestRef.current = { payload: payloadSignature, key: crypto.randomUUID() };
      }
      const savedLitter =
        !isCreate && selectedLitter
          ? await updateLitter(selectedLitter.id, payload)
          : await createLitter(payload as CreateLitterRequest, litterCreateRequestRef.current!.key);

      setSelectedLitter(savedLitter);
      if (isCreate) {
        setLitterEditorMode("edit");
        litterCreateRequestRef.current = null;
      }
      if (pendingLitterImageFile) await uploadPendingLitterImage(savedLitter.id);
      else await loadLitterImages(savedLitter.id);
      await loadLitterKittens(savedLitter.id);
      const next = toLitterDraft(savedLitter);
      setLitterDraft(next);
      setLitterBaseline(serializeDraft(next));
      setLitterEditorMode(isCreate ? null : "edit");
      litterCreateRequestRef.current = null;
      setNotice(isCreate ? "窝次已新增" : "窝次资料已更新");
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
      setNotice(
        patch.visibility === "hidden"
          ? "照片已隐藏，立即生效"
          : patch.visibility === "visible"
            ? "照片已显示，立即生效"
            : "照片设置已生效",
      );
    } catch (mediaError) {
      setError(getErrorMessage(mediaError));
    } finally {
      setIsSaving(false);
    }
  }

  async function reorderCatMedia(fromId: string, toId: string) {
    if (!selectedCat || isSaving || fromId === toId) return;
    const catId = selectedCat.id;
    const reordered = movePhoto(selectedCatImages, fromId, toId);
    setCatImagesByCatId((current) => ({ ...current, [catId]: reordered }));
    setIsSaving(true);
    setError("");
    setNotice("正在保存照片顺序…");
    try {
      for (const [index, media] of reordered.entries()) {
        const binding = media.bindings[0];
        if (binding && binding.sortOrder !== index) {
          await updateMediaBinding(media.id, binding.id, { sortOrder: index });
        }
      }
      setNotice("照片顺序已保存，刷新后仍会保持");
    } catch (orderError) {
      setError(`照片顺序未全部保存：${getErrorMessage(orderError)}。请重试调整。`);
    } finally {
      try {
        await loadCatImages(catId);
      } catch (reloadError) {
        setError(getErrorMessage(reloadError));
      }
      setIsSaving(false);
    }
  }

  async function setPrimaryCatCover(media: MediaAssetData) {
    if (!selectedCat || isSaving) return;
    const catId = selectedCat.id;
    const nextBinding = media.bindings[0];
    if (!nextBinding) return;
    setIsSaving(true);
    setError("");
    setNotice("正在设置封面…");
    try {
      await updateMediaBinding(media.id, nextBinding.id, { usage: "cover", visibility: "visible" });
      for (const other of selectedCatImages) {
        if (other.id !== media.id && other.bindings[0]?.usage === "cover") {
          await updateMediaBinding(other.id, other.bindings[0].id, { usage: "gallery" });
        }
      }
      const fresh = await getCat(catId);
      const presentation = readImagePresentation(fresh);
      const entryCoverSelections = {
        ...presentation.entryCoverSelections,
        listCard: { imageId: media.id, cropRect: defaultCropRect() },
      };
      await updateCat(catId, {
        storyJson: {
          ...(isRecord(fresh.storyJson) ? fresh.storyJson : {}),
          imagePresentation: { ...presentation, entryCoverSelections },
        },
      });
      if (selectedCatIdRef.current === catId) {
        setCatDraft((current) => ({
          ...current,
          imagePresentation: {
            ...current.imagePresentation,
            entryCoverSelections: {
              ...current.imagePresentation.entryCoverSelections,
              listCard: entryCoverSelections.listCard,
            },
          },
        }));
        setCatBaseline((current) => {
          const baseline = JSON.parse(current) as CatDraft;
          return serializeDraft({
            ...baseline,
            imagePresentation: {
              ...baseline.imagePresentation,
              entryCoverSelections: {
                ...baseline.imagePresentation.entryCoverSelections,
                listCard: entryCoverSelections.listCard,
              },
            },
          });
        });
      }
      setNotice("主要封面已生效；其它展示位置仍可单独设置");
    } catch (coverError) {
      setError(`封面未全部设置完成：${getErrorMessage(coverError)}。请查看当前标记后重试。`);
    } finally {
      try {
        await loadCatImages(catId);
      } catch (reloadError) {
        setError(getErrorMessage(reloadError));
      }
      setIsSaving(false);
    }
  }

  async function removeCatMediaBinding(media: MediaAssetData) {
    if (!selectedCat) return;
    const binding = media.bindings.find(
      (item) => item.ownerType === "cat" && item.ownerId === selectedCat.id && !item.deletedAt,
    );
    if (!binding || !confirm("从这只猫的相册移除这张照片？其它位置使用的原始文件不会删除。"))
      return;
    setIsSaving(true);
    setError("");
    let bindingRemoved = false;
    try {
      await archiveMediaBinding(media.id, binding.id);
      bindingRemoved = true;
      const fresh = await getCat(selectedCat.id);
      const presentation = removeImagePresentationReferences(
        readImagePresentation(fresh),
        media.id,
      );
      await updateCat(selectedCat.id, {
        storyJson: {
          ...(isRecord(fresh.storyJson) ? fresh.storyJson : {}),
          imagePresentation: compactImagePresentation(presentation),
        },
      });
      setCatDraft((current) => ({
        ...current,
        imagePresentation: removeImagePresentationReferences(current.imagePresentation, media.id),
      }));
      setCatBaseline((current) => {
        const baseline = JSON.parse(current) as CatDraft;
        return serializeDraft({
          ...baseline,
          imagePresentation: removeImagePresentationReferences(
            baseline.imagePresentation,
            media.id,
          ),
        });
      });
      await loadCatImages(selectedCat.id);
      setNotice("图片已从当前猫咪移除");
    } catch (mediaError) {
      if (bindingRemoved) {
        try {
          await loadCatImages(selectedCat.id);
        } catch {
          /* Keep the partial-result message visible. */
        }
        setError(
          `照片已从相册移除，但旧展示设置未能清理：${getErrorMessage(mediaError)}。其它位置的图片文件未受影响。`,
        );
      } else setError(getErrorMessage(mediaError));
    } finally {
      setIsSaving(false);
    }
  }

  async function replaceCatMediaBinding(media: MediaAssetData, file: File) {
    if (!selectedCat || isSaving) return;
    const catId = selectedCat.id;
    const binding = media.bindings.find(
      (item) => item.ownerType === "cat" && item.ownerId === catId && !item.deletedAt,
    );
    if (!binding) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    let uploaded = false;
    let referencesUpdated = false;
    let errorMessage = "";
    try {
      const replacement = await uploadCatImage(catId, file, {
        usage: binding.usage,
        sortOrder: binding.sortOrder,
        bindingVisibility: binding.visibility,
      });
      uploaded = true;
      const freshCat = await getCat(catId);
      const storyJson = isRecord(freshCat.storyJson) ? freshCat.storyJson : {};
      const imagePresentation = replaceImagePresentationReferences(
        readImagePresentation(freshCat),
        media.id,
        replacement.id,
      );
      const updatedCat = await updateCat(catId, {
        storyJson: removeUndefinedObject({
          ...storyJson,
          imagePresentation: compactImagePresentation(imagePresentation),
        }),
      });
      referencesUpdated = true;
      if (selectedCatIdRef.current === catId) {
        const completeCat = {
          ...freshCat,
          ...updatedCat,
          breedingProfile: freshCat.breedingProfile,
          kittenProfile: freshCat.kittenProfile,
        };
        setSelectedCat(completeCat);
        setCatDraft((current) => ({
          ...current,
          imagePresentation: replaceImagePresentationReferences(
            current.imagePresentation,
            media.id,
            replacement.id,
          ),
        }));
        setCatBaseline((current) =>
          serializeDraft({
            ...(JSON.parse(current) as CatDraft),
            imagePresentation: replaceImagePresentationReferences(
              (JSON.parse(current) as CatDraft).imagePresentation,
              media.id,
              replacement.id,
            ),
          }),
        );
      }
      await archiveMediaBinding(media.id, binding.id);
    } catch (mediaError) {
      errorMessage = !uploaded
        ? getErrorMessage(mediaError)
        : !referencesUpdated
          ? `新照片已上传，但展示位置未切换：${getErrorMessage(mediaError)}。旧照片仍可用；可从相册移除新照片后重试。`
          : `新照片已启用，但旧照片仍留在相册：${getErrorMessage(mediaError)}。可从相册移除旧照片。`;
    } finally {
      try {
        const [freshCat] = await Promise.all([getCat(catId), loadCatImages(catId)]);
        setCats((current) => current.map((cat) => (cat.id === catId ? freshCat : cat)));
        if (selectedCatIdRef.current === catId) {
          setSelectedCat(freshCat);
          // Keep unsaved text and presentation changes in the current draft.
        }
      } catch (refreshError) {
        errorMessage += ` 图片列表刷新失败：${getErrorMessage(refreshError)}`;
      }
      if (errorMessage) setError(errorMessage.trim());
      else setNotice("猫咪图片已替换");
      setIsSaving(false);
    }
  }

  async function updateLitterMediaBinding(
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) {
    if (!selectedLitter) return;
    const binding = media.bindings.find(
      (item) =>
        item.ownerType === "litter" && item.ownerId === selectedLitter.id && !item.deletedAt,
    );
    if (!binding) return;
    setIsSaving(true);
    setError("");
    try {
      await updateMediaBinding(media.id, binding.id, patch);
      await loadLitterImages(selectedLitter.id);
      setNotice("窝次图片设置已更新");
    } catch (mediaError) {
      setError(getErrorMessage(mediaError));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeLitterMediaBinding(media: MediaAssetData) {
    if (!selectedLitter) return;
    const binding = media.bindings.find(
      (item) =>
        item.ownerType === "litter" && item.ownerId === selectedLitter.id && !item.deletedAt,
    );
    if (!binding || !confirm("从当前窝次的相册移除这张照片？其它位置使用的原始文件不会删除。"))
      return;
    setIsSaving(true);
    setError("");
    try {
      await archiveMediaBinding(media.id, binding.id);
      await loadLitterImages(selectedLitter.id);
      setNotice("图片已从当前窝次移除");
    } catch (mediaError) {
      setError(getErrorMessage(mediaError));
    } finally {
      setIsSaving(false);
    }
  }

  async function reorderLitterMedia(fromId: string, toId: string) {
    if (!selectedLitter || isSaving || fromId === toId) return;
    const litterId = selectedLitter.id;
    const reordered = movePhoto(selectedLitterImages, fromId, toId);
    setLitterImagesByLitterId((current) => ({ ...current, [litterId]: reordered }));
    setIsSaving(true);
    setError("");
    try {
      for (const [index, media] of reordered.entries()) {
        const binding = media.bindings[0];
        if (binding && binding.sortOrder !== index)
          await updateMediaBinding(media.id, binding.id, { sortOrder: index });
      }
      setNotice("窝次照片顺序已保存");
    } catch (orderError) {
      setError(`窝次照片顺序未全部保存：${getErrorMessage(orderError)}`);
    } finally {
      try {
        await loadLitterImages(litterId);
      } catch (reloadError) {
        setError(getErrorMessage(reloadError));
      }
      setIsSaving(false);
    }
  }

  async function setPrimaryLitterCover(media: MediaAssetData) {
    if (!selectedLitter || isSaving || !media.bindings[0]) return;
    const litterId = selectedLitter.id;
    setIsSaving(true);
    setError("");
    try {
      await updateMediaBinding(media.id, media.bindings[0].id, {
        usage: "cover",
        visibility: "visible",
      });
      for (const other of selectedLitterImages) {
        if (other.id !== media.id && other.bindings[0]?.usage === "cover") {
          await updateMediaBinding(other.id, other.bindings[0].id, { usage: "gallery" });
        }
      }
      setNotice("窝次封面已设置，立即生效");
    } catch (coverError) {
      setError(`窝次封面未全部设置完成：${getErrorMessage(coverError)}`);
    } finally {
      try {
        await loadLitterImages(litterId);
      } catch (reloadError) {
        setError(getErrorMessage(reloadError));
      }
      setIsSaving(false);
    }
  }

  async function replaceLitterMediaBinding(media: MediaAssetData, file: File) {
    if (!selectedLitter || isSaving) return;
    const litterId = selectedLitter.id;
    const binding = media.bindings.find(
      (item) => item.ownerType === "litter" && item.ownerId === litterId && !item.deletedAt,
    );
    if (!binding) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    let uploaded = false;
    let errorMessage = "";
    try {
      await uploadLitterImage(litterId, file, {
        usage: binding.usage,
        sortOrder: binding.sortOrder,
        bindingVisibility: binding.visibility,
      });
      uploaded = true;
      await archiveMediaBinding(media.id, binding.id);
    } catch (mediaError) {
      errorMessage = uploaded
        ? `新照片已上传，但旧照片仍留在相册：${getErrorMessage(mediaError)}。可从相册移除旧照片。`
        : getErrorMessage(mediaError);
    } finally {
      try {
        await loadLitterImages(litterId);
      } catch (refreshError) {
        errorMessage += ` 图片列表刷新失败：${getErrorMessage(refreshError)}`;
      }
      if (errorMessage) setError(errorMessage.trim());
      else setNotice("窝次图片已替换");
      setIsSaving(false);
    }
  }

  return (
    <PageContainer>
      {(["kittens", "litters", "studs", "cats"] as SectionKey[]).includes(activeSection) ? (
        <div className="toolbar">
          <div>
            <p className="eyebrow">CATTERY</p>
            <h2>{SECTION_TITLES[activeSection]}</h2>
            <p className="muted compact">管理猫咪档案、窝次和图片。</p>
          </div>
          <div className="toolbar-actions">
            <button className="secondary-button" type="button" onClick={loadData}>
              刷新
            </button>
          </div>
        </div>
      ) : null}

      {activeSection !== "media" && notice ? <div className="notice">{notice}</div> : null}
      {activeSection !== "media" && error ? <div className="error-banner">{error}</div> : null}
      {activeSection !== "media" && loadError ? (
        <div className="error-banner" role="alert">
          数据加载失败：{loadError}{" "}
          <button type="button" onClick={loadData}>
            重试加载
          </button>
        </div>
      ) : null}
      {activeSection !== "media" && isLoading ? (
        <p className="muted">{hasLoaded ? "正在刷新数据..." : "正在加载数据..."}</p>
      ) : null}
      {activeSection === "kittens" && createdKittenLitterId && !error ? (
        <div className="form-actions next-step-actions">
          <button
            disabled={isSaving}
            type="button"
            onClick={() => void returnToLitter(createdKittenLitterId)}
          >
            返回所属窝次
          </button>
          <button
            className="secondary-button"
            disabled={isSaving}
            type="button"
            onClick={() =>
              openCreateCat(
                "kittens",
                litters.find((item) => item.id === createdKittenLitterId),
              )
            }
          >
            继续录入下一只小猫
          </button>
        </div>
      ) : null}

      {activeSection === "dashboard" && <DashboardPage />}
      {activeSection === "kittens" && (
        <CatManagementWorkspace
          cats={kittens}
          catDraft={catDraft}
          catDirty={catDirty}
          catEditorMode={catEditorMode}
          confirmingArchiveCatId={confirmingArchiveCatId}
          pendingPhotos={pendingCatPhotos}
          pendingCoverId={pendingCatCoverId}
          imageUploadState={catImageUploadState}
          includeArchived={includeArchivedCats}
          hasLoaded={hasLoaded}
          isLoading={isLoading}
          isSaving={isSaving}
          litters={litters}
          loadError={loadError}
          mode="kittens"
          parentLinks={selectedCat ? (parentLinksByCatId[selectedCat.id] ?? []) : []}
          selectedCat={selectedCat}
          selectedCatImages={selectedCatImages}
          onArchive={handleArchiveCat}
          onCancel={cancelCatEditor}
          onChange={setCatDraft}
          onEdit={(cat) => openEditCat(cat, "kittens")}
          onPhotosSelected={handleCatImagesSelected}
          onPendingPhotoRemove={removePendingCatPhoto}
          onPendingCoverChange={setPendingCatCoverId}
          onMediaReorder={reorderCatMedia}
          onSetPrimaryCover={setPrimaryCatCover}
          onMediaBindingChange={updateCatMediaBinding}
          onMediaBindingRemove={removeCatMediaBinding}
          onMediaBindingReplace={replaceCatMediaBinding}
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
          onMediaBindingChange={updateLitterMediaBinding}
          onMediaBindingRemove={removeLitterMediaBinding}
          onMediaBindingReplace={replaceLitterMediaBinding}
          onMediaReorder={reorderLitterMedia}
          onSetPrimaryCover={setPrimaryLitterCover}
          onNew={openCreateLitter}
          onAddKitten={(litter) => openCreateCat("kittens", litter)}
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
          pendingPhotos={pendingCatPhotos}
          pendingCoverId={pendingCatCoverId}
          imageUploadState={catImageUploadState}
          includeArchived={includeArchivedCats}
          isLoading={isLoading}
          isSaving={isSaving}
          litters={litters}
          mode="studs"
          parentLinks={selectedCat ? (parentLinksByCatId[selectedCat.id] ?? []) : []}
          selectedCat={selectedCat}
          selectedCatImages={selectedCatImages}
          onArchive={handleArchiveCat}
          onCancel={cancelCatEditor}
          onChange={setCatDraft}
          onEdit={(cat) => openEditCat(cat, "studs")}
          onPhotosSelected={handleCatImagesSelected}
          onPendingPhotoRemove={removePendingCatPhoto}
          onPendingCoverChange={setPendingCatCoverId}
          onMediaReorder={reorderCatMedia}
          onSetPrimaryCover={setPrimaryCatCover}
          onMediaBindingChange={updateCatMediaBinding}
          onMediaBindingRemove={removeCatMediaBinding}
          onMediaBindingReplace={replaceCatMediaBinding}
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
          pendingPhotos={pendingCatPhotos}
          pendingCoverId={pendingCatCoverId}
          imageUploadState={catImageUploadState}
          includeArchived={includeArchivedCats}
          isLoading={isLoading}
          isSaving={isSaving}
          litters={litters}
          mode="cats"
          parentLinks={selectedCat ? (parentLinksByCatId[selectedCat.id] ?? []) : []}
          selectedCat={selectedCat}
          selectedCatImages={selectedCatImages}
          onArchive={handleArchiveCat}
          onCancel={cancelCatEditor}
          onChange={setCatDraft}
          onEdit={(cat) => openEditCat(cat, "cats")}
          onPhotosSelected={handleCatImagesSelected}
          onPendingPhotoRemove={removePendingCatPhoto}
          onPendingCoverChange={setPendingCatCoverId}
          onMediaReorder={reorderCatMedia}
          onSetPrimaryCover={setPrimaryCatCover}
          onMediaBindingChange={updateCatMediaBinding}
          onMediaBindingRemove={removeCatMediaBinding}
          onMediaBindingReplace={replaceCatMediaBinding}
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
        <FixedPagesPanel
          isLoading={isLoading}
          pages={fixedPages}
          requestedSlug={getFixedPageSlugFromHash(activeHash)}
          onReload={loadData}
        />
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
  pendingPhotos,
  imageUploadState,
  includeArchived,
  hasLoaded,
  isLoading,
  isSaving,
  litters,
  loadError,
  mode,
  parentLinks,
  selectedCat,
  selectedCatImages,
  onArchive,
  onCancel,
  onChange,
  onEdit,
  onPhotosSelected,
  onPendingPhotoRemove,
  pendingCoverId,
  onPendingCoverChange,
  onMediaReorder,
  onSetPrimaryCover,
  onMediaBindingChange,
  onMediaBindingRemove,
  onMediaBindingReplace,
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
  pendingPhotos: PendingCatPhoto[];
  imageUploadState: ImageUploadState;
  includeArchived: boolean;
  hasLoaded?: boolean;
  isLoading: boolean;
  isSaving: boolean;
  litters: LitterData[];
  loadError?: string;
  mode: "kittens" | "studs" | "cats";
  parentLinks: ParentCatLinkData[];
  selectedCat: CatData | null;
  selectedCatImages: MediaAssetData[];
  onArchive: (cat: CatData) => void;
  onCancel: () => void;
  onChange: (draft: CatDraft) => void;
  onEdit: (cat: CatData) => void;
  onPhotosSelected: (files: File[]) => void;
  onPendingPhotoRemove: (id: string) => void;
  pendingCoverId: string;
  onPendingCoverChange: (id: string) => void;
  onMediaReorder: (fromId: string, toId: string) => void;
  onSetPrimaryCover: (media: MediaAssetData) => void;
  onMediaBindingChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onMediaBindingRemove: (media: MediaAssetData) => void;
  onMediaBindingReplace: (media: MediaAssetData, file: File) => void;
  onNew: () => void;
  onSelect: (cat: CatData) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleArchived: (value: boolean) => void;
}) {
  const title = mode === "kittens" ? "小猫管理" : mode === "studs" ? "种猫管理" : "其它猫咪";
  const usableLitters = litters.filter(isUsableLitter);
  const needsLitter =
    mode === "kittens" && hasLoaded && !isLoading && !loadError && usableLitters.length === 0;
  const cannotCreateKitten = mode === "kittens" && (isLoading || Boolean(loadError) || needsLitter);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [visibility, setVisibility] = useState("");
  const [page, setPage] = useState(1);
  const statusOptions =
    mode === "kittens"
      ? KITTEN_STATUS_OPTIONS
      : mode === "studs"
        ? REPRODUCTIVE_STATE_OPTIONS
        : CAT_STATUS_OPTIONS;
  const filteredCats = cats.filter((cat) => {
    const searchable =
      `${cat.name} ${cat.color ?? ""} ${cat.personality ?? ""}`.toLocaleLowerCase();
    const actualStatus =
      mode === "kittens"
        ? cat.kittenProfile?.saleStatus
        : mode === "studs"
          ? cat.breedingProfile?.reproductiveState
          : cat.lifecycleStatus;
    return (
      searchable.includes(query.trim().toLocaleLowerCase()) &&
      (!status || actualStatus === status) &&
      (!visibility || cat.visibility === visibility)
    );
  });
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredCats.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleCats = filteredCats.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return (
    <section
      className={`management-grid wide-detail ${catEditorMode ? "photo-editor-layout" : ""}`}
    >
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
            <button type="button" disabled={cannotCreateKitten} onClick={onNew}>
              新增
            </button>
          </div>
        </div>
        {needsLitter ? (
          <div className="prerequisite-note">
            {litters.length ? "当前没有可用于新增小猫的窝次。" : "新增小猫前需要先创建窝次。"}
            <a href="#litters">前往创建窝次</a>
          </div>
        ) : null}
        <div className="filter-bar">
          <label>
            搜索猫咪
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="名字、颜色或性格"
            />
          </label>
          <SelectField
            label="状态筛选"
            options={[{ label: "全部状态", value: "" }, ...statusOptions]}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <SelectField
            label="可见性筛选"
            options={[{ label: "全部可见性", value: "" }, ...VISIBILITY_OPTIONS]}
            value={visibility}
            onChange={(value) => {
              setVisibility(value);
              setPage(1);
            }}
          />
        </div>
        <p className="muted compact">
          共 {filteredCats.length} 只 · 第 {currentPage} / {totalPages} 页
        </p>
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
              {visibleCats.map((cat) => (
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
                      {!cat.deletedAt ? (
                        <button className="small-button" type="button" onClick={() => onEdit(cat)}>
                          编辑
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="form-actions">
          <button
            className="secondary-button"
            disabled={currentPage <= 1}
            type="button"
            onClick={() => setPage(currentPage - 1)}
          >
            上一页
          </button>
          <button
            className="secondary-button"
            disabled={currentPage >= totalPages}
            type="button"
            onClick={() => setPage(currentPage + 1)}
          >
            下一页
          </button>
        </div>
      </div>
      <aside className="detail-panel" aria-label={`${title}详情`}>
        {catEditorMode ? (
          <CatEditor
            draft={catDraft}
            pendingPhotos={pendingPhotos}
            pendingCoverId={pendingCoverId}
            imageUploadState={imageUploadState}
            isDirty={catDirty}
            isSaving={isSaving}
            litters={litters}
            mode={mode}
            selectedCat={selectedCat}
            selectedCatImages={selectedCatImages}
            onCancel={onCancel}
            onChange={onChange}
            onPhotosSelected={onPhotosSelected}
            onPendingPhotoRemove={onPendingPhotoRemove}
            onPendingCoverChange={onPendingCoverChange}
            onMediaReorder={onMediaReorder}
            onSetPrimaryCover={onSetPrimaryCover}
            onMediaBindingChange={onMediaBindingChange}
            onMediaBindingRemove={onMediaBindingRemove}
            onMediaBindingReplace={onMediaBindingReplace}
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
            <strong>
              {needsLitter
                ? "先创建可用窝次，再新增小猫"
                : mode === "kittens"
                  ? "从左侧选择小猫，或点击上方新增"
                  : "选择一只猫查看详情"}
            </strong>
            {mode !== "kittens" && !cannotCreateKitten ? (
              <button type="button" onClick={onNew}>
                新增
              </button>
            ) : null}
          </div>
        )}
      </aside>
    </section>
  );
}

function CatEditor({
  draft,
  pendingPhotos,
  imageUploadState,
  isDirty,
  isSaving,
  litters,
  mode,
  selectedCat,
  selectedCatImages,
  onCancel,
  onChange,
  onPhotosSelected,
  onPendingPhotoRemove,
  pendingCoverId,
  onPendingCoverChange,
  onMediaReorder,
  onSetPrimaryCover,
  onMediaBindingChange,
  onMediaBindingRemove,
  onMediaBindingReplace,
  onSubmit,
}: {
  draft: CatDraft;
  pendingPhotos: PendingCatPhoto[];
  imageUploadState: ImageUploadState;
  isDirty: boolean;
  isSaving: boolean;
  litters: LitterData[];
  mode: "kittens" | "studs" | "cats";
  selectedCat: CatData | null;
  selectedCatImages: MediaAssetData[];
  onCancel: () => void;
  onChange: (draft: CatDraft) => void;
  onPhotosSelected: (files: File[]) => void;
  onPendingPhotoRemove: (id: string) => void;
  pendingCoverId: string;
  onPendingCoverChange: (id: string) => void;
  onMediaReorder: (fromId: string, toId: string) => void;
  onSetPrimaryCover: (media: MediaAssetData) => void;
  onMediaBindingChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onMediaBindingRemove: (media: MediaAssetData) => void;
  onMediaBindingReplace: (media: MediaAssetData, file: File) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const selectableLitters = litters.filter(
    (litter) =>
      isUsableLitter(litter) || (litter.id === draft.kittenLitterId && Boolean(selectedCat)),
  );
  const selectedLitterName = selectableLitters.find(
    (litter) => litter.id === draft.kittenLitterId,
  )?.name;
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
          {selectedLitterName ? (
            <p className="prerequisite-note">
              当前所属窝次：<strong>{selectedLitterName}</strong>。可在下方更换。
            </p>
          ) : null}
          <div className="form-grid">
            <SelectField
              label="所属窝次（必选）"
              options={[
                { label: "请选择窝次", value: "" },
                ...selectableLitters.map((litter) => ({ label: litter.name, value: litter.id })),
              ]}
              value={draft.kittenLitterId}
              required
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
        pendingPhotos={pendingPhotos}
        pendingCoverId={pendingCoverId}
        imageUploadState={imageUploadState}
        images={selectedCatImages}
        isSaving={isSaving}
        mode={mode}
        onChange={onChange}
        onPhotosSelected={onPhotosSelected}
        onPendingPhotoRemove={onPendingPhotoRemove}
        onPendingCoverChange={onPendingCoverChange}
        onMediaReorder={onMediaReorder}
        onSetPrimaryCover={onSetPrimaryCover}
        onMediaBindingChange={onMediaBindingChange}
        onMediaBindingRemove={onMediaBindingRemove}
        onMediaBindingReplace={onMediaBindingReplace}
      />

      <FormActions isSaving={isSaving} onCancel={onCancel} />
    </form>
  );
}

function CatImageManager({
  draft,
  pendingPhotos,
  pendingCoverId,
  imageUploadState,
  images,
  isSaving,
  mode,
  onChange,
  onPhotosSelected,
  onPendingPhotoRemove,
  onPendingCoverChange,
  onMediaReorder,
  onSetPrimaryCover,
  onMediaBindingChange,
  onMediaBindingRemove,
  onMediaBindingReplace,
}: {
  draft: CatDraft;
  pendingPhotos: PendingCatPhoto[];
  pendingCoverId: string;
  imageUploadState: ImageUploadState;
  images: MediaAssetData[];
  isSaving: boolean;
  mode: "kittens" | "studs" | "cats";
  onChange: (draft: CatDraft) => void;
  onPhotosSelected: (files: File[]) => void;
  onPendingPhotoRemove: (id: string) => void;
  onPendingCoverChange: (id: string) => void;
  onMediaReorder: (fromId: string, toId: string) => void;
  onSetPrimaryCover: (media: MediaAssetData) => void;
  onMediaBindingChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onMediaBindingRemove: (media: MediaAssetData) => void;
  onMediaBindingReplace: (media: MediaAssetData, file: File) => void;
}) {
  const [showPresentation, setShowPresentation] = useState(false);
  const [detailImageId, setDetailImageId] = useState("");
  const visibleImages = images.filter((media) => media.bindings[0]?.visibility === "visible");
  return (
    <section className="cat-image-uploader photo-workspace" aria-label="照片管理">
      <div className="subsection-heading">
        <div>
          <h4>照片</h4>
          <p className="muted compact">添加照片后点保存上传；已在相册中的操作会立即生效。</p>
        </div>
        <span className={`upload-state upload-state-${imageUploadState}`}>
          {formatImageState(imageUploadState)}
        </span>
      </div>
      <label className="secondary-button photo-add-button">
        添加照片
        <input
          aria-label="添加照片"
          accept="image/*"
          disabled={isSaving}
          multiple
          type="file"
          onChange={(event) => {
            onPhotosSelected(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />
      </label>
      {pendingPhotos.length > 0 ? (
        <div className="photo-pending-section">
          <strong>待上传 · {pendingPhotos.length} 张</strong>
          <p className="muted compact">这些照片只在本地预览，保存成功后才会显示到小程序。</p>
          <div className="photo-wall">
            {pendingPhotos.map((photo) => (
              <div className="photo-card photo-card-pending" key={photo.id}>
                <img alt={photo.file.name} src={photo.url} />
                <div className="photo-card-body">
                  <span className="status-badge">
                    {photo.id === pendingCoverId ? "待上传封面" : "待上传"}
                  </span>
                  <div className="photo-card-actions">
                    <button
                      className="secondary-button small-button"
                      disabled={isSaving}
                      type="button"
                      onClick={() => onPendingCoverChange(photo.id)}
                    >
                      设为封面
                    </button>
                    <button
                      className="secondary-button small-button"
                      disabled={isSaving}
                      type="button"
                      onClick={() => onPendingPhotoRemove(photo.id)}
                    >
                      移除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <MediaBindingEditor
        images={images}
        onChange={onMediaBindingChange}
        onRemove={onMediaBindingRemove}
        onReplace={onMediaBindingReplace}
        onReorder={onMediaReorder}
        onSetCover={onSetPrimaryCover}
        onAdjust={(media) => {
          setDetailImageId(media.id);
          setShowPresentation(true);
        }}
        ownerLabel="这只猫"
        disabled={isSaving}
      />
      {showPresentation ? (
        <div className="photo-presentation-settings">
          <div className="subsection-heading">
            <h4>调整展示</h4>
            <button
              className="secondary-button small-button"
              type="button"
              onClick={() => setShowPresentation(false)}
            >
              收起
            </button>
          </div>
          <p className="muted compact">
            不同位置可以使用不同照片和裁剪。这里的调整将在保存档案后生效。
          </p>
          <EntryCoverEditor
            entries={
              mode === "studs"
                ? ["listCard", "breedingPlanCard", "communityProfile"]
                : mode === "kittens"
                  ? ["listCard", "communityProfile"]
                  : ["listCard"]
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
            initialImageId={detailImageId}
            value={draft.imagePresentation.detailImagePresentations}
            onChange={(detailImagePresentations) =>
              onChange({
                ...draft,
                imagePresentation: { ...draft.imagePresentation, detailImagePresentations },
              })
            }
          />
        </div>
      ) : (
        <button
          className="secondary-button"
          type="button"
          onClick={() => setShowPresentation(true)}
        >
          不同展示位置的图片设置
        </button>
      )}
    </section>
  );
}

function MediaBindingEditor({
  images,
  onChange,
  onRemove,
  onReplace,
  onReorder,
  onSetCover,
  onAdjust,
  ownerLabel = "当前内容",
  disabled = false,
}: {
  images: MediaAssetData[];
  onChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onRemove: (media: MediaAssetData) => void;
  onReplace?: (media: MediaAssetData, file: File) => void;
  onReorder?: (fromId: string, toId: string) => void;
  onSetCover?: (media: MediaAssetData) => void;
  onAdjust?: (media: MediaAssetData) => void;
  ownerLabel?: string;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<MediaAssetData | null>(null);
  if (images.length === 0)
    return <div className="cat-image-placeholder">相册还没有照片。点击“添加照片”开始。</div>;
  return (
    <>
      <div className="photo-wall">
        {images.map((media, index) => (
          <PhotoCard
            key={media.id}
            media={media}
            index={index}
            count={images.length}
            disabled={disabled}
            previousId={images[index - 1]?.id}
            nextId={images[index + 1]?.id}
            onChange={onChange}
            onRemove={onRemove}
            onReplace={onReplace}
            onReorder={onReorder}
            onSetCover={onSetCover}
            onAdjust={onAdjust}
            onPreview={() => setPreview(media)}
            ownerLabel={ownerLabel}
          />
        ))}
      </div>
      {preview ? (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="查看照片"
          onClick={() => setPreview(null)}
        >
          <button type="button" className="photo-lightbox-close" onClick={() => setPreview(null)}>
            关闭
          </button>
          <img
            alt={preview.altText || preview.title || "照片"}
            src={preview.sourceUrl || preview.thumbnailUrl || ""}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

function PhotoCard({
  media,
  index,
  count,
  disabled,
  previousId,
  nextId,
  onChange,
  onRemove,
  onReplace,
  onReorder,
  onSetCover,
  onAdjust,
  onPreview,
  ownerLabel,
}: {
  media: MediaAssetData;
  index: number;
  count: number;
  disabled: boolean;
  previousId?: string;
  nextId?: string;
  onChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onRemove: (media: MediaAssetData) => void;
  onReplace?: (media: MediaAssetData, file: File) => void;
  onReorder?: (fromId: string, toId: string) => void;
  onSetCover?: (media: MediaAssetData) => void;
  onAdjust?: (media: MediaAssetData) => void;
  onPreview: () => void;
  ownerLabel: string;
}) {
  const [replacement, setReplacement] = useState<{ file: File; url: string } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(
    () => () => {
      if (replacement) URL.revokeObjectURL(replacement.url);
    },
    [replacement],
  );
  useEffect(() => setImageFailed(false), [media.id, replacement]);
  const binding = media.bindings[0];
  const hidden = binding?.visibility !== "visible";
  return (
    <article
      className="photo-card"
      draggable={Boolean(onReorder) && !disabled}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", media.id)}
      onDragOver={(event) => {
        if (onReorder) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onReorder?.(event.dataTransfer.getData("text/plain"), media.id);
      }}
    >
      <button
        className="photo-thumb-button"
        type="button"
        onClick={() => (imageFailed ? setImageFailed(false) : onPreview())}
        aria-label={`查看第 ${index + 1} 张大图`}
      >
        {imageFailed ? (
          <span className="photo-load-error">
            照片暂时无法加载
            <br />
            点击重试
          </span>
        ) : (
          <img
            alt={media.altText || media.title || `照片 ${index + 1}`}
            src={replacement?.url || media.thumbnailUrl || media.sourceUrl}
            onError={() => setImageFailed(true)}
          />
        )}
      </button>
      <div className="photo-card-body">
        <div className="status-cluster">
          {binding?.usage === "cover" ? (
            <span className="status-badge status-pinned">封面</span>
          ) : null}
          {hidden ? <span className="status-badge">已隐藏</span> : null}
          {replacement ? <span className="status-badge">替换预览</span> : null}
        </div>
        <div className="photo-card-actions">
          {onSetCover ? (
            <button
              className="secondary-button small-button"
              disabled={disabled}
              type="button"
              onClick={() => onSetCover(media)}
            >
              设为封面
            </button>
          ) : null}
          {onAdjust ? (
            <button
              className="secondary-button small-button"
              type="button"
              onClick={() => onAdjust(media)}
            >
              调整展示
            </button>
          ) : null}
        </div>
        <details className="photo-more">
          <summary>更多操作</summary>
          <div className="photo-more-actions">
            {onReorder ? (
              <>
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => {
                    if (previousId) onReorder(media.id, previousId);
                  }}
                >
                  向前移动
                </button>
                <button
                  type="button"
                  disabled={disabled || index === count - 1}
                  onClick={() => {
                    if (nextId) onReorder(media.id, nextId);
                  }}
                >
                  向后移动
                </button>
              </>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(media, { visibility: hidden ? "visible" : "hidden" })}
            >
              {hidden ? "显示照片" : "隐藏照片"}
            </button>
            {onReplace ? (
              <label>
                替换照片
                <input
                  aria-label="替换图片"
                  accept="image/*"
                  disabled={disabled}
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setReplacement({ file, url: URL.createObjectURL(file) });
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            ) : null}
            <button type="button" disabled={disabled} onClick={() => onRemove(media)}>
              从{ownerLabel}的相册移除
            </button>
          </div>
        </details>
        {replacement ? (
          <div className="photo-replace-confirm">
            <span>确认用新照片替换？原照片会保留到替换完成。</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onReplace?.(media, replacement.file);
                setReplacement(null);
              }}
            >
              确认替换
            </button>
            <button type="button" onClick={() => setReplacement(null)}>
              取消
            </button>
          </div>
        ) : null}
      </div>
    </article>
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
  const selectedImageId =
    selection?.imageId ??
    images.find((item) => item.bindings[0]?.usage === "cover")?.id ??
    images[0]?.id ??
    "";
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
        <h4>不同展示位置的封面</h4>
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
        <div className="photo-entry-options" aria-label="选择展示照片">
          {images.map((image, index) => (
            <button
              key={image.id}
              className={`photo-entry-option ${selectedImageId === image.id ? "selected" : ""}`}
              type="button"
              aria-label={`选择第 ${index + 1} 张作为${COVER_ENTRY_META.find((item) => item.key === activeEntry)?.label}`}
              onClick={() => patchSelection({ imageId: image.id })}
            >
              <img
                alt={image.altText || image.title || `照片 ${index + 1}`}
                src={image.thumbnailUrl || image.sourceUrl}
              />
              <span>照片 {index + 1}</span>
            </button>
          ))}
        </div>
        <div className="presentation-preview">
          <CroppedPreview
            aspectRatio={entryAspectRatio(activeEntry)}
            cropRect={currentCrop}
            image={images.find((item) => item.id === selectedImageId)}
            mode={selection ? "crop" : "cover"}
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
  initialImageId,
  value,
  onChange,
}: {
  images: MediaAssetData[];
  initialImageId?: string;
  value?: DetailImagePresentations;
  onChange: (value: DetailImagePresentations | undefined) => void;
}) {
  const [activeImageId, setActiveImageId] = useState(initialImageId ?? "");
  useEffect(() => {
    if (initialImageId) setActiveImageId(initialImageId);
  }, [initialImageId]);
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
        <h4>详情页照片</h4>
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
        <CroppedPreview
          aspectRatio={4 / 5}
          cropRect={cropRect}
          image={image}
          mode={presentation?.mode ?? "cover"}
        />
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
  const controls: Array<{ key: keyof CropRect; label: string }> = [
    { key: "width", label: "裁剪宽度" },
    { key: "height", label: "裁剪高度" },
    { key: "x", label: "水平位置" },
    { key: "y", label: "垂直位置" },
  ];
  return (
    <div className="photo-crop-controls">
      {controls.map(({ key, label }) => (
        <label key={key}>
          {label}
          <input
            max={
              key === "x"
                ? 1 - value.width
                : key === "y"
                  ? 1 - value.height
                  : key === "width"
                    ? 1 - value.x
                    : 1 - value.y
            }
            min={key === "width" || key === "height" ? 0.1 : 0}
            step="0.01"
            type="range"
            value={value[key]}
            onChange={(event) =>
              onChange({
                ...value,
                [key]: Number.parseFloat(event.target.value),
              })
            }
          />
        </label>
      ))}
    </div>
  );
}

function CroppedPreview({
  aspectRatio,
  cropRect,
  image,
  mode,
}: {
  aspectRatio: number;
  cropRect: CropRect;
  image?: MediaAssetData;
  mode: "cover" | "crop" | "original";
}) {
  if (!image) return <div className="cat-image-placeholder">暂无图片</div>;
  const style = mode === "crop" ? cropPreviewStyle(image, aspectRatio, cropRect) : null;
  return (
    <div className="cropped-preview-frame" style={{ aspectRatio }}>
      <img
        alt={image.altText || image.title || image.id}
        src={image.thumbnailUrl || image.sourceUrl}
        style={
          style ?? {
            width: "100%",
            height: "100%",
            left: 0,
            top: 0,
            objectFit: mode === "original" ? "contain" : "cover",
          }
        }
      />
    </div>
  );
}

function entryAspectRatio(entry: CoverEntry): number {
  if (entry === "communityProfile") return 4 / 3;
  if (entry === "breedingPlanCard") return 1;
  return 16 / 10;
}

function cropPreviewStyle(image: MediaAssetData, aspectRatio: number, cropRect: CropRect) {
  const naturalWidth = Number(image.width);
  const naturalHeight = Number(image.height);
  if (!(naturalWidth > 0 && naturalHeight > 0)) return null;
  const width = Math.max(0.01, Math.min(1, cropRect.width));
  const height = Math.max(0.01, Math.min(1, cropRect.height));
  const x = Math.max(0, Math.min(1 - width, cropRect.x));
  const y = Math.max(0, Math.min(1 - height, cropRect.y));
  const scale = Math.max(
    100 / (width * naturalWidth),
    100 / aspectRatio / (height * naturalHeight),
  );
  const widthPercent = naturalWidth * scale;
  const heightPercent = naturalHeight * scale * aspectRatio;
  const left = Math.max(100 - widthPercent, Math.min(0, -x * naturalWidth * scale));
  const top = Math.max(100 - heightPercent, Math.min(0, -y * naturalHeight * scale * aspectRatio));
  return {
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
    left: `${left}%`,
    top: `${top}%`,
    objectFit: "contain" as const,
  };
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
  onMediaBindingChange,
  onMediaBindingRemove,
  onMediaBindingReplace,
  onMediaReorder,
  onSetPrimaryCover,
  onNew,
  onAddKitten,
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
  onMediaBindingChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onMediaBindingRemove: (media: MediaAssetData) => void;
  onMediaBindingReplace: (media: MediaAssetData, file: File) => void;
  onMediaReorder: (fromId: string, toId: string) => void;
  onSetPrimaryCover: (media: MediaAssetData) => void;
  onNew: () => void;
  onAddKitten: (litter: LitterData) => void;
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
                    {litter.fatherCat?.name ?? "父亲资料不可用"} /{" "}
                    {litter.motherCat?.name ?? "母亲资料不可用"}
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
            onMediaBindingChange={onMediaBindingChange}
            onMediaBindingRemove={onMediaBindingRemove}
            onMediaBindingReplace={onMediaBindingReplace}
            onMediaReorder={onMediaReorder}
            onSetPrimaryCover={onSetPrimaryCover}
            onSubmit={onSubmit}
          />
        ) : selectedLitter ? (
          <LitterDetail
            litter={selectedLitter}
            images={selectedImages}
            kittens={kittens}
            onEdit={onEdit}
            onAddKitten={onAddKitten}
          />
        ) : (
          <div className="empty-state">
            <strong>从左侧选择窝次，或点击上方新增窝次</strong>
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
  onMediaBindingChange,
  onMediaBindingRemove,
  onMediaBindingReplace,
  onMediaReorder,
  onSetPrimaryCover,
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
  onMediaBindingChange: (
    media: MediaAssetData,
    patch: { usage?: string; sortOrder?: number; visibility?: string },
  ) => void;
  onMediaBindingRemove: (media: MediaAssetData) => void;
  onMediaBindingReplace: (media: MediaAssetData, file: File) => void;
  onMediaReorder: (fromId: string, toId: string) => void;
  onSetPrimaryCover: (media: MediaAssetData) => void;
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
        <MediaBindingEditor
          images={selectedImages}
          onChange={onMediaBindingChange}
          onRemove={onMediaBindingRemove}
          onReplace={onMediaBindingReplace}
          onReorder={onMediaReorder}
          onSetCover={onSetPrimaryCover}
          ownerLabel="当前窝次"
          disabled={isSaving}
        />
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
          {!cat.deletedAt ? (
            <button
              className="secondary-button small-button"
              type="button"
              onClick={() => onEdit(cat)}
            >
              编辑
            </button>
          ) : null}
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
              .map((link) => link.parentProfile?.displayName ?? "家长资料不可用")
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
  onAddKitten,
}: {
  images: MediaAssetData[];
  kittens: KittenProfileData[];
  litter: LitterData;
  onEdit: (litter: LitterData) => void;
  onAddKitten: (litter: LitterData) => void;
}) {
  const primaryImage = getPrimaryMedia(images);
  return (
    <div className="detail-stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Litter Detail</p>
          <h3>{litter.name}</h3>
        </div>
        <div className="table-actions">
          {isUsableLitter(litter) ? (
            <button type="button" onClick={() => onAddKitten(litter)}>
              添加小猫
            </button>
          ) : null}
          <button
            className="secondary-button small-button"
            type="button"
            onClick={() => onEdit(litter)}
          >
            编辑
          </button>
        </div>
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
          ["父亲", litter.fatherCat?.name ?? "父亲资料不可用"],
          ["母亲", litter.motherCat?.name ?? "母亲资料不可用"],
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
              <strong>{kitten.cat?.name ?? "猫咪资料不可用"}</strong>
              <span>{formatOption(kitten.saleStatus, KITTEN_STATUS_OPTIONS)}</span>
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
  required = false,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>
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

function replaceImagePresentationReferences(
  value: ImagePresentation,
  previousId: string,
  replacementId: string,
): ImagePresentation {
  const entryCoverSelections = value.entryCoverSelections
    ? (Object.fromEntries(
        Object.entries(value.entryCoverSelections).map(([entry, selection]) => [
          entry,
          selection?.imageId === previousId ? { ...selection, imageId: replacementId } : selection,
        ]),
      ) as EntryCoverSelections)
    : undefined;
  return {
    ...value,
    entryCoverSelections,
    detailImagePresentations: renameImageKey(
      value.detailImagePresentations,
      previousId,
      replacementId,
    ),
    detailCarouselPresentations: renameImageKey(
      value.detailCarouselPresentations,
      previousId,
      replacementId,
    ),
  };
}

function removeImagePresentationReferences(
  value: ImagePresentation,
  imageId: string,
): ImagePresentation {
  const entryCoverSelections = { ...value.entryCoverSelections };
  for (const entry of Object.keys(entryCoverSelections) as CoverEntry[]) {
    if (entryCoverSelections[entry]?.imageId === imageId) delete entryCoverSelections[entry];
  }
  const detailImagePresentations = { ...value.detailImagePresentations };
  const detailCarouselPresentations = { ...value.detailCarouselPresentations };
  delete detailImagePresentations[imageId];
  delete detailCarouselPresentations[imageId];
  return {
    ...value,
    entryCoverSelections: Object.keys(entryCoverSelections).length
      ? entryCoverSelections
      : undefined,
    detailImagePresentations: Object.keys(detailImagePresentations).length
      ? detailImagePresentations
      : undefined,
    detailCarouselPresentations: Object.keys(detailCarouselPresentations).length
      ? detailCarouselPresentations
      : undefined,
  };
}

function renameImageKey<T>(
  value: Record<string, T> | undefined,
  previousId: string,
  replacementId: string,
): Record<string, T> | undefined {
  if (!value || !Object.hasOwn(value, previousId)) return value;
  const next = { ...value, [replacementId]: value[previousId] };
  delete next[previousId];
  return next;
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
  return items
    .map((media) => ({
      ...media,
      bindings: media.bindings.filter(
        (binding) =>
          binding.ownerType === ownerType && binding.ownerId === ownerId && !binding.deletedAt,
      ),
    }))
    .filter((media) => media.bindings.length > 0)
    .sort((a, b) => a.bindings[0].sortOrder - b.bindings[0].sortOrder || a.id.localeCompare(b.id));
}

function movePhoto(items: MediaAssetData[], fromId: string, toId: string) {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
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
    ) ?? images.find((media) => media.bindings.some((binding) => binding.visibility === "visible"))
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
  if (mode === "kittens")
    return cat.kittenProfile
      ? formatOption(cat.kittenProfile.saleStatus, KITTEN_STATUS_OPTIONS)
      : formatOption(cat.lifecycleStatus, CAT_STATUS_OPTIONS);
  if (mode === "studs")
    return (
      cat.breedingProfile?.statusLabel ||
      (cat.breedingProfile?.reproductiveState
        ? formatOption(cat.breedingProfile.reproductiveState, REPRODUCTIVE_STATE_OPTIONS)
        : formatOption(cat.lifecycleStatus, CAT_STATUS_OPTIONS))
    );
  return formatOption(cat.lifecycleStatus, CAT_STATUS_OPTIONS);
}

function formatParentOwnership(cat: CatData) {
  const links = cat.parentCatLinks ?? [];
  const link = links.find((item) => item.status === "active") ?? links[0];
  if (!link) return "-";
  const parentName = link.parentProfile?.displayName || "家长资料不可用";
  return `${parentName} / ${formatParentRelationship(link.relationship)}`;
}

function isUsableLitter(litter: LitterData) {
  return !litter.deletedAt && litter.status !== "archived" && litter.visibility !== "archived";
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
  if (window.location.hash === "#fixed-pages" || getFixedPageSlugFromHash(window.location.hash))
    return "fixedPages";
  if (window.location.hash === "#community") return "communityModeration";
  if (window.location.hash === "#community-comments") return "communityComments";
  if (window.location.hash === "#parent-users") return "parentUsers";
  if (window.location.hash === "#parent-applications") return "parentApplications";
  if (window.location.hash === "#selection-applications") return "selectionApplications";
  return "kittens";
}

const SECTION_HASHES: Record<SectionKey, string> = {
  dashboard: "#dashboard",
  kittens: "#kittens",
  litters: "#litters",
  studs: "#studs",
  cats: "#cats",
  media: "#media",
  fixedPages: "#fixed-pages/home",
  communityModeration: "#community",
  communityComments: "#community-comments",
  parentUsers: "#parent-users",
  parentApplications: "#parent-applications",
  selectionApplications: "#selection-applications",
};

const SECTION_TITLES: Record<SectionKey, string> = {
  dashboard: "数据概览",
  kittens: "小猫",
  litters: "窝次",
  studs: "种猫",
  cats: "其它猫咪",
  media: "媒体库",
  fixedPages: "站点内容",
  communityModeration: "动态管理",
  communityComments: "评论管理",
  parentUsers: "家长列表",
  parentApplications: "家长申请审核",
  selectionApplications: "问卷提交",
};

function getFixedPageSlugFromHash(hash: string): FixedPageData["slug"] | null {
  const slug = hash.match(/^#fixed-pages\/([a-z-]+)$/)?.[1];
  return slug && FIXED_PAGE_SLUGS.has(slug) ? (slug as FixedPageData["slug"]) : null;
}

const FIXED_PAGE_SLUGS = new Set([
  "home",
  "about",
  "philosophy",
  "environment",
  "feeding",
  "process",
  "breeding-plan",
  "aftercare",
  "questionnaire",
  "contact",
]);
