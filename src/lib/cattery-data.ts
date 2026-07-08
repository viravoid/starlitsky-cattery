export const WECHAT_ID = "xingyuemianyinmao";

export const SOCIALS = [
  { label: "微信号", value: "xingyuemianyinmao" },
  { label: "小红书", value: "StarlitSky星月缅因猫舍" },
  { label: "微博", value: "星月缅因猫舍" },
  { label: "抖音", value: "星月家的猫" },
  { label: "小猫日常号", value: "月七的小猫存档" },
];

export type StudCategory = "现役公猫" | "预备役公猫" | "现役母猫" | "退役种猫";

export interface Stud {
  name: string;
  color: string;
  role: string;
  category: StudCategory;
  trait: string;
}

export const STUDS: Stud[] = [
  { name: "重楼", color: "红虎斑 d22", role: "现役公猫 / 半退役", category: "现役公猫", trait: "体格宽大，气质沉稳" },
  { name: "琥珀", color: "棕虎斑麻纹加白 n2509", role: "现役公猫", category: "现役公猫", trait: "骨量足，纹路清晰" },
  { name: "水龙吟", color: "黑银鱼骨纹 ns23", role: "现役公猫", category: "现役公猫", trait: "银度高，性格温柔" },
  { name: "天河", color: "银虎斑加白 ns2203", role: "现役公猫", category: "现役公猫", trait: "大方亲人，表情甜" },
  { name: "三明治", color: "棕虎斑 n22", role: "预备役公猫", category: "预备役公猫", trait: "潜力款，正在成长" },
  { name: "云母", color: "黑银麻纹加白 ns2503", role: "现役母猫", category: "现役母猫", trait: "五官柔和，母性强" },
  { name: "尿团", color: "银玳瑁虎斑 fs22", role: "现役母猫", category: "现役母猫", trait: "颜色特别，活泼" },
  { name: "桂花糕", color: "玳瑁麻纹加白 f2509", role: "现役母猫", category: "现役母猫", trait: "花色甜美，亲人" },
  { name: "昭月", color: "黑银鱼骨纹 ns23", role: "现役母猫", category: "现役母猫", trait: "纹路利落，安静" },
  { name: "惊蛰", color: "蓝银虎斑 as22", role: "现役母猫", category: "现役母猫", trait: "蓝调稀有，优雅" },
  { name: "小熊猫", color: "棕麻纹加白 n2509", role: "现役母猫", category: "现役母猫", trait: "圆脸，表情丰富" },
  { name: "云玥", color: "银玳瑁虎斑 fs22", role: "现役母猫", category: "现役母猫", trait: "色块干净，稳重" },
  { name: "小虾线", color: "银玳瑁麻纹 fs25", role: "现役母猫", category: "现役母猫", trait: "年轻小母，灵动" },
  { name: "玛瑙", color: "玳瑁虎斑加白 f2209", role: "现役母猫", category: "现役母猫", trait: "加白匀称，甜美" },
  { name: "小边牧", color: "玳瑁虎斑 f22", role: "现役母猫", category: "现役母猫", trait: "花纹俏皮，亲人" },
  { name: "小桃", color: "玳瑁麻纹 f25", role: "现役母猫", category: "现役母猫", trait: "粉嫩气质，温柔" },
];

export type KittenStatus = "在售" | "观察中" | "已预订" | "已售" | "咨询价格";

export interface Kitten {
  id: string;
  name: string;
  gender: string;
  color: string;
  birthday: string;
  parents: string;
  status: KittenStatus;
  price: string;
  personality: string;
}

export const KITTENS: Kitten[] = [
  {
    id: "kitten-a",
    name: "示例小猫 A（缺少当前在售小猫资料）",
    gender: "妹妹",
    color: "示例文字（缺少颜色）",
    birthday: "示例文字（缺少生日）",
    parents: "示例文字（缺少父母信息）",
    status: "观察中",
    price: "示例文字（缺少价格）",
    personality: "示例文字（缺少性格介绍）",
  },
  {
    id: "kitten-b",
    name: "示例小猫 B（缺少当前在售小猫资料）",
    gender: "弟弟",
    color: "示例文字（缺少颜色）",
    birthday: "示例文字（缺少生日）",
    parents: "示例文字（缺少父母信息）",
    status: "在售",
    price: "示例文字（缺少价格）",
    personality: "示例文字（缺少性格介绍）",
  },
  {
    id: "kitten-c",
    name: "示例小猫 C（缺少当前在售小猫资料）",
    gender: "妹妹",
    color: "示例文字（缺少颜色）",
    birthday: "示例文字（缺少生日）",
    parents: "示例文字（缺少父母信息）",
    status: "已预订",
    price: "示例文字（缺少价格）",
    personality: "示例文字（缺少性格介绍）",
  },
];

