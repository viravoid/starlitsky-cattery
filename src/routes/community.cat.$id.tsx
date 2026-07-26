import { useMemo } from "react";
import { createFileRoute, notFound, useParams, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill, Placeholder } from "@/components/mobile/ui";
import { PostCard, LoginSheet, Lightbox } from "@/components/mobile/community/CommunityBits";
import { useCommunity } from "@/lib/community-store";
import { useCatteryImageUrls } from "@/hooks/use-cattery-image-urls";
import {
  hasHydratedCatteryData,
  resolveCatId,
  selectKittenRecords,
  selectStuds,
  useCattery,
} from "@/lib/cattery-store";

export const Route = createFileRoute("/community/cat/$id")({
  head: () => ({ meta: [{ title: "猫咪时光轴 — 猫友圈" }] }),
  component: CatTimeline,
});

function CatTimeline() {
  const { id } = useParams({ from: "/community/cat/$id" });
  const canonicalId = resolveCatId(id);
  const familyCats = useCommunity((s) => s.cats);
  const allPosts = useCommunity((s) => s.posts);
  const users = useCommunity((s) => s.users);
  const catteryState = useCattery((snapshot) => snapshot);
  const kittens = useMemo(() => selectKittenRecords(catteryState), [catteryState]);
  const studs = useMemo(() => selectStuds(catteryState), [catteryState]);
  const familyCat = useMemo(
    () => familyCats.find((cat) => resolveCatId(cat.id) === canonicalId),
    [canonicalId, familyCats],
  );
  const kitten = useMemo(
    () => kittens.find((cat) => resolveCatId(cat.id) === canonicalId),
    [canonicalId, kittens],
  );
  const stud = useMemo(
    () => studs.find((cat) => resolveCatId(cat.id) === canonicalId),
    [canonicalId, studs],
  );
  const posts = useMemo(
    () =>
      allPosts.filter(
        (post) =>
          !post.hidden && post.catIds.map((catId) => resolveCatId(catId)).includes(canonicalId),
      ),
    [allPosts, canonicalId],
  );
  const imageUrls = useCatteryImageUrls([
    kitten?.coverImageId,
    ...(kitten?.galleryImageIds ?? []).slice(0, 1),
  ]);
  const coverUrl =
    (kitten?.coverImageId && imageUrls[kitten.coverImageId]) ||
    ((kitten?.galleryImageIds ?? [])[0]
      ? imageUrls[(kitten?.galleryImageIds ?? [])[0]!]
      : undefined);

  if (!familyCat && !kitten && !stud && !hasHydratedCatteryData()) {
    return (
      <PhoneFrame title="猫咪时光轴" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          正在加载猫咪资料…
        </Section>
      </PhoneFrame>
    );
  }
  if (!familyCat && !kitten && !stud) throw notFound();
  const displayName = familyCat?.name ?? kitten?.name ?? stud?.name ?? "这只猫";
  const gender = familyCat?.gender ?? kitten?.gender;
  const color = familyCat?.color ?? kitten?.color ?? stud?.color;
  const birthday = familyCat?.birthday ?? kitten?.birthday;
  const joinDate = familyCat?.joinDate;
  const personality = familyCat?.personality ?? kitten?.personality ?? stud?.trait ?? "";
  const note = familyCat?.note;
  const owner = familyCat ? users.find((user) => user.id === familyCat.ownerId) : undefined;

  return (
    <PhoneFrame title={displayName} showBack>
      <Section className="space-y-6 py-5 pb-10">
        <div className="space-y-3">
          {coverUrl ? (
            <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-card">
              <img src={coverUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            </div>
          ) : (
            <Placeholder
              label={`示例图片（${displayName} 头像，待替换）`}
              ratio="aspect-[4/3]"
              rounded="rounded-3xl"
            />
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-[20px] font-bold text-heading">{displayName}</h1>
              {gender && <Pill tone={gender === "妹妹" ? "warm" : "sky"}>{gender}</Pill>}
            </div>
            {(color || birthday) && (
              <p className="mt-1 text-[12px] text-warm">
                {color}
                {color && birthday && " · "}
                {birthday && `生日 ${birthday}`}
                {joinDate && ` · 到家 ${joinDate}`}
              </p>
            )}
            {personality && (
              <p className="mt-3 text-[13.5px] leading-[1.8] text-card-foreground">{personality}</p>
            )}
            {note && (
              <p className="mt-2 rounded-2xl bg-cream/70 px-3 py-2 text-[12.5px] leading-relaxed text-warm">
                {note}
              </p>
            )}
            {owner && <p className="mt-3 text-[11.5px] text-warm">由 {owner.name} 维护</p>}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-warm">
            {displayName} 的动态 · {posts.length} 条
          </h3>
          <div className="space-y-5">
            {posts.length === 0 && (
              <p className="py-8 text-center text-[12.5px] text-warm">这只猫还没有专属动态。</p>
            )}
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </div>

        <p className="pt-2 text-center text-[11.5px] text-warm">
          想看更多？前往{" "}
          <Link to="/cats" className="text-violet">
            我们的猫
          </Link>{" "}
          查看猫舍现猫资料。
        </p>
      </Section>

      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}
