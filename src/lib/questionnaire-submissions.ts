import {
  DEFAULT_QUESTIONNAIRE_CONTENT,
  type QuestionnaireContent,
} from "./questionnaire-content";

export type QuestionnaireSubmissionStatus =
  | "未查看"
  | "已联系"
  | "适合继续沟通"
  | "暂不合适"
  | "已完成";

export const QUESTIONNAIRE_SUBMISSION_STATUSES: QuestionnaireSubmissionStatus[] = [
  "未查看",
  "已联系",
  "适合继续沟通",
  "暂不合适",
  "已完成",
];

export type QuestionnaireSubmissionFieldKey =
  | "name"
  | "gender"
  | "phone"
  | "age"
  | "job"
  | "city"
  | "experience"
  | "residents"
  | "residentsNeutered"
  | "hasKids"
  | "housing"
  | "windowSealed"
  | "familyAgree"
  | "wantGender"
  | "wantColor"
  | "budget"
  | "acceptNeuter"
  | "monthlySpend"
  | "scientificFeeding"
  | "acceptActive"
  | "commitment";

export type QuestionnaireSubmissionValues = Record<QuestionnaireSubmissionFieldKey, string>;

export interface QuestionnaireTextAnswerSnapshot {
  type: "text";
  questionLabel: string;
  value: string;
}

export interface QuestionnaireChoiceAnswerSnapshot {
  type: "choice";
  questionLabel: string;
  value: string;
  label: string;
}

export type QuestionnaireAnswerSnapshot =
  | QuestionnaireTextAnswerSnapshot
  | QuestionnaireChoiceAnswerSnapshot;

export type QuestionnaireSubmissionAnswers = Record<
  QuestionnaireSubmissionFieldKey,
  QuestionnaireAnswerSnapshot
>;

export interface QuestionnaireSubmission {
  id: string;
  submittedAt: string;
  status: QuestionnaireSubmissionStatus;
  adminNote?: string;
  answers: QuestionnaireSubmissionAnswers;
}

export type QuestionnaireValidationErrors = Partial<
  Record<QuestionnaireSubmissionFieldKey, string>
>;

type FieldType = "text" | "choice";
type FieldGroup = {
  id: "basicInfo" | "catExperience" | "livingEnvironment" | "catPreference" | "commitments";
  title: string;
  fields: QuestionnaireSubmissionFieldKey[];
};

type ChoiceMap = Record<QuestionnaireSubmissionFieldKey, Record<string, string>>;
type QuestionLabelMap = Record<QuestionnaireSubmissionFieldKey, string>;
type FieldTypeMap = Record<QuestionnaireSubmissionFieldKey, FieldType>;

export const QUESTIONNAIRE_FIELD_GROUPS: FieldGroup[] = [
  {
    id: "basicInfo",
    title: "一、基本信息",
    fields: ["name", "gender", "phone", "age", "job", "city"],
  },
  {
    id: "catExperience",
    title: "二、养猫经验",
    fields: ["experience", "residents", "residentsNeutered"],
  },
  {
    id: "livingEnvironment",
    title: "三、居住与家庭环境",
    fields: ["hasKids", "housing", "windowSealed", "familyAgree"],
  },
  {
    id: "catPreference",
    title: "四、选猫偏好",
    fields: ["wantGender", "wantColor", "budget", "acceptNeuter", "monthlySpend"],
  },
  {
    id: "commitments",
    title: "五、饲养理念与承诺",
    fields: ["scientificFeeding", "acceptActive", "commitment"],
  },
];

export const QUESTIONNAIRE_FIELD_ORDER = QUESTIONNAIRE_FIELD_GROUPS.flatMap((group) => group.fields);

const QUESTIONNAIRE_FIELD_TYPES: FieldTypeMap = {
  name: "text",
  gender: "choice",
  phone: "text",
  age: "text",
  job: "text",
  city: "text",
  experience: "choice",
  residents: "choice",
  residentsNeutered: "choice",
  hasKids: "choice",
  housing: "choice",
  windowSealed: "choice",
  familyAgree: "choice",
  wantGender: "choice",
  wantColor: "text",
  budget: "text",
  acceptNeuter: "choice",
  monthlySpend: "choice",
  scientificFeeding: "choice",
  acceptActive: "choice",
  commitment: "choice",
};

const REQUIRED_FIELDS = new Set<QuestionnaireSubmissionFieldKey>([
  "name",
  "gender",
  "phone",
  "age",
  "job",
  "city",
  "experience",
  "residents",
  "hasKids",
  "housing",
  "windowSealed",
  "familyAgree",
  "wantGender",
  "wantColor",
  "budget",
  "acceptNeuter",
  "monthlySpend",
  "scientificFeeding",
  "acceptActive",
  "commitment",
]);

