import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder, Pill } from "@/components/mobile/ui";
import { PlusIcon, XIcon, CatIcon } from "@/components/mobile/icons";
import {
  actions,
  useCommunity,
  CATEGORIES,
  type Category,
} from "@/lib/community-store";

export const Route = createFileRoute("/community/publish")({
  head: () => ({ meta: [{ title: "发布动态 — 猫友圈" }] }),
  component: Publish,
});

function Publish() {
  const navigate = useNavigate();
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);
  const cats = useCommunity((s) => s.cats);

  const canPost = role === "keeper" || role === "parent";
  const [category, setCategory] = useState<Category>(
    role === "parent" ? "家长分享" : "猫舍日常",
  );
  const [content, setContent] = useState("");
  const [imageCount, setImageCount] = useState(0);
  const [catIds, setCatIds] = useState<string[]>([]);

  if (!canPost) {
    return (
      <PhoneFrame title="发布动态" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          发布内容需要开通家长身份或猫舍主理人权限。
        </Section>
      </PhoneFrame>
    );
  }

  const selectableCats = cats.filter((c) =>
    role === "keeper" ? true : c.ownerId === currentUserId,
  );

  const toggleCat = (id: string) =>
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    if (!content.trim()) {
      alert("请写点什么吧～");
      return;
    }
    const id = actions.createPost({ category, content: content.trim(), imageCount, catIds });
    if (id) navigate({ to: "/community/post/$id", params: { id } });
  };

  const availableCats = role === "keeper" ? CATEGORIES : (["家长分享"] as const);

  return (
    <PhoneFrame title="发布动态" showBack>
      <Section className="space-y-4 py-4 pb-8">
        {/* category */}
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">分类</p>
          <div className="flex flex-wrap gap-2">
            {availableCats.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c as Category)}
                className={`pressable rounded-full px-3.5 py-1.5 text-[12.5px] font-medium ${
                  category === c
                    ? "bg-violet text-white shadow-card"
                    : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* content */}
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">内容</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录一件今天想说的事…"
            rows={6}
            className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-[14px] outline-none focus:border-primary"
          />
        </div>

        {/* images */}
        <div>
          <p className="mb-2 text-[12.5px] font-semibold text-heading">
            照片 · {imageCount}/9
          </p>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: imageCount }).map((_, i) => (
              <div key={i} className="relative">
                <Placeholder label="示例" ratio="aspect-square" rounded="rounded-xl" compact />
                <button
                  onClick={() => setImageCount((n) => Math.max(0, n - 1))}
                  className="pressable absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-heading/70 text-white"
                  aria-label="删除"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
            {imageCount < 9 && (
              <button
                onClick={() => setImageCount((n) => n + 1)}
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

        {/* linked cats */}
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
              {selectableCats.map((c) => {
                const on = catIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCat(c.id)}
                    className={`pressable inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] ${
                      on
                        ? "bg-mint/70 text-[#6b8db3] shadow-card"
                        : "border border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <CatIcon className="h-3.5 w-3.5" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
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
