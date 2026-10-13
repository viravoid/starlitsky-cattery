import type {
  AdminCommunityCommentData,
  AdminCommunityPostData,
  CommunityCommentData,
} from "@starlitsky/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCommunityModerationPost,
  listCommunityModerationComments,
  listCommunityModerationPosts,
  moderateCommunityComment,
  moderateCommunityPost,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

type CommunityView = "posts" | "comments";

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

export function CommunityModerationPanel({ initialView = "posts" }: { initialView?: CommunityView }) {
  const [view, setView] = useState<CommunityView>(initialView);
  const [posts, setPosts] = useState<AdminCommunityPostData[]>([]);
  const [comments, setComments] = useState<AdminCommunityCommentData[]>([]);
  const [selectedPost, setSelectedPost] = useState<AdminCommunityPostData | null>(null);
  const [selectedComment, setSelectedComment] = useState<AdminCommunityCommentData | null>(null);
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("");
  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadPosts = useCallback(async () => {
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
  }, [category, includeDeleted, query, visibility]);

  const loadComments = useCallback(async () => {
    const data = await listCommunityModerationComments({
      includeDeleted,
      pageSize: 100,
      q: query,
      visibility,
    });
    setComments(data.items);
    setSelectedComment((current) =>
      current
        ? (data.items.find((comment) => comment.id === current.id) ?? null)
        : data.items[0] ?? null,
    );
  }, [includeDeleted, query, visibility]);

  const loadCurrentView = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      if (view === "posts") {
        await loadPosts();
      } else {
        await loadComments();
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [loadComments, loadPosts, view]);

  useEffect(() => {
    void loadCurrentView();
  }, [loadCurrentView]);

  async function selectPost(post: AdminCommunityPostData) {
    setNotice("");
    setError("");
    try {
      setSelectedPost(await getCommunityModerationPost(post.id));
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function moderatePost(
    post: AdminCommunityPostData,
    input: { deleted?: boolean; pinned?: boolean; visibility?: string },
  ) {
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const updated = await moderateCommunityPost(post.id, input);
      setSelectedPost(updated);
      setNotice("动态状态已更新");
      await loadPosts();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function moderateComment(
    comment: Pick<CommunityCommentData, "id" | "postId">,
    input: { deleted?: boolean; visibility?: string },
  ) {
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const updatedComment = await moderateCommunityComment(comment.postId, comment.id, input);
      setSelectedPost((current) =>
        current
          ? {
              ...current,
              comments: current.comments.map((item) =>
                item.id === updatedComment.id ? updatedComment : item,
              ),
            }
          : current,
      );
      setSelectedComment((current) =>
        current && current.id === updatedComment.id
          ? { ...current, ...updatedComment }
          : current,
      );
      setNotice("评论状态已更新");
      await Promise.all([loadPosts(), loadComments()]);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  const stats = useMemo(
    () => ({
      comments: comments.length,
      hidden: posts.filter((post) => post.visibility === "hidden" && !post.deletedAt).length,
      pinned: posts.filter((post) => post.pinned && !post.deletedAt).length,
      visible: posts.filter((post) => post.visibility === "visible" && !post.deletedAt).length,
    }),
    [comments.length, posts],
  );

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  return (
    <div className="workspace">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Community Moderation</p>
          <h2>猫友圈管理</h2>
          <p className="muted compact">
            动态可见 {stats.visible} / 隐藏 {stats.hidden} / 置顶 {stats.pinned} / 评论{" "}
            {stats.comments}
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={() => void loadCurrentView()}>
            刷新
          </button>
        </div>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="tabs" role="tablist" aria-label="猫友圈管理视图">
        <button
          aria-selected={view === "posts"}
          className={view === "posts" ? "active-tab" : ""}
          type="button"
          onClick={() => setView("posts")}
        >
          动态管理
        </button>
        <button
          aria-selected={view === "comments"}
          className={view === "comments" ? "active-tab" : ""}
          type="button"
          onClick={() => setView("comments")}
        >
          评论管理
        </button>
      </div>

      <div className="inline-form">
        <div className="form-grid">
          {view === "posts" ? (
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
          ) : null}
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
            <input
              placeholder={view === "posts" ? "动态内容 / 作者" : "评论 / 作者 / 所属动态"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
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

      {view === "posts" ? (
        <PostModerationView
          isLoading={isLoading}
          isSaving={isSaving}
          posts={posts}
          selectedPost={selectedPost}
          onModerateComment={moderateComment}
          onModeratePost={moderatePost}
          onSelectPost={selectPost}
        />
      ) : (
        <CommentModerationView
          comments={comments}
          isLoading={isLoading}
          isSaving={isSaving}
          selectedComment={selectedComment}
          onModerateComment={moderateComment}
          onSelectComment={setSelectedComment}
        />
      )}
    </div>
  );
}

function PostModerationView({
  isLoading,
  isSaving,
  posts,
  selectedPost,
  onModerateComment,
  onModeratePost,
  onSelectPost,
}: {
  isLoading: boolean;
  isSaving: boolean;
  posts: AdminCommunityPostData[];
  selectedPost: AdminCommunityPostData | null;
  onModerateComment: (
    comment: Pick<CommunityCommentData, "id" | "postId">,
    input: { deleted?: boolean; visibility?: string },
  ) => void;
  onModeratePost: (
    post: AdminCommunityPostData,
    input: { deleted?: boolean; pinned?: boolean; visibility?: string },
  ) => void;
  onSelectPost: (post: AdminCommunityPostData) => void;
}) {
  return (
    <div className="management-grid wide-detail">
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
                  <th>图片</th>
                  <th>正文</th>
                  <th>作者</th>
                  <th>分类</th>
                  <th>关联</th>
                  <th>互动</th>
                  <th>状态</th>
                  <th>发布时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={post.id}
                    className={post.deletedAt || selectedPost?.id === post.id ? "archived-row" : ""}
                  >
                    <td>
                      <PostThumbnail post={post} />
                    </td>
                    <td>
                      <button
                        className="link-button truncate-cell"
                        type="button"
                        onClick={() => void onSelectPost(post)}
                      >
                        {post.content}
                      </button>
                    </td>
                    <td>{post.authorName}</td>
                    <td>{formatCategory(post.category)}</td>
                    <td>{formatRelations(post)}</td>
                    <td>
                      {post.likeCount} 赞 / {post.commentCount} 评
                    </td>
                    <td>
                      <StatusCluster
                        deletedAt={post.deletedAt}
                        pinned={post.pinned}
                        visibility={post.visibility}
                      />
                    </td>
                    <td>{formatDateTime(post.createdAt)}</td>
                    <td>
                      <PostActionButtons
                        isSaving={isSaving}
                        post={post}
                        onModerate={onModeratePost}
                      />
                    </td>
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
              <StatusCluster
                deletedAt={selectedPost.deletedAt}
                pinned={selectedPost.pinned}
                visibility={selectedPost.visibility}
              />
            </div>
            <p>{selectedPost.content}</p>
            <PostMediaStrip post={selectedPost} />
            <dl className="description-list">
              {[
                ["分类", formatCategory(selectedPost.category)],
                ["作者", `${selectedPost.authorName} (${selectedPost.authorRole})`],
                ["作者 ID", selectedPost.authorUserId],
                ["关联猫", selectedPost.cats.map((cat) => cat.name).join(", ") || "-"],
                ["关联窝次", selectedPost.litters.map((litter) => litter.name).join(", ") || "-"],
                ["图片", `${selectedPost.mediaAssets.length} 张`],
                ["点赞", `${selectedPost.likeCount} 个`],
                ["评论", `${selectedPost.commentCount} 条`],
                ["发布时间", formatDateTime(selectedPost.createdAt)],
                ["更新时间", formatDateTime(selectedPost.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="form-actions">
              <PostActionButtons
                isSaving={isSaving}
                post={selectedPost}
                onModerate={onModeratePost}
              />
            </div>
            <CommunityCommentModerationList
              comments={selectedPost.comments}
              isSaving={isSaving}
              onModerate={onModerateComment}
            />
          </div>
        ) : (
          <div className="empty-state">选择一条动态查看详情。</div>
        )}
      </aside>
    </div>
  );
}

function CommentModerationView({
  comments,
  isLoading,
  isSaving,
  selectedComment,
  onModerateComment,
  onSelectComment,
}: {
  comments: AdminCommunityCommentData[];
  isLoading: boolean;
  isSaving: boolean;
  selectedComment: AdminCommunityCommentData | null;
  onModerateComment: (
    comment: Pick<CommunityCommentData, "id" | "postId">,
    input: { deleted?: boolean; visibility?: string },
  ) => void;
  onSelectComment: (comment: AdminCommunityCommentData) => void;
}) {
  return (
    <div className="management-grid wide-detail">
      <section className="table-panel">
        <div className="section-heading">
          <h3>评论列表</h3>
          <span className="muted">{isLoading ? "加载中..." : `${comments.length} 条`}</span>
        </div>
        {comments.length === 0 ? (
          <div className="empty-state">暂无匹配评论</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>评论内容</th>
                  <th>作者</th>
                  <th>所属动态</th>
                  <th>时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((comment) => (
                  <tr
                    key={comment.id}
                    className={
                      comment.deletedAt || selectedComment?.id === comment.id ? "archived-row" : ""
                    }
                  >
                    <td>
                      <button
                        className="link-button truncate-cell"
                        type="button"
                        onClick={() => onSelectComment(comment)}
                      >
                        {comment.content}
                      </button>
                    </td>
                    <td>{comment.authorName}</td>
                    <td className="truncate-cell">{comment.post.content}</td>
                    <td>{formatDateTime(comment.createdAt)}</td>
                    <td>{formatVisibility(comment.visibility, comment.deletedAt)}</td>
                    <td>
                      <CommentActionButtons
                        comment={comment}
                        isSaving={isSaving}
                        onModerate={onModerateComment}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="detail-panel">
        {selectedComment ? (
          <div className="detail-stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Comment Detail</p>
                <h3>{selectedComment.authorName}</h3>
              </div>
              <span>{formatVisibility(selectedComment.visibility, selectedComment.deletedAt)}</span>
            </div>
            <p>{selectedComment.content}</p>
            <dl className="description-list">
              {[
                ["作者", `${selectedComment.authorName} (${selectedComment.authorRole})`],
                ["所属动态", selectedComment.post.content],
                ["动态作者", selectedComment.post.authorName],
                ["动态分类", formatCategory(selectedComment.post.category)],
                ["动态状态", formatVisibility(selectedComment.post.visibility, selectedComment.post.deletedAt)],
                ["评论时间", formatDateTime(selectedComment.createdAt)],
                ["更新时间", formatDateTime(selectedComment.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="form-actions">
              <CommentActionButtons
                comment={selectedComment}
                isSaving={isSaving}
                onModerate={onModerateComment}
              />
            </div>
          </div>
        ) : (
          <div className="empty-state">选择一条评论查看详情。</div>
        )}
      </aside>
    </div>
  );
}

function PostActionButtons({
  isSaving,
  post,
  onModerate,
}: {
  isSaving: boolean;
  post: AdminCommunityPostData;
  onModerate: (
    post: AdminCommunityPostData,
    input: { deleted?: boolean; pinned?: boolean; visibility?: string },
  ) => void;
}) {
  if (post.deletedAt) {
    return (
      <button
        className="secondary-button small-button"
        disabled={isSaving}
        type="button"
        onClick={() => onModerate(post, { deleted: false, visibility: "visible" })}
      >
        恢复
      </button>
    );
  }

  return (
    <div className="table-actions">
      <button
        className="secondary-button small-button"
        disabled={isSaving}
        type="button"
        onClick={() =>
          onModerate(post, { visibility: post.visibility === "hidden" ? "visible" : "hidden" })
        }
      >
        {post.visibility === "hidden" ? "恢复显示" : "隐藏"}
      </button>
      <button
        className="secondary-button small-button"
        disabled={isSaving}
        type="button"
        onClick={() => onModerate(post, { pinned: !post.pinned })}
      >
        {post.pinned ? "取消置顶" : "置顶"}
      </button>
      <button
        className="danger-button small-button"
        disabled={isSaving}
        type="button"
        onClick={() => onModerate(post, { deleted: true })}
      >
        删除
      </button>
    </div>
  );
}

function CommentActionButtons({
  comment,
  isSaving,
  onModerate,
}: {
  comment: Pick<CommunityCommentData, "deletedAt" | "id" | "postId" | "visibility">;
  isSaving: boolean;
  onModerate: (
    comment: Pick<CommunityCommentData, "id" | "postId">,
    input: { deleted?: boolean; visibility?: string },
  ) => void;
}) {
  if (comment.deletedAt) {
    return (
      <button
        className="secondary-button small-button"
        disabled={isSaving}
        type="button"
        onClick={() => onModerate(comment, { deleted: false, visibility: "visible" })}
      >
        恢复
      </button>
    );
  }

  return (
    <div className="table-actions">
      <button
        className="secondary-button small-button"
        disabled={isSaving}
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
        disabled={isSaving}
        type="button"
        onClick={() => onModerate(comment, { deleted: true })}
      >
        删除
      </button>
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
  onModerate: (
    comment: Pick<CommunityCommentData, "id" | "postId">,
    input: { deleted?: boolean; visibility?: string },
  ) => void;
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
            <CommentActionButtons
              comment={comment}
              isSaving={isSaving}
              onModerate={onModerate}
            />
          </div>
        ))
      )}
    </div>
  );
}

function PostThumbnail({ post }: { post: AdminCommunityPostData }) {
  const media = post.mediaAssets[0];
  const imageUrl = media?.thumbnailUrl || media?.sourceUrl;
  if (!imageUrl) return <div className="community-thumbnail-placeholder">无图</div>;
  return (
    <img
      alt={media.altText || media.title || "动态图片"}
      className="community-thumbnail"
      src={imageUrl}
    />
  );
}

function PostMediaStrip({ post }: { post: AdminCommunityPostData }) {
  if (post.mediaAssets.length === 0) return null;
  return (
    <div className="community-media-strip">
      {post.mediaAssets.slice(0, 6).map((media) => (
        <img
          alt={media.altText || media.title || "动态图片"}
          className="community-media-preview"
          key={media.id}
          src={media.thumbnailUrl || media.sourceUrl}
        />
      ))}
    </div>
  );
}

function StatusCluster({
  deletedAt,
  pinned,
  visibility,
}: {
  deletedAt?: string | null;
  pinned: boolean;
  visibility: string;
}) {
  return (
    <div className="status-cluster">
      <span className={`status-badge status-${deletedAt ? "deleted" : visibility}`}>
        {formatVisibility(visibility, deletedAt)}
      </span>
      {pinned ? <span className="status-badge status-pinned">置顶</span> : null}
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