const BLANK_VALUES = createBlankValues();

const DEFAULT_LABELS = buildQuestionLabelMap(DEFAULT_QUESTIONNAIRE_CONTENT);
const DEFAULT_CHOICES = buildChoiceMap(DEFAULT_QUESTIONNAIRE_CONTENT);

export function createBlankQuestionnaireValues(): QuestionnaireSubmissionValues {
  return { ...BLANK_VALUES };
}

export function createQuestionnaireSubmissionValues(
  value: Partial<Record<QuestionnaireSubmissionFieldKey, string>> | undefined,
): QuestionnaireSubmissionValues {
  return QUESTIONNAIRE_FIELD_ORDER.reduce((acc, key) => {
    acc[key] = normalizeAnswerValue(value?.[key]);
    return acc;
  }, createBlankQuestionnaireValues());
}

export function validateQuestionnaireValues(
  valuesInput: Partial<Record<QuestionnaireSubmissionFieldKey, string>>,
  content: QuestionnaireContent,
): QuestionnaireValidationErrors {
  const values = normalizeConditionalValues(createQuestionnaireSubmissionValues(valuesInput));
  const labels = buildQuestionLabelMap(content);
  const errors: QuestionnaireValidationErrors = {};

  for (const key of QUESTIONNAIRE_FIELD_ORDER) {
    if (!REQUIRED_FIELDS.has(key)) continue;
    if (values[key]) continue;
    const label = labels[key];
    errors[key] = QUESTIONNAIRE_FIELD_TYPES[key] === "choice" ? `请选择${label}` : `请填写${label}`;
  }

  if (values.residents === "yes" && !values.residentsNeutered) {
    errors.residentsNeutered = `请选择${labels.residentsNeutered}`;
  }

  if (values.phone && !/^1\d{10}$/.test(values.phone)) {
    errors.phone = "请输入正确的 11 位手机号";
  }

  return errors;
}

export function createQuestionnaireSubmissionAnswers(
  valuesInput: Partial<Record<QuestionnaireSubmissionFieldKey, string>>,
  content: QuestionnaireContent,
): QuestionnaireSubmissionAnswers {
  const values = normalizeConditionalValues(createQuestionnaireSubmissionValues(valuesInput));
  const labels = buildQuestionLabelMap(content);
  const choiceMap = buildChoiceMap(content);

  return QUESTIONNAIRE_FIELD_ORDER.reduce((acc, key) => {
    const value = values[key];
    if (QUESTIONNAIRE_FIELD_TYPES[key] === "choice") {
      acc[key] = {
        type: "choice",
        questionLabel: labels[key],
        value,
        label: value ? (choiceMap[key]?.[value] ?? "") : "",
      };
      return acc;
    }

    acc[key] = {
      type: "text",
      questionLabel: labels[key],
      value,
    };
    return acc;
  }, {} as QuestionnaireSubmissionAnswers);
}

export function normalizeQuestionnaireSubmission(value: unknown): QuestionnaireSubmission {
  const input = objectValue(value);
  const answersInput = objectValue(input.answers);

  return {
    id: optionalString(input.id, ""),
    submittedAt: optionalString(input.submittedAt, ""),
    status: normalizeQuestionnaireStatus(input.status),
    adminNote: normalizeOptionalText(optionalString(input.adminNote, undefined)),
    answers: QUESTIONNAIRE_FIELD_ORDER.reduce((acc, key) => {
      const answerInput = objectValue(answersInput[key]);
      if (QUESTIONNAIRE_FIELD_TYPES[key] === "choice") {
        const normalizedValue = normalizeAnswerValue(optionalString(answerInput.value, ""));
        acc[key] = {
          type: "choice",
          questionLabel: requiredString(
            answerInput.questionLabel,
            DEFAULT_LABELS[key],
          ),
          value: normalizedValue,
          label: requiredString(
            answerInput.label,
            normalizedValue ? (DEFAULT_CHOICES[key]?.[normalizedValue] ?? "") : "",
          ),
        };
        return acc;
      }

      acc[key] = {
        type: "text",
        questionLabel: requiredString(answerInput.questionLabel, DEFAULT_LABELS[key]),
        value: normalizeAnswerValue(optionalString(answerInput.value, "")),
      };
      return acc;
    }, {} as QuestionnaireSubmissionAnswers),
  };
}

