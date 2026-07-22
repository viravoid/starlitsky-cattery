import { useEffect, useMemo, useState } from "react";
import { QuestionnaireView } from "@/components/mobile/QuestionnaireView";
import {
  cloneQuestionnaireContent,
  normalizeQuestionnaireContent,
  type QuestionnaireChoiceOption,
  type QuestionnaireChoiceQuestion,
  type QuestionnaireContent,
  type QuestionnaireTextQuestion,
} from "@/lib/questionnaire-content";
import {
  loadSavedQuestionnaireContent,
  saveDraftPreviewQuestionnaireContent,
  saveQuestionnaireContent,
} from "@/lib/site-page-storage";
import { EditorButton, EditorSection, TextareaField, TextField } from "./SitePageEditorPrimitives";

type PanelKey =
  | "intro"
  | "basicInfo"
  | "catExperience"
  | "livingEnvironment"
  | "catPreference"
  | "commitments"
  | "outro"
  | "success";

export function QuestionnaireContentPanel({
  onNotice,
  onDirtyChange,
}: {
  onNotice: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState<QuestionnaireContent>(() => loadSavedQuestionnaireContent());
  const [draft, setDraft] = useState<QuestionnaireContent>(() => loadSavedQuestionnaireContent());
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    intro: true,
    basicInfo: true,
    catExperience: true,
    livingEnvironment: true,
    catPreference: true,
    commitments: true,
    outro: true,
    success: true,
  });

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [draft, saved]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const updateDraft = (updater: (content: QuestionnaireContent) => QuestionnaireContent) => {
    setDraft((current) =>
      normalizeQuestionnaireContent(updater(cloneQuestionnaireContent(current))),
    );
  };

  const togglePanel = (key: PanelKey) => {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  };

  const saveAll = () => {
    saveQuestionnaireContent(draft);
    const next = cloneQuestionnaireContent(draft);
    setSaved(next);
    setDraft(cloneQuestionnaireContent(next));
    onNotice("保存成功");
  };

  const restoreDraft = () => {
    if (!dirty) return;
    if (!window.confirm("确定要恢复本次修改吗？当前所有未保存的选猫问卷修改都会被放弃。")) {
      return;
    }
    setDraft(cloneQuestionnaireContent(saved));
  };

  const openDraftPreview = () => {
    saveDraftPreviewQuestionnaireContent(draft);
    window.open(
      "/questionnaire?sitePagePreview=questionnaire-draft",
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-3">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border border-border/80 bg-card px-3 py-2 shadow-card lg:top-4">
            <div>
              <p className="text-[13px] font-semibold text-heading">
                {dirty ? "有未保存修改" : "当前内容已保存"}
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                只编辑问卷文案；题目 key、题型、顺序、必填和条件逻辑固定。
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(true)}>
                预览
              </EditorButton>
              <EditorButton tone="quiet" onClick={openDraftPreview}>
                预览页面
              </EditorButton>
              <EditorButton tone="quiet" onClick={restoreDraft} disabled={!dirty}>
                恢复本次修改
              </EditorButton>
              <EditorButton onClick={saveAll} disabled={!dirty}>
                保存更改
              </EditorButton>
            </div>
          </div>

          <EditorSection
            title="开头说明"
            desc="顶部导航标题、页面主标题、图标和视觉结构固定；介绍或隐私说明为空时用户端隐藏对应文字。"
            open={openPanels.intro}
            onToggle={() => togglePanel("intro")}
          >
            <div className="grid gap-3">
              <TextareaField
                label="开头介绍"
                value={draft.intro}
                rows={5}
                onChange={(intro) => updateDraft((content) => ({ ...content, intro }))}
              />
              <TextareaField
                label="隐私说明"
                value={draft.privacyNotice}
                rows={3}
                onChange={(privacyNotice) =>
                  updateDraft((content) => ({ ...content, privacyNotice }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="一、基本信息"
            desc="分组名称、分组序号、题型、题目顺序和必填状态固定。"
            open={openPanels.basicInfo}
            onToggle={() => togglePanel("basicInfo")}
          >
            <div className="grid gap-4">
              <TextQuestionEditor
                title="真实姓名"
                question={draft.basicInfo.name}
                onChange={(name) =>
                  updateDraft((content) => ({
                    ...content,
                    basicInfo: { ...content.basicInfo, name },
                  }))
                }
              />
              <ChoiceQuestionEditor
                title="性别"
                question={draft.basicInfo.gender}
                onChange={(gender) =>
                  updateDraft((content) => ({
                    ...content,
                    basicInfo: { ...content.basicInfo, gender },
                  }))
                }
              />
              <TextQuestionEditor
                title="电话"
                question={draft.basicInfo.phone}
                onChange={(phone) =>
                  updateDraft((content) => ({
                    ...content,
                    basicInfo: { ...content.basicInfo, phone },
                  }))
                }
              />
              <TextQuestionEditor
                title="年龄"
                question={draft.basicInfo.age}
                onChange={(age) =>
                  updateDraft((content) => ({
                    ...content,
                    basicInfo: { ...content.basicInfo, age },
                  }))
                }
              />
              <TextQuestionEditor
                title="职业"
                question={draft.basicInfo.job}
                onChange={(job) =>
                  updateDraft((content) => ({
                    ...content,
                    basicInfo: { ...content.basicInfo, job },
                  }))
                }
              />
              <TextQuestionEditor
                title="现居城市"
                question={draft.basicInfo.city}
                onChange={(city) =>
                  updateDraft((content) => ({
                    ...content,
                    basicInfo: { ...content.basicInfo, city },
                  }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="二、养猫经验"
            desc="“原住民是否绝育”的显示条件固定依赖原住民选项 ID yes，不依赖显示文案。"
            open={openPanels.catExperience}
            onToggle={() => togglePanel("catExperience")}
          >
            <div className="grid gap-4">
              <ChoiceQuestionEditor
                title="是否有养猫经验"
                question={draft.catExperience.experience}
                onChange={(experience) =>
                  updateDraft((content) => ({
                    ...content,
                    catExperience: { ...content.catExperience, experience },
                  }))
                }
              />
              <ChoiceQuestionEditor
                title="家里是否有原住民"
                question={draft.catExperience.residents}
                onChange={(residents) =>
                  updateDraft((content) => ({
                    ...content,
                    catExperience: { ...content.catExperience, residents },
                  }))
                }
              />
              <ChoiceQuestionEditor
                title="原住民是否绝育"
                question={draft.catExperience.residentsNeutered}
                onChange={(residentsNeutered) =>
                  updateDraft((content) => ({
                    ...content,
                    catExperience: { ...content.catExperience, residentsNeutered },
                  }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="三、居住与家庭环境"
            desc="只编辑题目和选项展示文字；不会改变题型、顺序和必填状态。"
            open={openPanels.livingEnvironment}
            onToggle={() => togglePanel("livingEnvironment")}
          >
            <div className="grid gap-4">
              <ChoiceQuestionEditor
                title="是否有小孩"
                question={draft.livingEnvironment.hasKids}
                onChange={(hasKids) =>
                  updateDraft((content) => ({
                    ...content,
                    livingEnvironment: { ...content.livingEnvironment, hasKids },
                  }))
                }
              />
              <ChoiceQuestionEditor
                title="租房与房东同意情况"
                question={draft.livingEnvironment.housing}
                onChange={(housing) =>
                  updateDraft((content) => ({
                    ...content,
                    livingEnvironment: { ...content.livingEnvironment, housing },
                  }))
                }
              />
              <ChoiceQuestionEditor
                title="住房是否封窗"
                question={draft.livingEnvironment.windowSealed}
                onChange={(windowSealed) =>
                  updateDraft((content) => ({
                    ...content,
                    livingEnvironment: { ...content.livingEnvironment, windowSealed },
                  }))
                }
              />
              <ChoiceQuestionEditor
                title="家庭成员或室友是否同意"
                question={draft.livingEnvironment.familyAgree}
                onChange={(familyAgree) =>
                  updateDraft((content) => ({
                    ...content,
                    livingEnvironment: { ...content.livingEnvironment, familyAgree },
                  }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="四、选猫偏好"
            desc="文本题可编辑 placeholder；placeholder 为空时用户端不显示 placeholder。"
            open={openPanels.catPreference}
            onToggle={() => togglePanel("catPreference")}
          >
            <div className="grid gap-4">
              <ChoiceQuestionEditor
                title="想要公猫 or 母猫"
                question={draft.catPreference.wantGender}
                onChange={(wantGender) =>
                  updateDraft((content) => ({
                    ...content,
                    catPreference: { ...content.catPreference, wantGender },
                  }))
                }
              />
              <TextQuestionEditor
                title="想要幼猫颜色"
                question={draft.catPreference.wantColor}
                onChange={(wantColor) =>
                  updateDraft((content) => ({
                    ...content,
                    catPreference: { ...content.catPreference, wantColor },
                  }))
                }
              />
              <TextQuestionEditor
                title="接受的价格范围"
                question={draft.catPreference.budget}
                onChange={(budget) =>
                  updateDraft((content) => ({
                    ...content,
                    catPreference: { ...content.catPreference, budget },
                  }))
                }
              />
              <ChoiceQuestionEditor
                title="能否接受绝育"
                question={draft.catPreference.acceptNeuter}
                onChange={(acceptNeuter) =>
                  updateDraft((content) => ({
                    ...content,
                    catPreference: { ...content.catPreference, acceptNeuter },
                  }))
                }
              />
              <ChoiceQuestionEditor
                title="每个月给猫支出范围"
                question={draft.catPreference.monthlySpend}
                onChange={(monthlySpend) =>
                  updateDraft((content) => ({
                    ...content,
                    catPreference: { ...content.catPreference, monthlySpend },
                  }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="五、饲养理念与承诺"
            desc="三条承诺问题正文和共用选项文案可编辑；问题数量、顺序和必填状态固定。"
            open={openPanels.commitments}
            onToggle={() => togglePanel("commitments")}
          >
            <div className="grid gap-3">
              <TextareaField
                label="承诺问题 1"
                value={draft.commitments.scientificFeeding}
                rows={4}
                onChange={(scientificFeeding) =>
                  updateDraft((content) => ({
                    ...content,
                    commitments: { ...content.commitments, scientificFeeding },
                  }))
                }
              />
              <TextareaField
                label="承诺问题 2"
                value={draft.commitments.acceptActive}
                rows={4}
                onChange={(acceptActive) =>
                  updateDraft((content) => ({
                    ...content,
                    commitments: { ...content.commitments, acceptActive },
                  }))
                }
              />
              <TextareaField
                label="承诺问题 3"
                value={draft.commitments.commitment}
                rows={4}
                onChange={(commitment) =>
                  updateDraft((content) => ({
                    ...content,
                    commitments: { ...content.commitments, commitment },
                  }))
                }
              />
              <OptionLabelsEditor
                options={draft.commitments.options}
                onChange={(options) =>
                  updateDraft((content) => ({
                    ...content,
                    commitments: { ...content.commitments, options },
                  }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            title="底部 PS"
            desc="PS 为空时用户端隐藏底部 PS。"
            open={openPanels.outro}
            onToggle={() => togglePanel("outro")}
          >
            <TextareaField
              label="PS 文案"
              value={draft.ps}
              rows={3}
              onChange={(ps) => updateDraft((content) => ({ ...content, ps }))}
            />
          </EditorSection>

          <EditorSection
            title="提交成功页"
            desc="成功标题为空时回退默认标题；成功说明为空时隐藏说明文字。"
            open={openPanels.success}
            onToggle={() => togglePanel("success")}
          >
            <div className="grid gap-3">
              <TextField
                label="提交成功标题"
                value={draft.successTitle}
                onChange={(successTitle) =>
                  updateDraft((content) => ({ ...content, successTitle }))
                }
              />
              <TextareaField
                label="提交成功说明"
                value={draft.successBody}
                rows={3}
                onChange={(successBody) => updateDraft((content) => ({ ...content, successBody }))}
              />
            </div>
          </EditorSection>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-6">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-heading">实时预览</p>
              <EditorButton tone="quiet" onClick={openDraftPreview}>
                新标签页
              </EditorButton>
            </div>
            <QuestionnaireView content={draft} preview />
          </div>
        </aside>
      </div>

      {mobilePreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-3">
            <p className="text-[13px] font-semibold text-heading">选猫问卷预览</p>
            <EditorButton tone="quiet" onClick={() => setMobilePreviewOpen(false)}>
              关闭
            </EditorButton>
          </div>
          <QuestionnaireView content={draft} />
        </div>
      )}
    </>
  );
}

function TextQuestionEditor({
  title,
  question,
  onChange,
}: {
  title: string;
  question: QuestionnaireTextQuestion;
  onChange: (question: QuestionnaireTextQuestion) => void;
}) {
  return (
    <div className="grid gap-2 rounded-[6px] border border-border/80 bg-background p-3">
      <p className="text-[12px] font-semibold text-heading lg:text-[13px]">{title}</p>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <TextField
          label="题目显示文字"
          value={question.label}
          onChange={(label) => onChange({ ...question, label })}
        />
        <TextField
          label="placeholder"
          value={question.placeholder}
          onChange={(placeholder) => onChange({ ...question, placeholder })}
        />
      </div>
    </div>
  );
}

function ChoiceQuestionEditor<TId extends string>({
  title,
  question,
  onChange,
}: {
  title: string;
  question: QuestionnaireChoiceQuestion<TId>;
  onChange: (question: QuestionnaireChoiceQuestion<TId>) => void;
}) {
  return (
    <div className="grid gap-2 rounded-[6px] border border-border/80 bg-background p-3">
      <p className="text-[12px] font-semibold text-heading lg:text-[13px]">{title}</p>
      <TextField
        label="题目显示文字"
        value={question.label}
        onChange={(label) => onChange({ ...question, label })}
      />
      <OptionLabelsEditor
        options={question.options}
        onChange={(options) => onChange({ ...question, options })}
      />
    </div>
  );
}

function OptionLabelsEditor<TId extends string>({
  options,
  onChange,
}: {
  options: QuestionnaireChoiceOption<TId>[];
  onChange: (options: QuestionnaireChoiceOption<TId>[]) => void;
}) {
  const updateOption = (id: TId, label: string) => {
    onChange(options.map((option) => (option.id === id ? { ...option, label } : option)));
  };

  return (
    <div className="grid gap-2">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">选项显示文字</span>
      <div className="grid gap-2 md:grid-cols-2">
        {options.map((option) => (
          <label key={option.id} className="grid gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              固定 ID：{option.id}
            </span>
            <input
              value={option.label}
              onChange={(event) => updateOption(option.id, event.target.value)}
              className="h-9 rounded-[7px] border border-border bg-card px-3 text-[13px] outline-none focus:border-primary"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
