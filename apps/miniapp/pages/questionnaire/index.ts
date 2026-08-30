import type { SelectionApplicationAnswers } from "@starlitsky/shared";
import { submitSelectionApplication } from "../../utils/public-content";

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
  type: "radio" | "text" | "textarea";
}

interface QuestionGroup {
  title: string;
  questions: Question[];
}

interface QuestionnaireData {
  clientDedupKey: string;
  error: string;
  errors: Partial<Record<FieldKey, string>>;
  groups: QuestionGroup[];
  isSubmitting: boolean;
  submitted: boolean;
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

const YES_NO_OPTIONS = [
  { label: "有", value: "yes" },
  { label: "没有", value: "no" },
];

const ACCEPT_OPTIONS = [
  { label: "能接受", value: "accept" },
  { label: "需要进一步了解", value: "needMoreInfo" },
  { label: "不能接受", value: "cannotAccept" },
];

const GROUPS: QuestionGroup[] = [
  {
    title: "一、基本信息",
    questions: [
      textQuestion("name", "真实姓名", "请输入真实姓名"),
      radioQuestion("gender", "性别", [
        { label: "女", value: "female" },
        { label: "男", value: "male" },
        { label: "其他", value: "other" },
        { label: "不便透露", value: "private" },
      ]),
      textQuestion("phone", "电话", "请输入手机号"),
      textQuestion("age", "年龄", "请输入年龄"),
      textQuestion("job", "职业", "请输入职业"),
      textQuestion("city", "现居城市", "例如：西安"),
    ],
  },
  {
    title: "二、养猫经验",
    questions: [
      radioQuestion("experience", "是否有养猫经验", YES_NO_OPTIONS),
      radioQuestion("residents", "家里是否有原住民", YES_NO_OPTIONS),
      radioQuestion("residentsNeutered", "原住民是否绝育", [
        { label: "已绝育", value: "neutered" },
        { label: "未绝育", value: "notNeutered" },
        { label: "部分绝育", value: "partiallyNeutered" },
        { label: "暂不适用", value: "notApplicable" },
      ], false),
    ],
  },
  {
    title: "三、居住与家庭环境",
    questions: [
      radioQuestion("hasKids", "是否有小孩", YES_NO_OPTIONS),
      radioQuestion("housing", "是否租房，如果租房房东是否同意养猫", [
        { label: "自有住房", value: "owned" },
        { label: "租房，房东同意养猫", value: "rentApproved" },
        { label: "租房，尚未确认", value: "rentUnconfirmed" },
        { label: "租房，房东不同意", value: "rentRejected" },
      ]),
      radioQuestion("windowSealed", "住房是否有封窗", [
        { label: "已封窗", value: "sealed" },
        { label: "暂未封窗但可以封", value: "canSeal" },
        { label: "无法封窗", value: "cannotSeal" },
      ]),
      radioQuestion("familyAgree", "家庭成员或室友是否同意养猫", [
        { label: "全部同意", value: "allAgree" },
        { label: "部分同意", value: "partAgree" },
        { label: "尚未沟通", value: "notDiscussed" },
        { label: "不同意", value: "disagree" },
      ]),
    ],
  },
  {
    title: "四、选猫偏好",
    questions: [
      textareaQuestion("maineCoonKnowledge", "对缅因猫的了解", "可简单写写你了解的体型、活动量、护理需求等", false),
      radioQuestion("wantGender", "想要公猫 or 母猫（现猫无需填写）", [
        { label: "公猫", value: "male" },
        { label: "母猫", value: "female" },
        { label: "都可以", value: "either" },
        { label: "咨询现猫，暂不填写", value: "currentCat" },
      ]),
      textQuestion("wantColor", "想要幼猫颜色", "例如银虎斑、棕虎斑、玳瑁、都可以等"),
      textQuestion("budget", "接受的价格范围（现猫无需填写）", "例如 1w-2w、2w-3w、可根据小猫情况沟通等"),
      radioQuestion("acceptNeuter", "能否接受绝育", ACCEPT_OPTIONS),
      radioQuestion("monthlySpend", "每个月给猫支出范围", [
        { label: "300 以内", value: "under300" },
        { label: "300-500", value: "300to500" },
        { label: "500-1000", value: "500to1000" },
        { label: "1000 以上", value: "over1000" },
      ]),
    ],
  },
  {
    title: "五、饲养理念与承诺",
    questions: [
      radioQuestion(
        "scientificFeeding",
        "能否接受科学（天然粮 / 主食罐 / 生骨肉 / 熟自制）喂养，承诺不喂垃圾粮、不喂来源不明确的生肉",
        ACCEPT_OPTIONS,
      ),
      radioQuestion(
        "acceptActive",
        "小猫比较活泼，日常可能抓挠家具、咬线、玩闹误伤，能否接受",
        ACCEPT_OPTIONS,
      ),
      radioQuestion(
        "commitment",
        "是否承诺对小猫不离不弃，如无法继续饲养，会先与猫舍联系",
        ACCEPT_OPTIONS,
      ),
      textareaQuestion("additionalNote", "自由补充", "还有什么想告诉我们，或特别期待的小猫性格", false),
    ],
  },
];

const REQUIRED_FIELDS = GROUPS.flatMap((group) => group.questions)
  .filter((question) => question.required)
  .map((question) => question.key);

Page({
  data: {
    clientDedupKey: createClientDedupKey(),
    error: "",
    errors: {},
    groups: GROUPS,
    isSubmitting: false,
    submitted: false,
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

function textQuestion(key: FieldKey, label: string, placeholder: string): Question {
  return { key, label, placeholder, required: true, type: "text" };
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
  label: string,
  options: Option[],
  required = true,
): Question {
  return { key, label, options, required, type: "radio" };
}

function createClientDedupKey() {
  return `selection-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "问卷提交失败";
}
