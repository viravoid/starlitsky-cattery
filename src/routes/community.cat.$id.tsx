import { createFileRoute, useParams, Link, notFound } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill, Placeholder } from "@/components/mobile/ui";
import {
  PostCard,
  LoginSheet,
  Lightbox,
} from "@/components/mobile/community/CommunityBits";
import { useCommunity } from "@/lib/community-store";

export const Route = createFileRoute("/community/cat/$id")({
  head: () => ({ meta: [{ title: "小猫时光轴 — 猫友圈" }] }),
  component: CatTimeline,
});

function CatTimeline() {
  const { id } = useParams({ from: "/community/cat/$id" });
  const cat = useCommunity((s) => s.cats.find((c) => c.id === id));
  const posts = useCommunity((s) =>
    s.posts.filter((p) => !p.hidden && p.catIds.includes(id)),
  );
  const users = useCommunity((s) => s.users);
  if (!cat) throw notFound();
  const owner = users.find((u) => u.id === cat.ownerId);

  return (
    <PhoneFrame title={cat.name} showBack>
      <Section className="space-y-6 py-5 pb-10">
        {/* hero — cat is the主角 */}
        <div className="space-y-3">
          <Placeholder
            label={`示例图片（${cat.name} 头像，待替换）`}
            ratio="aspect-[4/3]"
            rounded="rounded-3xl"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-[20px] font-bold text-heading">{cat.name}</h1>
              <Pill tone={cat.gender === "妹妹" ? "warm" : "sky"}>{cat.gender}</Pill>
            </div>
            <p className="mt-1 text-[12px] text-warm">
              {cat.color} · 生日 {cat.birthday}
              {cat.joinDate && ` · 到家 ${cat.joinDate}`}
            </p>
            <p className="mt-3 text-[13.5px] leading-[1.8] text-card-foreground">
              {cat.personality}
            </p>
            {cat.note && (
              <p className="mt-2 rounded-2xl bg-cream/70 px-3 py-2 text-[12.5px] leading-relaxed text-warm">
                {cat.note}
              </p>
            )}
            {owner && (
              <p className="mt-3 text-[11.5px] text-warm">由 {owner.name} 维护</p>
            )}
          </div>
        </div>

        {/* timeline */}
        <div className="space-y-4">
          <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-warm">
            {cat.name} 的动态 · {posts.length} 条
          </h3>
          <div className="space-y-5">
            {posts.length === 0 && (
              <p className="py-8 text-center text-[12.5px] text-warm">
                这只小猫还没有专属动态。
              </p>
            )}
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </div>

        <p className="pt-2 text-center text-[11.5px] text-warm">
          想看更多？前往 <Link to="/cats" className="text-violet">我们的猫</Link> 查看猫舍现猫资料。
        </p>
      </Section>

      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}

