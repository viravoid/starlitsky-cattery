import type { SelectionApplicationAnswers } from "@starlitsky/shared";
import { getFixedPage, submitSelectionApplication } from "../../utils/public-content/index";
import {
  DEFAULT_QUESTIONNAIRE_CONTENT,
  normalizeQuestionnaireContent,
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
  inputType?: string;
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
  showRetry: boolean;
  submitted: boolean;
  successBody: string;
  successTitle: string;
  values: SelectionApplicationAnswers;
}

interface QuestionnairePage {
  data: QuestionnaireData;
  loadQuestionnaireContent(): Promise<void>;
  onSubmit(): Promise<void>;
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
    showRetry: false,
    submitted: false,
    successBody: CONTENT.successBody,
    successTitle: CONTENT.successTitle,
    values: createBlankValues(),
  } as QuestionnaireData,

  async onLoad(this: QuestionnairePage) {
    await this.loadQuestionnaireContent();
  },

  async loadQuestionnaireContent(this: QuestionnairePage) {
    try {
      const page = await getFixedPage("questionnaire");
      const content = normalizeQuestionnaireContent(page.contentJson);
      this.setData({
        groups: createGroups(content),
        intro: content.intro,
        privacyNotice: content.privacyNotice,
        ps: content.ps,
        successBody: content.successBody,
        successTitle: content.successTitle,
      });
    } catch {
      this.setData({ error: "" });
    }
  },

  onInput(this: QuestionnairePage, event: InputEvent) {
    const key = event.currentTarget.dataset.key as FieldKey;
    this.setData({
      error: this.data.showRetry ? this.data.error : "",
      errors: { ...this.data.errors, [key]: "" },
      showRetry: this.data.showRetry,
      values: { ...this.data.values, [key]: event.detail.value },
    });
  },

  onChoice(this: QuestionnairePage, event: InputEvent) {
    const key = event.currentTarget.dataset.key as FieldKey;
    const nextErrors = {
      ...this.data.errors,
      [key]: "",
      ...(key === "residents" && event.detail.value !== "yes" ? { residentsNeutered: "" } : {}),
    };
    const nextValues = {
      ...this.data.values,
      [key]: event.detail.value,
      ...(key === "residents" && event.detail.value !== "yes" ? { residentsNeutered: "" } : {}),
    };
    this.setData({
      error: this.data.showRetry ? this.data.error : "",
      errors: nextErrors,
      showRetry: this.data.showRetry,
      values: nextValues,
    });
  },

  async onSubmit(this: QuestionnairePage) {
    if (this.data.isSubmitting) return;

    const errors = validateValues(this.data.values, this.data.groups);
    if (Object.keys(errors).length > 0) {
      this.setData({ errors, error: getValidationSummary(errors), showRetry: false });
      return;
    }

    await submitCurrent(this);
  },

  async retrySubmit(this: QuestionnairePage) {
    if (this.data.isSubmitting || this.data.submitted) return;
    await this.onSubmit();
  },

  resetForm(this: QuestionnairePage) {
    this.setData({
      clientDedupKey: createClientDedupKey(),
      error: "",
      errors: {},
      showRetry: false,
      submitted: false,
      values: createBlankValues(),
    });
  },
});

async function submitCurrent(page: QuestionnairePage) {
  page.setData({ error: "", isSubmitting: true, showRetry: false });
  try {
    await submitSelectionApplication({
      ...page.data.values,
      clientDedupKey: page.data.clientDedupKey,
    });
    page.setData({ error: "", isSubmitting: false, showRetry: false, submitted: true });
  } catch (error) {
    page.setData({
      error: getErrorMessage(error),
      isSubmitting: false,
      showRetry: true,
    });
  }
}

function validateValues(values: SelectionApplicationAnswers, groups: QuestionGroup[]) {
  const errors: Partial<Record<FieldKey, string>> = {};
  const questions = groups.flatMap((group) => group.questions);
  for (const key of REQUIRED_FIELDS) {
    if (!values[key]?.trim()) {
      const question = questions.find((item) => item.key === key);
      errors[key] = getRequiredMessage(question);
    }
  }
  if (values.residents === "yes" && !values.residentsNeutered?.trim()) {
    errors.residentsNeutered = getRequiredMessage(
      questions.find((question) => question.key === "residentsNeutered"),
    );
  }
  if (values.phone && !/^1\d{10}$/.test(values.phone)) {
    errors.phone = "请输入正确的 11 位手机号";
  }
  return errors;
}

function getRequiredMessage(question: Question | undefined) {
  if (!question) return "必填";
  if (question.type === "commitment") return "请选择是否接受";
  return question.type === "text" || question.type === "textarea"
    ? `请填写${question.label}`
    : `请选择${question.label}`;
}

function getValidationSummary(errors: Partial<Record<FieldKey, string>>) {
  const onlyPhoneInvalid =
    Object.keys(errors).length === 1 && errors.phone === "请输入正确的 11 位手机号";
  return onlyPhoneInvalid ? "请检查填写内容" : "请先补充必填信息";
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
  const inputType = key === "phone" || key === "age" ? "number" : "text";
  return {
    inputType,
    key,
    label: question.label,
    placeholder: question.placeholder,
    required: true,
    type: "text",
  };
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
