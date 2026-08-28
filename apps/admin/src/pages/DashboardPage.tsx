import { PageContainer } from "../components/PageContainer";

export function DashboardPage() {
  return (
    <PageContainer>
      <h2>基础工程占位</h2>
      <p>
        独立后台管理端基础结构已建立。当前阶段只验证布局、配置、请求层和 shared
        contract 引用。
      </p>
      <p className="muted">尚未实现登录、权限、数据库连接或任何后台业务模块。</p>
    </PageContainer>
  );
}
