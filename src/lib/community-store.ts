import { useSyncExternalStore } from "react";

/* ── Types ─────────────────────────────────────────────── */
export type Role = "guest" | "user" | "parent" | "keeper";
export type Category = "猫舍日常" | "碎碎念" | "家长分享";

export interface CommunityCat {
  id: string;
  ownerId: string; // "keeper" or a parent user id
  name: string;
  gender: "弟弟" | "妹妹";
  birthday: string;
  joinDate?: string;
  color: string;
  personality: string;
  note?: string;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: "猫舍主理人" | "星月家长";
  category: Category;
  content: string;
  imageCount: number; // 0-9
  catIds: string[];
  createdAt: string; // ISO
  likes: number;
  likedByMe: boolean;
  comments: Comment[];
  pinned?: boolean;
  hidden?: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: "猫舍主理人" | "星月家长" | "普通用户";
  content: string;
  createdAt: string;
  hidden?: boolean;
}

export interface ParentUser {
  id: string;
  name: string; // display: "呼呼和奶油的家长"
  role: "parent" | "keeper";
  activatedAt?: string;
  inviteCode?: string;
  note?: string;
}

/* ── Seed data ─────────────────────────────────────────── */
const KEEPER_YUEQI = "keeper-yueqi";
const KEEPER_XINGXIA = "keeper-xingxia";
const PARENT_TOAST = "parent-toast";
const PARENT_HUHU = "parent-huhu";

const seedUsers: ParentUser[] = [
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

const seedCats: CommunityCat[] = [
  {
    id: "cat-huhu",
    ownerId: PARENT_HUHU,
    name: "呼呼",
    gender: "弟弟",
    birthday: "2025-08-15",
    joinDate: "2026-01-20",
    color: "棕虎斑加白",
    personality: "话痨，最爱蹲厨房门口等罐头。",
  },
  {
    id: "cat-cream",
    ownerId: PARENT_HUHU,
    name: "奶油",
    gender: "妹妹",
    birthday: "2025-08-15",
    joinDate: "2026-01-20",
    color: "玳瑁麻纹加白",
    personality: "安静温柔，喜欢晒太阳。",
  },
  {
    id: "cat-toast",
    ownerId: PARENT_TOAST,
    name: "吐司",
    gender: "弟弟",
    birthday: "2025-06-30",
    joinDate: "2025-12-18",
    color: "银虎斑加白",
    personality: "一周岁的小机灵鬼，饭点最准时。",
  },
  {
    id: "cat-chonglou",
    ownerId: KEEPER_YUEQI,
    name: "重楼",
    gender: "弟弟",
    birthday: "2020-05-01",
    color: "红虎斑",
    personality: "半退役老大哥，温柔靠谱。",
  },
];

const seedPosts: Post[] = [
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
    catIds: ["cat-chonglou"],
    createdAt: "2026-07-05T11:30:00",
    likes: 19,
    likedByMe: false,
    comments: [],
  },
];

/* ── Store ─────────────────────────────────────────────── */
interface State {
  role: Role;
  currentUserId: string | null; // when role != guest
  users: ParentUser[];
  cats: CommunityCat[];
  posts: Post[];
  showLoginSheet: boolean;
  loginReason: string;
  lightboxOpen: boolean;
  lightboxIndex: number;
  lightboxCount: number;
}

const initial: State = {
  role: "guest",
  currentUserId: null,
  users: seedUsers,
  cats: seedCats,
  posts: seedPosts,
  showLoginSheet: false,
  loginReason: "",
  lightboxOpen: false,
  lightboxIndex: 0,
  lightboxCount: 0,
};

let state: State = initial;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useCommunity<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => sel(state),
    () => sel(initial),
  );
}