export function statusTone(status: KittenStatus) {
  switch (status) {
    case "在售":
      return "sky";
    case "观察中":
      return "sunny";
    case "已预订":
      return "violet";
    case "已售":
      return "warm";
    default:
      return "warm";
  }
}

// ── Questionnaire submissions (admin only) ────────────────────
export type FormStatus =
  | "未查看"
  | "已联系"
  | "适合继续沟通"
  | "暂不合适"
  | "已完成";

export const FORM_STATUSES: FormStatus[] = [
  "未查看",
  "已联系",
  "适合继续沟通",
  "暂不合适",
  "已完成",
];

export interface FormEntry {
  id: string;
  time: string;
  name: string;
  gender: string;
  phone: string;
  age: string;
  job: string;
  city: string;
  experience: string; // 是否有养猫经验
  residents: string; // 家里是否有原住民
  residentsNeutered: string; // 原住民是否绝育
  hasKids: string;
  housing: string;
  windowSealed: string;
  familyAgree: string;
  wantGender: string;
  wantColor: string;
  budget: string;
  acceptNeuter: string;
  monthlySpend: string;
  scientificFeeding: string;
  acceptActive: string;
  commitment: string;
  status: FormStatus;
}

export const FORM_ENTRIES: FormEntry[] = [
  {
    id: "form-1",
    time: "2026-07-06 21:14",
    name: "示例文字（缺少姓名）",
    gender: "女",
    phone: "138****0000",
    age: "28",
    job: "示例文字（缺少职业）",
    city: "西安",
    experience: "有",
    residents: "有",
    residentsNeutered: "已绝育",
    hasKids: "没有",
    housing: "自有住房",
    windowSealed: "已封窗",
    familyAgree: "全部同意",
    wantGender: "母猫",
    wantColor: "银虎斑、玳瑁都可以",
    budget: "1w-2w",
    acceptNeuter: "能接受",
    monthlySpend: "500-1000",
    scientificFeeding: "能接受",
    acceptActive: "能接受",
    commitment: "能接受",
    status: "未查看",
  },
  {
    id: "form-2",
    time: "2026-07-04 10:32",
    name: "示例文字（缺少姓名）",
    gender: "男",
    phone: "159****8888",
    age: "34",
    job: "示例文字（缺少职业）",
    city: "成都",
    experience: "没有",
    residents: "没有",
    residentsNeutered: "暂不适用",
    hasKids: "有",
    housing: "租房，房东同意养猫",
    windowSealed: "暂未封窗但可以封",
    familyAgree: "全部同意",
    wantGender: "都可以",
    wantColor: "棕虎斑",
    budget: "2w-3w",
    acceptNeuter: "能接受",
    monthlySpend: "1000 以上",
    scientificFeeding: "需要进一步了解",
    acceptActive: "能接受",
    commitment: "能接受",
    status: "已联系",
  },
  {
    id: "form-3",
    time: "2026-07-01 16:05",
    name: "示例文字（缺少姓名）",
    gender: "女",
    phone: "186****2233",
    age: "26",
    job: "示例文字（缺少职业）",
    city: "上海",
    experience: "有",
    residents: "有",
    residentsNeutered: "部分绝育",
    hasKids: "没有",
    housing: "租房，尚未确认",
    windowSealed: "无法封窗",
    familyAgree: "部分同意",
    wantGender: "咨询现猫，暂不填写",
    wantColor: "都可以",
    budget: "可根据小猫情况沟通",
    acceptNeuter: "能接受",
    monthlySpend: "500-1000",
    scientificFeeding: "能接受",
    acceptActive: "需要进一步了解",
    commitment: "能接受",
    status: "适合继续沟通",
  },
];

export function formStatusTone(status: FormStatus) {
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
