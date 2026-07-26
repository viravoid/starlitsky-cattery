import { useSyncExternalStore } from "react";
import {
  KITTENS as LEGACY_KITTENS,
  LITTERS as LEGACY_LITTERS,
  STUDS as LEGACY_STUDS,
  type Kitten,
  type KittenStatus,
  type StructureRating,
  type Stud,
  type StudCategory,
} from "./cattery-data";
import {
  DEFAULT_QUESTIONNAIRE_CONTENT,
  type QuestionnaireContent,
} from "./questionnaire-content";
import {
  QUESTIONNAIRE_FIELD_ORDER,
  QUESTIONNAIRE_SUBMISSION_STATUSES,
  createQuestionnaireSubmissionAnswers,
  createQuestionnaireSubmissionFingerprint,
  normalizeQuestionnaireSubmission,
  questionnaireSubmissionStatusTone,
  type QuestionnaireSubmission,
  type QuestionnaireSubmissionAnswers,
  type QuestionnaireSubmissionFieldKey,
  type QuestionnaireSubmissionStatus,
} from "./questionnaire-submissions";

export { QUESTIONNAIRE_SUBMISSION_STATUSES, questionnaireSubmissionStatusTone };
export type {
  QuestionnaireSubmission,
  QuestionnaireSubmissionAnswers,
  QuestionnaireSubmissionFieldKey,
  QuestionnaireSubmissionStatus,
};

export type Role = "guest" | "user" | "parent" | "keeper";
export type Category = "猫舍日常" | "碎碎念" | "家长分享";
export type UserId = string;
export type CatId = string;
export type LitterId = string;
export type PostId = string;
export type Visibility = "visible" | "hidden" | "archived";

export interface CatteryUser {
  id: UserId;
  name: string;
  role: "parent" | "keeper";
  activatedAt?: string;
  active?: boolean;
  inviteCode?: string;
  note?: string;
}

export interface KittenFields {
  status: KittenStatus;
  price: string;
  litterId?: LitterId;
  fatherId?: CatId;
  motherId?: CatId;
  legacyFatherName?: string;
  legacyMotherName?: string;
  structureRating?: StructureRating;
}

export interface StudFields {
  role: string;
  category: StudCategory;
  status: string;
  trait: string;
  source: string;
  reproductiveState: "active" | "preparing" | "retired" | "semiRetired" | "archived";
}

export interface FamilyCatFields {
  joinDate?: string;
  note?: string;
}

export interface CatteryCat {
  id: CatId;
  kind: "kitten" | "stud" | "family";
  name: string;
  gender?: string;
  color?: string;
  birthday?: string;
  personality?: string;
  story?: string[];
  ownerId?: UserId;
  ownerLabel?: string;
  coverImageId?: string;
  galleryImageIds: string[];
  visibility: Visibility;
  createdAt?: string;
  updatedAt?: string;
  kitten?: KittenFields;
  stud?: StudFields;
  family?: FamilyCatFields;
}

export interface Litter {
  id: LitterId;
  name: string;
  birthDate?: string;
  status: string;
  fatherId?: CatId;
  motherId?: CatId;
  note?: string;
  coverImageId?: string;
  galleryImageIds: string[];
  visibility: Visibility;
  createdAt?: string;
  updatedAt?: string;
}

export type SelectVisibilityMode = "all" | "public";

export interface KittenRecord {
  id: CatId;
  name: string;
  gender: string;
  color: string;
  birthday: string;
  fatherId?: CatId;
  fatherName: string;
  motherId?: CatId;
  motherName: string;
  status: KittenStatus;
  price: string;
  litterId?: LitterId;
  litterName?: string;
  ownerId?: UserId;
  ownerName?: string;
  personality: string;
  story?: string[];
  structureRating?: StructureRating;
  coverImageId?: string;
  galleryImageIds: string[];
  visibility: Visibility;
  createdAt?: string;
  updatedAt?: string;
  linkedPostCount: number;
}

export interface LitterRecord {
  id: LitterId;
  name: string;
  birthDate?: string;
  status: string;
  fatherId?: CatId;
  fatherName?: string;
  motherId?: CatId;
  motherName?: string;
  note?: string;
  coverImageId?: string;
  galleryImageIds: string[];
  visibility: Visibility;
  createdAt?: string;
  updatedAt?: string;
  kittenIds: CatId[];
  kittenNames: string[];
  kittenCount: number;
  linkedPostCount: number;
}

export interface StudRecord {
  id: CatId;
  name: string;
  gender: string;
  color: string;
  birthday: string;
  personality: string;
  story?: string[];
  role: string;
  category: StudCategory;
  status: string;
  trait: string;
  source: string;
  reproductiveState: StudFields["reproductiveState"];
  coverImageId?: string;
  galleryImageIds: string[];
  visibility: Visibility;
  createdAt?: string;
  updatedAt?: string;
  linkedPostCount: number;
  linkedKittenCount: number;
  linkedLitterCount: number;
}

export interface Comment {
  id: string;
  authorId: UserId;
  authorName: string;
  authorRole: "猫舍主理人" | "星月家长" | "普通用户";
  content: string;
  createdAt: string;
  hidden?: boolean;
}

export interface Post {
  id: PostId;
  authorId: UserId;
  authorName: string;
  authorRole: "猫舍主理人" | "星月家长";
  category: Category;
  content: string;
  imageCount: number;
  catIds: CatId[];
  litterIds?: LitterId[];
  createdAt: string;
  updatedAt?: string;
  lastEditedById?: UserId;
  likes: number;
  likedByMe: boolean;
  comments: Comment[];
  pinned?: boolean;
  hidden?: boolean;
}

export interface CatteryData {
  version: 1;
  users: CatteryUser[];
  cats: CatteryCat[];
  litters: Litter[];
  posts: Post[];
  questionnaireSubmissions: QuestionnaireSubmission[];
}

export interface UpdatePostContext {
  role: Role;
  currentUserId: UserId | null;
}

type EditableActor = {
  role: "parent" | "keeper";
  id: UserId;
  user: CatteryUser;
};

export const CATTERY_STORAGE_KEY = "starlitsky.cattery.saved.v1";
export const CATTERY_SAVED_EVENT = "starlitsky:cattery-saved";

export const KEEPER_YUEQI = "keeper-yueqi";
export const KEEPER_XINGXIA = "keeper-xingxia";
export const PARENT_TOAST = "parent-toast";
export const PARENT_HUHU = "parent-huhu";

const CAT_ALIASES: Record<string, string> = {
  "cat-chonglou": "chonglou",
};

const LITTER_ALIASES: Record<string, string> = {
  A窝: "litter-a",
  B窝: "litter-b",
  C窝: "litter-c",
};

const LITTER_META: Record<string, { birthDate: string; status: string; note: string }> = {
  "litter-a": {
    birthDate: "2026-04-18",
    status: "成长记录中",
    note: "重点关联猫友圈成长动态。",
  },
  "litter-b": {
    birthDate: "2026-05-09",
    status: "观察中",
    note: "部分小猫仍在评估展示状态。",
  },
  "litter-c": {
    birthDate: "2026-06-02",
    status: "已建档",
    note: "待补充父母和完整小猫资料。",
  },
};

const DEFAULT_USERS: CatteryUser[] = [
  { id: KEEPER_YUEQI, name: "月七", role: "keeper", note: "猫舍主理人" },
  { id: KEEPER_XINGXIA, name: "星下", role: "keeper", note: "猫舍主理人" },
  {
    id: PARENT_TOAST,
    name: "吐司的家长",
    role: "parent",
    activatedAt: "2026-03-12",
    inviteCode: "XY-TOAST-2025",
  },
  {
    id: PARENT_HUHU,
    name: "呼呼和奶油的家长",
    role: "parent",
    activatedAt: "2026-02-04",
    inviteCode: "XY-HUHU-2025",
  },
];

