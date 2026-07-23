import { useSyncExternalStore } from "react";
import {
  KEEPER_YUEQI,
  PARENT_HUHU,
  catteryActions,
  getCatteryDataSnapshot,
  hydrateCatteryDataFromStorage,
  selectFamilyCats,
  selectLitters,
  selectPosts,
  selectUsers,
  subscribeToCatteryData,
  type CatteryCat,
  type Category,
  type Comment,
  type Post,
  type Role,
  type CatteryUser,
} from "./cattery-store";

export type { Role, Category, Post, Comment };
export type CommunityCat = ReturnType<typeof selectFamilyCats>[number];
export type ParentUser = CatteryUser;

interface SessionState {
  role: Role;
  currentUserId: string | null;
  showLoginSheet: boolean;
  loginReason: string;
  lightboxOpen: boolean;
  lightboxIndex: number;
  lightboxCount: number;
}

interface State extends SessionState {
  users: ParentUser[];
  cats: CommunityCat[];
  posts: Post[];
}

const sessionInitial: SessionState = {
  role: "guest",
  currentUserId: null,
  showLoginSheet: false,
  loginReason: "",
  lightboxOpen: false,
  lightboxIndex: 0,
  lightboxCount: 0,
};

let session: SessionState = { ...sessionInitial };
let hydrated = false;
const sessionListeners = new Set<() => void>();

function getState(): State {
  const data = getCatteryDataSnapshot();
  return {
    ...session,
    users: selectUsers(data),
    cats: selectCommunityCatsForFacade(data.cats),
    posts: selectPostsForFacade(data),
  };
}

const serverState: State = {
  ...sessionInitial,
  users: selectUsers(),
  cats: selectCommunityCatsForFacade(getCatteryDataSnapshot().cats),
  posts: selectPostsForFacade(getCatteryDataSnapshot()),
};

function notifySession() {
  sessionListeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (!hydrated && typeof window !== "undefined") {
    hydrated = true;
    hydrateCatteryDataFromStorage();
  }
  sessionListeners.add(listener);
  const unsubscribeCattery = subscribeToCatteryData(listener);
  return () => {
    sessionListeners.delete(listener);
    unsubscribeCattery();
  };
}

export function useCommunity<T>(selector: (state: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(serverState),
  );
}

export const actions = {
  requireLogin(reason: string): boolean {
    if (session.role === "guest") {
      session = { ...session, showLoginSheet: true, loginReason: reason };
      notifySession();
      return false;
    }
    return true;
  },
  closeLoginSheet() {
    session = { ...session, showLoginSheet: false };
    notifySession();
  },
  wechatLogin() {
    session = {
      ...session,
      role: "user",
      currentUserId: "user-guest-1",
      showLoginSheet: false,
    };
    if (!getCatteryDataSnapshot().users.find((user) => user.id === "user-guest-1")) {
      catteryActions.addUser({
        id: "user-guest-1",
        name: "微信用户",
        role: "parent",
        note: "尚未开通家长身份",
      });
    }
    notifySession();
  },
  activateParent(_code: string) {
    session = {
      ...session,
      role: "parent",
      currentUserId: PARENT_HUHU,
    };
    notifySession();
  },
  becomeKeeper() {
    session = { ...session, role: "keeper", currentUserId: KEEPER_YUEQI };
    notifySession();
  },
  logout() {
    session = { ...session, role: "guest", currentUserId: null };
    notifySession();
  },
  toggleLike(postId: string) {
    if (!actions.requireLogin("给猫爪点赞需要登录")) return;
    catteryActions.toggleLike(postId);
  },
  addComment(postId: string, content: string) {
    if (!actions.requireLogin("发表评论需要登录")) return;
    const me = getCatteryDataSnapshot().users.find((user) => user.id === session.currentUserId);
    if (!me) return;
    catteryActions.addComment(postId, {
      authorId: me.id,
      authorName: me.name,
      authorRole:
        session.role === "keeper"
          ? "猫舍主理人"
          : session.role === "parent"
            ? "星月家长"
            : "普通用户",
      content,
    });
  },
  createPost(input: {
    category: Category;
    content: string;
    imageCount: number;
    catIds: string[];
    litterIds?: string[];
  }): string | null {
    return catteryActions.createPost(input, {
      role: session.role,
      currentUserId: session.currentUserId,
    });
  },
  updatePost(id: string, patch: Partial<Post>) {
    catteryActions.updatePost(id, patch, {
      role: session.role,
      currentUserId: session.currentUserId,
    });
  },
  deletePost(id: string) {
    catteryActions.deletePost(id);
  },
  togglePin(id: string) {
    catteryActions.togglePin(id);
  },
  toggleHidePost(id: string) {
    catteryActions.toggleHidePost(id);
  },
  toggleHideComment(postId: string, commentId: string) {
    catteryActions.toggleHideComment(postId, commentId);
  },
  deleteComment(postId: string, commentId: string) {
    catteryActions.deleteComment(postId, commentId);
  },
  addCat(input: Omit<CommunityCat, "id" | "ownerId"> & { ownerId?: string }) {
    const ownerId = input.ownerId ?? session.currentUserId;
    if (!ownerId) return;
    catteryActions.addFamilyCat({
      ownerId,
      name: input.name,
      gender: input.gender,
      birthday: input.birthday,
      color: input.color,
      personality: input.personality,
      family: {
        joinDate: input.joinDate,
        note: input.note,
      },
    });
  },
  updateCat(id: string, patch: Partial<CommunityCat>) {
    catteryActions.updateCat(id, {
      ownerId: patch.ownerId,
      name: patch.name,
      gender: patch.gender,
      birthday: patch.birthday,
      color: patch.color,
      personality: patch.personality,
      family:
        patch.joinDate !== undefined || patch.note !== undefined
          ? { joinDate: patch.joinDate, note: patch.note }
          : undefined,
    });
  },
  deleteCat(id: string) {
    catteryActions.deleteFamilyCat(id);
  },
  openLightbox(count: number, index: number) {
    session = { ...session, lightboxOpen: true, lightboxIndex: index, lightboxCount: count };
    notifySession();
  },
  setLightboxIndex(index: number) {
    session = { ...session, lightboxIndex: index };
    notifySession();
  },
  closeLightbox() {
    session = { ...session, lightboxOpen: false };
    notifySession();
  },
  addParent(name: string, code: string) {
    catteryActions.addUser({
      name,
      role: "parent",
      inviteCode: code,
      activatedAt: new Date().toISOString().slice(0, 10),
    });
  },
  toggleParentActive(id: string) {
    catteryActions.toggleParentActive(id);
  },
};

export function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function categoryTone(category: Category): string {
  switch (category) {
    case "猫舍日常":
      return "sky";
    case "碎碎念":
      return "sunny";
    case "家长分享":
      return "warm";
  }
}

export const CATEGORIES: Category[] = ["猫舍日常", "碎碎念", "家长分享"];

function selectCommunityCatsForFacade(cats: CatteryCat[]): CommunityCat[] {
  return cats
    .filter((cat) => cat.kind === "family" || cat.id === "chonglou")
    .filter((cat) => cat.visibility !== "archived")
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

function selectPostsForFacade(data = getCatteryDataSnapshot()): Post[] {
  const litterNames = new Map(selectLitters(data).map((litter) => [litter.id, litter.name]));
  return selectPosts(data).map((post) => ({
    ...post,
    catIds: post.catIds.includes("chonglou") ? [...post.catIds, "cat-chonglou"] : post.catIds,
    litterIds: post.litterIds?.map((id) => litterNames.get(id) ?? id),
  }));
}
