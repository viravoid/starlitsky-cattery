import { PageContainer } from "../components/PageContainer";

export function DashboardPage() {
  return (
    <PageContainer>
      <div className="workspace">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2>数据概览</h2>
            <p className="muted compact">当前后台已接入真实 Admin API、权限与业务数据。</p>
          </div>
        </div>
        <div className="management-grid">
          <section className="table-panel">
            <h3>已接入模块</h3>
            <div className="answer-list">
              <div className="answer-row">
                <span>猫咪管理</span>
                <p>小猫、种猫、窝次、媒体与固定页面继续使用真实组件。</p>
              </div>
              <div className="answer-row">
                <span>猫友圈</span>
                <p>动态与评论管理保留真实 moderation API。</p>
              </div>
              <div className="answer-row">
                <span>家长管理</span>
                <p>家长列表、申请审核、已有用户认证与猫咪绑定走真实服务端校验。</p>
              </div>
            </div>
          </section>
          <aside className="detail-panel">
            <h3>本轮边界</h3>
            <p className="muted compact">
              未重构的业务模块仍嵌入现有真实页面，不引入 mock store、假登录或独立 CMS。
            </p>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}
