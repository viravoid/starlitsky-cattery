import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { PostCard, LoginSheet, Lightbox } from "@/components/mobile/community/CommunityBits";
import { useCommunity } from "@/lib/community-store";

export const Route = createFileRoute("/community/my-posts")({
  head: () => ({ meta: [{ title: "我的发布 — 猫友圈" }] }),
  component: MyPosts,
});

function MyPosts() {
  const currentUserId = useCommunity((s) => s.currentUserId);
  const posts = useCommunity((s) =>
    s.posts.filter((p) => p.authorId === currentUserId),
  );
  const role = useCommunity((s) => s.role);

  if (role === "guest") {
    return (
      <PhoneFrame title="我的发布" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          登录后可查看自己的发布。
        </Section>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame title="我的发布" showBack>
      <Section className="space-y-3 py-4 pb-8">
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
          <PostCard key={p.id} post={p} />
        ))}
      </Section>
      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}
