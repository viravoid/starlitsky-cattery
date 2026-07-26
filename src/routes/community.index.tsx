import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { PlusIcon, CatIcon, PawIcon, UserIcon } from "@/components/mobile/icons";
import { PostCard, LoginSheet, Lightbox } from "@/components/mobile/community/CommunityBits";
import { actions, useCommunity, CATEGORIES, type Category } from "@/lib/community-store";
import { selectLitterRecords, useCattery } from "@/lib/cattery-store";

export const Route = createFileRoute("/community/")({
  head: () => ({
    meta: [
      { title: "猫友圈 — 星月缅因猫舍" },
      {
        name: "description",
        content: "星月缅因猫舍的猫友圈：猫舍日常、家长分享和主理人碎碎念，记录每只小猫的成长时光。",
      },
    ],
  }),
  component: CommunityFeed,
});

function CommunityFeed() {
  const [filter, setFilter] = useState<Category | "全部">("全部");
  const [litterFilter, setLitterFilter] = useState<string | "全部">("全部");
  const [litterOpen, setLitterOpen] = useState(false);
  const catteryState = useCattery((snapshot) => snapshot);
  const litterOptions = useMemo(() => selectLitterRecords(catteryState), [catteryState]);
  const posts = useCommunity((s) => s.posts).filter((post) => !post.hidden);
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);
  const users = useCommunity((s) => s.users);
  const parentSessionActive = useCommunity((s) => s.parentSessionActive);
  const me = users.find((user) => user.id === currentUserId);
  const demoParent = users.find((user) => user.id === "parent-huhu");

  const filtered = posts
    .filter(
      (post) =>
        (filter === "全部" || post.category === filter) &&
        (litterFilter === "全部" || (post.litterIds ?? []).includes(litterFilter)),
    )
    .sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  const activeLitterLabel =
    litterFilter === "全部"
      ? "全部"
      : (litterOptions.find((item) => item.id === litterFilter)?.name ?? "全部");

  const canPost = role === "keeper" || (role === "parent" && parentSessionActive);

  return (
    <PhoneFrame activeTab="community" showTabBar>
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

        {role === "parent" && !parentSessionActive && (
          <div className="mt-3 rounded-2xl border border-border bg-card/60 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
            当前家长身份已停用。历史猫咪和历史动态仍保留，但暂时不能继续发布、编辑或新增家长内容。
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-2xl border border-dashed border-border bg-cream/60 px-3 py-2 text-[11px] text-warm">
          <span className="mr-1 opacity-70">Demo 登录：</span>
          {[
            { key: "guest", label: "未登录" },
            { key: "parent", label: `家长（${demoParent?.name ?? "呼呼和奶油"}）` },
            { key: "keeper", label: "主理人（月七）" },
          ].map((option) => {
            const active = role === option.key;
            return (
              <button
                key={option.key}
                onClick={() => {
                  if (option.key === "guest") {
                    actions.logout();
                    return;
                  }
                  if (option.key === "parent") {
                    if (!actions.activateParent("DEMO")) {
                      alert("当前没有可用的已启用家长身份。");
                    }
                    return;
                  }
                  actions.becomeKeeper();
                }}
                className="pressable rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: active ? "#7a9ac0" : "transparent",
                  color: active ? "#fff" : "#8c929a",
                  border: active ? "none" : "1px solid var(--border)",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="no-scrollbar mt-4 flex gap-5 overflow-x-auto border-b border-border/70 px-5">
        {(["全部", ...CATEGORIES] as const).map((category) => {
          const active = filter === category;
          return (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className="pressable relative shrink-0 py-2.5 text-[13px]"
              style={{
                color: active ? "#7a9ac0" : "#8c929a",
                fontWeight: active ? 600 : 500,
              }}
            >
              {category}
              {active && (
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
          窝次{litterFilter === "全部" ? "" : `：${activeLitterLabel}`}
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
          {(["全部", ...litterOptions.map((item) => item.id)] as const).map((litterId) => {
            const active = litterFilter === litterId;
            const label =
              litterId === "全部"
                ? litterId
                : (litterOptions.find((item) => item.id === litterId)?.name ?? litterId);
            return (
              <button
                key={litterId}
                onClick={() => {
                  setLitterFilter(litterId);
                  setLitterOpen(false);
                }}
                className="pressable shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold"
                style={
                  active
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
                {label}
              </button>
            );
          })}
        </div>
      )}

      <Section className="space-y-4 py-4 pb-28">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-border/60 bg-card px-5 py-10 text-center text-[13px] text-muted-foreground">
            当前筛选下还没有动态。
          </div>
        ) : (
          filtered.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </Section>

      {canPost && (
        <Link
          to="/community/publish"
          className="pressable fixed bottom-24 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-violet text-white shadow-float"
          aria-label="发布动态"
        >
          <PlusIcon className="h-6 w-6" />
        </Link>
      )}
      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}
