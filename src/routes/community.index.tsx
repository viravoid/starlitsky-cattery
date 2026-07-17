import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { PlusIcon, CatIcon, PawIcon, UserIcon } from "@/components/mobile/icons";
import {
  PostCard,
  LoginSheet,
  Lightbox,
} from "@/components/mobile/community/CommunityBits";
import {
  actions,
  useCommunity,
  CATEGORIES,
  type Category,
} from "@/lib/community-store";
import { LITTERS, type Litter } from "@/lib/cattery-data";

export const Route = createFileRoute("/community/")({
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
  const [litterFilter, setLitterFilter] = useState<Litter | "全部">("全部");
  const [litterOpen, setLitterOpen] = useState(false);
  const posts = useCommunity((s) => s.posts).filter((p) => !p.hidden);
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);
  const users = useCommunity((s) => s.users);
  const me = users.find((u) => u.id === currentUserId);

  const filtered = posts
    .filter(
      (p) =>
        (filter === "全部" || p.category === filter) &&
        (litterFilter === "全部" || (p.litterIds ?? []).includes(litterFilter)),
    )
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const canPost = role === "keeper" || role === "parent";

  return (
    <PhoneFrame activeTab="community" showTabBar>
      {/* header — quieter, single line */}
      <header className="px-5 pt-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold leading-tight text-heading">猫友圈</h1>
          {role === "guest" ? (
            <button
              onClick={() => actions.requireLogin("登录后可点赞、评论和关注小猫")}
              className="pressable text-[12px] font-medium text-violet"
            >
              登录
            </button>
          ) : (
            <span className="text-[12px] text-warm">
              {me?.name ?? "已登录"}
              <button
                onClick={() => actions.logout()}
                className="pressable ml-2 text-warm/70 underline underline-offset-2"
              >
                退出
              </button>
            </span>
          )}
        </div>

        {/* my area entries — inline text links, no card墙 */}
        {role !== "guest" && (
          <nav className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-warm">
            {role === "parent" && (
              <Link to="/community/my-cats" className="pressable inline-flex items-center gap-1">
                <CatIcon className="h-3.5 w-3.5" />
                我的猫咪
              </Link>
            )}
            <Link to="/community/my-posts" className="pressable inline-flex items-center gap-1">
              <PawIcon className="h-3.5 w-3.5" />
              我的发布
            </Link>
            {role === "user" && (
              <Link
                to="/community/parent-onboard"
                className="pressable inline-flex items-center gap-1"
              >
                <UserIcon className="h-3.5 w-3.5" />
                开通家长
              </Link>
            )}
          </nav>
        )}

        {/* Demo 角色切换 —— 仅供预览，正式版可移除 */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl border border-dashed border-border bg-cream/60 px-3 py-2 text-[11px] text-warm">
          <span className="mr-1 opacity-70">Demo 登录：</span>
          {[
            { key: "guest", label: "未登录" },
            { key: "parent", label: "家长（呼呼和奶油）" },
            { key: "keeper", label: "主理人（月七）" },
          ].map((opt) => {
            const on = role === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => {
                  if (opt.key === "guest") actions.logout();
                  else if (opt.key === "parent") actions.activateParent("DEMO");
                  else actions.becomeKeeper();
                }}
                className="pressable rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: on ? "#7a9ac0" : "transparent",
                  color: on ? "#fff" : "#8c929a",
                  border: on ? "none" : "1px solid var(--border)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </header>


      {/* filters — underline nav, no filled pills */}
      <div className="no-scrollbar mt-4 flex gap-5 overflow-x-auto border-b border-border/70 px-5">
        {(["全部", ...CATEGORIES] as const).map((c) => {
          const on = filter === c;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className="pressable relative shrink-0 py-2.5 text-[13px]"
              style={{
                color: on ? "#7a9ac0" : "#8c929a",
                fontWeight: on ? 600 : 500,
              }}
            >
              {c}
              {on && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-px mx-auto h-[3px] w-8 rounded-full"
                  style={{ backgroundColor: "#e7c15d" }}
                />
              )}
            </button>
          );
        })}
        <button
          onClick={() => setLitterOpen((open) => !open)}
          className="pressable relative flex shrink-0 items-center gap-1.5 py-2.5 text-[13px]"
          style={{
            color: litterFilter === "全部" ? "#8c929a" : "#b48725",
            fontWeight: litterFilter === "全部" ? 500 : 600,
          }}
          aria-expanded={litterOpen}
        >
          窝次{litterFilter === "全部" ? "" : `：${litterFilter}`}
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform"
            style={{
              transform: litterOpen ? "rotate(180deg)" : "none",
              color: litterFilter === "全部" ? "#6b8db3" : "#b48725",
            }}
          />
          {litterFilter !== "全部" && (
            <span
              aria-hidden
              className="absolute inset-x-0 -bottom-px mx-auto h-[3px] w-8 rounded-full"
              style={{ backgroundColor: "#e7c15d" }}
            />
          )}
        </button>
      </div>

      {litterOpen && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pt-3">
          {(["全部", ...LITTERS] as const).map((l) => {
            const on = litterFilter === l;
            return (
              <button
                key={l}
                onClick={() => {
                  setLitterFilter(l);
                  setLitterOpen(false);
                }}
                className="pressable shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold"
                style={
                  on
                    ? {
                        backgroundColor: "#f9f0d4",
                        color: "#b48725",
                        border: "1px solid #e7c15d",
                      }
                    : {
                        backgroundColor: "#fffdf8",
                        color: "#6b8db3",
                        border: "1px solid #e8dfcf",
                      }
                }
              >
                {l}
              </button>
            );
          })}
        </div>
      )}

      {/* feed — extra breathing room */}
      <Section className="space-y-5 pb-28 pt-3">
        {filtered.length === 0 && (
          <div className="px-2 py-10 text-center text-[13px] text-warm">
            还没有相关动态～
          </div>
        )}
        {filtered.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </Section>

      {/* floating publish FAB — small, corner */}
      <div className="pointer-events-none absolute bottom-24 right-5 z-30">
        {canPost ? (
          <Link
            to="/community/publish"
            className="pressable pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-violet text-white shadow-float"
            aria-label="发布动态"
          >
            <PlusIcon className="h-5 w-5" />
          </Link>
        ) : (
          <button
            onClick={() =>
              role === "guest"
                ? actions.requireLogin("登录后可发布家长分享")
                : actions.requireLogin("发布内容需要开通家长身份")
            }
            className="pressable pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-violet text-white shadow-float"
            aria-label="发布动态"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}



