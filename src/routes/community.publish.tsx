import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder, Pill } from "@/components/mobile/ui";
import { PlusIcon, XIcon, CatIcon } from "@/components/mobile/icons";
import { actions, useCommunity, CATEGORIES, type Category } from "@/lib/community-store";
import {
  resolveCatId,
  selectKittenRecords,
  selectLitterRecords,
  selectStuds,
  useCattery,
} from "@/lib/cattery-store";

function getLinkedOptionClass(selected: boolean) {
  return selected
    ? "bg-sunny/60 text-[#b48725] shadow-card"
    : "border border-border bg-card text-muted-foreground";
}

export const Route = createFileRoute("/community/publish")({
  head: () => ({ meta: [{ title: "发布动态 — 猫友圈" }] }),
  component: Publish,
});

function Publish() {
  const navigate = useNavigate();
  const role = useCommunity((s) => s.role);
  const parentSessionActive = useCommunity((s) => s.parentSessionActive);
  const currentUserId = useCommunity((s) => s.currentUserId);
  const cats = useCommunity((s) => s.cats);
  const catteryState = useCattery((snapshot) => snapshot);
  const publicKittens = useMemo(() => selectKittenRecords(catteryState), [catteryState]);
  const publicStuds = useMemo(() => selectStuds(catteryState), [catteryState]);
  const litterOptions = useMemo(() => selectLitterRecords(catteryState), [catteryState]);

  const canPost = role === "keeper" || (role === "parent" && parentSessionActive);
  const [category, setCategory] = useState<Category>(role === "parent" ? "家长分享" : "猫舍日常");
  const [content, setContent] = useState("");
  const [imageCount, setImageCount] = useState(0);
  const [catIds, setCatIds] = useState<string[]>([]);
  const [litterIds, setLitterIds] = useState<string[]>([]);
  const selectableCats = useMemo(() => {
    if (role !== "keeper") {
      return cats.filter((cat) => cat.ownerId === currentUserId);
    }
    const lookup = new Map<string, { id: string; name: string }>();
    [...cats, ...publicKittens, ...publicStuds].forEach((cat) => {
      const canonicalId = resolveCatId(cat.id);
      if (!lookup.has(canonicalId)) {
        lookup.set(canonicalId, { id: canonicalId, name: cat.name });
      }
    });
    return Array.from(lookup.values());
  }, [cats, currentUserId, publicKittens, publicStuds, role]);

  if (!canPost) {
    return (
      <PhoneFrame title="发布动态" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          {role === "parent" && !parentSessionActive
            ? "当前家长身份已停用，暂时不能发布新内容。"
            : "发布内容需要开通家长身份或猫舍主理人权限。"}
        </Section>
      </PhoneFrame>
    );
  }

  const toggleCat = (id: string) =>
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleLitter = (litterId: string) =>
    setLitterIds((prev) =>
      prev.includes(litterId) ? prev.filter((item) => item !== litterId) : [...prev, litterId],
    );

  const submit = () => {
    if (!content.trim()) {
      alert("请写点什么吧～");
      return;
    }
    const id = actions.createPost({
      category,
      content: content.trim(),
      imageCount,
      catIds,
      litterIds,
    });
    if (!id) {
      alert("当前家长身份已停用或无权限发布。");
      return;
    }
    navigate({ to: "/community/post/$id", params: { id } });
  };

  const availableCategories = role === "keeper" ? CATEGORIES : (["家长分享", "碎碎念"] as const);

  return (
    <PhoneFrame title="发布动态" showBack>
      <Section className="space-y-4 py-4 pb-8">
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">分类</p>
          <div className="flex flex-wrap gap-2">
            {availableCategories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item as Category)}
                className={`pressable rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${
                  category === item
                    ? "bg-violet text-white shadow-card"
                    : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">内容</p>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="记录一件今天想说的事…"
            rows={6}
            className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[14px] outline-none focus:border-primary"
          />
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">照片 · {imageCount}/9</p>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: imageCount }).map((_, index) => (
              <div key={index} className="relative">
                <Placeholder label="示例" ratio="aspect-square" rounded="rounded-xl" compact />
                <button
                  onClick={() => setImageCount((count) => Math.max(0, count - 1))}
                  className="pressable absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-heading/70 text-white"
                  aria-label="删除"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
            {imageCount < 9 && (
              <button
                onClick={() => setImageCount((count) => count + 1)}
                className="pressable flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-border text-warm"
                aria-label="添加图片"
              >
                <PlusIcon className="h-6 w-6" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-warm">
            示例上传（实际接入微信小程序后可从相册选择）
          </p>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">
            关联猫咪 {role === "parent" && "· 只能关联自己的猫"}
          </p>
          {selectableCats.length === 0 ? (
            <p className="rounded-2xl bg-card/60 px-4 py-4 text-[12.5px] text-muted-foreground">
              还没有可关联的猫咪。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectableCats.map((cat) => {
                const selected = catIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCat(cat.id)}
                    className={`pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] ${getLinkedOptionClass(
                      selected,
                    )}`}
                  >
                    <CatIcon className="h-3.5 w-3.5" />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">关联窝次 · 可选</p>
          <div className="flex flex-wrap gap-2">
            {litterOptions.map((litter) => {
              const selected = litterIds.includes(litter.id);
              return (
                <button
                  key={litter.id}
                  onClick={() => toggleLitter(litter.id)}
                  className={`pressable rounded-full px-3 py-1.5 text-[12.5px] ${getLinkedOptionClass(
                    selected,
                  )}`}
                >
                  {litter.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] leading-relaxed text-warm">
          <Pill tone="warm">发布须知</Pill>
          <p className="mt-1">
            请发布与缅因猫、猫舍生活相关的内容。主理人保留隐藏或删除不当内容的权限。
          </p>
        </div>

        <button
          onClick={submit}
          className="pressable w-full rounded-full bg-violet py-3 text-[15px] font-semibold text-white shadow-card"
        >
          发布动态
        </button>
      </Section>
    </PhoneFrame>
  );
}
