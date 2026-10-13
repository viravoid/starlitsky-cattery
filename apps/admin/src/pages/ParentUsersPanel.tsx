import type { AdminUserData, CatData, ParentCatLinkData } from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  certifyExistingUserAsParent,
  createCatParentLink,
  listAdminUsers,
  listCats,
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
  { label: "Active", value: "active" },
  { label: "Disabled", value: "disabled" },
];

const RELATIONSHIP_OPTIONS = [
  { label: "Owner", value: "owner" },
  { label: "Co-owner", value: "co_owner" },
  { label: "Caregiver", value: "caregiver" },
];

const LINK_STATUS_OPTIONS = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Ended", value: "ended" },
];

export function ParentUsersPanel() {
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [cats, setCats] = useState<CatData[]>([]);
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
      const [userList, catList] = await Promise.all([
        listAdminUsers({
          pageSize: 100,
          parentStatus,
          q: query,
          role,
          wechatBound: wechatBound === "" ? undefined : wechatBound === "true",
        }),
        listCats({ includeDeleted: false, pageSize: 100 }),
      ]);
      setUsers(userList.items);
      setCats(catList.items);
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
  }, [parentStatus, query, role, wechatBound]);

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
  }, [selectedUser]);

  async function handleCertify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.userId) return;

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
        catLinks: form.catId
          ? [
              {
                catId: form.catId,
                relationship: form.relationship,
                startedAt: form.startedAt || null,
                note: emptyToNull(form.note),
              },
            ]
          : [],
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

  async function handleAddLink() {
    const profileId = selectedUser?.parentProfile?.id;
    if (!profileId || !newLinkCatId) return;

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
            <span className="muted">{isLoading ? "加载中..." : `${users.length} 条`}</span>
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
                    <td>{user.nickname ?? "-"}</td>
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
                  ["待审申请", selectedUser.pendingApplication?.displayName ?? "-"],
                ]}
              />

              <form className="inline-form" onSubmit={handleCertify}>
                <h4>手动认证为家长</h4>
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
                <label>
                  城市
                  <input
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    同时绑定猫咪
                    <select
                      value={form.catId}
                      onChange={(event) => setForm({ ...form, catId: event.target.value })}
                    >
                      <option value="">暂不绑定</option>
                      {cats.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    关系
                    <select
                      value={form.relationship}
                      onChange={(event) =>
                        setForm({ ...form, relationship: event.target.value })
                      }
                    >
                      {RELATIONSHIP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  备注
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={(event) => setForm({ ...form, note: event.target.value })}
                  />
                </label>
                <button disabled={isSaving} type="submit">
                  {isSaving ? "保存中..." : "认证/激活家长"}
                </button>
              </form>

              <ParentCatLinks
                cats={cats}
                disabled={isSaving || !selectedUser.parentProfile}
                links={selectedUser.parentProfile?.links ?? []}
                newLinkCatId={newLinkCatId}
                newLinkRelationship={newLinkRelationship}
                onAddLink={handleAddLink}
                onNewLinkCatIdChange={setNewLinkCatId}
                onNewLinkRelationshipChange={setNewLinkRelationship}
                onUpdateLink={handleUpdateLink}
              />
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
  cats: CatData[];
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
            <input
              aria-label="开始时间"
              placeholder="started_at"
              value={toDateInputValue(link.startedAt)}
              onChange={(event) => onUpdateLink(link, { startedAt: event.target.value || null })}
            />
            <input
              aria-label="结束时间"
              placeholder="ended_at"
              value={toDateInputValue(link.endedAt)}
              onChange={(event) => onUpdateLink(link, { endedAt: event.target.value || null })}
            />
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
                {cat.name}
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

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
