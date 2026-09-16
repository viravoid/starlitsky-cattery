import type { SelectionApplicationAnswers } from "@starlitsky/shared";
import { submitSelectionApplication } from "../../utils/public-content/index";
import {
  DEFAULT_QUESTIONNAIRE_CONTENT,
  type QuestionnaireChoiceOption,
  type QuestionnaireChoiceQuestion,
  type QuestionnaireContent,
  type QuestionnaireTextQuestion,
} from "../../utils/questionnaire-content/index";

type FieldKey = keyof SelectionApplicationAnswers;

interface Option {
  label: string;
  value: string;
}

interface Question {
  help?: string;
  key: FieldKey;
  label: string;
  options?: Option[];
  placeholder?: string;
  required?: boolean;
  type: "commitment" | "radio" | "text" | "textarea";
}

interface QuestionGroup {
  no: string;
  title: string;
  questions: Question[];
}

interface QuestionnaireData {
  clientDedupKey: string;
  error: string;
  errors: Partial<Record<FieldKey, string>>;
  groups: QuestionGroup[];
  intro: string;
  isSubmitting: boolean;
  privacyNotice: string;
  ps: string;
  submitted: boolean;
  successBody: string;
  successTitle: string;
  values: SelectionApplicationAnswers;
}

interface QuestionnairePage {
  data: QuestionnaireData;
  retrySubmit(): Promise<void>;
  setData(data: Partial<QuestionnaireData>): void;
}

interface InputEvent {
  currentTarget: {
    dataset: Record<string, string>;
  };
  detail: {
    value: string;
  };
}

const CONTENT = DEFAULT_QUESTIONNAIRE_CONTENT;
const GROUPS: QuestionGroup[] = createGroups(CONTENT);

const REQUIRED_FIELDS = GROUPS.flatMap((group) => group.questions)
  .filter((question) => question.required)
  .map((question) => question.key);

Page({
  data: {
    clientDedupKey: createClientDedupKey(),
    error: "",
    errors: {},
    groups: GROUPS,
    intro: CONTENT.intro,
    isSubmitting: false,
    privacyNotice: CONTENT.privacyNotice,
    ps: CONTENT.ps,
    submitted: false,
    successBody: CONTENT.successBody,
    successTitle: CONTENT.successTitle,
    values: createBlankValues(),
  } as QuestionnaireData,

  onInput(this: QuestionnairePage, event: InputEvent) {
    const key = event.currentTarget.dataset.key as FieldKey;
    this.setData({
      errors: { ...this.data.errors, [key]: "" },
      values: { ...this.data.values, [key]: event.detail.value },
    });
  },

  onChoice(this: QuestionnairePage, event: InputEvent) {
    const key = event.currentTarget.dataset.key as FieldKey;
    const nextValues = {
      ...this.data.values,
      [key]: event.detail.value,
      ...(key === "residents" && event.detail.value !== "yes" ? { residentsNeutered: "" } : {}),
    };
    this.setData({
      errors: { ...this.data.errors, [key]: "" },
      values: nextValues,
    });
  },

  async onSubmit(this: QuestionnairePage) {
    if (this.data.isSubmitting) return;

    const errors = validateValues(this.data.values);
    if (Object.keys(errors).length > 0) {
      this.setData({ errors, error: "请先补充必填信息" });
      return;
    }

    await submitCurrent(this);
  },

  async retrySubmit(this: QuestionnairePage) {
    if (this.data.isSubmitting || this.data.submitted) return;
    await submitCurrent(this);
  },

  resetForm(this: QuestionnairePage) {
    this.setData({
      clientDedupKey: createClientDedupKey(),
      error: "",
      errors: {},
      submitted: false,
      values: createBlankValues(),
    });
  },
});

async function submitCurrent(page: QuestionnairePage) {
  page.setData({ error: "", isSubmitting: true });
  try {
    await submitSelectionApplication({
      ...page.data.values,
      clientDedupKey: page.data.clientDedupKey,
    });
    page.setData({ error: "", isSubmitting: false, submitted: true });
  } catch (error) {
    page.setData({
      error: getErrorMessage(error),
      isSubmitting: false,
    });
  }
}

