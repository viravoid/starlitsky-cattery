import type { TextListItem } from "./aftercare-content";

export type ProcessPriceCard = {
  id: string;
  label: string;
  value: string;
  note: string;
};

export type ProcessSimpleCard = {
  id: string;
  label: string;
  value: string;
};

export type ProcessStep = {
  id: string;
  title: string;
  description: string;
};

export type ProcessContent = {
  version: 1;
  pricingIntro: string;
  priceCards: ProcessPriceCard[];
  breedingIntro: string;
  breedingCards: ProcessSimpleCard[];
  returningFamiliesIntro: string;
  returningBenefits: ProcessSimpleCard[];
  steps: ProcessStep[];
  welcomeKitItems: TextListItem[];
  welcomeKitNote: string;
  contractNotice: string;
};

export const DEFAULT_PROCESS_CONTENT: ProcessContent = {
  version: 1,
  pricingIntro:
    "传统色 · 绝育小猫价格\n小猫8周后定价，从品相，体格，性格等方面综合评估，每只小猫找家都会有详细的介绍以及找家信息",
  priceCards: [
    {
      id: "process-price-pet",
      label: "宠物级",
      value: "10000 – 20000 元",
      note: "符合品标有少量扣分项或性格有些许瑕疵，社会化达标，身体健康。",
    },
    {
      id: "process-price-show",
      label: "赛级",
      value: "20000 – 30000 元",
      note: "符合品标无明显扣分项，性格同样非常好的小猫，参与比赛可以取得名次，社会化达标，身体健康。",
    },
    {
      id: "process-price-retired",
      label: "退役种猫",
      value: "0 – 10000 元",
      note: "老家长优先，退役种猫找家会严格审核，如无合适领养家庭会在猫舍养老。",
    },
  ],
  breedingIntro: "繁育权仅面向互相了解，并且主理人熟悉科学饲养科学繁育的猫舍。",
  breedingCards: [
    { id: "process-breeding-queen", label: "繁育权 · 母猫", value: "30000 – 50000 元" },
    { id: "process-breeding-king", label: "繁育权 · 公猫", value: "40000 – 70000 元" },
  ],
  returningFamiliesIntro: "感谢一路同行的信任与陪伴，星月永远记得每一位老家长。",
  returningBenefits: [
    { id: "process-returning-second", label: "二胎", value: "9 折" },
    { id: "process-returning-third", label: "三胎", value: "8 折" },
    { id: "process-returning-fourth", label: "四胎", value: "7 折" },
    { id: "process-returning-retired", label: "退役猫", value: "免费\n领养" },
  ],
  steps: [
    {
      id: "process-step-questionnaire",
      title: "了解猫舍，填写问卷",
      description:
        "请先阅读置顶了解猫舍，有任何想了解的事情随时询问，如有意接猫可以填写选猫问卷，互相了解。",
    },
    {
      id: "process-step-contract",
      title: "排队选猫，签订合同",
      description:
        "我们采取排队制选猫，排队订金 3000 元，如一年未选猫可全额退还。排队家长选猫后落选小猫进入公开选猫环节，确定选猫后支付该猫全款 50% 定金并签订合同。",
    },
    {
      id: "process-step-health",
      title: "疫苗、体检、绝育与康复",
      description:
        "我们的小猫会在完全接种疫苗，体检合格的情况下，于 4.5 月龄以上绝育，完全康复后去新家。与家长沟通运输方式，如需推迟接猫可在猫舍免费寄养 30 天。",
    },
    {
      id: "process-step-welcome",
      title: "接猫指导与新家礼包",
      description: "在小猫到家前我们会提供详细指导，并寄出新家礼包。",
    },
  ],
  welcomeKitItems: [
    { id: "process-kit-food", text: "过渡粮" },
    { id: "process-kit-can", text: "罐头" },
    { id: "process-kit-snack", text: "随机零食" },
    { id: "process-kit-medicine", text: "药品分装" },
    { id: "process-kit-wipes", text: "湿巾" },
    { id: "process-kit-carrier", text: "大号航空箱" },
    { id: "process-kit-toy", text: "小猫喜欢的玩具" },
    { id: "process-kit-report", text: "体检报告" },
  ],
  welcomeKitNote: "内容可能偶尔调整，价值差别不大。",
  contractNotice: "具体价格、接猫时间和售后内容以实际小猫情况及正式合同为准。",
};

export function cloneProcessContent(content: ProcessContent = DEFAULT_PROCESS_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as ProcessContent;
}