export function getQuestionnaireAnswerDisplayValue(
  answer: QuestionnaireAnswerSnapshot,
  emptyLabel = "未填写",
) {
  const value = answer.type === "choice" ? answer.label : answer.value;
  return value.trim() || emptyLabel;
}

export function createQuestionnaireSubmissionFingerprint(
  answers: QuestionnaireSubmissionAnswers,
): string {
  return QUESTIONNAIRE_FIELD_ORDER.map((key) => `${key}:${serializeAnswer(answers[key])}`).join("|");
}

export function questionnaireSubmissionStatusTone(status: QuestionnaireSubmissionStatus) {
  switch (status) {
    case "未查看":
      return "warm";
    case "已联系":
      return "sky";
    case "适合继续沟通":
      return "violet";
    case "已完成":
      return "sunny";
    default:
      return "warm";
  }
}

function serializeAnswer(answer: QuestionnaireAnswerSnapshot) {
  return answer.type === "choice" ? answer.value : answer.value;
}

function normalizeConditionalValues(
  values: QuestionnaireSubmissionValues,
): QuestionnaireSubmissionValues {
  if (values.residents !== "yes") {
    return { ...values, residentsNeutered: "" };
  }
  return values;
}

function createBlankValues(): QuestionnaireSubmissionValues {
  return QUESTIONNAIRE_FIELD_ORDER.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {} as QuestionnaireSubmissionValues);
}

function buildQuestionLabelMap(content: QuestionnaireContent): QuestionLabelMap {
  return {
    name: content.basicInfo.name.label,
    gender: content.basicInfo.gender.label,
    phone: content.basicInfo.phone.label,
    age: content.basicInfo.age.label,
    job: content.basicInfo.job.label,
    city: content.basicInfo.city.label,
    experience: content.catExperience.experience.label,
    residents: content.catExperience.residents.label,
    residentsNeutered: content.catExperience.residentsNeutered.label,
    hasKids: content.livingEnvironment.hasKids.label,
    housing: content.livingEnvironment.housing.label,
    windowSealed: content.livingEnvironment.windowSealed.label,
    familyAgree: content.livingEnvironment.familyAgree.label,
    wantGender: content.catPreference.wantGender.label,
    wantColor: content.catPreference.wantColor.label,
    budget: content.catPreference.budget.label,
    acceptNeuter: content.catPreference.acceptNeuter.label,
    monthlySpend: content.catPreference.monthlySpend.label,
    scientificFeeding: content.commitments.scientificFeeding,
    acceptActive: content.commitments.acceptActive,
    commitment: content.commitments.commitment,
  };
}

function buildChoiceMap(content: QuestionnaireContent): ChoiceMap {
  return {
    name: {},
    gender: toOptionMap(content.basicInfo.gender.options),
    phone: {},
    age: {},
    job: {},
    city: {},
    experience: toOptionMap(content.catExperience.experience.options),
    residents: toOptionMap(content.catExperience.residents.options),
    residentsNeutered: toOptionMap(content.catExperience.residentsNeutered.options),
    hasKids: toOptionMap(content.livingEnvironment.hasKids.options),
    housing: toOptionMap(content.livingEnvironment.housing.options),
    windowSealed: toOptionMap(content.livingEnvironment.windowSealed.options),
    familyAgree: toOptionMap(content.livingEnvironment.familyAgree.options),
    wantGender: toOptionMap(content.catPreference.wantGender.options),
    wantColor: {},
    budget: {},
    acceptNeuter: toOptionMap(content.catPreference.acceptNeuter.options),
    monthlySpend: toOptionMap(content.catPreference.monthlySpend.options),
    scientificFeeding: toOptionMap(content.commitments.options),
    acceptActive: toOptionMap(content.commitments.options),
    commitment: toOptionMap(content.commitments.options),
  };
}

function toOptionMap(options: { id: string; label: string }[]) {
  return options.reduce(
    (acc, option) => {
      acc[option.id] = option.label;
      return acc;
    },
    {} as Record<string, string>,
  );
}

function normalizeQuestionnaireStatus(value: unknown): QuestionnaireSubmissionStatus {
  return QUESTIONNAIRE_SUBMISSION_STATUSES.includes(value as QuestionnaireSubmissionStatus)
    ? (value as QuestionnaireSubmissionStatus)
    : "未查看";
}

function normalizeAnswerValue(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function optionalString(value: unknown, fallback: string): string;
function optionalString(value: unknown, fallback: undefined): string | undefined;
function optionalString(value: unknown, fallback: string | undefined) {
  return typeof value === "string" ? value : fallback;
}

function requiredString(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return value.trim() ? value : fallback;
}
