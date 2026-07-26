import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";
import { PostCard, LoginSheet, Lightbox } from "@/components/mobile/community/CommunityBits";
import { EditIcon, TrashIcon, PlusIcon, XIcon, CatIcon } from "@/components/mobile/icons";
import { actions, useCommunity, type Post } from "@/lib/community-store";
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
    : "border border-border bg-background text-muted-foreground";
}

export const Route = createFileRoute("/community/my-posts")({
  head: () => ({ meta: [{ title: "我的发布 — 猫友圈" }] }),
  component: MyPosts,
});

function MyPosts() {
  const currentUserId = useCommunity((s) => s.currentUserId);
  const allPosts = useCommunity((s) => s.posts);
  const role = useCommunity((s) => s.role);
  const parentSessionActive = useCommunity((s) => s.parentSessionActive);
  const posts = allPosts.filter((post) => post.authorId === currentUserId);
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
    if (!confirm("确定删除这条动态？")) return;
    const deleted = actions.deletePost(id);
    if (!deleted) {
      alert("当前家长身份已停用或无权限删除。");
      return;
    }
    if (editingId === id) setEditingId(null);
  };

  return (
    <PhoneFrame title="我的发布" showBack>
      <Section className="space-y-4 py-4 pb-8">
        {role === "parent" && !parentSessionActive && (
          <p className="rounded-2xl bg-card/60 px-4 py-4 text-[12.5px] leading-relaxed text-muted-foreground">
            当前家长身份已停用。历史动态仍会保留，但暂时不能继续编辑或发布新内容。
          </p>
        )}
        {posts.length === 0 && (
          <p className="rounded-2xl bg-card/60 px-4 py-10 text-center text-[13px] text-muted-foreground">
            还没有发布过内容～
            <br />
            <Link to="/community/publish" className="mt-2 inline-block text-violet">
              去写第一条动态
            </Link>
          </p>
        )}
        {posts.map((post) =>
          editingId === post.id ? (
            <EditPanel key={post.id} post={post} onClose={() => setEditingId(null)} />
          ) : (
            <div key={post.id} className="space-y-2">
              <PostCard post={post} />
              <div className="flex justify-end gap-2 px-1">
                <button
                  onClick={() => setEditingId(post.id)}
                  disabled={role === "parent" && !parentSessionActive}
                  className="pressable inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11.5px] font-medium text-heading disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(post.id)}
                  disabled={role === "parent" && !parentSessionActive}
                  className="pressable inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11.5px] font-medium text-wine disabled:cursor-not-allowed disabled:opacity-50"
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
  const parentSessionActive = useCommunity((s) => s.parentSessionActive);
  const cats = useCommunity((s) => s.cats);
  const catteryState = useCattery((snapshot) => snapshot);
  const publicKittens = useMemo(() => selectKittenRecords(catteryState), [catteryState]);
  const publicStuds = useMemo(() => selectStuds(catteryState), [catteryState]);
  const litterOptions = useMemo(() => selectLitterRecords(catteryState), [catteryState]);
  const canEdit = post.authorId === currentUserId && (role !== "parent" || parentSessionActive);

  const [content, setContent] = useState(post.content);
  const [imageCount, setImageCount] = useState(post.imageCount);
  const [catIds, setCatIds] = useState<string[]>(post.catIds);
  const [litterIds, setLitterIds] = useState<string[]>(post.litterIds ?? []);

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

  const toggleCat = (id: string) =>
    setCatIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  const toggleLitter = (litterId: string) =>
    setLitterIds((prev) =>
      prev.includes(litterId) ? prev.filter((item) => item !== litterId) : [...prev, litterId],
    );

  const save = () => {
    if (!content.trim()) {
      alert("内容不能为空");
      return;
    }
    const updated = actions.updatePost(post.id, {
      content: content.trim(),
      imageCount,
      catIds,
      litterIds,
    });
    if (!updated) {
      alert("当前家长身份已停用或无权限编辑。");
      return;
    }
    onClose();
  };

  if (!canEdit) {
    return (
      <div className="rounded-2xl border border-border bg-card/70 p-4 text-[12.5px] text-muted-foreground">
        当前状态下不能编辑这条动态。
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/70 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-semibold text-heading">编辑动态</p>
        <button onClick={onClose} className="pressable text-[11.5px] text-muted-foreground">
          取消
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-heading">内容</p>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={5}
          className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-[14px] outline-none focus:border-primary"
        />
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium text-heading">照片 · {imageCount}/9</p>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: imageCount }).map((_, index) => (
            <div key={index} className="relative">
              <Placeholder label="示例" ratio="aspect-square" rounded="rounded-xl" compact />
              <button
                onClick={() => setImageCount((count) => Math.max(0, count - 1))}
                className="pressable absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-heading/70 text-white"
                aria-label="删除图片"
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
      </div>

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
        <p className="mb-1.5 text-[12px] font-medium text-heading">关联窝次 · 可选</p>
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