export function normalizeProcessContent(value: unknown): ProcessContent {
  if (!value || typeof value !== "object") return cloneProcessContent();

  const input = value as Partial<ProcessContent>;
  const base = cloneProcessContent();

  return {
    version: 1,
    pricingIntro: typeof input.pricingIntro === "string" ? input.pricingIntro : base.pricingIntro,
    priceCards: normalizePriceCards(input.priceCards, base.priceCards, "process-price"),
    breedingIntro:
      typeof input.breedingIntro === "string" ? input.breedingIntro : base.breedingIntro,
    breedingCards: normalizeSimpleCards(
      input.breedingCards,
      base.breedingCards,
      "process-breeding",
    ),
    returningFamiliesIntro:
      typeof input.returningFamiliesIntro === "string"
        ? input.returningFamiliesIntro
        : base.returningFamiliesIntro,
    returningBenefits: normalizeSimpleCards(
      input.returningBenefits,
      base.returningBenefits,
      "process-returning",
    ),
    steps: normalizeSteps(input.steps, base.steps, "process-step"),
    welcomeKitItems: normalizeTextList(input.welcomeKitItems, base.welcomeKitItems, "process-kit"),
    welcomeKitNote:
      typeof input.welcomeKitNote === "string" ? input.welcomeKitNote : base.welcomeKitNote,
    contractNotice:
      typeof input.contractNotice === "string" ? input.contractNotice : base.contractNotice,
  };
}

function normalizePriceCards(
  value: unknown,
  fallback: ProcessPriceCard[],
  section: string,
): ProcessPriceCard[] {
  if (!Array.isArray(value)) return fallback;

  const reservedIds = collectCanonicalIds(value);
  const usedIds = new Set<string>();
  return value.map((item, index) => {
    const input = item && typeof item === "object" ? (item as Partial<ProcessPriceCard>) : {};
    return {
      id: normalizeItemId(input.id, section, index, usedIds, reservedIds),
      label: typeof input.label === "string" ? input.label : "",
      value: typeof input.value === "string" ? input.value : "",
      note: typeof input.note === "string" ? input.note : "",
    };
  });
}

function normalizeSimpleCards(
  value: unknown,
  fallback: ProcessSimpleCard[],
  section: string,
): ProcessSimpleCard[] {
  if (!Array.isArray(value)) return fallback;

  const reservedIds = collectCanonicalIds(value);
  const usedIds = new Set<string>();
  return value.map((item, index) => {
    const input = item && typeof item === "object" ? (item as Partial<ProcessSimpleCard>) : {};
    return {
      id: normalizeItemId(input.id, section, index, usedIds, reservedIds),
      label: typeof input.label === "string" ? input.label : "",
      value: typeof input.value === "string" ? input.value : "",
    };
  });
}

function normalizeSteps(value: unknown, fallback: ProcessStep[], section: string): ProcessStep[] {
  if (!Array.isArray(value)) return fallback;

  const reservedIds = collectCanonicalIds(value);
  const usedIds = new Set<string>();
  return value.map((item, index) => {
    const input = item && typeof item === "object" ? (item as Partial<ProcessStep>) : {};
    return {
      id: normalizeItemId(input.id, section, index, usedIds, reservedIds),
      title: typeof input.title === "string" ? input.title : "",
      description: typeof input.description === "string" ? input.description : "",
    };
  });
}

function normalizeTextList(
  value: unknown,
  fallback: TextListItem[],
  section: string,
): TextListItem[] {
  if (!Array.isArray(value)) return fallback;

  const reservedIds = collectCanonicalIds(value);
  const usedIds = new Set<string>();
  return value.map((item, index) => {
    const input = item && typeof item === "object" ? (item as Partial<TextListItem>) : {};
    return {
      id: normalizeItemId(input.id, section, index, usedIds, reservedIds),
      text: typeof input.text === "string" ? input.text : "",
    };
  });
}

function collectCanonicalIds(items: unknown[]) {
  const ids = new Set<string>();
  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "string") return;
    const canonicalId = id.trim();
    if (canonicalId) ids.add(canonicalId);
  });
  return ids;
}

function normalizeItemId(
  value: unknown,
  section: string,
  index: number,
  usedIds: Set<string>,
  reservedIds: Set<string>,
) {
  const canonicalId = typeof value === "string" ? value.trim() : "";
  if (canonicalId && !usedIds.has(canonicalId)) {
    usedIds.add(canonicalId);
    return canonicalId;
  }

  const baseId = `${section}-${index + 1}`;
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate) || reservedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}
