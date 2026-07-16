import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Placeholder, Pill } from "../ui";
import {
  HeartIcon,
  ChatBubbleIcon,
  CatIcon,
  UserIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PawIcon,
} from "../icons";
import {
  actions,
  categoryTone,
  formatTime,
  useCommunity,
  type Post,
} from "@/lib/community-store";

/* ── CatAvatar ─────────────────────────────────────────── */
export function CatAvatar({
  name,
  size = 36,
  className = "",
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-cream ring-1 ring-border ${className}`}
      style={{ width: size, height: size }}
      aria-label={name}
    >
      <CatIcon className="h-1/2 w-1/2 text-warm" />
    </span>
  );
}

export function UserAvatar({
  role,
  size = 40,
}: {
  role: "keeper" | "parent";
  size?: number;
}) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full ${
        role === "keeper" ? "bg-violet/15 text-violet" : "bg-sky/25 text-[#4a5f6e]"
      }`}
      style={{ width: size, height: size }}
    >
      {role === "keeper" ? <PawIcon className="h-1/2 w-1/2" /> : <UserIcon className="h-1/2 w-1/2" />}
    </span>
  );
}

/* ── Image grid ────────────────────────────────────────── */
export function PostImages({ count, postId }: { count: number; postId: string }) {
  if (count === 0) return null;
  const arr = Array.from({ length: Math.min(count, 9) });
  if (count === 1) {
    return (
      <button
        type="button"
        onClick={() => actions.openLightbox(count, 0)}
        className="pressable mt-3 block w-full overflow-hidden rounded-2xl"
      >
        <Placeholder
          label="示例图片（家长/主理人上传，待替换）"
          ratio="aspect-[4/3]"
          rounded="rounded-2xl"
        />
      </button>
    );
  }
  const cols = count === 2 || count === 4 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`mt-3 grid ${cols} gap-1.5`}>
      {arr.map((_, i) => (
        <button
          key={`${postId}-${i}`}
          type="button"
          onClick={() => actions.openLightbox(count, i)}
          className="pressable overflow-hidden rounded-xl"
        >
          <Placeholder
            label="示例图片"
            ratio="aspect-square"
            rounded="rounded-xl"
            compact
          />
        </button>
      ))}
    </div>
  );
}