const DEFAULT_FAMILY_CATS: CatteryCat[] = [
  {
    id: "cat-huhu",
    kind: "family",
    ownerId: PARENT_HUHU,
    name: "呼呼",
    gender: "弟弟",
    birthday: "2025-08-15",
    color: "棕虎斑加白",
    personality: "话痨，最爱蹲厨房门口等罐头。",
    galleryImageIds: [],
    visibility: "visible",
    family: { joinDate: "2026-01-20" },
  },
  {
    id: "cat-cream",
    kind: "family",
    ownerId: PARENT_HUHU,
    name: "奶油",
    gender: "妹妹",
    birthday: "2025-08-15",
    color: "玳瑁麻纹加白",
    personality: "安静温柔，喜欢晒太阳。",
    galleryImageIds: [],
    visibility: "visible",
    family: { joinDate: "2026-01-20" },
  },
  {
    id: "cat-toast",
    kind: "family",
    ownerId: PARENT_TOAST,
    name: "吐司",
    gender: "弟弟",
    birthday: "2025-06-30",
    color: "银虎斑加白",
    personality: "一周岁的小机灵鬼，饭点最准时。",
    galleryImageIds: [],
    visibility: "visible",
    family: { joinDate: "2025-12-18" },
  },
];

const DEFAULT_POSTS: Post[] = [
  {
    id: "p-1",
    authorId: KEEPER_YUEQI,
    authorName: "月七",
    authorRole: "猫舍主理人",
    category: "猫舍日常",
    content: "好看！好看宝宝！呼呼哈哈！",
    imageCount: 1,
    catIds: ["cat-huhu"],
    createdAt: "2026-07-14T09:20:00",
    likes: 24,
    likedByMe: false,
    comments: [
      {
        id: "c-1",
        authorId: PARENT_HUHU,
        authorName: "呼呼和奶油的家长",
        authorRole: "星月家长",
        content: "谢谢主理人！还是这么可爱～",
        createdAt: "2026-07-14T10:02:00",
      },
    ],
    pinned: true,
  },
  {
    id: "p-2",
    authorId: PARENT_TOAST,
    authorName: "吐司的家长",
    authorRole: "星月家长",
    category: "家长分享",
    content: "一周岁啦！在新家也还是每天准时蹲在厨房门口等罐头。",
    imageCount: 3,
    catIds: ["cat-toast"],
    createdAt: "2026-07-12T18:45:00",
    likes: 42,
    likedByMe: true,
    comments: [
      {
        id: "c-2",
        authorId: KEEPER_YUEQI,
        authorName: "月七",
        authorRole: "猫舍主理人",
        content: "生日快乐吐司！",
        createdAt: "2026-07-12T19:10:00",
      },
    ],
  },
  {
    id: "p-3",
    authorId: PARENT_HUHU,
    authorName: "呼呼和奶油的家长",
    authorRole: "星月家长",
    category: "家长分享",
    content: "今天两个宝宝一起晒太阳，终于拍到同框了。",
    imageCount: 4,
    catIds: ["cat-huhu", "cat-cream"],
    litterIds: ["litter-a"],
    createdAt: "2026-07-10T15:12:00",
    likes: 58,
    likedByMe: false,
    comments: [],
  },
  {
    id: "p-4",
    authorId: KEEPER_XINGXIA,
    authorName: "星下",
    authorRole: "猫舍主理人",
    category: "碎碎念",
    content: "阴天的午后，大家都在打盹。有时候繁育这件事，就是慢慢陪它们长大。",
    imageCount: 2,
    catIds: [],
    createdAt: "2026-07-08T14:00:00",
    likes: 31,
    likedByMe: false,
    comments: [],
  },
  {
    id: "p-5",
    authorId: KEEPER_YUEQI,
    authorName: "月七",
    authorRole: "猫舍主理人",
    category: "猫舍日常",
    content: "重楼今天出来溜达啦，退役猫待遇享受中。",
    imageCount: 1,
    catIds: ["chonglou"],
    createdAt: "2026-07-05T11:30:00",
    likes: 19,
    likedByMe: false,
    comments: [],
  },
  {
    id: "p-6",
    authorId: KEEPER_YUEQI,
    authorName: "月七",
    authorRole: "猫舍主理人",
    category: "猫舍日常",
    content: "A 窝的小朋友们今天开食啦，小家伙们吃相都特别可爱。",
    imageCount: 2,
    catIds: [],
    litterIds: ["litter-a"],
    createdAt: "2026-07-02T10:15:00",
    likes: 36,
    likedByMe: false,
    comments: [],
  },
];

const KEEPERS_ALLOWED_CATEGORIES: Category[] = ["猫舍日常", "碎碎念", "家长分享"];
const PARENTS_ALLOWED_CATEGORIES: Category[] = ["家长分享", "碎碎念"];
const QUESTIONNAIRE_SUBMISSION_DEDUPE_WINDOW_MS = 5_000;

const DEFAULT_QUESTIONNAIRE_SUBMISSIONS: QuestionnaireSubmission[] = [
  createSeedQuestionnaireSubmission("questionnaire-demo-1", "2026-07-06T21:14:00", {
    name: "示例文字（缺少姓名）",
    gender: "female",
    phone: "138****0000",
    age: "28",
    job: "示例文字（缺少职业）",
    city: "西安",
    experience: "yes",
    residents: "yes",
    residentsNeutered: "neutered",
    hasKids: "no",
    housing: "owned",
    windowSealed: "sealed",
    familyAgree: "allAgree",
    wantGender: "female",
    wantColor: "银虎斑、玳瑁都可以",
    budget: "1w-2w",
    acceptNeuter: "accept",
    monthlySpend: "500to1000",
    scientificFeeding: "accept",
    acceptActive: "accept",
    commitment: "accept",
  }),
  createSeedQuestionnaireSubmission(
    "questionnaire-demo-2",
    "2026-07-04T10:32:00",
    {
      name: "示例文字（缺少姓名）",
      gender: "male",
      phone: "159****8888",
      age: "34",
      job: "示例文字（缺少职业）",
      city: "成都",
      experience: "no",
      residents: "no",
      hasKids: "yes",
      housing: "rentApproved",
      windowSealed: "canSeal",
      familyAgree: "allAgree",
      wantGender: "either",
      wantColor: "棕虎斑",
      budget: "2w-3w",
      acceptNeuter: "accept",
      monthlySpend: "over1000",
      scientificFeeding: "needMoreInfo",
      acceptActive: "accept",
      commitment: "accept",
    },
    "已联系",
  ),
  createSeedQuestionnaireSubmission(
    "questionnaire-demo-3",
    "2026-07-01T16:05:00",
    {
      name: "示例文字（缺少姓名）",
      gender: "female",
      phone: "186****2233",
      age: "26",
      job: "示例文字（缺少职业）",
      city: "上海",
      experience: "yes",
      residents: "yes",
      residentsNeutered: "partiallyNeutered",
      hasKids: "no",
      housing: "rentUnconfirmed",
      windowSealed: "cannotSeal",
      familyAgree: "partAgree",
      wantGender: "currentCat",
      wantColor: "都可以",
      budget: "可根据小猫情况沟通",
      acceptNeuter: "accept",
      monthlySpend: "500to1000",
      scientificFeeding: "accept",
      acceptActive: "needMoreInfo",
      commitment: "accept",
    },
    "适合继续沟通",
  ),
];

const defaultData: CatteryData = {
  version: 1,
  users: DEFAULT_USERS,
  cats: [
    ...LEGACY_STUDS.map(studToCat),
    ...LEGACY_KITTENS.map(kittenToCat),
    ...DEFAULT_FAMILY_CATS,
  ],
  litters: LEGACY_LITTERS.map((name) => {
    const id = resolveLitterId(name);
    const meta = LITTER_META[id] ?? { birthDate: "", status: "已建档", note: "" };
    return {
      id,
      name,
      birthDate: meta.birthDate,
      status: meta.status,
      note: meta.note,
      galleryImageIds: [],
      visibility: "visible",
    };
  }),
  posts: DEFAULT_POSTS,
  questionnaireSubmissions: DEFAULT_QUESTIONNAIRE_SUBMISSIONS,
};
const serverCatterySnapshot = cloneCatteryData(defaultData);

let data: CatteryData = cloneDefaultCatteryData();
const listeners = new Set<() => void>();
let activeStorageWindow: Window | null = null;
let hydrated = false;

export function resolveCatId(id: string) {
  return CAT_ALIASES[id] ?? id;
}

