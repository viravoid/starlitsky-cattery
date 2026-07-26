import { useMemo } from "react";
import { createFileRoute, notFound, useParams, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";
import { PostCard, LoginSheet, Lightbox } from "@/components/mobile/community/CommunityBits";
import { useCommunity } from "@/lib/community-store";
import { hasHydratedCatteryData, selectLitterRecords, useCattery } from "@/lib/cattery-store";

export const Route = createFileRoute("/community/litter/$id")({
  head: () => ({ meta: [{ title: "窝次时光轴 — 猫友圈" }] }),
  component: LitterTimeline,
});

function LitterTimeline() {
  const { id } = useParams({ from: "/community/litter/$id" });
  const catteryState = useCattery((snapshot) => snapshot);
  const litters = useMemo(() => selectLitterRecords(catteryState), [catteryState]);
  const allPosts = useCommunity((s) => s.posts);
  const litter = useMemo(() => litters.find((item) => item.id === id), [id, litters]);
  const posts = useMemo(
    () => allPosts.filter((p) => !p.hidden && (p.litterIds ?? []).includes(id)),
    [allPosts, id],
  );

  if (!litter && !hasHydratedCatteryData()) {
    return (
      <PhoneFrame title="窝次时光轴" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          正在加载窝次资料…
        </Section>
      </PhoneFrame>
    );
  }
  if (!litter) throw notFound();

  return (
    <PhoneFrame title={litter.name} showBack>
      <Section className="space-y-6 py-5 pb-10">
        <div className="space-y-3">
          <Placeholder
            label={`示例图片（${litter.name} 合照，待替换）`}
            ratio="aspect-[4/3]"
            rounded="rounded-3xl"
          />
          <div>
            <h1 className="text-[20px] font-bold text-heading">{litter.name}</h1>
            <p className="mt-1 text-[12px] text-warm">
              {litter.birthDate ? `${litter.birthDate} 出生 · ` : ""}这一窝小朋友的共同动态。
            </p>
            <p className="mt-2 text-[12.5px] text-card-foreground">
              小猫 {litter.kittenCount} 只 · 动态 {posts.length} 条
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-warm">
            {litter.name} · {posts.length} 条动态
          </h3>
          <div className="space-y-5">
            {posts.length === 0 && (
              <p className="py-8 text-center text-[12.5px] text-warm">这一窝还没有专属动态。</p>
            )}
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </div>

        <p className="pt-2 text-center text-[11.5px] text-warm">
          回到{" "}
          <Link to="/cats" className="text-violet">
            我们的猫
          </Link>{" "}
          查看更多小猫。
        </p>
      </Section>

      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}
