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

export type Role = "guest" | "user" | "parent" | "keeper";
export type Category = "????" | "???" | "????";
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

export interface Comment {
  id: string;
  authorId: UserId;
  authorName: string;
  authorRole: "?????" | "????" | "????";
  content: string;
  createdAt: string;
  hidden?: boolean;
}

export interface Post {
  id: PostId;
  authorId: UserId;
  authorName: string;
  authorRole: "?????" | "????";
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
}

export interface UpdatePostContext {
  role: Role;
  currentUserId: UserId | null;
}

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
  A?: "litter-a",
  B?: "litter-b",
  C?: "litter-c",
};

const LITTER_META: Record<string, { birthDate: string; status: string; note: string }> = {
  "litter-a": {
    birthDate: "2026-04-18",
    status: "?????",
    note: "????????????",
  },
  "litter-b": {
    birthDate: "2026-05-09",
    status: "???",
    note: "?????????????",
  },
  "litter-c": {
    birthDate: "2026-06-02",
    status: "???",
    note: "?????????????",
  },
};

const DEFAULT_USERS: CatteryUser[] = [
  { id: KEEPER_YUEQI, name: "??", role: "keeper", note: "?????" },
  { id: KEEPER_XINGXIA, name: "??", role: "keeper", note: "?????" },
  {
    id: PARENT_TOAST,
    name: "?????",
    role: "parent",
    activatedAt: "2026-03-12",
    inviteCode: "XY-TOAST-2025",
  },
  {
    id: PARENT_HUHU,
    name: "????????",
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
    name: "??",
    gender: "??",
    birthday: "2025-08-15",
    color: "?????",
    personality: "??????????????",
    galleryImageIds: [],
    visibility: "visible",
    family: { joinDate: "2026-01-20" },
  },
  {
    id: "cat-cream",
    kind: "family",
    ownerId: PARENT_HUHU,
    name: "??",
    gender: "??",
    birthday: "2025-08-15",
    color: "??????",
    personality: "???????????",
    galleryImageIds: [],
    visibility: "visible",
    family: { joinDate: "2026-01-20" },
  },
  {
    id: "cat-toast",
    kind: "family",
    ownerId: PARENT_TOAST,
    name: "??",
    gender: "??",
    birthday: "2025-06-30",
    color: "?????",
    personality: "???????????????",
    galleryImageIds: [],
    visibility: "visible",
    family: { joinDate: "2025-12-18" },
  },
];

const DEFAULT_POSTS: Post[] = [
  {
    id: "p-1",
    authorId: KEEPER_YUEQI,
    authorName: "??",
    authorRole: "?????",
    category: "????",
    content: "?????????????",
    imageCount: 1,
    catIds: ["cat-huhu"],
    createdAt: "2026-07-14T09:20:00",
    likes: 24,
    likedByMe: false,
    comments: [
      {
        id: "c-1",
        authorId: PARENT_HUHU,
        authorName: "????????",
        authorRole: "????",
        content: "?????????????",
        createdAt: "2026-07-14T10:02:00",
      },
    ],
    pinned: true,
  },
  {
    id: "p-2",
    authorId: PARENT_TOAST,
    authorName: "?????",
    authorRole: "????",
    category: "????",
    content: "?????????????????????????",
    imageCount: 3,
    catIds: ["cat-toast"],
    createdAt: "2026-07-12T18:45:00",
    likes: 42,
    likedByMe: true,
    comments: [
      {
        id: "c-2",
        authorId: KEEPER_YUEQI,
        authorName: "??",
        authorRole: "?????",
        content: "???????",
        createdAt: "2026-07-12T19:10:00",
      },
    ],
  },
  {
    id: "p-3",
    authorId: PARENT_HUHU,
    authorName: "????????",
    authorRole: "????",
    category: "????",
    content: "????????????????????",
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
    authorName: "??",
    authorRole: "?????",
    category: "???",
    content: "????????????????????????????????",
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
    authorName: "??",
    authorRole: "?????",
    category: "????",
    content: "???????????????????",
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
    authorName: "??",
    authorRole: "?????",
    category: "????",
    content: "A ????????????????????????",
    imageCount: 2,
    catIds: [],
    litterIds: ["litter-a"],
    createdAt: "2026-07-02T10:15:00",
    likes: 36,
    likedByMe: false,
    comments: [],
  },
];