export function resolveLitterId(id: string) {
  return LITTER_ALIASES[id] ?? id;
}

export function resolveLitterReference(reference: string, state: CatteryData = data) {
  const canonical = resolveLitterId(reference);
  if (state.litters.some((litter) => litter.id === canonical)) return canonical;
  const matchedByName = state.litters.find((litter) => litter.name === reference);
  return matchedByName?.id ?? canonical;
}

export function cloneDefaultCatteryData() {
  return cloneCatteryData(defaultData);
}

export function normalizeCatteryData(value: unknown): CatteryData {
  if (!value || typeof value !== "object") return cloneDefaultCatteryData();
  if (isLegacyCommunityData(value)) return normalizeLegacyCommunityData(value);

  const input = value as Partial<CatteryData>;
  return {
    version: 1,
    users: normalizeUsers(input.users),
    cats: normalizeCats(input.cats),
    litters: normalizeLitters(input.litters),
    posts: normalizePosts(input.posts),
    questionnaireSubmissions: normalizeQuestionnaireSubmissions(input.questionnaireSubmissions),
  };
}

export function loadSavedCatteryData() {
  if (!isBrowser()) return cloneDefaultCatteryData();
  try {
    return parseSavedCatteryData(window.localStorage.getItem(CATTERY_STORAGE_KEY));
  } catch {
    return cloneDefaultCatteryData();
  }
}

export function saveCatteryData(content: CatteryData) {
  setData(content);
  if (isBrowser()) window.dispatchEvent(new CustomEvent(CATTERY_SAVED_EVENT));
}

function writeCatteryData(content: CatteryData) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(CATTERY_STORAGE_KEY, JSON.stringify(normalizeCatteryData(content)));
  } catch {
    // Browser storage may be blocked or full; keep the in-memory demo state usable.
  }
}

export function subscribeToCatteryData(callback: () => void) {
  if (!isBrowser()) return () => {};

  listeners.add(callback);
  ensureStorageListener();
  return () => {
    listeners.delete(callback);
    removeStorageListenerIfUnused();
  };
}

export function useCattery<T>(selector: (state: CatteryData) => T): T {
  const snapshot = useSyncExternalStore(
    subscribe,
    getCatteryDataSnapshot,
    getServerCatterySnapshot,
  );
  return selector(snapshot);
}

export function getCatteryDataSnapshot() {
  return data;
}

export function hasHydratedCatteryData() {
  return hydrated;
}

function getServerCatterySnapshot() {
  return serverCatterySnapshot;
}

export function hydrateCatteryDataFromStorage() {
  setData(loadSavedCatteryData(), false);
}

export function resetCatteryDataForTests(next?: unknown) {
  setData(next === undefined ? cloneDefaultCatteryData() : normalizeCatteryData(next), false);
}

export function findUserByInviteCode(inviteCode: string, state: CatteryData = data) {
  const normalized = inviteCode.trim();
  if (!normalized) return null;
  return (
    state.users.find(
      (user) => user.role === "parent" && (user.inviteCode?.trim() ?? "") === normalized,
    ) ?? null
  );
}

export function isParentUserActive(
  user: Pick<CatteryUser, "role" | "activatedAt" | "active"> | null | undefined,
) {
  return Boolean(user && user.role === "parent" && user.activatedAt && user.active !== false);
}