/* ── Post card ─────────────────────────────────────────── */
export function PostCard({
  post,
  showActions = true,
}: {
  post: Post;
  showActions?: boolean;
}) {
  const cats = useCommunity((s) => s.cats);
  const linkedCats = post.catIds
    .map((id) => cats.find((c) => c.id === id))
    .filter(Boolean) as { id: string; name: string }[];

  const role = post.authorRole === "猫舍主理人" ? "keeper" : "parent";

  return (
    <article className="soft-card space-y-2.5">
      {/* header */}
      <header className="flex items-center gap-2.5">
        <UserAvatar role={role} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13.5px] font-semibold text-heading">
              {post.authorName}
            </span>
            <Pill tone={role === "keeper" ? "violet" : "creamblue"}>
              {post.authorRole}
            </Pill>
            {post.pinned && <Pill tone="sunny">置顶</Pill>}
          </div>
          <p className="mt-0.5 text-[11px] text-warm">{formatTime(post.createdAt)}</p>
        </div>
        <Pill tone={categoryTone(post.category)}>{post.category}</Pill>
      </header>

      {/* body */}
      <Link
        to="/community/post/$id"
        params={{ id: post.id }}
        className="pressable block"
      >
        <p className="whitespace-pre-line text-[14px] leading-relaxed text-card-foreground">
          {post.content}
        </p>
        <PostImages count={post.imageCount} postId={post.id} />
      </Link>

      {/* linked cats */}
      {linkedCats.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-cream/60 px-3 py-2">
          <span className="text-[11px] text-warm">关联</span>
          {linkedCats.map((c) => (
            <Link
              key={c.id}
              to="/community/cat/$id"
              params={{ id: c.id }}
              className="pressable inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[12px] font-medium text-heading shadow-card"
            >
              <CatAvatar size={20} />
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {/* footer */}
      {showActions && (
        <footer className="flex items-center justify-between pt-1 text-[12.5px] text-muted-foreground">
          <button
            type="button"
            onClick={() => actions.toggleLike(post.id)}
            className={`pressable inline-flex items-center gap-1.5 ${
              post.likedByMe ? "text-wine" : ""
            }`}
          >
            <HeartIcon className="h-4 w-4" />
            <span>{post.likes}</span>
          </button>
          <Link
            to="/community/post/$id"
            params={{ id: post.id }}
            className="pressable inline-flex items-center gap-1.5"
          >
            <ChatBubbleIcon className="h-4 w-4" />
            <span>{post.comments.length}</span>
          </Link>
        </footer>
      )}
    </article>
  );
}

/* ── Login sheet ───────────────────────────────────────── */
export function LoginSheet() {
  const open = useCommunity((s) => s.showLoginSheet);
  const reason = useCommunity((s) => s.loginReason);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-heading/40 sm:items-center">
      <div className="w-full max-w-[402px] rounded-t-[1.75rem] bg-card p-6 shadow-float sm:rounded-[1.75rem]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet/15">
            <PawIcon className="h-7 w-7 text-violet" />
          </span>
          <h2 className="mt-3 text-[17px] font-semibold text-heading">登录后继续</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {reason || "登录后即可点赞、评论和发布内容"}
          </p>
        </div>
        <button
          onClick={() => actions.wechatLogin()}
          className="pressable mt-5 w-full rounded-full bg-mint px-4 py-3 text-[14px] font-semibold text-[#3b5245] shadow-card"
        >
          微信一键登录
        </button>
        <button
          onClick={() => actions.closeLoginSheet()}
          className="pressable mt-2 w-full rounded-full py-2.5 text-[13px] text-muted-foreground"
        >
          再看看
        </button>
      </div>
    </div>
  );
}

/* ── Lightbox ──────────────────────────────────────────── */
export function Lightbox() {
  const open = useCommunity((s) => s.lightboxOpen);
  const index = useCommunity((s) => s.lightboxIndex);
  const count = useCommunity((s) => s.lightboxCount);
  if (!open) return null;
  const prev = () => actions.setLightboxIndex((index - 1 + count) % count);
  const next = () => actions.setLightboxIndex((index + 1) % count);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85">
      <div className="flex items-center justify-between px-4 pt-6 text-white">
        <span className="text-[13px]">
          {index + 1} / {count}
        </span>
        <button
          onClick={() => actions.closeLightbox()}
          className="pressable grid h-9 w-9 place-items-center rounded-full bg-white/10"
          aria-label="关闭"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[402px]">
          <Placeholder
            label="示例图片（放大查看，待替换）"
            ratio="aspect-square"
            rounded="rounded-2xl"
          />
        </div>
        {count > 1 && (
          <>
            <button
              onClick={prev}
              className="pressable absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
              aria-label="上一张"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              onClick={next}
              className="pressable absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
              aria-label="下一张"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
      <div className="h-10" />
    </div>
  );
}

/* ── Comment composer ──────────────────────────────────── */
export function CommentComposer({ postId }: { postId: string }) {
  const role = useCommunity((s) => s.role);
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) {
      if (role === "guest") actions.requireLogin("发表评论需要登录");
      return;
    }
    actions.addComment(postId, text.trim());
    setText("");
  };
  return (
    <div className="flex items-center gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          if (role === "guest") actions.requireLogin("发表评论需要登录");
        }}
        placeholder="留下你的评论…"
        className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-[13.5px] outline-none focus:border-primary"
      />
      <button
        onClick={submit}
        className="pressable rounded-full bg-violet px-4 py-2.5 text-[13px] font-semibold text-white"
      >
        发送
      </button>
    </div>
  );
}

/* ── SectionHeader ─────────────────────────────────────── */
export function Sub({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.18em] text-warm">
      {children}
    </h3>
  );
}
