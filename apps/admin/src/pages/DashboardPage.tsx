import type { AdminDashboardOverviewData } from "@starlitsky/shared";
import { useCallback, useEffect, useState } from "react";
import { getAdminDashboardOverview } from "../api/cattery";
import { PageContainer } from "../components/PageContainer";
import { getErrorMessage } from "../utils/errors";

const STAT_CARDS: Array<{
  label: string;
  key: keyof AdminDashboardOverviewData;
  href: string;
}> = [
  { label: "小猫总数", key: "kittens", href: "#kittens" },
  { label: "待找家", key: "availableKittens", href: "#kittens" },
  { label: "种猫数量", key: "studs", href: "#studs" },
  { label: "窝次数", key: "litters", href: "#litters" },
  { label: "有效家长", key: "activeParents", href: "#parent-users" },
  { label: "待审核家长", key: "pendingParentApplications", href: "#parent-applications" },
  { label: "选猫问卷", key: "selectionApplications", href: "#selection-applications" },
  { label: "猫友圈动态", key: "communityPosts", href: "#community" },
  { label: "评论总数", key: "comments", href: "#community-comments" },
];

export function DashboardPage() {
  const [data, setData] = useState<AdminDashboardOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await getAdminDashboardOverview());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PageContainer>
      <div className="toolbar dashboard-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h2>数据概览</h2>
          <p className="muted compact">查看猫咪、家长、问卷和猫友圈的当前数据。</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
        >
          {isLoading ? "加载中..." : "刷新"}
        </button>
      </div>

      {error ? <div className="error-banner">数据概览加载失败：{error}</div> : null}
      <div className="dashboard-stats" aria-label="实时统计">
        {STAT_CARDS.map((card) => (
          <a className="dashboard-stat" href={card.href} key={card.label}>
            <strong>{data ? data[card.key] : "—"}</strong>
            <span>{card.label}</span>
          </a>
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="table-panel">
          <div className="section-heading">
            <div>
              <h3>待处理事项</h3>
              <p className="muted compact">点击进入对应的管理页面。</p>
            </div>
          </div>
          <div className="dashboard-todos">
            <DashboardTodo
              href="#selection-applications"
              label="待处理问卷"
              value={data?.pendingSelectionApplications}
            />
            <DashboardTodo
              href="#parent-applications"
              label="待审核家长申请"
              value={data?.pendingParentApplications}
            />
          </div>
        </section>
        <aside className="detail-panel">
          <h3>常用入口</h3>
          <div className="dashboard-shortcuts">
            <a href="#parent-users">认证与管理家长</a>
            <a href="#media">管理图片</a>
            <a href="#fixed-pages/home">编辑首页内容</a>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

function DashboardTodo({ href, label, value }: { href: string; label: string; value?: number }) {
  return (
    <a className="dashboard-todo" href={href}>
      <span>{label}</span>
      <span>{value ?? "—"} 条</span>
      <span aria-hidden="true">查看</span>
    </a>
  );
}
