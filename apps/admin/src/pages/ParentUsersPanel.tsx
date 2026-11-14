import type {
  AdminUserData,
  ParentAdminEventData,
  ParentCatLinkData,
  ParentManagementOverviewData,
} from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  certifyExistingUserAsParent,
  createCatParentLink,
  getParentManagementOverview,
  listAdminUsers,
  listParentAdminEvents,
  searchAdminParentCatCandidates,
  setParentStatus as updateParentStatus,
  updateParentCatLink,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

interface CertifyFormState {
  userId: string;
  displayName: string;
  realName: string;
  contactPhone: string;
  contactWechat: string;
  city: string;
  catId: string;
  relationship: string;
  startedAt: string;
  note: string;
}

interface CatChoice {
  id: string;
  name: string;
  color: string | null;
  visibility: string;
}
interface PendingCatLink {
  catId: string;
  relationship: string;
}

const DEFAULT_CERTIFY_FORM: CertifyFormState = {
  userId: "",
  displayName: "",
  realName: "",
  contactPhone: "",
  contactWechat: "",
  city: "",
  catId: "",
  relationship: "owner",
  startedAt: "",
  note: "",
};

const ROLE_OPTIONS = [
  { label: "全部角色", value: "" },
  { label: "普通用户", value: "user" },
  { label: "家长", value: "parent" },
  { label: "猫舍管理员", value: "keeper" },
  { label: "系统管理员", value: "admin" },
];

const PARENT_STATUS_OPTIONS = [
  { label: "全部家长状态", value: "" },
  { label: "有效", value: "active" },
  { label: "已停用", value: "disabled" },
];

const RELATIONSHIP_OPTIONS = [
  { label: "主人", value: "owner" },
  { label: "共同主人", value: "co_owner" },
  { label: "照护人", value: "caregiver" },
];

const LINK_STATUS_OPTIONS = [
  { label: "生效", value: "active" },
  { label: "暂停", value: "inactive" },
  { label: "结束", value: "ended" },
];

