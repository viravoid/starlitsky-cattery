import type { ParentApplicationData, ReviewParentApplicationRequest } from "@starlitsky/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveParentApplication,
  listParentApplications,
  rejectParentApplication,
  searchAdminParentCatCandidates,
  type AdminParentCatCandidate,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

export function ParentApplicationsPanel() {
  const [applications, setApplications] = useState<ParentApplicationData[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [unlistedSelections, setUnlistedSelections] = useState<
    Record<number, AdminParentCatCandidate>
  >({});
  const [unlistedConfirmed, setUnlistedConfirmed] = useState<Record<number, boolean>>({});
  const [newCatConfirmed, setNewCatConfirmed] = useState<Record<number, boolean>>({});
  const [newCatActions, setNewCatActions] = useState<Record<number, "create" | "link_existing">>(
    {},
  );
  const [newCatSelections, setNewCatSelections] = useState<Record<number, AdminParentCatCandidate>>(
    {},
  );
  const [newCatLinkConfirmed, setNewCatLinkConfirmed] = useState<Record<number, boolean>>({});
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
    setUnlistedSelections({});
    setUnlistedConfirmed({});
    setNewCatConfirmed({});
    setNewCatActions({});
    setNewCatSelections({});
    setNewCatLinkConfirmed({});
  }, [selectedApplication?.id, selectedApplication?.adminNote]);

  async function review(action: "approve" | "reject") {
    if (!selectedApplication) return;
    setIsSaving(true);
    setNotice("");
    setError("");
    try {
      const payload: ReviewParentApplicationRequest = { adminNote: emptyToNull(adminNote) };
      if (action === "approve") {
        if (
          selectedApplication.unlistedCatClaims.some(
            (_, index) => !unlistedSelections[index] || !unlistedConfirmed[index],
          ) ||
          selectedApplication.newCats.some((_, index) =>
            newCatActions[index] === "create"
              ? !newCatConfirmed[index]
              : newCatActions[index] === "link_existing"
                ? !newCatSelections[index] || !newCatLinkConfirmed[index]
                : true,
          )
        ) {
          throw new Error("请逐条确认未公开猫咪的关联目标与真正新猫的创建");
        }
        payload.unlistedCatResolutions = selectedApplication.unlistedCatClaims.map(
          (claim, index) => ({
            index,
            catId: unlistedSelections[index].id,
            confirmedCatName: unlistedSelections[index].name,
            confirmedClaimName: claim.name,
          }),
        );
        payload.newCatConfirmations = selectedApplication.newCats.map((cat, index) =>
          newCatActions[index] === "link_existing"
            ? {
                index,
                action: "link_existing" as const,
                confirmedName: cat.name,
                catId: newCatSelections[index].id,
                confirmedCatName: newCatSelections[index].name,
              }
            : { index, action: "create" as const, confirmedName: cat.name },
        );
      }
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
                  <th>猫咪</th>
                  <th>电话来源</th>
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
                    <td>
                      公开 {application.existingCatClaims.length} / 未公开{" "}
                      {application.unlistedCatClaims.length} / 新猫 {application.newCats.length}
                    </td>
                    <td>
                      {formatPhoneSource(application.contactPhoneSource, application.contactPhone)}
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
                  ["联系电话", selectedApplication.contactPhone ?? "-"],
                  [
                    "电话来源",
                    formatPhoneSource(
                      selectedApplication.contactPhoneSource,
                      selectedApplication.contactPhone,
                    ),
                  ],
                  ["微信获取时间", formatDateTime(selectedApplication.contactPhoneVerifiedAt)],
                  ["微信号", selectedApplication.contactWechat ?? "-"],
                  ["城市", selectedApplication.city ?? "-"],
                  ["历史邀请短码", selectedApplication.invite?.shortCode ?? "-"],
                  ["提交时间", formatDateTime(selectedApplication.createdAt)],
                  ["审核时间", formatDateTime(selectedApplication.reviewedAt)],
                  ["审核人", selectedApplication.reviewedBy?.nickname ?? "-"],
                  ["审核备注", selectedApplication.adminNote ?? "-"],
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
              <div className="inline-form">
                <h4>认领未公开猫咪 · 需确认档案</h4>
                {selectedApplication.unlistedCatClaims.length === 0 ? (
                  <p className="muted compact">无</p>
                ) : null}
                {selectedApplication.unlistedCatClaims.map((claim, index) => (
                  <UnlistedCatResolution
                    key={`${selectedApplication.id}-${index}`}
                    name={claim.name}
                    identification={claim.identification}
                    selected={unlistedSelections[index]}
                    confirmed={Boolean(unlistedConfirmed[index])}
                    onSelect={(cat) => {
                      setUnlistedSelections((current) => ({ ...current, [index]: cat }));
                      setUnlistedConfirmed((current) => ({ ...current, [index]: false }));
                    }}
                    onConfirm={(checked) =>
                      setUnlistedConfirmed((current) => ({ ...current, [index]: checked }))
                    }
                  />
                ))}
              </div>
              <MiniList
                title="自行填写的新猫"
                items={selectedApplication.newCats.map(
                  (cat) =>
                    `${cat.name} · ${cat.gender ?? "未填性别"} · ${cat.color ?? "未填颜色"}${
                      cat.arrivedAt ? ` · 到家 ${cat.arrivedAt.slice(0, 10)}` : ""
                    }`,
                )}
              />
              {selectedApplication.newCats.map((cat, index) => (
                <div className="inline-form" key={`new-${index}`}>
                  <p>
                    <strong>{cat.name}</strong> · 请核查现有档案后决定
                  </p>
                  <label>
                    <input
                      type="radio"
                      name={`new-cat-${index}`}
                      checked={newCatActions[index] === "link_existing"}
                      onChange={() =>
                        setNewCatActions((current) => ({ ...current, [index]: "link_existing" }))
                      }
                    />
                    关联已有档案
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`new-cat-${index}`}
                      checked={newCatActions[index] === "create"}
                      onChange={() =>
                        setNewCatActions((current) => ({ ...current, [index]: "create" }))
                      }
                    />
                    确认尚无档案并新建
                  </label>
                  {newCatActions[index] === "link_existing" ? (
                    <UnlistedCatResolution
                      name={cat.name}
                      identification={cat.note ?? cat.personality ?? "历史申请，请核对完整资料"}
                      selected={newCatSelections[index]}
                      confirmed={Boolean(newCatLinkConfirmed[index])}
                      onSelect={(selected) => {
                        setNewCatSelections((current) => ({ ...current, [index]: selected }));
                        setNewCatLinkConfirmed((current) => ({ ...current, [index]: false }));
                      }}
                      onConfirm={(checked) =>
                        setNewCatLinkConfirmed((current) => ({ ...current, [index]: checked }))
                      }
                    />
                  ) : null}
                  {newCatActions[index] === "create" ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(newCatConfirmed[index])}
                        onChange={(event) =>
                          setNewCatConfirmed((current) => ({
                            ...current,
                            [index]: event.target.checked,
                          }))
                        }
                      />
                      已核查现有档案，确认“{cat.name}”确实尚无档案并新建
                    </label>
                  ) : null}
                </div>
              ))}

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