const KEEPERS_ALLOWED_CATEGORIES: Category[] = ["????", "???", "????"];
const PARENTS_ALLOWED_CATEGORIES: Category[] = ["????", "???"];

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
    const meta = LITTER_META[id] ?? { birthDate: "", status: "???", note: "" };
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
};

let data: CatteryData = cloneDefaultCatteryData();
const listeners = new Set<() => void>();

export function resolveCatId(id: string) {
  return CAT_ALIASES[id] ?? id;
}

export function resolveLitterId(id: string) {
  return LITTER_ALIASES[id] ?? id;
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
  };
}

export function loadSavedCatteryData() {
  if (!isBrowser()) return cloneDefaultCatteryData();
  try {
    const raw = window.localStorage.getItem(CATTERY_STORAGE_KEY);
    if (!raw) return cloneDefaultCatteryData();
    return normalizeCatteryData(JSON.parse(raw));
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
  const onStorage = (event: StorageEvent) => {
    if (event.key === CATTERY_STORAGE_KEY) callback();
  };

  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCattery<T>(selector: (state: CatteryData) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(data),
    () => selector(cloneDefaultCatteryData()),
  );
}

export function getCatteryDataSnapshot() {
  return data;
}

export function hydrateCatteryDataFromStorage() {
  setData(loadSavedCatteryData(), false);
}

export function resetCatteryDataForTests(next?: unknown) {
  setData(next === undefined ? cloneDefaultCatteryData() : normalizeCatteryData(next), false);
}

export const catteryActions = {
  replaceAll(next: CatteryData) {
    setData(next);
  },
  addUser(input: Omit<CatteryUser, "id"> & { id?: string }) {
    const id = input.id?.trim() || createStableId("parent");
    setData({
      ...data,
      users: [...data.users, normalizeUser({ ...input, id })],
    });
    return id;
  },
  toggleParentActive(id: UserId) {
    setData({
      ...data,
      users: data.users.map((user) =>
        user.id === id && user.role === "parent"
          ? { ...user, activatedAt: user.activatedAt ? undefined : today() }
          : user,
      ),
    });
  },
  addFamilyCat(
    input: Omit<CatteryCat, "id" | "kind" | "galleryImageIds" | "visibility"> & { id?: string },
  ) {
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
  updateCat(id: CatId, patch: Partial<CatteryCat>) {
    const resolvedId = resolveCatId(id);
    setData({
      ...data,
      cats: data.cats.map((cat) =>
        cat.id === resolvedId
          ? normalizeCat({ ...cat, ...safeCatPatch(patch), updatedAt: now() })
          : cat,
      ),
    });
  },
  deleteFamilyCat(id: CatId) {
    const resolvedId = resolveCatId(id);
    const existing = data.cats.find((cat) => cat.id === resolvedId);
    if (!existing || existing.kind !== "family") return;
    setData({
      ...data,
      cats: data.cats.filter((cat) => cat.id !== resolvedId),
      posts: data.posts.map((post) => ({
        ...post,
        catIds: post.catIds.filter((catId) => resolveCatId(catId) !== resolvedId),
      })),
    });
  },
  setStudVisibility(id: CatId, visibility: Visibility) {
    const resolvedId = resolveCatId(id);
    setData({
      ...data,
      cats: data.cats.map((cat) =>
        cat.id === resolvedId && cat.kind === "stud"
          ? normalizeCat({ ...cat, visibility, updatedAt: now() })
          : cat,
      ),
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
  updateLitter(id: LitterId, patch: Partial<Litter>) {
    const resolvedId = resolveLitterId(id);
    setData({
      ...data,
      litters: data.litters.map((litter) =>
        litter.id === resolvedId
          ? normalizeLitter({ ...litter, ...safeLitterPatch(patch), updatedAt: now() })
          : litter,
      ),
    });
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
    const me = data.users.find((user) => user.id === context.currentUserId);
    if (!me || context.role === "guest" || context.role === "user") return null;
    const allowedCategories =
      context.role === "keeper" ? KEEPERS_ALLOWED_CATEGORIES : PARENTS_ALLOWED_CATEGORIES;
    const category = allowedCategories.includes(input.category)
      ? input.category
      : context.role === "parent"
        ? "????"
        : "????";
    const catIds =
      context.role === "keeper"
        ? input.catIds.map(resolveCatId)
        : input.catIds
            .map(resolveCatId)
            .filter((catId) =>
              data.cats.some((cat) => cat.id === catId && cat.ownerId === context.currentUserId),
            );
    const id = createStableId("p");
    const post = normalizePost({
      id,
      authorId: me.id,
      authorName: me.name,
      authorRole: context.role === "keeper" ? "?????" : "????",
      category,
      content: input.content,
      imageCount: clampImageCount(input.imageCount),
      catIds,
      litterIds: (input.litterIds ?? []).map(resolveLitterId),
      createdAt: now(),
      likes: 0,
      likedByMe: false,
      comments: [],
    });
    setData({ ...data, posts: [post, ...data.posts] });
    return id;
  },
  updatePost(id: PostId, patch: Partial<Post>, context: UpdatePostContext) {
    const existing = data.posts.find((post) => post.id === id);
    if (!existing || !canEditPost(existing, context)) return false;
    const safePatch = safePostPatch(patch, existing, context);
    setData({
      ...data,
      posts: data.posts.map((post) =>
        post.id === id
          ? normalizePost({
              ...post,
              ...safePatch,
              updatedAt: now(),
              lastEditedById:
                post.authorId === context.currentUserId
                  ? post.lastEditedById
                  : (context.currentUserId ?? undefined),
            })
          : post,
      ),
    });
    return true;
  },
  deletePost(id: PostId) {
    setData({ ...data, posts: data.posts.filter((post) => post.id !== id) });
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
  togglePin(id: PostId) {
    setData({
      ...data,
      posts: data.posts.map((post) => (post.id === id ? { ...post, pinned: !post.pinned } : post)),
    });
  },
  toggleHidePost(id: PostId) {
    setData({
      ...data,
      posts: data.posts.map((post) => (post.id === id ? { ...post, hidden: !post.hidden } : post)),
    });
  },
  toggleHideComment(postId: PostId, commentId: string) {
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
  },
  deleteComment(postId: PostId, commentId: string) {
    setData({
      ...data,
      posts: data.posts.map((post) =>
        post.id === postId
          ? { ...post, comments: post.comments.filter((comment) => comment.id !== commentId) }
          : post,
      ),
    });
  },
};

export function selectUsers(state: CatteryData = data) {
  return state.users.map((user) => ({ ...user }));
}

export function selectPosts(state: CatteryData = data) {
  return state.posts.map(clonePost);
}

export function selectLitters(state: CatteryData = data) {
  return state.litters.map((litter) => ({
    ...litter,
    galleryImageIds: [...litter.galleryImageIds],
  }));
}

export function selectKittens(state: CatteryData = data): Kitten[] {
  const litterNames = new Map(state.litters.map((litter) => [litter.id, litter.name]));
  return state.cats
    .filter((cat) => cat.kind === "kitten" && cat.kitten && cat.visibility !== "archived")
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      gender: cat.gender ?? "",
      color: cat.color ?? "",
      birthday: cat.birthday ?? "",
      father: cat.kitten?.legacyFatherName ?? findCatName(state, cat.kitten?.fatherId) ?? "",
      mother: cat.kitten?.legacyMotherName ?? findCatName(state, cat.kitten?.motherId) ?? "",
      status: cat.kitten?.status ?? "???",
      price: cat.kitten?.price ?? "",
      litter: cat.kitten?.litterId
        ? litterNames.get(resolveLitterId(cat.kitten.litterId))
        : undefined,
      personality: cat.personality ?? "",
      story: cat.story ? [...cat.story] : undefined,
      structureRating: cloneStructureRating(cat.kitten?.structureRating),
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
      category: cat.stud?.category ?? "????",
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
      gender: cat.gender === "??" ? "??" : "??",
      birthday: cat.birthday ?? "",
      joinDate: cat.family?.joinDate,
      color: cat.color ?? "",
      personality: cat.personality ?? "",
      note: cat.family?.note,
    }));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setData(next: CatteryData, persist = true) {
  data = cloneCatteryData(normalizeCatteryData(next));
  if (persist) writeCatteryData(data);
  listeners.forEach((listener) => listener());
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
  return {
    id: optionalString(input.id, createStableId("user")),
    name: optionalString(input.name, "?????"),
    role: input.role === "keeper" ? "keeper" : "parent",
    activatedAt: optionalString(input.activatedAt, undefined),
    inviteCode: optionalString(input.inviteCode, undefined),
    note: optionalString(input.note, undefined),
  };
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
    name: optionalString(input.name, "?????"),
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
      input.status === "???" || input.status === "???" || input.status === "???"
        ? input.status
        : "???",
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
    input.category === "????" ||
    input.category === "?????" ||
    input.category === "????"
      ? input.category
      : "????";
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
    status: optionalString(input.status, "???"),
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
  return value.map(normalizePost);
}

function normalizePost(value: unknown): Post {
  const input = objectValue(value);
  const authorRole = input.authorRole === "????" ? "????" : "?????";
  const category =
    input.category === "???" || input.category === "????" || input.category === "????"
      ? input.category
      : authorRole === "????"
        ? "????"
        : "????";
  return {
    id: optionalString(input.id, createStableId("p")),
    authorId: optionalString(input.authorId, ""),
    authorName: optionalString(input.authorName, "?????"),
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
    input.authorRole === "????" ||
    input.authorRole === "????" ||
    input.authorRole === "?????"
      ? input.authorRole
      : "????";
  return {
    id: optionalString(input.id, createStableId("c")),
    authorId: optionalString(input.authorId, ""),
    authorName: optionalString(input.authorName, "?????"),
    authorRole,
    content: optionalString(input.content, ""),
    createdAt: optionalString(input.createdAt, now()),
    hidden: input.hidden === true,
  };
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
      reproductiveState: stud.status.includes("???")
        ? "semiRetired"
        : stud.category === "?????"
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

function canEditPost(post: Post, context: UpdatePostContext) {
  if (!context.currentUserId) return false;
  if (post.authorId === context.currentUserId) return true;
  return context.role === "keeper" && post.authorRole === "?????";
}

function safePostPatch(
  patch: Partial<Post>,
  existing: Post,
  context: UpdatePostContext,
): Partial<Post> {
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
  if (existing.authorRole === "????" && existing.authorId !== context.currentUserId) {
    delete safe.content;
    delete safe.catIds;
    delete safe.litterIds;
    delete safe.imageCount;
    delete safe.category;
  }
  if (safe.catIds) {
    const resolved = safe.catIds.map(resolveCatId);
    safe.catIds =
      context.role === "keeper"
        ? resolved
        : resolved.filter((catId) =>
            data.cats.some((cat) => cat.id === catId && cat.ownerId === context.currentUserId),
          );
  }
  if (safe.litterIds) safe.litterIds = safe.litterIds.map(resolveLitterId);
  if (typeof safe.imageCount === "number") safe.imageCount = clampImageCount(safe.imageCount);
  return safe;
}

function safeCatPatch(patch: Partial<CatteryCat>) {
  const { id, kind, createdAt, ...safe } = patch;
  void id;
  void kind;
  void createdAt;
  return safe;
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
  if (typeof status === "string" && status.includes("???")) return "semiRetired";
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