export function ParentUsersPanel() {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [cats, setCats] = useState<CatChoice[]>([]);
  const [catQuery, setCatQuery] = useState("");
  const [isSearchingCats, setIsSearchingCats] = useState(false);
  const [certifyLinks, setCertifyLinks] = useState<PendingCatLink[]>([]);
  const [overview, setOverview] = useState<ParentManagementOverviewData | null>(null);
  const [events, setEvents] = useState<ParentAdminEventData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [parentStatus, setParentStatus] = useState("");
  const [wechatBound, setWechatBound] = useState("");
  const [form, setForm] = useState<CertifyFormState>(DEFAULT_CERTIFY_FORM);
  const [newLinkCatId, setNewLinkCatId] = useState("");
  const [newLinkRelationship, setNewLinkRelationship] = useState("owner");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? users[0] ?? null,
    [selectedUserId, users],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [userList, summary] = await Promise.all([
        listAdminUsers({
          page,
          pageSize: 20,
          parentStatus,
          q: query,
          role,
          wechatBound: wechatBound === "" ? undefined : wechatBound === "true",
        }),
        getParentManagementOverview(),
      ]);
      setUsers(userList.items);
      setOverview(summary);
      setTotalPages(userList.pagination.totalPages);
      setTotalUsers(userList.pagination.total);
      setSelectedUserId((current) =>
        current && userList.items.some((user) => user.id === current)
          ? current
          : (userList.items[0]?.id ?? ""),
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [page, parentStatus, query, role, wechatBound]);

  useEffect(() => {
    setPage(1);
  }, [parentStatus, query, role, wechatBound]);

  useEffect(() => {
    if (!selectedUser?.id) {
      setEvents([]);
      return;
    }
    void listParentAdminEvents(selectedUser.id)
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [selectedUser?.id, selectedUser?.updatedAt]);

  async function searchCats() {
    if (catQuery.trim().length < 2) return;
    setIsSearchingCats(true);
    setError("");
    try {
      setCats(await searchAdminParentCatCandidates(catQuery));
    } catch (searchError) {
      setError(getErrorMessage(searchError));
    } finally {
      setIsSearchingCats(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedUser) {
      setForm(DEFAULT_CERTIFY_FORM);
      return;
    }
    setForm({
      userId: selectedUser.id,
      displayName: selectedUser.parentProfile?.displayName ?? selectedUser.nickname ?? "",
      realName: selectedUser.parentProfile?.realName ?? "",
      contactPhone: selectedUser.parentProfile?.contactPhone ?? selectedUser.phone ?? "",
      contactWechat: selectedUser.parentProfile?.contactWechat ?? "",
      city: selectedUser.parentProfile?.city ?? "",
      catId: "",
      relationship: "owner",
      startedAt: "",
      note: selectedUser.parentProfile?.note ?? "",
    });
    setCertifyLinks([]);
    setNewLinkCatId("");
  }, [selectedUser]);

  async function handleCertify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.userId || isSaving) return;
    if (!selectedUser?.parentProfile && certifyLinks.length === 0) {
      setError("请至少选择一只猫咪并加入待认证关系。");
      return;
    }
    if (!selectedUser?.wechatBound) {
      setError("该用户尚未用微信登录，请先让本人进入小程序绑定账号。");
      return;
    }
    if (
      !window.confirm(
        `确认将 ${selectedUser.nickname || selectedUser.id} 认证为家长，并建立 ${certifyLinks.length} 条猫咪关系？`,
      )
    )
      return;

    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const saved = await certifyExistingUserAsParent(form.userId, {
        city: emptyToNull(form.city),
        contactPhone: emptyToNull(form.contactPhone),
        contactWechat: emptyToNull(form.contactWechat),
        displayName: emptyToNull(form.displayName),
        realName: emptyToNull(form.realName),
        note: emptyToNull(form.note),
        catLinks: certifyLinks.map((link) => ({ ...link, status: "active" })),
      });
      setSelectedUserId(saved.id);
      setNotice("已认证为家长，并复用原 users.id");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleParentStatus(status: "active" | "disabled") {
    if (!selectedUser?.parentProfile || isSaving) return;
    if (
      !window.confirm(
        status === "disabled"
          ? "确认停用家长身份？该用户将立即失去家长权限。"
          : "确认恢复家长身份及原有猫咪关系？",
      )
    )
      return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      await updateParentStatus(selectedUser.id, status);
      setNotice(status === "disabled" ? "家长身份已停用" : "家长身份已恢复");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddLink() {
    const profileId = selectedUser?.parentProfile?.id;
    if (!profileId || !newLinkCatId || isSaving) return;
    if (!window.confirm("确认新增这条猫咪归属关系？")) return;

    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      await createCatParentLink(newLinkCatId, {
        parentProfileId: profileId,
        relationship: newLinkRelationship,
        status: "active",
      });
      setNewLinkCatId("");
      setNotice("猫咪关联已创建");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateLink(link: ParentCatLinkData, data: Partial<ParentCatLinkData>) {
    if (isSaving) return;
    if (!window.confirm(`确认修改 ${link.cat?.name ?? link.catId} 的归属关系？`)) return;
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      await updateParentCatLink(link.id, {
        relationship: data.relationship,
        status: data.status,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        note: data.note,
      });
      setNotice("猫咪关联已更新");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="workspace">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Parent Users</p>
          <h2>家长列表</h2>
          <p className="muted compact">查看真实用户、申请、家长档案与猫咪绑定。</p>
        </div>
        <button className="secondary-button" type="button" onClick={loadData}>
          刷新
        </button>
      </div>

      {overview ? (
        <div className="filter-bar" aria-label="家长管理统计">
          <strong>待审核 {overview.pending}</strong>
          <strong>已通过 {overview.approved}</strong>
          <strong>已拒绝 {overview.rejected}</strong>
          <strong>有效家长 {overview.active}</strong>
          <strong>已停用 {overview.disabled}</strong>
        </div>
      ) : null}
      {overview ? (
        <div className="inline-form">
          <strong>最近申请与授权记录</strong>
          <p className="muted compact">
            最近申请：
            {overview.recentApplications
              .map((item) => `${item.nickname || item.userId}（${item.status}）`)
              .join("、") || "无"}
          </p>
          <p className="muted compact">
            最近操作：
            {overview.recentEvents
              .map(
                (item) =>
                  `${item.actorName || item.actorId || "管理员"} ${formatEventAction(item.action)} ${item.targetName || item.userId}`,
              )
              .join("、") || "无"}
          </p>
        </div>
      ) : null}

      <div className="filter-bar">
        <label>
          搜索
          <input
            placeholder="user id / 昵称 / 手机 / 家长姓名"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          角色
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          家长状态
          <select value={parentStatus} onChange={(event) => setParentStatus(event.target.value)}>
            {PARENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          微信绑定
          <select value={wechatBound} onChange={(event) => setWechatBound(event.target.value)}>
            <option value="">全部</option>
            <option value="true">已绑定</option>
            <option value="false">未绑定</option>
          </select>
        </label>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="management-grid wide-detail">
        <section className="table-panel">
          <div className="section-heading">
            <h3>用户列表</h3>
            <span className="muted">
              {isLoading
                ? "加载中..."
                : `共 ${totalUsers} 条 · 第 ${page}/${Math.max(1, totalPages)} 页`}
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>微信</th>
                  <th>昵称</th>
                  <th>Roles</th>
                  <th>Parent Profile</th>
                  <th>Pending</th>
                  <th>名下猫咪</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={selectedUser?.id === user.id ? "archived-row" : ""}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td className="truncate-cell">{user.id}</td>
                    <td>{user.wechatBound ? "已绑定" : "未绑定"}</td>
                    <td>
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt=""
                          width={28}
                          height={28}
                          style={{ borderRadius: "50%", verticalAlign: "middle", marginRight: 8 }}
                        />
                      ) : null}
                      {user.nickname ?? "-"}
                    </td>
                    <td>{user.roles.join(", ")}</td>
                    <td>{user.parentProfile ? user.parentProfile.status : "-"}</td>
                    <td>{user.pendingApplication ? user.pendingApplication.displayName : "-"}</td>
                    <td>{formatCatNames(user.parentProfile?.links ?? [])}</td>
                    <td>{formatDateTime(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </button>
          </div>
        </section>

        <aside className="detail-panel">
          {selectedUser ? (
            <div className="detail-stack">
              <div>
                <p className="eyebrow">User Detail</p>
                <h3>{selectedUser.nickname || selectedUser.id}</h3>
              </div>
              <DescriptionList
                items={[
                  ["User ID", selectedUser.id],
                  ["微信", selectedUser.wechatBound ? "已绑定" : "未绑定"],
                  ["Roles", selectedUser.roles.join(", ")],
                  ["家长档案", selectedUser.parentProfile?.status ?? "-"],
                  [
                    "手机号来源",
                    formatProfilePhoneSource(selectedUser.parentProfile?.contactPhoneSource),
                  ],
                  ["待审申请", selectedUser.pendingApplication?.displayName ?? "-"],
                ]}
              />

              {selectedUser.parentProfile ? (
                <div className="form-actions">
                  <button
                    className={
                      selectedUser.parentProfile.status === "active"
                        ? "danger-button"
                        : "secondary-button"
                    }
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      void handleParentStatus(
                        selectedUser.parentProfile?.status === "active" ? "disabled" : "active",
                      )
                    }
                  >
                    {selectedUser.parentProfile.status === "active"
                      ? "停用家长身份"
                      : "重新启用家长"}
                  </button>
                </div>
              ) : null}

              <form className="inline-form" onSubmit={handleCertify}>
                <h4>{selectedUser.parentProfile ? "更新家长资料" : "直接认证为家长"}</h4>
                {!selectedUser.wechatBound ? (
                  <p className="error-banner">
                    该用户尚未用微信登录，不能授予家长身份；请先让本人进入小程序。
                  </p>
                ) : null}
                {selectedUser.parentProfile?.status === "disabled" ? (
                  <p className="muted compact">
                    家长身份已停用。请先使用上方按钮重新启用，再修改资料或猫咪关系。
                  </p>
                ) : null}
                <div className="form-grid">
                  <label>
                    展示名
                    <input
                      required
                      value={form.displayName}
                      onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                    />
                  </label>
                  <label>
                    真实姓名
                    <input
                      value={form.realName}
                      onChange={(event) => setForm({ ...form, realName: event.target.value })}
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    手机
                    <input
                      value={form.contactPhone}
                      onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
                    />
                  </label>
                  <label>
                    微信号
                    <input
                      value={form.contactWechat}
                      onChange={(event) => setForm({ ...form, contactWechat: event.target.value })}
                    />
                  </label>
                </div>
                <p className="muted compact">
                  管理员修改手机号后标为「管理员录入 / 未经微信验证」；号码未变时保留原验证来源。
                </p>
                <label>
                  城市
                  <input
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    搜索猫咪档案（包含隐藏档案）
                    <input
                      value={catQuery}
                      onChange={(event) => setCatQuery(event.target.value)}
                      placeholder="名称、颜色或 ID，至少 2 字"
                    />
                  </label>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isSearchingCats || catQuery.trim().length < 2}
                    onClick={() => void searchCats()}
                  >
                    {isSearchingCats ? "查询中..." : "查询猫咪"}
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    选择猫咪
                    <select
                      value={form.catId}
                      onChange={(event) => setForm({ ...form, catId: event.target.value })}
                    >
                      <option value="">请选择搜索结果</option>
                      {cats.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} · {cat.color ?? "颜色未知"} · {cat.visibility} · {cat.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    关系
                    <select
                      value={form.relationship}
                      onChange={(event) => setForm({ ...form, relationship: event.target.value })}
                    >
                      {RELATIONSHIP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!form.catId}
                  onClick={() => {
                    if (
                      certifyLinks.some(
                        (link) =>
                          link.catId === form.catId && link.relationship === form.relationship,
                      )
                    ) {
                      setError("该关系已在待认证列表中");
                      return;
                    }
                    setCertifyLinks((current) => [
                      ...current,
                      { catId: form.catId, relationship: form.relationship },
                    ]);
                    setForm((current) => ({ ...current, catId: "" }));
                  }}
                >
                  加入待认证关系
                </button>
                {certifyLinks.map((link, index) => (
                  <p className="mini-list-row" key={`${link.catId}-${link.relationship}`}>
                    {cats.find((cat) => cat.id === link.catId)?.name ?? link.catId} ·{" "}
                    {link.relationship} · {link.catId}
                    <button
                      className="secondary-button small-button"
                      type="button"
                      onClick={() =>
                        setCertifyLinks((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      移除
                    </button>
                  </p>
                ))}
                <label>
                  备注
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                  />
                </label>
                <button
                  disabled={
                    isSaving ||
                    !selectedUser.wechatBound ||
                    selectedUser.parentProfile?.status === "disabled"
                  }
                  type="submit"
                >
                  {isSaving
                    ? "保存中..."
                    : selectedUser.parentProfile
                      ? "保存家长资料与关系"
                      : "确认认证为家长"}
                </button>
              </form>

              <ParentCatLinks
                cats={cats}
                disabled={
                  isSaving ||
                  !selectedUser.parentProfile ||
                  selectedUser.parentProfile.status === "disabled"
                }
                links={selectedUser.parentProfile?.links ?? []}
                newLinkCatId={newLinkCatId}
                newLinkRelationship={newLinkRelationship}
                onAddLink={handleAddLink}
                onNewLinkCatIdChange={setNewLinkCatId}
                onNewLinkRelationshipChange={setNewLinkRelationship}
                onUpdateLink={handleUpdateLink}
              />
              <div className="inline-form">
                <h4>审核与授权记录</h4>
                {events.length ? (
                  events.map((event) => (
                    <p className="mini-list-row" key={event.id}>
                      {formatDateTime(event.createdAt)} ·{" "}
                      {event.actorName || event.actorId || "管理员"} ·{" "}
                      {formatEventAction(event.action)}
                    </p>
                  ))
                ) : (
                  <p className="muted compact">暂无管理操作记录</p>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">暂无用户</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ParentCatLinks({
  cats,
  disabled,
  links,
  newLinkCatId,
  newLinkRelationship,
  onAddLink,
  onNewLinkCatIdChange,
  onNewLinkRelationshipChange,
  onUpdateLink,
}: {
  cats: CatChoice[];
  disabled: boolean;
  links: ParentCatLinkData[];
  newLinkCatId: string;
  newLinkRelationship: string;
  onAddLink: () => void;
  onNewLinkCatIdChange: (value: string) => void;
  onNewLinkRelationshipChange: (value: string) => void;
  onUpdateLink: (link: ParentCatLinkData, data: Partial<ParentCatLinkData>) => void;
}) {
  return (
    <div className="inline-form">
      <div className="subsection-heading">
        <h4>猫咪归属</h4>
      </div>
      {links.length === 0 ? (
        <p className="muted compact">暂无绑定猫咪</p>
      ) : (
        links.map((link) => (
          <div key={link.id} className="parent-link-row">
            <strong>{link.cat?.name ?? link.catId}</strong>
            <select
              disabled={disabled}
              value={link.relationship}
              onChange={(event) => onUpdateLink(link, { relationship: event.target.value })}
            >
              {RELATIONSHIP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              disabled={disabled}
              value={link.status}
              onChange={(event) =>
                onUpdateLink(link, {
                  endedAt:
                    event.target.value === "active"
                      ? null
                      : (link.endedAt ?? new Date().toISOString()),
                  status: event.target.value,
                })
              }
            >
              {LINK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="muted compact">
              {toDateInputValue(link.startedAt)} — {toDateInputValue(link.endedAt)}
            </span>
          </div>
        ))
      )}
      <div className="form-grid">
        <label>
          新增猫咪
          <select
            disabled={disabled}
            value={newLinkCatId}
            onChange={(event) => onNewLinkCatIdChange(event.target.value)}
          >
            <option value="">请选择</option>
            {cats.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} · {cat.color ?? "颜色未知"} · {cat.visibility} · {cat.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          关系
          <select
            disabled={disabled}
            value={newLinkRelationship}
            onChange={(event) => onNewLinkRelationshipChange(event.target.value)}
          >
            {RELATIONSHIP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button disabled={disabled || !newLinkCatId} type="button" onClick={onAddLink}>
        添加绑定
      </button>
    </div>
  );
}

function DescriptionList({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="description-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatCatNames(links: ParentCatLinkData[]) {
  const activeLinks = links.filter((link) => link.status === "active");
  if (activeLinks.length === 0) return "-";
  return activeLinks.map((link) => link.cat?.name ?? link.catId).join(", ");
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function formatProfilePhoneSource(source: string | undefined) {
  if (source === "wechat_verified") return "微信验证";
  if (source === "self_provided") return "用户自填";
  if (source === "admin_entered") return "管理员录入 / 未经微信验证";
  if (source === "unknown") return "历史来源未知";
  return "未提供";
}

function formatEventAction(action: string) {
  return (
    (
      {
        certify: "认证或更新资料",
        disable: "停用家长",
        reactivate: "恢复家长",
        add_cat_link: "添加猫咪关系",
        update_cat_link: "修改猫咪关系",
      } as Record<string, string>
    )[action] ?? action
  );
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
