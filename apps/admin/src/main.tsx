import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function AdminFoundation() {
  return (
    <main className="page">
      <section className="panel">
        <p className="eyebrow">Admin Foundation</p>
        <h1>星月缅因猫舍后台</h1>
        <p>独立后台管理端基础工程已建立，后续模块按迁移计划逐步接入。</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminFoundation />
  </React.StrictMode>,
);
