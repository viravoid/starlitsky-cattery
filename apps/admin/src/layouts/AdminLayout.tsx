import type { ReactNode } from "react";

export function AdminLayout({ children }: { children: ReactNode }) {
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
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