function UnlistedCatResolution({
  name,
  identification,
  selected,
  confirmed,
  onSelect,
  onConfirm,
}: {
  name: string;
  identification: string;
  selected?: AdminParentCatCandidate;
  confirmed: boolean;
  onSelect: (cat: AdminParentCatCandidate) => void;
  onConfirm: (checked: boolean) => void;
}) {
  const [query, setQuery] = useState(name);
  const [candidates, setCandidates] = useState<AdminParentCatCandidate[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setError("");
    try {
      setCandidates(await searchAdminParentCatCandidates(query));
    } catch (searchError) {
      setError(getErrorMessage(searchError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-form">
      <p>
        <strong>{name}</strong> · 识别说明：{identification}
      </p>
      <label>
        私有档案查询
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button
        className="secondary-button"
        type="button"
        disabled={loading || query.trim().length < 2}
        onClick={() => void search()}
      >
        {loading ? "查询中..." : "查询已有档案"}
      </button>
      {error ? <p className="error-banner">{error}</p> : null}
      {candidates.map((cat) => (
        <button
          className="secondary-button"
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat)}
        >
          {cat.name} · {cat.gender ?? "性别未知"} · {cat.color ?? "颜色未知"} · {cat.visibility} ·{" "}
          {cat.id}
        </button>
      ))}
      {selected ? (
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => onConfirm(event.target.checked)}
          />
          确认将申请“{name}”关联到“{selected.name}”（{selected.id}）
        </label>
      ) : (
        <p className="muted compact">未确认对应档案，不能通过申请。</p>
      )}
    </div>
  );
}

function formatApplicationStatus(status: string) {
  if (status === "pending") return "待审核";
  if (status === "approved") return "已通过";
  if (status === "rejected") return "已拒绝";
  return status;
}

function formatPhoneSource(
  source: ParentApplicationData["contactPhoneSource"],
  phone: string | null,
) {
  if (!phone) return "未提供手机号";
  if (source === "wechat_verified") return "微信获取的手机号";
  if (source === "self_provided") return "自行填写的手机号";
  if (source === "unknown") return "来源未知的历史手机号";
  return "未提供手机号";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
