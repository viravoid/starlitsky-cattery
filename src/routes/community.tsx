import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { PlusIcon, PawIcon, CatIcon, UserIcon } from "@/components/mobile/icons";
import {
  PostCard,
  LoginSheet,
  Lightbox,
  UserAvatar,
} from "@/components/mobile/community/CommunityBits";
import {
  actions,
  useCommunity,
  CATEGORIES,
  type Category,
} from "@/lib/community-store";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "猫友圈 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍的猫友圈：猫舍日常、家长分享和主理人碎碎念，记录每只小猫的成长时光。",
      },
    ],
  }),
  component: CommunityFeed,
});

function CommunityFeed() {
  const [filter, setFilter] = useState<Category | "全部">("全部");
  const posts = useCommunity((s) => s.posts).filter((p) => !p.hidden);
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);
  const users = useCommunity((s) => s.users);
  const me = users.find((u) => u.id === currentUserId);

  const filtered = posts
    .filter((p) => filter === "全部" || p.category === filter)
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const canPost = role === "keeper" || role === "parent";

  return (
    <PhoneFrame activeTab="community" showTabBar>
      {/* header */}
      <header className="px-5 pb-3 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold leading-tight text-heading">猫友圈</h1>
            <p className="mt-1 text-[12.5px] text-warm">
              家长与猫舍的共同记事本
            </p>
          </div>
          <div className="flex items-center gap-2">
            {role === "guest" ? (
              <button
                onClick={() => actions.requireLogin("登录后可点赞、评论和关注小猫")}
                className="pressable inline-flex items-center gap-1.5 rounded-full bg-mint/60 px-3 py-1.5 text-[12px] font-semibold text-[#3b5245]"
              >
                <UserIcon className="h-4 w-4" />
                登录
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-card px-2.5 py-1.5 text-[12px] text-heading shadow-card">
                <UserAvatar role={role === "keeper" ? "keeper" : "parent"} size={22} />
                <span className="max-w-[8em] truncate">{me?.name ?? "已登录"}</span>
              </span>
            )}
          </div>
        </div>

        {/* my area entries */}
        {role !== "guest" && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {role === "parent" && (
              <Link
                to="/community/my-cats"
                className="pressable rounded-2xl border border-border bg-card p-3 text-center shadow-card"
              >
                <CatIcon className="mx-auto h-6 w-6 text-violet" />
                <p className="mt-1.5 text-[11.5px] font-medium text-heading">我的猫咪</p>
              </Link>
            )}
            <Link
              to="/community/my-posts"
              className="pressable rounded-2xl border border-border bg-card p-3 text-center shadow-card"
            >
              <PawIcon className="mx-auto h-6 w-6 text-violet" />
              <p className="mt-1.5 text-[11.5px] font-medium text-heading">我的发布</p>
            </Link>
            {role === "user" && (
              <Link
                to="/community/parent-onboard"
                className="pressable rounded-2xl border border-border bg-card p-3 text-center shadow-card"
              >
                <UserIcon className="mx-auto h-6 w-6 text-violet" />
                <p className="mt-1.5 text-[11.5px] font-medium text-heading">开通家长</p>
              </Link>
            )}
            <button
              onClick={() => actions.logout()}
              className="pressable rounded-2xl border border-dashed border-border bg-card/60 p-3 text-center text-[11.5px] text-muted-foreground"
            >
              退出登录
            </button>
          </div>
        )}
      </header>

      {/* filters */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3">
        {(["全部", ...CATEGORIES] as const).map((c) => {
          const on = filter === c;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`pressable shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${
                on
                  ? "bg-violet text-white shadow-card"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* feed */}
      <Section className="space-y-3 pb-24">
        {filtered.length === 0 && (
          <div className="soft-card text-center text-[13px] text-muted-foreground">
            还没有相关动态～
          </div>
        )}
        {filtered.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </Section>

      {/* FAB */}
      <button
        onClick={() => {
          if (!canPost) {
            if (role === "guest") {
              actions.requireLogin("发布内容需要登录，家长身份可发布家长分享");
            } else {
              // logged in but not parent/keeper
              actions.requireLogin("发布内容需要开通家长身份");
            }
            return;
          }
          window.location.href = "/community/publish";
        }}
        className="pressable fixed bottom-24 right-1/2 z-30 grid h-14 w-14 translate-x-[calc(50vw-1.5rem)] place-items-center rounded-full bg-violet text-white shadow-float sm:translate-x-[calc(200px-2.25rem)]"
        aria-label="发布"
      >
        <PlusIcon className="h-7 w-7" />
      </button>

      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}

