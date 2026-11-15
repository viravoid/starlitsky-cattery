type JsonRecord = Record<string, unknown>;

interface Props {
  content: JsonRecord;
  onChange: (patch: JsonRecord) => void;
}

const QUESTION_GROUPS = [
  { key: "basicInfo", title: "一、基本信息", questions: [["name", "真实姓名"], ["gender", "性别"], ["phone", "电话"], ["age", "年龄"], ["job", "职业"], ["city", "现居城市"]] },
  { key: "catExperience", title: "二、养猫经验", questions: [["experience", "是否有养猫经验"], ["residents", "家里是否有原住民"], ["residentsNeutered", "原住民是否绝育"]] },
  { key: "livingEnvironment", title: "三、居住与家庭环境", questions: [["hasKids", "是否有小孩"], ["housing", "租房与房东同意情况"], ["windowSealed", "住房是否封窗"], ["familyAgree", "家庭成员或室友是否同意"]] },
  { key: "catPreference", title: "四、选猫偏好", questions: [["wantGender", "想要公猫或母猫"], ["wantColor", "想要幼猫颜色"], ["budget", "接受的价格范围"], ["acceptNeuter", "能否接受绝育"], ["monthlySpend", "每个月给猫支出范围"]] },
] as const;

export function QuestionnaireContentEditor({ content, onChange }: Props) {
  const updateQuestion = (groupKey: string, questionKey: string, patch: JsonRecord) => {
    const group = record(content[groupKey]);
    const question = record(group[questionKey]);
    onChange({ [groupKey]: { ...group, [questionKey]: { ...question, ...patch } } });
  };
  const commitments = record(content.commitments);
  const updateCommitments = (patch: JsonRecord) => onChange({ commitments: { ...commitments, ...patch } });

  return <div className="home-editor">
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>开头介绍与隐私说明</h4></div></div>
      <label>开头介绍<textarea rows={5} value={string(content.intro)} onChange={(event) => onChange({ intro: event.target.value })} /></label>
      <label>隐私说明<textarea rows={3} value={string(content.privacyNotice)} onChange={(event) => onChange({ privacyNotice: event.target.value })} /></label>
    </section>
    {QUESTION_GROUPS.map((groupConfig) => {
      const group = record(content[groupConfig.key]);
      return <section className="home-editor-section" key={groupConfig.key}>
        <div className="section-heading"><div><h4>{groupConfig.title}</h4><p className="muted compact">题型、顺序、选项 ID 和必填状态保持固定。</p></div></div>
        {groupConfig.questions.map(([questionKey, title]) => {
          const question = record(group[questionKey]);
          return <div className="structured-section-card" key={questionKey}>
            <strong>{title}</strong>
            <label>题目显示文字<input value={string(question.label)} onChange={(event) => updateQuestion(groupConfig.key, questionKey, { label: event.target.value })} /></label>
            {Array.isArray(question.options)
              ? <OptionLabels options={question.options.map(record)} onChange={(options) => updateQuestion(groupConfig.key, questionKey, { options })} />
              : <label>输入提示<input value={string(question.placeholder)} onChange={(event) => updateQuestion(groupConfig.key, questionKey, { placeholder: event.target.value })} /></label>}
          </div>;
        })}
      </section>;
    })}
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>五、饲养理念与承诺</h4></div></div>
      {[["scientificFeeding", "承诺问题 1"], ["acceptActive", "承诺问题 2"], ["commitment", "承诺问题 3"]].map(([key, label]) =>
        <label key={key}>{label}<textarea rows={4} value={string(commitments[key])} onChange={(event) => updateCommitments({ [key]: event.target.value })} /></label>,
      )}
      <OptionLabels options={Array.isArray(commitments.options) ? commitments.options.map(record) : []} onChange={(options) => updateCommitments({ options })} />
    </section>
    <section className="home-editor-section">
      <div className="section-heading"><div><h4>底部 PS 与提交成功页</h4></div></div>
      <label>PS 文案<textarea rows={3} value={string(content.ps)} onChange={(event) => onChange({ ps: event.target.value })} /></label>
      <label>提交成功标题<input value={string(content.successTitle)} onChange={(event) => onChange({ successTitle: event.target.value })} /></label>
      <label>提交成功说明<textarea rows={3} value={string(content.successBody)} onChange={(event) => onChange({ successBody: event.target.value })} /></label>
    </section>
  </div>;
}

function OptionLabels({ options, onChange }: { options: JsonRecord[]; onChange: (options: JsonRecord[]) => void }) {
  return <div className="form-grid">
    {options.map((option, index) => <label key={string(option.id) || index}>选项 {string(option.id) || index + 1}
      <input value={string(option.label)} onChange={(event) => onChange(options.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} />
    </label>)}
  </div>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value : "";
}