export const catteryActions = {
  replaceAll(next: CatteryData) {
    setData(next);
  },
  addUser(input: Omit<CatteryUser, "id"> & { id?: string }, context?: UpdatePostContext) {
    if (context && !canManageCattery(context)) return null;

    const id =
      input.id?.trim() ||
      createUnusedId("parent", (candidate) => data.users.some((user) => user.id === candidate));
    if (data.users.some((user) => user.id === id)) return null;
    setData({
      ...data,
      users: [...data.users, normalizeUser({ ...input, id })],
    });
    return id;
  },
  createParent(
    input: { id?: string; name: string; inviteCode: string; note?: string; activatedAt?: string },
    context?: UpdatePostContext,
  ) {
    if (context && !canManageCattery(context)) return null;

    const name = input.name.trim();
    const inviteCode = input.inviteCode.trim();
    if (!name || !inviteCode) return null;

    const id =
      input.id?.trim() ||
      createUnusedId("parent", (candidate) => data.users.some((user) => user.id === candidate));
    if (data.users.some((user) => user.id === id)) return null;
    if (
      data.users.some(
        (user) => user.role === "parent" && (user.inviteCode?.trim() ?? "") === inviteCode,
      )
    ) {
      return null;
    }

    const parent = normalizeUser({
      id,
      name,
      role: "parent",
      inviteCode,
      note: normalizeOptionalText(input.note),
      activatedAt: input.activatedAt?.trim() || today(),
      active: true,
    });
    setData({ ...data, users: [...data.users, parent] });
    return id;
  },
  updateParent(
    id: UserId,
    patch: Partial<Pick<CatteryUser, "name" | "inviteCode" | "note">>,
    context?: UpdatePostContext,
  ) {
    if (context && !canManageCattery(context)) return false;

    const existing = data.users.find((user) => user.id === id && user.role === "parent");
    if (!existing) return false;

    const name = patch.name === undefined ? existing.name : patch.name.trim();
    const inviteCode =
      patch.inviteCode === undefined
        ? (existing.inviteCode?.trim() ?? "")
        : patch.inviteCode.trim();
    if (!name || !inviteCode) return false;
    if (
      data.users.some(
        (user) =>
          user.id !== id &&
          user.role === "parent" &&
          (user.inviteCode?.trim() ?? "") === inviteCode,
      )
    ) {
      return false;
    }

    setData({
      ...data,
      users: data.users.map((user) =>
        user.id === id && user.role === "parent"
          ? normalizeUser({
              ...user,
              name,
              inviteCode,
              note: patch.note === undefined ? user.note : normalizeOptionalText(patch.note),
            })
          : user,
      ),
    });
    return true;
  },
  toggleParentActive(id: UserId, context?: UpdatePostContext) {
    if (context && !canManageCattery(context)) return false;
    if (!data.users.some((user) => user.id === id && user.role === "parent")) return false;

    setData({
      ...data,
      users: data.users.map((user) =>
        user.id === id && user.role === "parent"
          ? normalizeUser({
              ...user,
              activatedAt: user.activatedAt ?? today(),
              active: user.activatedAt && user.active !== false ? false : true,
            })
          : user,
      ),
    });
    return true;
  },
  addKitten(
    input: Omit<CatteryCat, "id" | "kind" | "galleryImageIds" | "visibility" | "kitten"> & {
      id?: string;
      visibility?: Visibility;
      galleryImageIds?: string[];
      kitten: KittenFields;
    },
    context: UpdatePostContext,
  ) {
    if (!canManageCattery(context)) return null;

    const id = input.id?.trim() || createStableId("kitten");
    const cat = normalizeCat({
      ...input,
      id,
      kind: "kitten",
      galleryImageIds: input.galleryImageIds ?? [],
      visibility: input.visibility ?? "visible",
      kitten: input.kitten,
    });
    setData({ ...data, cats: [...data.cats, cat] });
    return id;
  },
  addStud(
    input: Omit<CatteryCat, "id" | "kind" | "galleryImageIds" | "visibility" | "stud"> & {
      id?: string;
      visibility?: Visibility;
      galleryImageIds?: string[];
      stud: StudFields;
    },
    context: UpdatePostContext,
  ) {
    if (!canManageCattery(context)) return null;

    const id = input.id?.trim() || createStableId("stud");
    const cat = normalizeCat({
      ...input,
      id,
      kind: "stud",
      galleryImageIds: input.galleryImageIds ?? [],
      visibility: input.visibility ?? "visible",
      stud: input.stud,
    });
    setData({ ...data, cats: [...data.cats, cat] });
    return id;
  },
  addFamilyCat(
    input: Omit<CatteryCat, "id" | "kind" | "galleryImageIds" | "visibility"> & { id?: string },
    context: UpdatePostContext,
  ) {
    const actor = getEditableActor(context);
    if (!actor) return null;
    if (actor.role === "parent" && input.ownerId !== actor.id) return null;

    const id = input.id?.trim() || createStableId("cat");
    const cat: CatteryCat = normalizeCat({
      ...input,
      id,
      kind: "family",
      galleryImageIds: [],
      visibility: "visible",
    });
    setData({ ...data, cats: [...data.cats, cat] });
    return id;
  },
  updateCat(id: CatId, patch: Partial<CatteryCat>, context: UpdatePostContext) {
    const resolvedId = resolveCatId(id);
    const actor = getEditableActor(context);
    const existing = data.cats.find((cat) => cat.id === resolvedId);
    if (!actor || !existing || !canManageCat(existing, actor)) return false;
    const safePatch = safeCatPatch(patch, actor);

    setData({
      ...data,
      cats: data.cats.map((cat) =>
        cat.id === resolvedId ? normalizeCat({ ...cat, ...safePatch, updatedAt: now() }) : cat,
      ),
    });
    return true;
  },
  updateKitten(id: CatId, patch: Partial<CatteryCat>, context: UpdatePostContext) {
    const resolvedId = resolveCatId(id);
    const actor = getEditableActor(context);
    const existing = data.cats.find((cat) => cat.id === resolvedId);
    if (!actor || actor.role !== "keeper" || !existing || existing.kind !== "kitten") {
      return false;
    }
    const safePatch = safeCatPatch(patch, actor);

    setData({
      ...data,
      cats: data.cats.map((cat) =>
        cat.id === resolvedId ? normalizeCat({ ...cat, ...safePatch, updatedAt: now() }) : cat,
      ),
    });
    return true;
  },
  updateStud(id: CatId, patch: Partial<CatteryCat>, context: UpdatePostContext) {
    const resolvedId = resolveCatId(id);
    const actor = getEditableActor(context);
    const existing = data.cats.find((cat) => cat.id === resolvedId);
    if (!actor || actor.role !== "keeper" || !existing || existing.kind !== "stud") {
      return false;
    }
    const safePatch = safeCatPatch(patch, actor);

    setData({
      ...data,
      cats: data.cats.map((cat) =>
        cat.id === resolvedId ? normalizeCat({ ...cat, ...safePatch, updatedAt: now() }) : cat,
      ),
    });
    return true;
  },
  deleteFamilyCat(id: CatId, context: UpdatePostContext) {
    const resolvedId = resolveCatId(id);
    const actor = getEditableActor(context);
    const existing = data.cats.find((cat) => cat.id === resolvedId);
    if (!actor || !existing || existing.kind !== "family" || !canManageCat(existing, actor)) {
      return false;
    }

    setData({
      ...data,
      cats: data.cats.filter((cat) => cat.id !== resolvedId),
      posts: data.posts.map((post) => ({
        ...post,
        catIds: post.catIds.filter((catId) => resolveCatId(catId) !== resolvedId),
      })),
    });
    return true;
  },
  setCatVisibility(id: CatId, visibility: Visibility, context: UpdatePostContext) {
    const resolvedId = resolveCatId(id);
    const actor = getEditableActor(context);
    const existing = data.cats.find((cat) => cat.id === resolvedId);
    if (!actor || actor.role !== "keeper" || !existing) return false;

    setData({
      ...data,
      cats: data.cats.map((cat) =>
        cat.id === resolvedId ? normalizeCat({ ...cat, visibility, updatedAt: now() }) : cat,
      ),
    });
    return true;
  },
  setStudVisibility(id: CatId, visibility: Visibility) {
    return catteryActions.setCatVisibility(id, visibility, {
      role: "keeper",
      currentUserId: KEEPER_YUEQI,
    });
  },
  setStudReproductiveState(id: CatId, reproductiveState: StudFields["reproductiveState"]) {
    const resolvedId = resolveCatId(id);
    setData({
      ...data,
      cats: data.cats.map((cat) =>
        cat.id === resolvedId && cat.kind === "stud" && cat.stud
          ? normalizeCat({
              ...cat,
              updatedAt: now(),
              visibility: reproductiveState === "archived" ? "archived" : cat.visibility,
              stud: { ...cat.stud, reproductiveState },
            })
          : cat,
      ),
    });
  },
  addLitter(
    input: Omit<Litter, "id" | "galleryImageIds" | "visibility"> & {
      id?: string;
      galleryImageIds?: string[];
      visibility?: Visibility;
    },
    context: UpdatePostContext,
  ) {
    if (!canManageCattery(context)) return null;

    const id = input.id?.trim() || createStableId("litter");
    const litter = normalizeLitter({
      ...input,
      id,
      galleryImageIds: input.galleryImageIds ?? [],
      visibility: input.visibility ?? "visible",
    });
    setData({ ...data, litters: [...data.litters, litter] });
    return id;
  },
  updateLitter(id: LitterId, patch: Partial<Litter>, context?: UpdatePostContext) {
    if (context && !canManageCattery(context)) return false;

    const resolvedId = resolveLitterReference(id);
    setData({
      ...data,
      litters: data.litters.map((litter) =>
        litter.id === resolvedId
          ? normalizeLitter({ ...litter, ...safeLitterPatch(patch), updatedAt: now() })
          : litter,
      ),
    });
    return true;
  },
  setLitterVisibility(id: LitterId, visibility: Visibility, context: UpdatePostContext) {
    if (!canManageCattery(context)) return false;

    const resolvedId = resolveLitterReference(id);
    setData({
      ...data,
      litters: data.litters.map((litter) =>
        litter.id === resolvedId
          ? normalizeLitter({ ...litter, visibility, updatedAt: now() })
          : litter,
      ),
    });
    return true;
  },
  submitQuestionnaire(
    input: {
      content: QuestionnaireContent;
      values: Partial<Record<QuestionnaireSubmissionFieldKey, string>>;
      dedupeWindowMs?: number;
    },
  ) {
    const answers = createQuestionnaireSubmissionAnswers(input.values, input.content);
    const fingerprint = createQuestionnaireSubmissionFingerprint(answers);
    const nowIso = now();
    const dedupeWindowMs = Math.max(0, input.dedupeWindowMs ?? QUESTIONNAIRE_SUBMISSION_DEDUPE_WINDOW_MS);
    const duplicate = data.questionnaireSubmissions.find((submission) => {
      const submittedAt = Date.parse(submission.submittedAt);
      const createdAt = Date.parse(nowIso);
      if (Number.isNaN(submittedAt) || Number.isNaN(createdAt)) return false;
      return (
        createdAt - submittedAt <= dedupeWindowMs &&
        createQuestionnaireSubmissionFingerprint(submission.answers) === fingerprint
      );
    });
    if (duplicate) {
      return { id: duplicate.id, created: false as const };
    }

    const id = createUnusedId("questionnaire", (candidate) =>
      data.questionnaireSubmissions.some((submission) => submission.id === candidate),
    );
    const submission = normalizeQuestionnaireSubmission({
      id,
      submittedAt: nowIso,
      status: "未查看",
      answers,
    });
    setData({
      ...data,
      questionnaireSubmissions: [submission, ...data.questionnaireSubmissions],
    });
    return { id, created: true as const };
  },
  updateQuestionnaireSubmissionStatus(id: string, status: QuestionnaireSubmissionStatus) {
    if (!data.questionnaireSubmissions.some((submission) => submission.id === id)) return false;
    setData({
      ...data,
      questionnaireSubmissions: data.questionnaireSubmissions.map((submission) =>
        submission.id === id ? normalizeQuestionnaireSubmission({ ...submission, status }) : submission,
      ),
    });
    return true;
  },
  updateQuestionnaireSubmissionAdminNote(id: string, adminNote: string) {
    if (!data.questionnaireSubmissions.some((submission) => submission.id === id)) return false;
    setData({
      ...data,
      questionnaireSubmissions: data.questionnaireSubmissions.map((submission) =>
        submission.id === id
          ? normalizeQuestionnaireSubmission({ ...submission, adminNote })
          : submission,
      ),
    });
    return true;
  },
  createPost(
    input: {
      category: Category;
      content: string;
      imageCount: number;
      catIds: string[];
      litterIds?: string[];
    },
    context: UpdatePostContext,
  ) {
    const actor = getEditableActor(context);
    if (!actor) return null;
    const allowedCategories =
      actor.role === "keeper" ? KEEPERS_ALLOWED_CATEGORIES : PARENTS_ALLOWED_CATEGORIES;
    const category = allowedCategories.includes(input.category)
      ? input.category
      : actor.role === "parent"
        ? "家长分享"
        : "猫舍日常";
    const catIds =
      actor.role === "keeper"
        ? input.catIds.map(resolveCatId)
        : input.catIds
            .map(resolveCatId)
            .filter((catId) =>
              data.cats.some((cat) => cat.id === catId && cat.ownerId === actor.id),
            );
    const id = createStableId("p");
    const post = normalizePost({
      id,
      authorId: actor.user.id,
      authorName: actor.user.name,
      authorRole: actor.role === "keeper" ? "猫舍主理人" : "星月家长",
      category,
      content: input.content,
      imageCount: clampImageCount(input.imageCount),
      catIds,
      litterIds:
        actor.role === "keeper"
          ? (input.litterIds ?? []).map((item) => resolveLitterReference(item))
          : [],
      createdAt: now(),
      likes: 0,
      likedByMe: false,
      comments: [],
    });
    setData({ ...data, posts: [post, ...data.posts] });
    return id;
  },
  updatePost(id: PostId, patch: Partial<Post>, context: UpdatePostContext) {
    const actor = getEditableActor(context);
    const existing = data.posts.find((post) => post.id === id);
    if (!actor || !existing || !canEditPost(existing, actor)) return false;
    const safePatch = safePostPatch(patch, actor);
    setData({
      ...data,
      posts: data.posts.map((post) =>
        post.id === id
          ? normalizePost({
              ...post,
              ...safePatch,
              updatedAt: now(),
              lastEditedById: post.authorId === actor.id ? post.lastEditedById : actor.id,
            })
          : post,
      ),
    });
    return true;
  },
  deletePost(id: PostId, context: UpdatePostContext) {
    const actor = getEditableActor(context);
    const existing = data.posts.find((post) => post.id === id);
    if (!actor || !existing || !canDeletePost(existing, actor)) return false;

    setData({ ...data, posts: data.posts.filter((post) => post.id !== id) });
    return true;
  },
  toggleLike(postId: PostId) {
    setData({
      ...data,
      posts: data.posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              likedByMe: !post.likedByMe,
              likes: Math.max(0, post.likedByMe ? post.likes - 1 : post.likes + 1),
            }
          : post,
      ),
    });
  },
  addComment(
    postId: PostId,
    input: Omit<Comment, "id" | "createdAt"> & { id?: string; createdAt?: string },
  ) {
    setData({
      ...data,
      posts: data.posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: [
                ...post.comments,
                normalizeComment({
                  ...input,
                  id: input.id?.trim() || createStableId("c"),
                  createdAt: input.createdAt ?? now(),
                }),
              ],
            }
          : post,
      ),
    });
  },
  togglePin(id: PostId, context: UpdatePostContext) {
    const actor = getEditableActor(context);
    const existing = data.posts.find((post) => post.id === id);
    if (!actor || !existing || !canModeratePost(actor)) return false;

    setData({
      ...data,
      posts: data.posts.map((post) => (post.id === id ? { ...post, pinned: !post.pinned } : post)),
    });
    return true;
  },
  toggleHidePost(id: PostId, context: UpdatePostContext) {
    const actor = getEditableActor(context);
    const existing = data.posts.find((post) => post.id === id);
    if (!actor || !existing || !canModeratePost(actor)) return false;

    setData({
      ...data,
      posts: data.posts.map((post) => (post.id === id ? { ...post, hidden: !post.hidden } : post)),
    });
    return true;
  },
  toggleHideComment(postId: PostId, commentId: string, context: UpdatePostContext) {
    const actor = getEditableActor(context);
    const existing = data.posts.find((post) => post.id === postId);
    if (!actor || !existing || !canModeratePost(actor)) return false;

    setData({
      ...data,
      posts: data.posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              comments: post.comments.map((comment) =>
                comment.id === commentId ? { ...comment, hidden: !comment.hidden } : comment,
              ),
            }
          : post,
      ),
    });
    return true;
  },
  deleteComment(postId: PostId, commentId: string, context: UpdatePostContext) {
    const actor = getEditableActor(context);
    const existing = data.posts.find((post) => post.id === postId);
    if (!actor || !existing || !canDeleteComment(existing, commentId, actor)) return false;

    setData({
      ...data,
      posts: data.posts.map((post) =>
        post.id === postId
          ? { ...post, comments: post.comments.filter((comment) => comment.id !== commentId) }
          : post,
      ),
    });
    return true;
  },
};

