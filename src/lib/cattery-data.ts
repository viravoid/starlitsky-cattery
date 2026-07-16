export const WECHAT_ID = "xingyuemianyinmao";

export const SOCIALS = [
  { label: "微信号", value: "xingyuemianyinmao" },
  { label: "小红书", value: "StarlitSky星月缅因猫舍" },
  { label: "微博", value: "星月缅因猫舍" },
  { label: "抖音", value: "星月家的猫" },
  { label: "小猫日常号", value: "月七的小猫存档" },
];

export type StudCategory = "现役公猫" | "现役母猫" | "预备役种猫";

export interface Stud {
  id: string;
  name: string;
  color: string;
  role: string;
  category: StudCategory;
  status: string; // 当前状态
  trait: string; // 简短一句话介绍（用于列表卡片）
  source: string; // 来源 / 血线
  story?: string[]; // 主理人完整介绍（自然分段）
}

const SRC = "示例文字（缺少来源 / 血线）";

function stud(
  id: string,
  name: string,
  color: string,
  role: string,
  category: StudCategory,
  status: string,
  trait: string,
  source: string = SRC,
  story?: string[],
): Stud {
  return { id, name, color, role, category, status, trait, source, story };
}

export const STUDS: Stud[] = [
  stud(
    "chonglou",
    "重楼",
    "红虎斑 d22",
    "现役公猫 / 半退役",
    "现役公猫",
    "半退役 · 在舍",
    "体格宽大，气质沉稳",
    "俄罗斯老牌猫舍",
    [
      "来自一家俄罗斯老牌猫舍，该猫舍主理人曾任国内 WCF 协会裁判，繁育的小猫结构细节都很出色。",
      "重楼头版强壮敦厚，额头饱满转折清晰，耳位端正耳朵又大又直，而且他也来自一条大体格血线，身体肌肉轮廓清晰强健有力，骨量优秀，体重接近二十斤，运动能力优秀，热爱跑跳和小猫玩。体检心脏、髋关节都很健康。",
      "与此同时他还有着非常温顺的性格，对人友好，喜欢陪小猫玩，对母猫也很温柔。",
      "他的风格比较符合我理想中甜美帅气结合的样子，尽管他身价不菲，但我还是毅然决然地接他回家。",
      "一转眼他已经打工四年啦，时间证明了结构优秀的种猫是不会过时的，他为我们留下了很多非常优秀的小猫。现在半退役生活在我家享受退役猫待遇，因为他不乱尿可以偶尔出来玩耍，在新房也给他准备了最大的公猫房~",
    ],
  ),
  stud("hupo", "琥珀", "棕虎斑麻纹加白 n2509", "现役公猫", "现役公猫", "在配", "骨量足，纹路清晰"),
  stud("shulongyin", "水龙吟", "黑银鱼骨纹 ns23", "现役公猫", "现役公猫", "在配", "银度高，性格温柔"),
  stud("tianhe", "天河", "银虎斑加白 ns2203", "现役公猫", "现役公猫", "在配", "大方亲人，表情甜"),
  stud("sanmingzhi", "三明治", "棕虎斑 n22", "预备役种猫", "预备役种猫", "成长中", "潜力款，正在成长"),
  stud("yunmu", "云母", "黑银麻纹加白 ns2503", "现役母猫", "现役母猫", "在舍", "五官柔和，母性强"),
  stud("niaotuan", "尿团", "银玳瑁虎斑 fs22", "现役母猫", "现役母猫", "在舍", "颜色特别，活泼"),
  stud("guihuagao", "桂花糕", "玳瑁麻纹加白 f2509", "现役母猫", "现役母猫", "在舍", "花色甜美，亲人"),
  stud("zhaoyue", "昭月", "黑银鱼骨纹 ns23", "现役母猫", "现役母猫", "在舍", "纹路利落，安静"),
  stud("jingzhe", "惊蛰", "蓝银虎斑 as22", "现役母猫", "现役母猫", "在舍", "蓝调稀有，优雅"),
  stud("xiongmao", "小熊猫", "棕麻纹加白 n2509", "现役母猫", "现役母猫", "在舍", "圆脸，表情丰富"),
  stud("yunyue", "云玥", "银玳瑁虎斑 fs22", "现役母猫", "现役母猫", "在舍", "色块干净，稳重"),
  stud("xiaoxiaxian", "小虾线", "银玳瑁麻纹 fs25", "现役母猫", "现役母猫", "成长中", "年轻小母，灵动"),
  stud("manao", "玛瑙", "玳瑁虎斑加白 f2209", "现役母猫", "现役母猫", "在舍", "加白匀称，甜美"),
  stud("xiaobianmu", "小边牧", "玳瑁虎斑 f22", "现役母猫", "现役母猫", "在舍", "花纹俏皮，亲人"),
  stud("xiaotao", "小桃", "玳瑁麻纹 f25", "现役母猫", "现役母猫", "成长中", "粉嫩气质，温柔"),
];