function validateValues(values: SelectionApplicationAnswers) {
  const errors: Partial<Record<FieldKey, string>> = {};
  for (const key of REQUIRED_FIELDS) {
    if (!values[key]?.trim()) {
      errors[key] = "必填";
    }
  }
  if (values.residents === "yes" && !values.residentsNeutered?.trim()) {
    errors.residentsNeutered = "必填";
  }
  if (values.phone && !/^1\d{10}$/.test(values.phone)) {
    errors.phone = "请输入正确的 11 位手机号";
  }
  return errors;
}

function createBlankValues(): SelectionApplicationAnswers {
  return {
    name: "",
    gender: "",
    phone: "",
    age: "",
    job: "",
    city: "",
    experience: "",
    residents: "",
    residentsNeutered: "",
    hasKids: "",
    housing: "",
    windowSealed: "",
    familyAgree: "",
    maineCoonKnowledge: "",
    wantGender: "",
    wantColor: "",
    budget: "",
    acceptNeuter: "",
    monthlySpend: "",
    scientificFeeding: "",
    acceptActive: "",
    commitment: "",
    additionalNote: "",
  };
}

function createGroups(content: QuestionnaireContent): QuestionGroup[] {
  return [
    {
      no: "一",
      title: "基本信息",
      questions: [
        textQuestion("name", content.basicInfo.name),
        radioQuestion("gender", content.basicInfo.gender),
        textQuestion("phone", content.basicInfo.phone),
        textQuestion("age", content.basicInfo.age),
        textQuestion("job", content.basicInfo.job),
        textQuestion("city", content.basicInfo.city),
      ],
    },
    {
      no: "二",
      title: "养猫经验",
      questions: [
        radioQuestion("experience", content.catExperience.experience),
        radioQuestion("residents", content.catExperience.residents),
        radioQuestion("residentsNeutered", content.catExperience.residentsNeutered, false),
      ],
    },
    {
      no: "三",
      title: "居住与家庭环境",
      questions: [
        radioQuestion("hasKids", content.livingEnvironment.hasKids),
        radioQuestion("housing", content.livingEnvironment.housing),
        radioQuestion("windowSealed", content.livingEnvironment.windowSealed),
        radioQuestion("familyAgree", content.livingEnvironment.familyAgree),
      ],
    },
    {
      no: "四",
      title: "选猫偏好",
      questions: [
        radioQuestion("wantGender", content.catPreference.wantGender),
        textQuestion("wantColor", content.catPreference.wantColor),
        textQuestion("budget", content.catPreference.budget),
        radioQuestion("acceptNeuter", content.catPreference.acceptNeuter),
        radioQuestion("monthlySpend", content.catPreference.monthlySpend),
      ],
    },
    {
      no: "五",
      title: "饲养理念与承诺",
      questions: [
        commitmentQuestion(
          "scientificFeeding",
          content.commitments.scientificFeeding,
          content.commitments.options,
        ),
        commitmentQuestion("acceptActive", content.commitments.acceptActive, content.commitments.options),
        commitmentQuestion("commitment", content.commitments.commitment, content.commitments.options),
      ],
    },
  ];
}

function textQuestion(key: FieldKey, question: QuestionnaireTextQuestion): Question {
  return { key, label: question.label, placeholder: question.placeholder, required: true, type: "text" };
}

function textareaQuestion(
  key: FieldKey,
  label: string,
  placeholder: string,
  required = true,
): Question {
  return { key, label, placeholder, required, type: "textarea" };
}

function radioQuestion(
  key: FieldKey,
  question: QuestionnaireChoiceQuestion,
  required = true,
): Question {
  return {
    key,
    label: question.label,
    options: question.options.map(toNativeOption),
    required,
    type: "radio",
  };
}

function commitmentQuestion(
  key: FieldKey,
  label: string,
  options: QuestionnaireChoiceOption[],
): Question {
  return {
    key,
    label,
    options: options.map(toNativeOption),
    required: true,
    type: "commitment",
  };
}

function toNativeOption(option: QuestionnaireChoiceOption): Option {
  return { label: option.label, value: option.id };
}

function createClientDedupKey() {
  return `selection-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "问卷提交失败";
}