export function selectUsers(state: CatteryData = data) {
  return state.users.map((user) => ({ ...user }));
}

export function selectPosts(state: CatteryData = data) {
  const userNames = new Map(state.users.map((user) => [user.id, user.name]));
  return state.posts.map((post) => {
    const next = clonePost(post);
    const authorName = userNames.get(post.authorId);
    if (authorName) next.authorName = authorName;
    next.comments = next.comments.map((comment) => {
      const commentAuthorName = userNames.get(comment.authorId);
      return commentAuthorName ? { ...comment, authorName: commentAuthorName } : comment;
    });
    return next;
  });
}

export function selectQuestionnaireSubmissions(state: CatteryData = data) {
  return [...state.questionnaireSubmissions]
    .map(cloneQuestionnaireSubmission)
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
}

export function selectLitters(state: CatteryData = data) {
  return state.litters.map((litter) => ({
    ...litter,
    galleryImageIds: [...litter.galleryImageIds],
  }));
}

export function selectKittenRecords(
  state: CatteryData = data,
  visibility: SelectVisibilityMode = "public",
): KittenRecord[] {
  const visibleLitterNames = new Map(
    state.litters
      .filter((litter) => litter.visibility === "visible")
      .map((litter) => [litter.id, litter.name]),
  );
  const allLitterNames = new Map(state.litters.map((litter) => [litter.id, litter.name]));
  const userNames = new Map(state.users.map((user) => [user.id, user.name]));
  return state.cats
    .filter((cat) => cat.kind === "kitten" && cat.kitten)
    .filter((cat) => (visibility === "all" ? true : cat.visibility === "visible"))
    .map((cat) => {
      const resolvedLitterId = cat.kitten?.litterId
        ? resolveLitterReference(cat.kitten.litterId, state)
        : undefined;
      return {
        id: cat.id,
        name: cat.name,
        gender: cat.gender ?? "",
        color: cat.color ?? "",
        birthday: cat.birthday ?? "",
        fatherId: cat.kitten?.fatherId,
        fatherName: cat.kitten?.legacyFatherName ?? findCatName(state, cat.kitten?.fatherId) ?? "",
        motherId: cat.kitten?.motherId,
        motherName: cat.kitten?.legacyMotherName ?? findCatName(state, cat.kitten?.motherId) ?? "",
        status: cat.kitten?.status ?? "待找家",
        price: cat.kitten?.price ?? "",
        litterId: resolvedLitterId,
        litterName:
          resolvedLitterId === undefined
            ? undefined
            : visibility === "all"
              ? allLitterNames.get(resolvedLitterId)
              : visibleLitterNames.get(resolvedLitterId),
        ownerId: cat.ownerId,
        ownerName: cat.ownerId ? userNames.get(cat.ownerId) : undefined,
        personality: cat.personality ?? "",
        story: cat.story ? [...cat.story] : undefined,
        structureRating: cloneStructureRating(cat.kitten?.structureRating),
        coverImageId: cat.coverImageId,
        galleryImageIds: [...cat.galleryImageIds],
        visibility: cat.visibility,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        linkedPostCount: state.posts.filter((post) => post.catIds.includes(cat.id)).length,
      };
    });
}

