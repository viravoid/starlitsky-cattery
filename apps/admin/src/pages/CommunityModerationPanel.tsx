import type { AdminCommunityPostData, CommunityCommentData } from "@starlitsky/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCommunityModerationPost,
  listCommunityModerationPosts,
  moderateCommunityComment,
  moderateCommunityPost,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

const CATEGORY_OPTIONS = [
  { label: "全部分类", value: "" },
  { label: "猫舍日常", value: "cattery_daily" },
  { label: "家长分享", value: "parent_share" },
  { label: "碎碎念", value: "personal_thoughts" },
];

const VISIBILITY_OPTIONS = [
  { label: "全部状态", value: "" },
  { label: "可见", value: "visible" },
  { label: "隐藏", value: "hidden" },
  { label: "归档", value: "archived" },
];

export function CommunityModerationPanel() {
  const [posts, setPosts] = useState<AdminCommunityPostData[]>([]);
  const [selectedPost, setSelectedPost] = useState<AdminCommunityPostData | null>(null);
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("");
  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedId = selectedPost?.id ?? "";
  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await listCommunityModerationPosts({
        category,
        includeDeleted,
        pageSize: 100,
        q: query,
        visibility,
      });
      setPosts(data.items);
      setSelectedPost((current) =>
        current ? (data.items.find((post) => post.id === current.id) ?? null) : data.items[0] ?? null,
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [category, includeDeleted, query, visibility]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  async function selectPost(post: AdminCommunityPostData) {
    setNotice("");
    setError("");
    try {
      setSelectedPost(await getCommunityModerationPost(post.id));
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function moderatePost(input: { deleted?: boolean; pinned?: boolean; visibility?: string }) {
    if (!selectedPost) return;
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const updated = await moderateCommunityPost(selectedPost.id, input);
      setSelectedPost(updated);
      setNotice("动态状态已更新");
      await loadPosts();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function moderateComment(comment: CommunityCommentData, input: { deleted?: boolean; visibility?: string }) {
    if (!selectedPost) return;
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const updatedComment = await moderateCommunityComment(selectedPost.id, comment.id, input);
      setSelectedPost({
        ...selectedPost,
        comments: selectedPost.comments.map((item) =>
          item.id === updatedComment.id ? updatedComment : item,
        ),
      });
      setNotice("评论状态已更新");
      await loadPosts();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  const stats = useMemo(
    () => ({
      hidden: posts.filter((post) => post.visibility === "hidden" && !post.deletedAt).length,
      pinned: posts.filter((post) => post.pinned && !post.deletedAt).length,
      visible: posts.filter((post) => post.visibility === "visible" && !post.deletedAt).length,
    }),
    [posts],
  );

  return (
    <div className="workspace">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Community Moderation</p>
          <h2>社区动态管理</h2>
          <p className="muted compact">
            可见 {stats.visible} / 隐藏 {stats.hidden} / 置顶 {stats.pinned}
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={loadPosts}>
            刷新
          </button>
        </div>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="inline-form">
        <div className="form-grid">
          <label>
            分类
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            可见性
            <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            搜索
            <input value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="toggle-row">
            <input
              checked={includeDeleted}
              type="checkbox"
              onChange={(event) => setIncludeDeleted(event.target.checked)}
            />
            显示已删除
          </label>
        </div>
      </div>

      <div className="management-grid">
        <section className="table-panel">
          <div className="section-heading">
            <h3>动态列表</h3>
            <span className="muted">{isLoading ? "加载中..." : `${posts.length} 条`}</span>
          </div>
          {posts.length === 0 ? (
            <div className="empty-state">暂无匹配动态</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>正文</th>
                    <th>分类</th>
                    <th>作者</th>
                    <th>状态</th>
                    <th>置顶</th>
                    <th>关联</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className={post.deletedAt || selectedId === post.id ? "archived-row" : ""}
                      onClick={() => void selectPost(post)}
                    >
                      <td>
                        <button className="link-button truncate-cell" type="button">
                          {post.content}
                        </button>
                      </td>
                      <td>{formatCategory(post.category)}</td>
                      <td>{post.authorName}</td>
                      <td>{formatVisibility(post.visibility, post.deletedAt)}</td>
                      <td>{post.pinned ? "是" : "否"}</td>
                      <td>{formatRelations(post)}</td>
                      <td>{formatDateTime(post.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="detail-panel">
          {selectedPost ? (
            <div className="detail-stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Post Detail</p>
                  <h3>{selectedPost.authorName}</h3>
                </div>
                <span>{formatVisibility(selectedPost.visibility, selectedPost.deletedAt)}</span>
              </div>
              <p>{selectedPost.content}</p>
              <dl className="description-list">
                {[
                  ["分类", formatCategory(selectedPost.category)],
                  ["作者", `${selectedPost.authorName} (${selectedPost.authorRole})`],
                  ["作者 ID", selectedPost.authorUserId],
                  ["置顶", selectedPost.pinned ? "是" : "否"],
                  ["关联猫", selectedPost.cats.map((cat) => cat.name).join(", ") || "-"],
                  ["关联窝次", selectedPost.litters.map((litter) => litter.name).join(", ") || "-"],
                  ["图片", `${selectedPost.mediaAssets.length} 张`],
                  ["评论", `${selectedPost.comments.length} 条`],
                  ["创建时间", formatDateTime(selectedPost.createdAt)],
                  ["更新时间", formatDateTime(selectedPost.updatedAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  disabled={isSaving || Boolean(selectedPost.deletedAt)}
                  type="button"
                  onClick={() =>
                    moderatePost({
                      visibility: selectedPost.visibility === "hidden" ? "visible" : "hidden",
                    })
                  }
                >
                  {selectedPost.visibility === "hidden" ? "恢复显示" : "隐藏"}
                </button>
                <button
                  className="secondary-button"
                  disabled={isSaving || Boolean(selectedPost.deletedAt)}
                  type="button"
                  onClick={() => moderatePost({ pinned: !selectedPost.pinned })}
                >
                  {selectedPost.pinned ? "取消置顶" : "置顶"}
                </button>
                <button
                  className="danger-button"
                  disabled={isSaving || Boolean(selectedPost.deletedAt)}
                  type="button"
                  onClick={() => moderatePost({ deleted: true })}
                >
                  删除
                </button>
              </div>
              <CommunityCommentModerationList
                comments={selectedPost.comments}
                isSaving={isSaving}
                onModerate={moderateComment}
              />
            </div>
          ) : (
            <div className="empty-state">选择一条动态查看详情。</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function CommunityCommentModerationList({
  comments,
  isSaving,
  onModerate,
}: {
  comments: CommunityCommentData[];
  isSaving: boolean;
  onModerate: (comment: CommunityCommentData, input: { deleted?: boolean; visibility?: string }) => void;
}) {
  return (
    <div className="archive-stack">
      <div className="subsection-heading">
        <h4>评论状态</h4>
      </div>
      {comments.length === 0 ? (
        <p className="muted compact">暂无评论</p>
      ) : (
        comments.map((comment) => (
          <div className="comment-moderation-row" key={comment.id}>
            <div>
              <strong>{comment.authorName}</strong>
              <p className="muted compact">{comment.content}</p>
              <span>{formatVisibility(comment.visibility, comment.deletedAt)}</span>
            </div>
            <div className="table-actions">
              <button
                className="secondary-button small-button"
                disabled={isSaving || Boolean(comment.deletedAt)}
                type="button"
                onClick={() =>
                  onModerate(comment, {
                    visibility: comment.visibility === "hidden" ? "visible" : "hidden",
                  })
                }
              >
                {comment.visibility === "hidden" ? "恢复" : "隐藏"}
              </button>
              <button
                className="danger-button small-button"
                disabled={isSaving || Boolean(comment.deletedAt)}
                type="button"
                onClick={() => onModerate(comment, { deleted: true })}
              >
                删除
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function formatRelations(post: AdminCommunityPostData) {
  const catNames = post.cats.map((cat) => cat.name);
  const litterNames = post.litters.map((litter) => litter.name);
  return [...catNames, ...litterNames].slice(0, 3).join(", ") || "-";
}

function formatCategory(value: string) {
  if (value === "cattery_daily") return "猫舍日常";
  if (value === "parent_share") return "家长分享";
  if (value === "personal_thoughts") return "碎碎念";
  return value;
}

function formatVisibility(value: string, deletedAt?: string | null) {
  if (deletedAt) return "已删除";
  if (value === "visible") return "可见";
  if (value === "hidden") return "隐藏";
  if (value === "archived") return "归档";
  return value;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}
