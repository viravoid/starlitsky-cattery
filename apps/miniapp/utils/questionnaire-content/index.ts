export interface QuestionnaireTextQuestion {
  label: string;
  placeholder: string;
}

export interface QuestionnaireChoiceOption {
  id: string;
  label: string;
}

export interface QuestionnaireChoiceQuestion {
  label: string;
  options: QuestionnaireChoiceOption[];
}

export interface QuestionnaireContent {
  version: 1;
  intro: string;
  privacyNotice: string;
  basicInfo: {
    name: QuestionnaireTextQuestion;
    gender: QuestionnaireChoiceQuestion;
    phone: QuestionnaireTextQuestion;
    age: QuestionnaireTextQuestion;
    job: QuestionnaireTextQuestion;
    city: QuestionnaireTextQuestion;
  };
  catExperience: {
    experience: QuestionnaireChoiceQuestion;
    residents: QuestionnaireChoiceQuestion;
    residentsNeutered: QuestionnaireChoiceQuestion;
  };
  livingEnvironment: {
    hasKids: QuestionnaireChoiceQuestion;
    housing: QuestionnaireChoiceQuestion;
    windowSealed: QuestionnaireChoiceQuestion;
    familyAgree: QuestionnaireChoiceQuestion;
  };
  catPreference: {
    wantGender: QuestionnaireChoiceQuestion;
    wantColor: QuestionnaireTextQuestion;
    budget: QuestionnaireTextQuestion;
    acceptNeuter: QuestionnaireChoiceQuestion;
    monthlySpend: QuestionnaireChoiceQuestion;
  };
  commitments: {
    scientificFeeding: string;
    acceptActive: string;
    commitment: string;
    options: QuestionnaireChoiceOption[];
  };
  ps: string;
  successTitle: string;
  successBody: string;
}

export const DEFAULT_QUESTIONNAIRE_CONTENT: QuestionnaireContent = {
  version: 1,
  intro:
    "正规猫舍双向选择～请有购买意向的朋友填写一下问卷，方便我们了解您，谢谢配合！这是一份双向选择问卷，用于帮助我们了解你的养猫环境、饲养理念与选猫需求。填写后，猫舍会根据情况与你进一步沟通。",
  privacyNotice: "以下信息仅用于猫舍双向选择与后续沟通，不会公开展示。",
  basicInfo: {
    name: { label: "真实姓名", placeholder: "请输入真实姓名" },
    gender: {
      label: "性别",
      options: [
        { id: "female", label: "女" },
        { id: "male", label: "男" },
        { id: "other", label: "其他" },
        { id: "private", label: "不便透露" },
      ],
    },
    phone: { label: "电话", placeholder: "请输入手机号" },
    age: { label: "年龄", placeholder: "请输入年龄" },
    job: { label: "职业", placeholder: "请输入职业" },
    city: { label: "现居城市", placeholder: "例如：西安" },
  },
  catExperience: {
    experience: {
      label: "是否有养猫经验",
      options: [
        { id: "yes", label: "有" },
        { id: "no", label: "没有" },
      ],
    },
    residents: {
      label: "家里是否有原住民",
      options: [
        { id: "yes", label: "有" },
        { id: "no", label: "没有" },
      ],
    },
    residentsNeutered: {
      label: "原住民是否绝育",
      options: [
        { id: "neutered", label: "已绝育" },
        { id: "notNeutered", label: "未绝育" },
        { id: "partiallyNeutered", label: "部分绝育" },
        { id: "notApplicable", label: "暂不适用" },
      ],
    },
  },
  livingEnvironment: {
    hasKids: {
      label: "是否有小孩",
      options: [
        { id: "yes", label: "有" },
        { id: "no", label: "没有" },
      ],
    },
    housing: {
      label: "是否租房，如果租房房东是否同意养猫",
      options: [
        { id: "owned", label: "自有住房" },
        { id: "rentApproved", label: "租房，房东同意养猫" },
        { id: "rentUnconfirmed", label: "租房，尚未确认" },
        { id: "rentRejected", label: "租房，房东不同意" },
      ],
    },
    windowSealed: {
      label: "住房是否有封窗",
      options: [
        { id: "sealed", label: "已封窗" },
        { id: "canSeal", label: "暂未封窗但可以封" },
        { id: "cannotSeal", label: "无法封窗" },
      ],
    },
    familyAgree: {
      label: "家庭成员或室友是否同意养猫",
      options: [
        { id: "allAgree", label: "全部同意" },
        { id: "partAgree", label: "部分同意" },
        { id: "notDiscussed", label: "尚未沟通" },
        { id: "disagree", label: "不同意" },
      ],
    },
  },
  catPreference: {
    wantGender: {
      label: "想要公猫 or 母猫（现猫无需填写）",
      options: [
        { id: "male", label: "公猫" },
        { id: "female", label: "母猫" },
        { id: "either", label: "都可以" },
        { id: "currentCat", label: "咨询现猫，暂不填写" },
      ],
    },
    wantColor: {
      label: "想要幼猫颜色",
      placeholder: "例如银虎斑、棕虎斑、玳瑁、都可以等",
    },
    budget: {
      label: "接受的价格范围（现猫无需填写）",
      placeholder: "例如 1w-2w、2w-3w、可根据小猫情况沟通等",
    },
    acceptNeuter: {
      label: "能否接受绝育",
      options: [
        { id: "accept", label: "能接受" },
        { id: "needMoreInfo", label: "需要进一步了解" },
        { id: "cannotAccept", label: "不能接受" },
      ],
    },
    monthlySpend: {
      label: "每个月给猫支出范围",
      options: [
        { id: "under300", label: "300 以内" },
        { id: "300to500", label: "300-500" },
        { id: "500to1000", label: "500-1000" },
        { id: "over1000", label: "1000 以上" },
      ],
    },
  },
  commitments: {
    scientificFeeding:
      "能否接受科学（天然粮 / 主食罐 / 生骨肉 / 熟自制）喂养，承诺不喂垃圾粮、不喂来源不明确的生肉",
    acceptActive: "小猫比较活泼，日常有可能会有抓挠家具、咬线、玩闹误伤等行为，能否接受",
    commitment:
      "是否承诺对小猫不离不弃，如遇不可抗因素无法继续饲养，必须与猫舍进行联系，猫舍有权知晓小猫未来的去向，能否接受",
    options: [
      { id: "accept", label: "能接受" },
      { id: "needMoreInfo", label: "需要进一步了解" },
      { id: "cannotAccept", label: "不能接受" },
    ],
  },
  ps: "PS：性别和颜色仅做了解，排队不分颜色窝次，不限选猫时间。",
  successTitle: "问卷已提交，感谢你的填写",
  successBody: "我们会尽快查看你的问卷，请耐心等待回复。",
};
