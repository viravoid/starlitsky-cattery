import type { ReactNode } from "react";
import type { CurrentUserData } from "@starlitsky/shared";

const NAV_GROUPS = [
  {
    title: "数据概览",
    items: [{ label: "数据概览", href: "#dashboard" }],
  },
  {
    title: "猫咪管理",
    items: [
      { label: "小猫", href: "#cats" },
      { label: "种猫", href: "#cats" },
    ],
  },
  {
    title: "问卷管理",
    items: [{ label: "问卷提交", href: "#selection-applications" }],
  },
  {
    title: "猫友圈管理",
    items: [
      { label: "动态管理", href: "#community" },
      { label: "评论管理", href: "#community" },
      { label: "家长列表", href: "#parent-users" },
      { label: "家长申请", href: "#parent-applications" },
      { label: "家长邀请", href: "#parent-invites" },
    ],
  },
  {
    title: "站点内容",
    items: [
      { label: "首页", href: "#fixed-pages" },
      { label: "猫舍介绍", href: "#fixed-pages" },
      { label: "繁育理念", href: "#fixed-pages" },
      { label: "猫舍环境", href: "#fixed-pages" },
      { label: "喂养体系", href: "#fixed-pages" },
      { label: "价格与接猫流程", href: "#fixed-pages" },
      { label: "繁育计划", href: "#fixed-pages" },
      { label: "售后保障", href: "#fixed-pages" },
      { label: "选猫问卷页面", href: "#fixed-pages" },
      { label: "联系方式", href: "#fixed-pages" },
    ],
  },
];

export function AdminLayout({
  children,
  onLogout,
  user,
}: {
  children: ReactNode;
  onLogout?: () => void;
  user?: CurrentUserData | null;
}) {
  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Starlitsky Admin</p>
          <h1>星月缅因猫舍后台</h1>
        </div>
        <nav aria-label="后台导航" className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <section key={group.title} className="sidebar-group">
              <h2>{group.title}</h2>
              {group.items.map((item) => (
                <a key={`${group.title}-${item.label}`} href={item.href}>
                  {item.label}
                </a>
              ))}
            </section>
          ))}
        </nav>
        {onLogout ? (
          <div className="session-summary">
            <span>{user?.nickname || user?.currentRole || "已登录"}</span>
            <button className="secondary-button small-button" type="button" onClick={onLogout}>
              退出
            </button>
          </div>
        ) : null}
      </aside>
      <div className="layout">{children}</div>
    </main>
  );
}
