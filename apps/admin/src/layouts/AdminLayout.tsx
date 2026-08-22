import type { ReactNode } from "react";

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="page">
      <div className="layout">
        <header className="layout-header">
          <p className="eyebrow">Admin Foundation</p>
          <h1>星月缅因猫舍后台</h1>
        </header>
        {children}
      </div>
    </main>
  );
}