/* ── Actions ───────────────────────────────────────────── */
export const actions = {
  requireLogin(reason: string): boolean {
    if (state.role === "guest") {
      state = { ...state, showLoginSheet: true, loginReason: reason };
      notify();
      return false;
    }
    return true;
  },
  closeLoginSheet() {
    state = { ...state, showLoginSheet: false };
    notify();
  },
  // Simulated wechat login → becomes a普通已登录用户 (default: 呼呼和奶油的家长 as parent for demo convenience, but starts as "user")
  wechatLogin() {
    // For demo: log in as a普通用户 (not yet parent). User must open parent-onboard to become parent.
    state = {
      ...state,
      role: "user",
      currentUserId: "user-guest-1",
      showLoginSheet: false,
    };
    if (!state.users.find((u) => u.id === "user-guest-1")) {
      state = {
        ...state,
        users: [...state.users, { id: "user-guest-1", name: "微信用户", role: "parent", note: "尚未开通家长身份" }],
      };
    }
    notify();
  },
  // Activate parent — demo just switches current user to 呼呼和奶油的家长
  activateParent(_code: string) {
    state = {
      ...state,
      role: "parent",
      currentUserId: PARENT_HUHU,
    };
    notify();
  },
  becomeKeeper() {
    state = { ...state, role: "keeper", currentUserId: KEEPER_YUEQI };
    notify();
  },
  logout() {
    state = { ...state, role: "guest", currentUserId: null };
    notify();
  },
  toggleLike(postId: string) {
    if (!actions.requireLogin("给猫爪点赞需要登录")) return;
    state = {
      ...state,
      posts: state.posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likes: p.likedByMe ? p.likes - 1 : p.likes + 1,
            }
          : p,
      ),
    };
    notify();
  },
  addComment(postId: string, content: string) {
    if (!actions.requireLogin("发表评论需要登录")) return;
    const me = state.users.find((u) => u.id === state.currentUserId);
    if (!me) return;
    const role =
      state.role === "keeper" ? "猫舍主理人" : state.role === "parent" ? "星月家长" : "普通用户";
    const c: Comment = {
      id: `c-${Date.now()}`,
      authorId: me.id,
      authorName: me.name,
      authorRole: role,
      content,
      createdAt: new Date().toISOString(),
    };
    state = {
      ...state,
      posts: state.posts.map((p) =>
        p.id === postId ? { ...p, comments: [...p.comments, c] } : p,
      ),
    };
    notify();
  },
  createPost(input: {
    category: Category;
    content: string;
    imageCount: number;
    catIds: string[];
  }): string | null {
    const me = state.users.find((u) => u.id === state.currentUserId);
    if (!me || state.role === "guest" || state.role === "user") return null;
    const role = state.role === "keeper" ? "猫舍主理人" : "星月家长";
    const id = `p-${Date.now()}`;
    const post: Post = {
      id,
      authorId: me.id,
      authorName: me.name,
      authorRole: role,
      category: state.role === "parent" ? "家长分享" : input.category,
      content: input.content,
      imageCount: Math.max(0, Math.min(9, input.imageCount)),
      catIds: input.catIds,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedByMe: false,
      comments: [],
    };
    state = { ...state, posts: [post, ...state.posts] };
    notify();
    return id;
  },
  updatePost(id: string, patch: Partial<Post>) {
    state = {
      ...state,
      posts: state.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    };
    notify();
  },
  deletePost(id: string) {
    state = { ...state, posts: state.posts.filter((p) => p.id !== id) };
    notify();
  },
  togglePin(id: string) {
    state = {
      ...state,
      posts: state.posts.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)),
    };
    notify();
  },
  toggleHidePost(id: string) {
    state = {
      ...state,
      posts: state.posts.map((p) => (p.id === id ? { ...p, hidden: !p.hidden } : p)),
    };
    notify();
  },
  toggleHideComment(postId: string, commentId: string) {
    state = {
      ...state,
      posts: state.posts.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.map((c) =>
                c.id === commentId ? { ...c, hidden: !c.hidden } : c,
              ),
            }
          : p,
      ),
    };
    notify();
  },
  deleteComment(postId: string, commentId: string) {
    state = {
      ...state,
      posts: state.posts.map((p) =>
        p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p,
      ),
    };
    notify();
  },
  addCat(input: Omit<CommunityCat, "id" | "ownerId"> & { ownerId?: string }) {
    const ownerId = input.ownerId ?? state.currentUserId;
    if (!ownerId) return;
    const id = `cat-${Date.now()}`;
    state = { ...state, cats: [...state.cats, { ...input, id, ownerId }] };
    notify();
  },
  updateCat(id: string, patch: Partial<CommunityCat>) {
    state = {
      ...state,
      cats: state.cats.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    };
    notify();
  },
  deleteCat(id: string) {
    state = {
      ...state,
      cats: state.cats.filter((c) => c.id !== id),
      posts: state.posts.map((p) => ({ ...p, catIds: p.catIds.filter((cid) => cid !== id) })),
    };
    notify();
  },
  openLightbox(count: number, index: number) {
    state = { ...state, lightboxOpen: true, lightboxIndex: index, lightboxCount: count };
    notify();
  },
  setLightboxIndex(i: number) {
    state = { ...state, lightboxIndex: i };
    notify();
  },
  closeLightbox() {
    state = { ...state, lightboxOpen: false };
    notify();
  },
  addParent(name: string, code: string) {
    const id = `parent-${Date.now()}`;
    state = {
      ...state,
      users: [
        ...state.users,
        { id, name, role: "parent", inviteCode: code, activatedAt: new Date().toISOString().slice(0, 10) },
      ],
    };
    notify();
  },
  toggleParentActive(id: string) {
    state = {
      ...state,
      users: state.users.map((u) =>
        u.id === id
          ? { ...u, activatedAt: u.activatedAt ? undefined : new Date().toISOString().slice(0, 10) }
          : u,
      ),
    };
    notify();
  },
};

/* ── Helpers ───────────────────────────────────────────── */
export function formatTime(iso: string) {
  // Deterministic (SSR-safe) — parse the ISO date and format as M月D日.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function categoryTone(c: Category): string {
  switch (c) {
    case "猫舍日常":
      return "sky";
    case "碎碎念":
      return "sunny";
    case "家长分享":
      return "warm";
  }
}

export const CATEGORIES: Category[] = ["猫舍日常", "碎碎念", "家长分享"];
