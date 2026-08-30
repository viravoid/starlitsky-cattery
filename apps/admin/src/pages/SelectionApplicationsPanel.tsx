import type { SelectionApplicationData } from "@starlitsky/shared";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getSelectionApplication,
  listSelectionApplications,
  updateSelectionApplicationReview,
} from "../api/cattery";
import { getErrorMessage } from "../utils/errors";

const STATUS_OPTIONS = [
  { label: "全部", value: "" },
  { label: "未查看", value: "submitted" },
  { label: "已审核", value: "reviewed" },
];

export function SelectionApplicationsPanel() {
  const [applications, setApplications] = useState<SelectionApplicationData[]>([]);
  const [selected, setSelected] = useState<SelectionApplicationData | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedRows = useMemo(() => buildAnswerRows(selected), [selected]);

  async function loadApplications(nextStatus = status, nextQuery = query) {
    setIsLoading(true);
    setError("");
    try {
      const data = await listSelectionApplications({
        pageSize: 100,
        q: nextQuery,
        status: nextStatus,
      });
      setApplications(data.items);
      setSelected((current) =>
        current ? (data.items.find((item) => item.id === current.id) ?? current) : null,
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadApplications();
  }, []);

  async function selectApplication(application: SelectionApplicationData) {
    setNotice("");
    setError("");
    try {
      const detail = await getSelectionApplication(application.id);
      setSelected(detail);
      setDraftNote(detail.adminNote ?? "");
    } catch (selectError) {
      setError(getErrorMessage(selectError));
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadApplications(status, query);
  }

  async function handleStatusChange(nextStatus: string) {
    setStatus(nextStatus);
    await loadApplications(nextStatus, query);
  }

  async function saveReview(nextStatus: "submitted" | "reviewed" = selected?.status === "reviewed" ? "reviewed" : "submitted") {
    if (!selected) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await updateSelectionApplicationReview(selected.id, {
        adminNote: draftNote,
        status: nextStatus,
      });
      setSelected(updated);
      setDraftNote(updated.adminNote ?? "");
      setNotice(nextStatus === "reviewed" ? "问卷已标记为已审核" : "问卷已标记为未查看");
      await loadApplications(status, query);
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
          <p className="eyebrow">Selection Questionnaire</p>
          <h2>选猫问卷管理</h2>
          <p className="muted compact">查看小程序提交的正式选猫问卷，并记录处理备注。</p>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={() => loadApplications()}>
            刷新
          </button>
        </div>
      </div>

      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      <div className="management-grid">
        <section className="table-panel">
          <form className="inline-form" onSubmit={handleSearch}>
            <div className="form-grid">
              <label>
                状态
                <select value={status} onChange={(event) => handleStatusChange(event.target.value)}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                搜索
                <input
                  placeholder="姓名、电话、城市或职业"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit">筛选</button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("");
                  void loadApplications("", "");
                }}
              >
                清空
              </button>
            </div>
          </form>

          <div className="section-heading">
            <h3>问卷列表</h3>
            <span className="muted compact">{applications.length} 条</span>
          </div>

          {isLoading ? (
            <div className="empty-state">正在加载问卷...</div>
          ) : applications.length === 0 ? (
            <div className="empty-state">当前还没有符合条件的问卷。</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>提交时间</th>
                    <th>姓名</th>
                    <th>电话</th>
                    <th>城市</th>
                    <th>预算</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((application) => (
                    <tr key={application.id}>
                      <td>{formatDateTime(application.submittedAt)}</td>
                      <td>{application.contactName}</td>
                      <td>{application.contactPhone}</td>
                      <td>{application.contactCity}</td>
                      <td>{application.preferences.budget}</td>
                      <td>{statusLabel(application.status)}</td>
                      <td>
                        <button
                          className="secondary-button small-button"
                          type="button"
                          onClick={() => selectApplication(application)}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="detail-panel" aria-label="问卷详情">
          {selected ? (
            <div className="detail-stack">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Questionnaire Detail</p>
                  <h3>{selected.contactName}</h3>
                </div>
                <span className={`upload-state upload-state-${selected.status}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>

              <DescriptionList
                items={[
                  ["提交时间", formatDateTime(selected.submittedAt)],
                  ["电话", selected.contactPhone],
                  ["性别", optionLabel("gender", selected.contactGender)],
                  ["年龄", selected.contactAge],
                  ["职业", selected.contactJob],
                  ["城市", selected.contactCity],
                  ["关联用户", selected.user?.nickname || selected.userId || "游客"],
                  ["审核时间", formatDateTime(selected.reviewedAt)],
                  ["审核人", selected.reviewedBy?.nickname || "-"],
                ]}
              />

              <div className="answer-list">
                {selectedRows.map((row) => (
                  <div key={row.label} className="answer-row">
                    <span>{row.label}</span>
                    <p>{row.value || "-"}</p>
                  </div>
                ))}
              </div>

              <label>
                管理员备注
                <textarea
                  rows={5}
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                />
              </label>

              <div className="form-actions">
                <button disabled={isSaving} type="button" onClick={() => saveReview("reviewed")}>
                  标记已审核
                </button>
                <button
                  className="secondary-button"
                  disabled={isSaving}
                  type="button"
                  onClick={() => saveReview("submitted")}
                >
                  标记未查看
                </button>
                <button
                  className="secondary-button"
                  disabled={isSaving}
                  type="button"
                  onClick={() => saveReview()}
                >
                  保存备注
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">选择一份问卷查看详情。</div>
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

function buildAnswerRows(application: SelectionApplicationData | null) {
  if (!application) return [];
  return [
    ["是否有养猫经验", optionLabel("yesNo", application.catExperience.experience)],
    ["家里是否有原住民", optionLabel("yesNo", application.existingPets.residents)],
    ["原住民是否绝育", optionLabel("residentsNeutered", application.existingPets.residentsNeutered)],
    ["是否有小孩", optionLabel("yesNo", application.livingEnvironment.hasKids)],
    ["租房与房东同意情况", optionLabel("housing", application.livingEnvironment.housing)],
    ["住房是否有封窗", optionLabel("windowSealed", application.livingEnvironment.windowSealed)],
    ["家庭成员或室友是否同意", optionLabel("familyAgree", application.livingEnvironment.familyAgree)],
    ["对缅因猫的了解", application.maineCoonKnowledge ?? ""],
    ["想要公猫 or 母猫", optionLabel("wantGender", application.preferences.wantGender)],
    ["想要幼猫颜色", application.preferences.wantColor],
    ["接受的价格范围", application.preferences.budget],
    ["每月给猫支出范围", optionLabel("monthlySpend", application.preferences.monthlySpend)],
    ["能否接受绝育", optionLabel("accept", application.commitments.acceptNeuter)],
    ["科学喂养承诺", optionLabel("accept", application.commitments.scientificFeeding)],
    ["接受小猫活泼行为", optionLabel("accept", application.commitments.acceptActive)],
    ["长期负责承诺", optionLabel("accept", application.commitments.commitment)],
    ["自由补充", application.additionalNote ?? ""],
  ].map(([label, value]) => ({ label, value }));
}

function optionLabel(group: string, value: string | null | undefined) {
  if (!value) return "";
  const labels: Record<string, Record<string, string>> = {
    accept: {
      accept: "能接受",
      needMoreInfo: "需要进一步了解",
      cannotAccept: "不能接受",
    },
    familyAgree: {
      allAgree: "全部同意",
      partAgree: "部分同意",
      notDiscussed: "尚未沟通",
      disagree: "不同意",
    },
    gender: {
      female: "女",
      male: "男",
      other: "其他",
      private: "不便透露",
    },
    housing: {
      owned: "自有住房",
      rentApproved: "租房，房东同意养猫",
      rentUnconfirmed: "租房，尚未确认",
      rentRejected: "租房，房东不同意",
    },
    monthlySpend: {
      under300: "300 以内",
      "300to500": "300-500",
      "500to1000": "500-1000",
      over1000: "1000 以上",
    },
    residentsNeutered: {
      neutered: "已绝育",
      notNeutered: "未绝育",
      partiallyNeutered: "部分绝育",
      notApplicable: "暂不适用",
    },
    wantGender: {
      male: "公猫",
      female: "母猫",
      either: "都可以",
      currentCat: "咨询现猫，暂不填写",
    },
    windowSealed: {
      sealed: "已封窗",
      canSeal: "暂未封窗但可以封",
      cannotSeal: "无法封窗",
    },
    yesNo: {
      yes: "有",
      no: "没有",
    },
  };
  return labels[group]?.[value] ?? value;
}

function statusLabel(status: string) {
  return status === "reviewed" ? "已审核" : "未查看";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}
