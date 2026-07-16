import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";
import { PostCard, LoginSheet, Lightbox } from "@/components/mobile/community/CommunityBits";
import { EditIcon, TrashIcon, PlusIcon, XIcon, CatIcon } from "@/components/mobile/icons";
import { actions, useCommunity, type Post } from "@/lib/community-store";

export const Route = createFileRoute("/community/my-posts")({
  head: () => ({ meta: [{ title: "我的发布 — 猫友圈" }] }),
  component: MyPosts,
});

function MyPosts() {
  const currentUserId = useCommunity((s) => s.currentUserId);
  const allPosts = useCommunity((s) => s.posts);
  const role = useCommunity((s) => s.role);
  const posts = allPosts.filter((p) => p.authorId === currentUserId);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (role === "guest") {
    return (
      <PhoneFrame title="我的发布" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          登录后可查看自己的发布。
        </Section>
      </PhoneFrame>
    );
  }

  const handleDelete = (id: string) => {
    if (confirm("确定删除这条动态？")) {
      actions.deletePost(id);
      if (editingId === id) setEditingId(null);
    }
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
        {posts.map((p) =>
          editingId === p.id ? (
            <EditPanel key={p.id} post={p} onClose={() => setEditingId(null)} />
          ) : (
            <div key={p.id} className="space-y-2">
              <PostCard post={p} />
              <div className="flex justify-end gap-2 px-1">
                <button
                  onClick={() => setEditingId(p.id)}
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
          ),
        )}
      </Section>
      <LoginSheet />
      <Lightbox />
    </PhoneFrame>
  );
}

function EditPanel({ post, onClose }: { post: Post; onClose: () => void }) {
  const role = useCommunity((s) => s.role);
  const currentUserId = useCommunity((s) => s.currentUserId);
  const cats = useCommunity((s) => s.cats);

  const [content, setContent] = useState(post.content);
  const [imageCount, setImageCount] = useState(post.imageCount);
  const [catIds, setCatIds] = useState<string[]>(post.catIds);

  const selectableCats = cats.filter((c) =>
    role === "keeper" ? true : c.ownerId === currentUserId,
  );
  const toggleCat = (id: string) =>
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = () => {
    if (!content.trim()) {
      alert("内容不能为空");
      return;
    }
    actions.updatePost(post.id, {
      content: content.trim(),
      imageCount,
      catIds,
    });
    onClose();
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/70 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-semibold text-heading">编辑动态</p>
        <button
          onClick={onClose}
          className="pressable text-[11.5px] text-muted-foreground"
        >
          取消
        </button>
      </div>

      {/* content */}
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-heading">内容</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-[14px] outline-none focus:border-primary"
        />
      </div>

      {/* images */}
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-heading">
          照片 · {imageCount}/9
        </p>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: imageCount }).map((_, i) => (
            <div key={i} className="relative">
              <Placeholder label="示例" ratio="aspect-square" rounded="rounded-xl" compact />
              <button
                onClick={() => setImageCount((n) => Math.max(0, n - 1))}
                className="pressable absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-heading/70 text-white"
                aria-label="删除图片"
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
      </div>

      {/* linked cats */}
      <div>
        <p className="mb-1.5 text-[12px] font-medium text-heading">
          关联猫咪 {role === "parent" && "· 只能关联自己的猫"}
        </p>
        {selectableCats.length === 0 ? (
          <p className="rounded-2xl bg-background/60 px-4 py-4 text-[12.5px] text-muted-foreground">
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
                      : "border border-border bg-background text-muted-foreground"
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

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="pressable flex-1 rounded-full border border-border bg-background py-2.5 text-[13.5px] font-medium text-muted-foreground"
        >
          取消
        </button>
        <button
          onClick={save}
          className="pressable flex-1 rounded-full bg-violet py-2.5 text-[13.5px] font-semibold text-white shadow-card"
        >
          保存
        </button>
      </div>
    </div>
  );
}
