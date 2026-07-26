import { createFileRoute, useParams, Link, notFound } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill } from "@/components/mobile/ui";
import { TrashIcon, PawIcon, PawFillIcon } from "@/components/mobile/icons";
import {
  PostImages,
  LoginSheet,
  Lightbox,
  CommentComposer,
  CatAvatar,
} from "@/components/mobile/community/CommunityBits";
import {
  actions,
  formatTime,
  hasHydratedCommunityStore,
  useCommunity,
} from "@/lib/community-store";
import {
  hasHydratedCatteryData,
  resolveCatId,
  selectKittenRecords,
  selectLitterRecords,
  selectStuds,
  useCattery,
} from "@/lib/cattery-store";

export const Route = createFileRoute("/community/post/$id")({
  head: () => ({
    meta: [{ title: "动态详情 — 猫友圈" }],
  }),
  component: PostDetail,
});

function PostDetail() {
  const { id } = useParams({ from: "/community/post/$id" });
  const post = useCommunity((s) => s.posts.find((p) => p.id === id));
  const familyCats = useCommunity((s) => s.cats);
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);
  const catteryState = useCattery((snapshot) => snapshot);
  const publicKittens = selectKittenRecords(catteryState);
  const publicStuds = selectStuds(catteryState);
  const publicLitters = selectLitterRecords(catteryState);

  if (!post && (!hasHydratedCommunityStore() || !hasHydratedCatteryData())) {
    return (
      <PhoneFrame title="动态详情" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          正在加载动态内容…
        </Section>
      </PhoneFrame>
    );
  }
  if (!post) throw notFound();

  const catLookup = new Map<string, { id: string; name: string }>();
  [...familyCats, ...publicKittens, ...publicStuds].forEach((cat) => {
    catLookup.set(resolveCatId(cat.id), { id: resolveCatId(cat.id), name: cat.name });
  });
  const litterLookup = new Map(publicLitters.map((litter) => [litter.id, litter.name]));
  const linkedCats = Array.from(new Set(post.catIds.map((catId) => resolveCatId(catId))))
    .map((catId) => catLookup.get(catId))
    .filter(Boolean) as { id: string; name: string }[];
  const linkedLitters = (post.litterIds ?? [])
    .map((litterId) => ({ id: litterId, name: litterLookup.get(litterId) }))
    .filter((item): item is { id: string; name: string } => Boolean(item.name));

  const authorRoleKind = post.authorRole === "猫舍主理人" ? "keeper" : "parent";
  const isMine = currentUserId === post.authorId;

  return (
    <PhoneFrame title="动态详情" showBack>
      <Section className="space-y-6 py-5 pb-6">
        <article className="space-y-4">
          <header className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[14.5px] font-semibold text-heading">{post.authorName}</span>
              <Pill tone={authorRoleKind === "keeper" ? "violet" : "creamblue"}>
                {post.authorRole}
              </Pill>
              <span className="text-[10.5px] text-warm/80">· {post.category}</span>
            </div>
            <p className="text-[11.5px] text-warm">{formatTime(post.createdAt)}</p>
          </header>

          <p className="whitespace-pre-line text-[14.5px] leading-[1.85] text-card-foreground">
            {post.content}
          </p>

          <PostImages count={post.imageCount} postId={post.id} />

          {(linkedCats.length > 0 || linkedLitters.length > 0) && (
            <div className="pt-1">
              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-warm/80">关联信息</p>
              {linkedLitters.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {linkedLitters.map((litter) => (
                    <Link
                      key={`${post.id}-${litter.id}`}
                      to="/community/litter/$id"
                      params={{ id: litter.id }}
                      className="pressable inline-flex items-center rounded-full bg-[#f9f0d4] px-3 py-1 text-[12px] font-medium text-[#b48725]"
                    >
                      {litter.name}
                    </Link>
                  ))}
                </div>
              )}
              {linkedCats.length > 0 && (
                <div className="flex flex-wrap gap-4">
                  {linkedCats.map((c) => (
                    <Link
                      key={c.id}
                      to="/community/cat/$id"
                      params={{ id: c.id }}
                      className="pressable flex flex-col items-center gap-1.5"
                    >
                      <CatAvatar size={64} name={c.name} />
                      <span className="text-[12px] font-medium text-heading">{c.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <footer className="flex items-center gap-6 border-t border-border/60 pt-3 text-[13px] text-warm">
            <button
              onClick={() => actions.toggleLike(post.id)}
              className={`pressable inline-flex items-center gap-1.5 ${
                post.likedByMe ? "text-violet" : ""
              }`}
            >
              {post.likedByMe ? (
                <PawFillIcon className="h-4 w-4" />
              ) : (
                <PawIcon className="h-4 w-4" />
              )}
              <span>{post.likes} 个爪印</span>
            </button>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("comments-section")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="pressable"
            >
              {post.comments.length} 条评论
            </button>
          </footer>

          {isMine && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (confirm("确定删除这条动态吗？")) {
                    const deleted = actions.deletePost(post.id);
                    if (!deleted) {
                      alert("当前家长身份已停用或无权限删除。");
                      return;
                    }
                    history.back();
                  }
                }}
                className="pressable inline-flex items-center gap-1 text-[12px] text-wine"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                删除动态
              </button>
            </div>
          )}
        </article>

        <div id="comments-section">
          <h3 className="mb-3 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-warm">
            评论
          </h3>
          <div className="divide-y divide-border/60">
            {post.comments.filter((c) => !c.hidden).length === 0 && (
              <p className="py-8 text-center text-[12.5px] text-warm">
                还没有人评论，来说点什么吧～
              </p>
            )}
            {post.comments
              .filter((c) => !c.hidden)
              .map((c) => {
                const kind =
                  c.authorRole === "猫舍主理人"
                    ? "keeper"
                    : c.authorRole === "星月家长"
                      ? "parent"
                      : "guest";
                return (
                  <div key={c.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12.5px] font-semibold text-heading">
                          {c.authorName}
                        </span>
                        {kind !== "guest" && (
                          <Pill tone={kind === "keeper" ? "violet" : "creamblue"}>
                            {c.authorRole}
                          </Pill>
                        )}
                        <span className="text-[10.5px] text-warm/80">
                          · {formatTime(c.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-[1.75] text-card-foreground">
                        {c.content}
                      </p>
                    </div>
                    {role === "keeper" && (
                      <button
                        onClick={() => actions.deleteComment(post.id, c.id)}
                        className="pressable text-[11px] text-wine"
                      >
                        删除
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </Section>

      <CommentComposer postId={post.id} />
      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}
