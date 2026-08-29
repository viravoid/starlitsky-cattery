import type {
  CreatedParentInviteData,
  ParentApplicationData,
  ParentInviteData,
} from "@starlitsky/shared";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  approveParentApplication,
  createParentInvite,
  listParentApplications,
  listParentInvites,
  rejectParentApplication,
  revokeParentInvite,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

interface InviteFormState {
  expiresAt: string;
  maxUses: string;
  note: string;
}

const DEFAULT_INVITE_FORM: InviteFormState = {
  expiresAt: "",
  maxUses: "1",
  note: "",
};

export function ParentInvitesPanel() {
  const [form, setForm] = useState<InviteFormState>(DEFAULT_INVITE_FORM);
  const [invites, setInvites] = useState<ParentInviteData[]>([]);
  const [createdInvite, setCreatedInvite] = useState<CreatedParentInviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await listParentInvites({ pageSize: 100 });
      setInvites(data.items);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const invite = await createParentInvite({
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        maxUses: Number(form.maxUses || 1),
        note: emptyToNull(form.note),
      });
      setCreatedInvite(invite);
      setForm(DEFAULT_INVITE_FORM);
      setNotice("邀请已创建，请立即复制二维码 token 或短邀请码。");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRevoke(invite: ParentInviteData) {
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      await revokeParentInvite(invite.id, { adminNote: invite.note });
      setNotice("邀请已失效");
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
          <p className="eyebrow">Parent Invites</p>
          <h2>家长邀请管理</h2>
          <p className="muted compact">二维码 token 与短邀请码共用同一邀请记录。</p>
        </div>
        <button className="secondary-button" type="button" onClick={loadData}>
          刷新
        </button>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {createdInvite ? (
        <div className="detail-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Created Invite</p>
              <h3>本次创建的邀请凭证</h3>
            </div>
          </div>
          <DescriptionList
            items={[
              ["短邀请码", createdInvite.shortCode],
              ["二维码入口", `pages/parent-auth/index?token=${createdInvite.token}`],
              ["二维码 token", createdInvite.token],
            ]}
          />
        </div>
      ) : null}

      <div className="management-grid">
        <section className="table-panel">
          <div className="section-heading">
            <h3>邀请记录</h3>
            <span className="muted">{isLoading ? "加载中..." : `${invites.length} 条`}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>短码</th>
                  <th>状态</th>
                  <th>使用</th>
                  <th>过期</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="truncate-cell">{invite.shortCode}</td>
                    <td>{formatInviteStatus(invite)}</td>
                    <td>
                      {invite.usedCount}/{invite.maxUses}
                    </td>
                    <td>{formatDateTime(invite.expiresAt)}</td>
                    <td>{formatDateTime(invite.createdAt)}</td>
                    <td>
                      <button
                        className="danger-button small-button"
                        disabled={isSaving || invite.status === "revoked"}
                        type="button"
                        onClick={() => handleRevoke(invite)}
                      >
                        失效
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="detail-panel">
          <form className="form-stack" onSubmit={handleSubmit}>
            <div>
              <p className="eyebrow">New Invite</p>
              <h3>生成邀请</h3>
            </div>
            <label>
              使用次数
              <input
                min={1}
                max={100}
                required
                type="number"
                value={form.maxUses}
                onChange={(event) => setForm({ ...form, maxUses: event.target.value })}
              />
            </label>
            <label>
              过期时间
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
              />
            </label>
            <label>
              备注
              <textarea
                rows={4}
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
              />
            </label>
            <button disabled={isSaving} type="submit">
              {isSaving ? "生成中..." : "生成邀请"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

export function ParentApplicationsPanel() {
  const [applications, setApplications] = useState<ParentApplicationData[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedApplication = useMemo(
    () =>
      applications.find((application) => application.id === selectedId) ?? applications[0] ?? null,
    [applications, selectedId],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await listParentApplications({ pageSize: 100 });
      setApplications(data.items);
      setSelectedId((current) =>
        current && data.items.some((application) => application.id === current)
          ? current
          : (data.items[0]?.id ?? ""),
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setAdminNote(selectedApplication?.adminNote ?? "");
  }, [selectedApplication?.id, selectedApplication?.adminNote]);

  async function review(action: "approve" | "reject") {
    if (!selectedApplication) return;
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const payload = { adminNote: emptyToNull(adminNote) };
      await (action === "approve"
        ? approveParentApplication(selectedApplication.id, payload)
        : rejectParentApplication(selectedApplication.id, payload));
      setNotice(action === "approve" ? "申请已通过" : "申请已拒绝");
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
          <p className="eyebrow">Parent Applications</p>
          <h2>家长申请审核</h2>
          <p className="muted compact">
            通过后才会激活 ParentProfile、授予 parent 并建立猫咪归属。
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={loadData}>
          刷新
        </button>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="management-grid">
        <section className="table-panel">
          <div className="section-heading">
            <h3>申请列表</h3>
            <span className="muted">{isLoading ? "加载中..." : `${applications.length} 条`}</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>申请人</th>
                  <th>状态</th>
                  <th>邀请码</th>
                  <th>猫咪</th>
                  <th>提交时间</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr
                    key={application.id}
                    className={selectedApplication?.id === application.id ? "archived-row" : ""}
                    onClick={() => setSelectedId(application.id)}
                  >
                    <td>{application.displayName}</td>
                    <td>{formatApplicationStatus(application.status)}</td>
                    <td>{application.invite?.shortCode ?? "-"}</td>
                    <td>
                      现有 {application.existingCatClaims.length} / 新猫{" "}
                      {application.newCats.length}
                    </td>
                    <td>{formatDateTime(application.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="detail-panel">
          {selectedApplication ? (
            <div className="detail-stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Application Detail</p>
                  <h3>{selectedApplication.displayName}</h3>
                </div>
                <span>{formatApplicationStatus(selectedApplication.status)}</span>
              </div>
              <DescriptionList
                items={[
                  ["用户", selectedApplication.user?.nickname ?? selectedApplication.userId],
                  ["真实姓名", selectedApplication.realName ?? "-"],
                  ["手机号", selectedApplication.contactPhone ?? "-"],
                  ["微信号", selectedApplication.contactWechat ?? "-"],
                  ["城市", selectedApplication.city ?? "-"],
                  ["邀请短码", selectedApplication.invite?.shortCode ?? "-"],
                  ["提交时间", formatDateTime(selectedApplication.createdAt)],
                  ["审核时间", formatDateTime(selectedApplication.reviewedAt)],
                ]}
              />

              <MiniList
                title="申请认领的已有猫"
                items={selectedApplication.existingCatClaims.map(
                  (claim) =>
                    `${claim.cat?.name ?? claim.catId} · ${claim.relationship}${
                      claim.note ? ` · ${claim.note}` : ""
                    }`,
                )}
              />
              <MiniList
                title="自行填写的新猫"
                items={selectedApplication.newCats.map(
                  (cat) =>
                    `${cat.name} · ${cat.gender ?? "未填性别"} · ${cat.color ?? "未填颜色"}${
                      cat.arrivedAt ? ` · 到家 ${cat.arrivedAt.slice(0, 10)}` : ""
                    }`,
                )}
              />

              <label>
                管理员备注
                <textarea
                  rows={4}
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                />
              </label>
              <div className="form-actions">
                <button
                  disabled={isSaving || selectedApplication.status !== "pending"}
                  type="button"
                  onClick={() => review("approve")}
                >
                  通过
                </button>
                <button
                  className="danger-button"
                  disabled={isSaving || selectedApplication.status !== "pending"}
                  type="button"
                  onClick={() => review("reject")}
                >
                  拒绝
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">暂无申请</div>
          )}
        </aside>
      </div>
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

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="inline-form">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="muted compact">无</p>
      ) : (
        items.map((item) => (
          <div key={item} className="mini-list-row">
            <span>{item}</span>
          </div>
        ))
      )}
    </div>
  );
}

function formatInviteStatus(invite: ParentInviteData) {
  if (!invite.isUsable && invite.invalidReason) return `${invite.status} (${invite.invalidReason})`;
  return invite.status;
}

function formatApplicationStatus(status: string) {
  if (status === "pending") return "待审核";
  if (status === "approved") return "已通过";
  if (status === "rejected") return "已拒绝";
  return status;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
