import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { PostCard, LoginSheet, Lightbox } from "@/components/mobile/community/CommunityBits";
import { EditIcon, TrashIcon } from "@/components/mobile/icons";
import { actions, useCommunity } from "@/lib/community-store";

export const Route = createFileRoute("/community/my-posts")({
  head: () => ({ meta: [{ title: "我的发布 — 猫友圈" }] }),
  component: MyPosts,
});

function MyPosts() {
  const currentUserId = useCommunity((s) => s.currentUserId);
  const allPosts = useCommunity((s) => s.posts);
  const role = useCommunity((s) => s.role);
  const posts = allPosts.filter((p) => p.authorId === currentUserId);


  if (role === "guest") {
    return (
      <PhoneFrame title="我的发布" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          登录后可查看自己的发布。
        </Section>
      </PhoneFrame>
    );
  }

  const handleEdit = (id: string, current: string) => {
    const next = prompt("编辑动态内容", current);
    if (next !== null && next.trim() && next !== current) {
      actions.updatePost(id, { content: next.trim() });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("确定删除这条动态？")) actions.deletePost(id);
  };

  return (
    <PhoneFrame title="我的发布" showBack>
      <Section className="space-y-4 py-4 pb-8">
        {posts.length === 0 && (
          <p className="rounded-2xl bg-card/60 px-4 py-10 text-center text-[13px] text-muted-foreground">
            还没有发布过内容～
            <br />
            <Link to="/community/publish" className="mt-2 inline-block text-violet">
              去写第一条动态
            </Link>
          </p>
        )}
        {posts.map((p) => (
          <div key={p.id} className="space-y-2">
            <PostCard post={p} />
            <div className="flex justify-end gap-2 px-1">
              <button
                onClick={() => handleEdit(p.id, p.content)}
                className="pressable inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11.5px] font-medium text-heading"
              >
                <EditIcon className="h-3.5 w-3.5" />
                编辑
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                className="pressable inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11.5px] font-medium text-wine"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                删除
              </button>
            </div>
          </div>
        ))}
      </Section>
      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}