export function selectLitterRecords(
  state: CatteryData = data,
  visibility: SelectVisibilityMode = "public",
): LitterRecord[] {
  return state.litters
    .filter((litter) => (visibility === "all" ? true : litter.visibility === "visible"))
    .map((litter) => {
      const resolvedId = resolveLitterReference(litter.id, state);
      const kittens = state.cats.filter(
        (cat) =>
          cat.kind === "kitten" &&
          cat.kitten &&
          resolveLitterReference(cat.kitten.litterId ?? "", state) === resolvedId,
      );
      return {
        id: litter.id,
        name: litter.name,
        birthDate: litter.birthDate,
        status: litter.status,
        fatherId: litter.fatherId,
        fatherName: findCatName(state, litter.fatherId),
        motherId: litter.motherId,
        motherName: findCatName(state, litter.motherId),
        note: litter.note,
        coverImageId: litter.coverImageId,
        galleryImageIds: [...litter.galleryImageIds],
        visibility: litter.visibility,
        createdAt: litter.createdAt,
        updatedAt: litter.updatedAt,
        kittenIds: kittens.map((kitten) => kitten.id),
        kittenNames: kittens.map((kitten) => kitten.name),
        kittenCount: kittens.length,
        linkedPostCount: state.posts.filter((post) =>
          (post.litterIds ?? []).some((item) => resolveLitterReference(item, state) === resolvedId),
        ).length,
      };
    });
}

export function selectKittens(state: CatteryData = data): Kitten[] {
  return selectKittenRecords(state, "public").map((kitten) => ({
    id: kitten.id,
    name: kitten.name,
    gender: kitten.gender,
    color: kitten.color,
    birthday: kitten.birthday,
    father: kitten.fatherName,
    mother: kitten.motherName,
    status: kitten.status,
    price: kitten.price,
    litter: kitten.litterName,
    personality: kitten.personality,
    story: kitten.story ? [...kitten.story] : undefined,
    structureRating: cloneStructureRating(kitten.structureRating),
  }));
}

export function selectStudRecords(
  state: CatteryData = data,
  visibility: SelectVisibilityMode = "public",
): StudRecord[] {
  return state.cats
    .filter((cat) => cat.kind === "stud" && cat.stud)
    .filter((cat) => (visibility === "all" ? true : cat.visibility === "visible"))
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      gender: cat.gender ?? "",
      color: cat.color ?? "",
      birthday: cat.birthday ?? "",
      personality: cat.personality ?? "",
      story: cat.story ? [...cat.story] : undefined,
      role: cat.stud?.role ?? "",
      category: cat.stud?.category ?? "现役公猫",
      status: cat.stud?.status ?? "",
      trait: cat.stud?.trait ?? "",
      source: cat.stud?.source ?? "",
      reproductiveState: cat.stud?.reproductiveState ?? "active",
      coverImageId: cat.coverImageId,
      galleryImageIds: [...cat.galleryImageIds],
      visibility: cat.visibility,
      createdAt: cat.createdAt,
      updatedAt: cat.updatedAt,
      linkedPostCount: state.posts.filter((post) => post.catIds.includes(cat.id)).length,
      linkedKittenCount: state.cats.filter(
        (item) =>
          item.kind === "kitten" &&
          item.kitten &&
          (item.kitten.fatherId === cat.id || item.kitten.motherId === cat.id),
      ).length,
      linkedLitterCount: state.litters.filter(
        (litter) => litter.fatherId === cat.id || litter.motherId === cat.id,
      ).length,
    }));
}

export function selectStuds(state: CatteryData = data): Stud[] {
  return state.cats
    .filter((cat) => cat.kind === "stud" && cat.stud && cat.visibility === "visible")
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color ?? "",
      role: cat.stud?.role ?? "",
      category: cat.stud?.category ?? "现役公猫",
      status: cat.stud?.status ?? "",
      trait: cat.stud?.trait ?? "",
      source: cat.stud?.source ?? "",
      story: cat.story ? [...cat.story] : undefined,
    }));
}

export function selectFamilyCats(state: CatteryData = data) {
  return state.cats
    .filter((cat) => cat.kind === "family" && cat.visibility !== "archived")
    .map((cat) => ({
      id: cat.id,
      ownerId: cat.ownerId ?? "",
      name: cat.name,
      gender: cat.gender === "妹妹" ? "妹妹" : "弟弟",
      birthday: cat.birthday ?? "",
      joinDate: cat.family?.joinDate,
      color: cat.color ?? "",
      personality: cat.personality ?? "",
      note: cat.family?.note,
    }));
}

function subscribe(listener: () => void) {
  if (!hydrated && isBrowser()) {
    hydrated = true;
    hydrateCatteryDataFromStorage();
  }
  return subscribeToCatteryData(listener);
}

function setData(next: CatteryData, persist = true) {
  data = cloneCatteryData(normalizeCatteryData(next));
  if (persist) writeCatteryData(data);
  notifyListeners();
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("Cattery data subscriber failed.", error);
    }
  });
}

function parseSavedCatteryData(raw: string | null) {
  if (!raw) return cloneDefaultCatteryData();
  try {
    return normalizeCatteryData(JSON.parse(raw));
  } catch {
    return cloneDefaultCatteryData();
  }
}

function ensureStorageListener() {
  if (!isBrowser() || activeStorageWindow === window) return;
  activeStorageWindow?.removeEventListener("storage", handleStorageEvent);
  window.addEventListener("storage", handleStorageEvent);
  activeStorageWindow = window;
}

function removeStorageListenerIfUnused() {
  if (listeners.size > 0 || !activeStorageWindow) return;
  activeStorageWindow.removeEventListener("storage", handleStorageEvent);
  activeStorageWindow = null;
}

function handleStorageEvent(event: StorageEvent) {
  if (event.key !== CATTERY_STORAGE_KEY) return;
  setData(parseSavedCatteryData(event.newValue), false);
}

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeLegacyCommunityData(value: { users?: unknown; cats?: unknown; posts?: unknown }) {
  const base = cloneDefaultCatteryData();
  const legacyCats = Array.isArray(value.cats)
    ? value.cats
        .map((item) => normalizeLegacyCommunityCat(item))
        .filter((cat): cat is CatteryCat => Boolean(cat))
    : [];
  const legacyIds = new Set(legacyCats.map((cat) => cat.id));
  return normalizeCatteryData({
    version: 1,
    users: value.users,
    cats: [...base.cats.filter((cat) => !legacyIds.has(cat.id)), ...legacyCats],
    litters: base.litters,
    posts: value.posts,
  });
}

function isLegacyCommunityData(
  value: object,
): value is { users?: unknown; cats?: unknown; posts?: unknown } {
  return !("version" in value) && ("users" in value || "cats" in value || "posts" in value);
}