export type KittenStatus = "待找家" | "找家中" | "已有家";

export interface StructureRating {
  face: {
    eyes?: number;    // 0-6
    ears?: number;
    muzzle?: number;
    profile?: number;
  };
  body: {
    length?: number;
    build?: number;
    overall?: number;
  };
  allowHighlightStar?: boolean;
}

export interface Kitten {
  id: string;
  name: string;
  gender: string;
  color: string;
  birthday: string;
  father: string;
  mother: string;
  status: KittenStatus;
  price: string;
  litter?: string;
  personality: string;
  story?: string[]; // 主理人完整介绍（自然分段）
  structureRating?: StructureRating;
}

export const LITTERS = ["A窝", "B窝", "C窝"] as const;
export type Litter = (typeof LITTERS)[number];


export const KITTENS: Kitten[] = [
  {
    id: "kitten-a",
    name: "示例小猫 A（缺少当前在售小猫资料）",
    gender: "妹妹",
    color: "示例文字（缺少颜色）",
    birthday: "示例文字（缺少生日）",
    father: "示例文字（缺少父亲信息）",
    mother: "示例文字（缺少母亲信息）",
    status: "待找家",
    price: "示例文字（缺少价格）",
    litter: "A窝",
    personality: "示例文字（缺少性格介绍）",
    story: ["（示例文字：主理人的完整介绍待补充）"],

    structureRating: {
      face: { eyes: 5, ears: 6, muzzle: 6, profile: 5 },
      body: { length: 5, build: 5, overall: 5 },
      allowHighlightStar: true,
    },
  },
  {
    id: "kitten-b",
    name: "示例小猫 B（缺少当前在售小猫资料）",
    gender: "弟弟",
    color: "示例文字（缺少颜色）",
    birthday: "示例文字（缺少生日）",
    father: "示例文字（缺少父亲信息）",
    mother: "示例文字（缺少母亲信息）",
    status: "找家中",
    price: "示例文字（缺少价格）",
    litter: "B窝",
    personality: "示例文字（缺少性格介绍）",
    story: ["（示例文字：主理人的完整介绍待补充）"],

  },
  {
    id: "kitten-c",
    name: "示例小猫 C（缺少当前在售小猫资料）",
    gender: "妹妹",
    color: "示例文字（缺少颜色）",
    birthday: "示例文字（缺少生日）",
    father: "示例文字（缺少父亲信息）",
    mother: "示例文字（缺少母亲信息）",
    status: "已有家",
    price: "示例文字（缺少价格）",
    litter: "C窝",
    personality: "示例文字（缺少性格介绍）",
    story: ["（示例文字：主理人的完整介绍待补充）"],

  },
];

export function statusTone(status: KittenStatus) {
  switch (status) {
    case "待找家":
      return "sunny";
    case "找家中":
      return "sky";
    case "已有家":
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
