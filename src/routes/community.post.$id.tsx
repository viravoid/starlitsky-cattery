import { createFileRoute, useParams, Link, notFound } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill } from "@/components/mobile/ui";
import { TrashIcon } from "@/components/mobile/icons";
import {
  PostImages,
  UserAvatar,
  LoginSheet,
  Lightbox,
  CommentComposer,
  CatAvatar,
} from "@/components/mobile/community/CommunityBits";
import {
  actions,
  categoryTone,
  formatTime,
  useCommunity,
} from "@/lib/community-store";

export const Route = createFileRoute("/community/post/$id")({
  head: () => ({
    meta: [{ title: "动态详情 — 猫友圈" }],
  }),
  component: PostDetail,
});

function PostDetail() {
  const { id } = useParams({ from: "/community/post/$id" });
  const post = useCommunity((s) => s.posts.find((p) => p.id === id));
  const cats = useCommunity((s) => s.cats);
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);

  if (!post) throw notFound();

  const linkedCats = post.catIds
    .map((cid) => cats.find((c) => c.id === cid))
    .filter(Boolean) as { id: string; name: string }[];

  const authorRoleKind = post.authorRole === "猫舍主理人" ? "keeper" : "parent";
  const isMine = currentUserId === post.authorId;

  return (
    <PhoneFrame title="动态详情" showBack>
      <Section className="space-y-4 py-4 pb-4">
        <div className="soft-card space-y-3">
          <header className="flex items-center gap-2.5">
            <UserAvatar role={authorRoleKind} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-semibold text-heading">
                  {post.authorName}
                </span>
                <Pill tone={authorRoleKind === "keeper" ? "violet" : "creamblue"}>
                  {post.authorRole}
                </Pill>
              </div>
              <p className="mt-0.5 text-[11px] text-warm">{formatTime(post.createdAt)}</p>
            </div>
            <Pill tone={categoryTone(post.category)}>{post.category}</Pill>
          </header>

          <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-card-foreground">
            {post.content}
          </p>

          <PostImages count={post.imageCount} postId={post.id} />

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

          <footer className="flex items-center justify-between border-t border-border pt-3 text-[13px] text-muted-foreground">
            <button
              onClick={() => actions.toggleLike(post.id)}
              className={`pressable ${post.likedByMe ? "text-wine" : ""}`}
            >
              🐾 {post.likes} 个爪印
            </button>
            <span>{post.comments.length} 条评论</span>
          </footer>

          {isMine && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (confirm("确定删除这条动态吗？")) {
                    actions.deletePost(post.id);
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
        </div>

        {/* comments */}
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-heading">评论</h3>
          <div className="space-y-2.5">
            {post.comments.filter((c) => !c.hidden).length === 0 && (
              <p className="rounded-2xl bg-card/60 px-4 py-6 text-center text-[12.5px] text-muted-foreground">
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
                  <div key={c.id} className="flex gap-2.5 rounded-2xl bg-card px-3 py-2.5 shadow-card">
                    <UserAvatar role={kind === "keeper" ? "keeper" : "parent"} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] font-semibold text-heading">
                          {c.authorName}
                        </span>
                        {kind !== "guest" && (
                          <Pill tone={kind === "keeper" ? "violet" : "creamblue"}>
                            {c.authorRole}
                          </Pill>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-card-foreground">
                        {c.content}
                      </p>
                      <p className="mt-1 text-[11px] text-warm">{formatTime(c.createdAt)}</p>
                    </div>
                    {role === "keeper" && (
                      <button
                        onClick={() => actions.deleteComment(post.id, c.id)}
                        className="pressable self-start text-[11px] text-wine"
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

// avoid unused
void useState;
