import type { FixedPageData, UpdateFixedPageRequest } from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getFixedPage, updateFixedPage } from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

interface FixedPageFormState {
  contentJson: string;
  contentSchemaVersion: string;
  seoDescription: string;
  seoTitle: string;
  status: string;
  title: string;
}

const STATUS_OPTIONS = [
  { label: "草稿", value: "draft" },
  { label: "已发布", value: "published" },
  { label: "隐藏", value: "hidden" },
];

export function FixedPagesPanel({
  isLoading,
  pages,
  onReload,
}: {
  isLoading: boolean;
  pages: FixedPageData[];
  onReload: () => Promise<void>;
}) {
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedPage, setSelectedPage] = useState<FixedPageData | null>(null);
  const [form, setForm] = useState<FixedPageFormState>(() => toForm(null));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const currentListPage = useMemo(
    () => pages.find((page) => page.slug === selectedSlug) ?? pages[0] ?? null,
    [pages, selectedSlug],
  );

  useEffect(() => {
    if (!selectedSlug && pages[0]) setSelectedSlug(pages[0].slug);
  }, [pages, selectedSlug]);

  const selectPage = useCallback(async (slug: string) => {
    setSelectedSlug(slug);
    setNotice("");
    setError("");

    try {
      const page = await getFixedPage(slug);
      setSelectedPage(page);
      setForm(toForm(page));
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }, []);

  useEffect(() => {
    if (!currentListPage) return;
    void selectPage(currentListPage.slug);
  }, [currentListPage, selectPage]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPage) return;

    setIsSaving(true);
    setNotice("");
    setError("");

    try {
      const payload = toPayload(form);
      const updated = await updateFixedPage(selectedPage.slug, payload);
      setSelectedPage(updated);
      setForm(toForm(updated));
      setNotice("固定页面内容已保存");
      await onReload();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <p className="eyebrow">Fixed Pages</p>
          <h2>固定页面内容管理</h2>
          <p className="muted compact">
            只维护预定义页面的结构化内容，不提供文章、新增栏目或通用 CMS 能力。
          </p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={() => void onReload()}>
            刷新
          </button>
        </div>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="management-grid">
        <section className="table-panel" aria-label="固定页面列表">
          <div className="section-heading">
            <div>
              <h3>固定页面</h3>
              <p className="muted compact">当前 {pages.length} 个预定义页面</p>
            </div>
          </div>
          {isLoading ? (
            <div className="empty-state">正在加载固定页面...</div>
          ) : pages.length === 0 ? (
            <div className="empty-state">暂无固定页面配置，请先运行数据库迁移。</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>页面</th>
                    <th>Slug</th>
                    <th>状态</th>
                    <th>版本</th>
                    <th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((page) => (
                    <tr key={page.slug}>
                      <td>
                        <button
                          className="link-button"
                          type="button"
                          onClick={() => void selectPage(page.slug)}
                        >
                          {page.title}
                        </button>
                      </td>
                      <td>{page.slug}</td>
                      <td>{formatOption(page.status, STATUS_OPTIONS)}</td>
                      <td>v{page.contentSchemaVersion}</td>
                      <td>{formatDateTime(page.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="detail-panel" aria-label="固定页面编辑">
          {selectedPage ? (
            <form className="form-stack" onSubmit={handleSubmit}>
              <div>
                <p className="eyebrow">Edit Fixed Page</p>
                <h3>{selectedPage.slug}</h3>
              </div>
              <label>
                页面标题
                <input
                  aria-label="页面标题"
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  状态
                  <select
                    aria-label="状态"
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  内容结构版本
                  <input
                    aria-label="内容结构版本"
                    inputMode="numeric"
                    value={form.contentSchemaVersion}
                    onChange={(event) =>
                      setForm({ ...form, contentSchemaVersion: event.target.value })
                    }
                  />
                </label>
              </div>
              <label>
                SEO 标题
                <input
                  aria-label="SEO 标题"
                  value={form.seoTitle}
                  onChange={(event) => setForm({ ...form, seoTitle: event.target.value })}
                />
              </label>
              <label>
                SEO 描述
                <textarea
                  aria-label="SEO 描述"
                  rows={3}
                  value={form.seoDescription}
                  onChange={(event) => setForm({ ...form, seoDescription: event.target.value })}
                />
              </label>
              <label>
                结构化内容 JSON
                <textarea
                  aria-label="结构化内容 JSON"
                  className="code-textarea"
                  rows={14}
                  value={form.contentJson}
                  onChange={(event) => setForm({ ...form, contentJson: event.target.value })}
                />
              </label>
              <div className="form-actions">
                <button disabled={isSaving} type="submit">
                  {isSaving ? "保存中..." : "保存固定页面"}
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-state">选择一个固定页面查看和编辑内容。</div>
          )}
        </aside>
      </div>
    </>
  );
}

function toForm(page: FixedPageData | null): FixedPageFormState {
  return {
    contentJson: JSON.stringify(page?.contentJson ?? {}, null, 2),
    contentSchemaVersion: String(page?.contentSchemaVersion ?? 1),
    seoDescription: page?.seoDescription ?? "",
    seoTitle: page?.seoTitle ?? "",
    status: page?.status ?? "draft",
    title: page?.title ?? "",
  };
}

function toPayload(form: FixedPageFormState): UpdateFixedPageRequest {
  let contentJson: unknown;
  try {
    contentJson = JSON.parse(form.contentJson || "{}");
  } catch {
    throw new Error("结构化内容 JSON 格式不正确");
  }

  return {
    contentJson,
    contentSchemaVersion: Number(form.contentSchemaVersion),
    seoDescription: emptyToNull(form.seoDescription),
    seoTitle: emptyToNull(form.seoTitle),
    status: form.status as UpdateFixedPageRequest["status"],
    title: form.title.trim(),
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatOption(value: string, options: Array<{ label: string; value: string }>) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}
