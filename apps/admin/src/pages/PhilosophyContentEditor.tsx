type JsonRecord = Record<string, unknown>;

interface Props {
  content: JsonRecord;
  onChange: (patch: JsonRecord) => void;
}

const GROUPS = [
  { title: "开篇理念", fields: [["openingBelief", "开篇理念正文"]] },
  { title: "成长与繁育经历", fields: [["growthEffortParagraph", "成长经历第 1 段"], ["growthCommunityParagraph", "成长经历第 2 段"], ["growthFuturePlanParagraph", "成长经历第 3 段"]] },
  { title: "搬入新家后的阶段变化", fields: [["stageNewHomeParagraph", "阶段变化第 1 段"], ["stageClearGoalParagraph", "阶段变化第 2 段"]] },
  { title: "血线与风格理解", fields: [["styleBloodlineParagraph", "血线理解第 1 段"], ["styleBeyondLabelsParagraph", "血线理解第 2 段"]] },
  { title: "高亮观点", fields: [["highlightLineOne", "高亮第 1 行"], ["highlightLineTwo", "高亮第 2 行"]] },
  { title: "当前繁育方向", fields: [["directionGlobalBreedersParagraph", "繁育方向第 1 段"], ["directionGoalParagraph", "繁育方向第 2 段"]] },
  { title: "收尾理念", fields: [["closingLifeParagraph", "收尾第 1 段"], ["closingCareerParagraph", "收尾第 2 段"], ["closingParentParagraph", "收尾第 3 段"], ["closingAftercareParagraph", "收尾第 4 段"]] },
] as const;

export function PhilosophyContentEditor({ content, onChange }: Props) {
  const milestones = record(content.milestones);
  const updateMilestone = (key: "founder" | "yueqi", patch: JsonRecord) =>
    onChange({ milestones: { ...milestones, [key]: { ...record(milestones[key]), ...patch } } });

  return <div className="home-editor">
    {GROUPS.slice(0, 2).map((group) => <TextGroup key={group.title} group={group} content={content} onChange={onChange} />)}
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>繁育年限</h4></div></div>
      {(["founder", "yueqi"] as const).map((key) => {
        const milestone = record(milestones[key]);
        return <div className="structured-section-card" key={key}>
          <strong>{key === "founder" ? "主理人年限节点" : "月七年限节点"}</strong>
          <div className="form-grid">
            <label>年限数值<input value={string(milestone.value)} onChange={(event) => updateMilestone(key, { value: event.target.value })} /></label>
            <label>年限说明<input value={string(milestone.description)} onChange={(event) => updateMilestone(key, { description: event.target.value })} /></label>
          </div>
        </div>;
      })}
    </section>
    {GROUPS.slice(2).map((group) => <TextGroup key={group.title} group={group} content={content} onChange={onChange} />)}
  </div>;
}

function TextGroup({ group, content, onChange }: {
  group: typeof GROUPS[number];
  content: JsonRecord;
  onChange: (patch: JsonRecord) => void;
}) {
  return <section className="home-editor-section">
    <div className="section-heading"><div><h4>{group.title}</h4></div></div>
    {group.fields.map(([key, label]) => <label key={key}>{label}
      <textarea rows={4} value={string(content[key])} onChange={(event) => onChange({ [key]: event.target.value })} />
    </label>)}
  </section>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