function normalizeUsers(value: unknown) {
  const fallback = cloneDefaultCatteryData().users;
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const users = value.map(normalizeUser).filter((user) => {
    if (!user.id || seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
  return users.length > 0 ? users : fallback;
}

function normalizeUser(value: unknown): CatteryUser {
  const input = objectValue(value);
  const activatedAt = optionalString(input.activatedAt, undefined);
  return {
    id: optionalString(input.id, createStableId("user")),
    name: optionalString(input.name, "未命名用户"),
    role: input.role === "keeper" ? "keeper" : "parent",
    activatedAt,
    active: input.role === "keeper" ? true : optionalBoolean(input.active, Boolean(activatedAt)),
    inviteCode: optionalString(input.inviteCode, undefined),
    note: optionalString(input.note, undefined),
  };
}

function optionalBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeCats(value: unknown) {
  const fallback = cloneDefaultCatteryData().cats;
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const cats = value.map(normalizeCat).filter((cat) => {
    cat.id = resolveCatId(cat.id);
    if (!cat.id || seen.has(cat.id)) return false;
    seen.add(cat.id);
    return true;
  });
  return cats.length > 0 ? cats : fallback;
}

function normalizeCat(value: unknown): CatteryCat {
  const input = objectValue(value);
  const kind =
    input.kind === "stud" || input.kind === "family" || input.kind === "kitten"
      ? input.kind
      : "family";
  const cat: CatteryCat = {
    id: resolveCatId(optionalString(input.id, createStableId("cat"))),
    kind,
    name: optionalString(input.name, "未命名猫咪"),
    gender: optionalString(input.gender, undefined),
    color: optionalString(input.color, undefined),
    birthday: optionalString(input.birthday, undefined),
    personality: optionalString(input.personality, undefined),
    story: optionalStringArray(input.story),
    ownerId: optionalString(input.ownerId, undefined),
    ownerLabel: optionalString(input.ownerLabel, undefined),
    coverImageId: optionalString(input.coverImageId, undefined),
    galleryImageIds: optionalStringArray(input.galleryImageIds) ?? [],
    visibility: normalizeVisibility(input.visibility),
    createdAt: optionalString(input.createdAt, undefined),
    updatedAt: optionalString(input.updatedAt, undefined),
  };
  if (kind === "kitten") cat.kitten = normalizeKittenFields(input.kitten);
  if (kind === "stud") cat.stud = normalizeStudFields(input.stud);
  if (kind === "family") cat.family = normalizeFamilyFields(input.family);
  return cat;
}

function normalizeLegacyCommunityCat(value: unknown) {
  const input = objectValue(value);
  const id = optionalString(input.id, "");
  if (!id) return null;
  return normalizeCat({
    id: resolveCatId(id),
    kind: "family",
    ownerId: optionalString(input.ownerId, ""),
    name: input.name,
    gender: input.gender,
    birthday: input.birthday,
    color: input.color,
    personality: input.personality,
    galleryImageIds: [],
    visibility: "visible",
    family: {
      joinDate: input.joinDate,
      note: input.note,
    },
  });
}

function normalizeKittenFields(value: unknown): KittenFields {
  const input = objectValue(value);
  return {
    status:
      input.status === "找家中" || input.status === "已有家" || input.status === "待找家"
        ? input.status
        : "待找家",
    price: optionalString(input.price, ""),
    litterId: optionalString(input.litterId, undefined)
      ? resolveLitterId(optionalString(input.litterId, ""))
      : undefined,
    fatherId: optionalString(input.fatherId, undefined)
      ? resolveCatId(optionalString(input.fatherId, ""))
      : undefined,
    motherId: optionalString(input.motherId, undefined)
      ? resolveCatId(optionalString(input.motherId, ""))
      : undefined,
    legacyFatherName: optionalString(input.legacyFatherName, undefined),
    legacyMotherName: optionalString(input.legacyMotherName, undefined),
    structureRating: cloneStructureRating(input.structureRating as StructureRating | undefined),
  };
}

function normalizeStudFields(value: unknown): StudFields {
  const input = objectValue(value);
  const category =
    input.category === "现役母猫" ||
    input.category === "预备役种猫" ||
    input.category === "现役公猫"
      ? input.category
      : "现役公猫";
  return {
    role: optionalString(input.role, ""),
    category,
    status: optionalString(input.status, ""),
    trait: optionalString(input.trait, ""),
    source: optionalString(input.source, ""),
    reproductiveState: normalizeReproductiveState(input.reproductiveState, input.status),
  };
}

function normalizeFamilyFields(value: unknown): FamilyCatFields {
  const input = objectValue(value);
  return {
    joinDate: optionalString(input.joinDate, undefined),
    note: optionalString(input.note, undefined),
  };
}

function normalizeLitters(value: unknown) {
  const fallback = cloneDefaultCatteryData().litters;
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const litters = value.map(normalizeLitter).filter((litter) => {
    litter.id = resolveLitterId(litter.id);
    if (!litter.id || seen.has(litter.id)) return false;
    seen.add(litter.id);
    return true;
  });
  return litters.length > 0 ? litters : fallback;
}

function normalizeLitter(value: unknown): Litter {
  const input = objectValue(value);
  const id = resolveLitterId(
    optionalString(input.id, optionalString(input.name, createStableId("litter"))),
  );
  const defaultName =
    Object.entries(LITTER_ALIASES).find(([, canonical]) => canonical === id)?.[0] ?? id;
  return {
    id,
    name: optionalString(input.name, defaultName),
    birthDate: optionalString(input.birthDate, undefined),
    status: optionalString(input.status, "已建档"),
    fatherId: optionalString(input.fatherId, undefined)
      ? resolveCatId(optionalString(input.fatherId, ""))
      : undefined,
    motherId: optionalString(input.motherId, undefined)
      ? resolveCatId(optionalString(input.motherId, ""))
      : undefined,
    note: optionalString(input.note, undefined),
    coverImageId: optionalString(input.coverImageId, undefined),
    galleryImageIds: optionalStringArray(input.galleryImageIds) ?? [],
    visibility: normalizeVisibility(input.visibility),
    createdAt: optionalString(input.createdAt, undefined),
    updatedAt: optionalString(input.updatedAt, undefined),
  };
}

function normalizePosts(value: unknown) {
  const fallback = cloneDefaultCatteryData().posts;
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  return value.map(normalizePost).filter((post) => {
    if (!post.id || seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

function normalizeQuestionnaireSubmissions(value: unknown) {
  const fallback = cloneDefaultCatteryData().questionnaireSubmissions;
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const submissions = value
    .map(normalizeQuestionnaireSubmission)
    .filter((submission) => {
      if (!submission.id || seen.has(submission.id)) return false;
      seen.add(submission.id);
      return true;
    })
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  return submissions.length > 0 ? submissions : fallback;
}

function normalizePost(value: unknown): Post {
  const input = objectValue(value);
  const authorRole = input.authorRole === "星月家长" ? "星月家长" : "猫舍主理人";
  const category =
    input.category === "碎碎念" || input.category === "家长分享" || input.category === "猫舍日常"
      ? input.category
      : authorRole === "星月家长"
        ? "家长分享"
        : "猫舍日常";
  return {
    id: optionalString(input.id, createStableId("p")),
    authorId: optionalString(input.authorId, ""),
    authorName: optionalString(input.authorName, "未命名用户"),
    authorRole,
    category,
    content: optionalString(input.content, ""),
    imageCount: clampImageCount(input.imageCount),
    catIds: optionalStringArray(input.catIds)?.map(resolveCatId) ?? [],
    litterIds: optionalStringArray(input.litterIds)?.map(resolveLitterId) ?? [],
    createdAt: optionalString(input.createdAt, now()),
    updatedAt: optionalString(input.updatedAt, undefined),
    lastEditedById: optionalString(input.lastEditedById, undefined),
    likes:
      typeof input.likes === "number" && Number.isFinite(input.likes)
        ? Math.max(0, input.likes)
        : 0,
    likedByMe: input.likedByMe === true,
    comments: Array.isArray(input.comments) ? input.comments.map(normalizeComment) : [],
    pinned: input.pinned === true,
    hidden: input.hidden === true,
  };
}

function normalizeComment(value: unknown): Comment {
  const input = objectValue(value);
  const authorRole =
    input.authorRole === "星月家长" ||
    input.authorRole === "普通用户" ||
    input.authorRole === "猫舍主理人"
      ? input.authorRole
      : "普通用户";
  return {
    id: optionalString(input.id, createStableId("c")),
    authorId: optionalString(input.authorId, ""),
    authorName: optionalString(input.authorName, "未命名用户"),
    authorRole,
    content: optionalString(input.content, ""),
    createdAt: optionalString(input.createdAt, now()),
    hidden: input.hidden === true,
  };
}

function createSeedQuestionnaireSubmission(
  id: string,
  submittedAt: string,
  values: Partial<Record<QuestionnaireSubmissionFieldKey, string>>,
  status: QuestionnaireSubmissionStatus = "未查看",
) {
  return normalizeQuestionnaireSubmission({
    id,
    submittedAt,
    status,
    answers: createQuestionnaireSubmissionAnswers(values, DEFAULT_QUESTIONNAIRE_CONTENT),
  });
}

function studToCat(stud: Stud): CatteryCat {
  return {
    id: stud.id,
    kind: "stud",
    name: stud.name,
    color: stud.color,
    personality: stud.trait,
    story: stud.story ? [...stud.story] : undefined,
    ownerId: KEEPER_YUEQI,
    galleryImageIds: [],
    visibility: "visible",
    stud: {
      role: stud.role,
      category: stud.category,
      status: stud.status,
      trait: stud.trait,
      source: stud.source,
      reproductiveState: stud.status.includes("半退役")
        ? "semiRetired"
        : stud.category === "预备役种猫"
          ? "preparing"
          : "active",
    },
  };
}

function kittenToCat(kitten: Kitten): CatteryCat {
  return {
    id: kitten.id,
    kind: "kitten",
    name: kitten.name,
    gender: kitten.gender,
    color: kitten.color,
    birthday: kitten.birthday,
    personality: kitten.personality,
    story: kitten.story ? [...kitten.story] : undefined,
    galleryImageIds: [],
    visibility: "visible",
    kitten: {
      status: kitten.status,
      price: kitten.price,
      litterId: kitten.litter ? resolveLitterId(kitten.litter) : undefined,
      legacyFatherName: kitten.father,
      legacyMotherName: kitten.mother,
      structureRating: cloneStructureRating(kitten.structureRating),
    },
  };
}

function getEditableActor(context: UpdatePostContext): EditableActor | null {
  if (context.role !== "parent" && context.role !== "keeper") return null;
  if (!context.currentUserId) return null;
  const user = data.users.find((item) => item.id === context.currentUserId);
  if (!user || user.role !== context.role) return null;
  if (user.role === "parent" && !isParentUserActive(user)) return null;
  return { role: context.role, id: user.id, user };
}

function canManageCattery(context: UpdatePostContext) {
  return getEditableActor(context)?.role === "keeper";
}

function canManageCat(cat: CatteryCat, actor: EditableActor) {
  if (actor.role === "keeper") return true;
  return cat.kind === "family" && cat.ownerId === actor.id;
}

function canEditPost(post: Post, actor: EditableActor) {
  if (actor.role === "parent") {
    return post.authorRole === "星月家长" && post.authorId === actor.id;
  }
  return post.authorRole === "猫舍主理人";
}

function canDeletePost(post: Post, actor: EditableActor) {
  if (actor.role === "keeper") return true;
  return post.authorRole === "星月家长" && post.authorId === actor.id;
}

function canModeratePost(actor: EditableActor) {
  return actor.role === "keeper";
}

function canDeleteComment(post: Post, commentId: string, actor: EditableActor) {
  if (actor.role === "keeper") return true;
  const comment = post.comments.find((item) => item.id === commentId);
  return Boolean(comment && comment.authorId === actor.id);
}

function safePostPatch(patch: Partial<Post>, actor: EditableActor): Partial<Post> {
  const {
    id,
    authorId,
    authorName,
    authorRole,
    createdAt,
    lastEditedById,
    updatedAt,
    comments,
    likes,
    ...rest
  } = patch;
  void id;
  void authorId;
  void authorName;
  void authorRole;
  void createdAt;
  void lastEditedById;
  void updatedAt;
  void comments;
  void likes;

  const safe: Partial<Post> = { ...rest };
  const allowedCategories =
    actor.role === "keeper" ? KEEPERS_ALLOWED_CATEGORIES : PARENTS_ALLOWED_CATEGORIES;
  if (safe.category && !allowedCategories.includes(safe.category)) {
    safe.category = actor.role === "keeper" ? "猫舍日常" : "家长分享";
  }
  if (actor.role !== "keeper") {
    delete safe.litterIds;
    delete safe.pinned;
    delete safe.hidden;
  }
  if (safe.catIds) {
    const resolved = safe.catIds.map(resolveCatId);
    safe.catIds =
      actor.role === "keeper"
        ? resolved
        : resolved.filter((catId) =>
            data.cats.some((cat) => cat.id === catId && cat.ownerId === actor.id),
          );
  }
  if (safe.litterIds) safe.litterIds = safe.litterIds.map((item) => resolveLitterReference(item));
  if (typeof safe.imageCount === "number") safe.imageCount = clampImageCount(safe.imageCount);
  return safe;
}

function safeCatPatch(patch: Partial<CatteryCat>, actor: EditableActor) {
  const { id, kind, createdAt, ...safe } = patch;
  void id;
  void kind;
  void createdAt;
  if (actor.role === "keeper") return safe;

  const parentSafe: Partial<CatteryCat> = {};
  if (safe.name !== undefined) parentSafe.name = safe.name;
  if (safe.gender !== undefined) parentSafe.gender = safe.gender;
  if (safe.birthday !== undefined) parentSafe.birthday = safe.birthday;
  if (safe.color !== undefined) parentSafe.color = safe.color;
  if (safe.personality !== undefined) parentSafe.personality = safe.personality;
  if (safe.story !== undefined) parentSafe.story = safe.story;
  if (safe.coverImageId !== undefined) parentSafe.coverImageId = safe.coverImageId;
  if (safe.galleryImageIds !== undefined) parentSafe.galleryImageIds = safe.galleryImageIds;
  if (safe.family !== undefined) parentSafe.family = safe.family;
  if (safe.updatedAt !== undefined) parentSafe.updatedAt = safe.updatedAt;
  return parentSafe;
}

function safeLitterPatch(patch: Partial<Litter>) {
  const { id, createdAt, ...safe } = patch;
  void id;
  void createdAt;
  return safe;
}

function cloneCatteryData(content: CatteryData): CatteryData {
  return {
    version: 1,
    users: content.users.map((user) => ({ ...user })),
    cats: content.cats.map((cat) => ({
      ...cat,
      story: cat.story ? [...cat.story] : undefined,
      galleryImageIds: [...cat.galleryImageIds],
      kitten: cat.kitten
        ? {
            ...cat.kitten,
            structureRating: cloneStructureRating(cat.kitten.structureRating),
          }
        : undefined,
      stud: cat.stud ? { ...cat.stud } : undefined,
      family: cat.family ? { ...cat.family } : undefined,
    })),
    litters: content.litters.map((litter) => ({
      ...litter,
      galleryImageIds: [...litter.galleryImageIds],
    })),
    posts: content.posts.map(clonePost),
    questionnaireSubmissions: content.questionnaireSubmissions.map(cloneQuestionnaireSubmission),
  };
}

function clonePost(post: Post): Post {
  return {
    ...post,
    catIds: [...post.catIds],
    litterIds: post.litterIds ? [...post.litterIds] : undefined,
    comments: post.comments.map((comment) => ({ ...comment })),
  };
}

function cloneQuestionnaireSubmission(submission: QuestionnaireSubmission): QuestionnaireSubmission {
  return {
    ...submission,
    answers: QUESTIONNAIRE_FIELD_ORDER.reduce((acc, key) => {
      acc[key] = { ...submission.answers[key] };
      return acc;
    }, {} as QuestionnaireSubmissionAnswers),
  };
}

function cloneStructureRating(value: StructureRating | undefined): StructureRating | undefined {
  if (!value || typeof value !== "object") return undefined;
  return {
    face: { ...(value.face ?? {}) },
    body: { ...(value.body ?? {}) },
    allowHighlightStar: value.allowHighlightStar,
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function optionalString(value: unknown, fallback: string): string;
function optionalString(value: unknown, fallback: undefined): string | undefined;
function optionalString(value: unknown, fallback: string | undefined) {
  return typeof value === "string" ? value : fallback;
}

function optionalStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => (typeof item === "string" ? item : "")).filter(Boolean);
}

function normalizeVisibility(value: unknown): Visibility {
  return value === "hidden" || value === "archived" || value === "visible" ? value : "visible";
}

function normalizeReproductiveState(
  value: unknown,
  status: unknown,
): StudFields["reproductiveState"] {
  if (
    value === "active" ||
    value === "preparing" ||
    value === "retired" ||
    value === "semiRetired" ||
    value === "archived"
  ) {
    return value;
  }
  if (typeof status === "string" && status.includes("半退役")) return "semiRetired";
  return "active";
}

function clampImageCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(9, Math.trunc(value)))
    : 0;
}

function findCatName(state: CatteryData, id: string | undefined) {
  if (!id) return undefined;
  return state.cats.find((cat) => cat.id === resolveCatId(id))?.name;
}

function createUnusedId(prefix: string, exists: (candidate: string) => boolean) {
  let candidate = createStableId(prefix);
  while (exists(candidate)) {
    candidate = createStableId(prefix);
  }
  return candidate;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function createStableId(prefix: string) {
  if (isBrowser() && window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function now() {
  return new Date().toISOString();
}

function today() {
  return now().slice(0, 10);
}
