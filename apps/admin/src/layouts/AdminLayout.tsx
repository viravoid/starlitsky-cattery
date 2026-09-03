import type { ReactNode } from "react";
import type { CurrentUserData } from "@starlitsky/shared";

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
    <main className="page">
      <div className="layout">
        <header className="layout-header">
          <div>
            <p className="eyebrow">Starlitsky Admin</p>
            <h1>星月缅因猫舍后台</h1>
          </div>
          <nav aria-label="后台导航">
            <a href="#cats">猫咪管理</a>
            <a href="#litters">窝次管理</a>
            <a href="#media">媒体管理</a>
            <a href="#fixed-pages">固定页面</a>
            <a href="#community">社区管理</a>
            <a href="#parent-invites">家长邀请</a>
            <a href="#parent-applications">申请审核</a>
          </nav>
          {onLogout ? (
            <div className="session-summary">
              <span>{user?.nickname || user?.currentRole || "已登录"}</span>
              <button className="secondary-button small-button" type="button" onClick={onLogout}>
                退出
              </button>
            </div>
          ) : null}
        </header>
        {children}
      </div>
    </main>
  );
}
