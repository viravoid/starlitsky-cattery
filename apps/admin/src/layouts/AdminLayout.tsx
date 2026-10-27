import type { CurrentUserData } from "@starlitsky/shared";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

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
    title: "媒体管理",
    items: [{ label: "媒体库", href: "#media" }],
  },
  {
    title: "问卷管理",
    items: [{ label: "问卷提交", href: "#selection-applications" }],
  },
  {
    title: "猫友圈管理",
    items: [
      { label: "动态管理", href: "#community" },
      { label: "评论管理", href: "#community-comments" },
      { label: "家长列表", href: "#parent-users" },
      { label: "家长申请", href: "#parent-applications" },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeHash, setActiveHash] = useState(() => window.location.hash || "#cats");

  useEffect(() => {
    function handleHashChange() {
      setActiveHash(window.location.hash || "#cats");
      setMobileNavOpen(false);
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const session = onLogout ? (
    <div className="session-summary">
      <span>{user?.nickname || user?.currentRole || "已登录"}</span>
      <button className="secondary-button small-button" type="button" onClick={onLogout}>
        退出
      </button>
    </div>
  ) : null;

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <SidebarBrand />
        <AdminNavigation activeHash={activeHash} />
        {session}
      </aside>

      <header className="mobile-admin-header">
        <div>
          <strong>{getActiveNavigationLabel(activeHash)}</strong>
          <span>星月后台</span>
        </div>
        <button
          aria-label={mobileNavOpen ? "关闭菜单" : "打开菜单"}
          className="secondary-button mobile-menu-button"
          type="button"
          onClick={() => setMobileNavOpen((current) => !current)}
        >
          {mobileNavOpen ? (
            <X aria-hidden="true" size={17} />
          ) : (
            <Menu aria-hidden="true" size={17} />
          )}
          菜单
        </button>
      </header>

      {mobileNavOpen ? (
        <div
          className="mobile-nav-overlay"
          role="presentation"
          onClick={() => setMobileNavOpen(false)}
        >
          <aside className="mobile-nav-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-nav-heading">
              <SidebarBrand />
              <button
                aria-label="关闭菜单"
                className="secondary-button small-button"
                type="button"
                onClick={() => setMobileNavOpen(false)}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <AdminNavigation activeHash={activeHash} onNavigate={() => setMobileNavOpen(false)} />
            {session}
          </aside>
        </div>
      ) : null}

      <div className="layout">{children}</div>
    </main>
  );
}

function SidebarBrand() {
  return (
    <div className="sidebar-brand">
      <p className="eyebrow">Starlitsky Admin</p>
      <h1>星月缅因猫舍后台</h1>
    </div>
  );
}

function AdminNavigation({
  activeHash,
  onNavigate,
}: {
  activeHash: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="后台导航" className="sidebar-nav">
      {NAV_GROUPS.map((group) => (
        <section key={group.title} className="sidebar-group">
          <h2>{group.title}</h2>
          {group.items.map((item) => (
            <a
              key={`${group.title}-${item.label}`}
              aria-current={activeHash === item.href ? "page" : undefined}
              className={activeHash === item.href ? "active" : ""}
              href={item.href}
              onClick={onNavigate}
            >
              {item.label}
            </a>
          ))}
        </section>
      ))}
    </nav>
  );
}

function getActiveNavigationLabel(activeHash: string) {
  return (
    NAV_GROUPS.flatMap((group) => group.items).find((item) => item.href === activeHash)?.label ??
    "后台管理"
  );
}
