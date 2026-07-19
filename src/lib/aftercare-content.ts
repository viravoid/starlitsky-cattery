export type TextListItem = {
  id: string;
  text: string;
};

export type AftercareContent = {
  version: 1;
  promises: TextListItem[];
  healthItems: TextListItem[];
  contractNotice: string;
};

export const DEFAULT_AFTERCARE_CONTENT: AftercareContent = {
  version: 1,
  promises: [
    { id: "aftercare-promise-genetic-screening", text: "种猫全部做遗传病检查，结果 all n/n" },
    {
      id: "aftercare-promise-low-frequency",
      text: "科学繁育，根据母猫状态每窝间隔 8–16 个月，窝次清晰透明",
    },
    {
      id: "aftercare-promise-self-bred",
      text: "所有小猫均为我们猫舍自己繁育、从小照顾并社会化训练、找家",
    },
    {
      id: "aftercare-promise-no-bad-practices",
      text: "拒绝高频繁育、借配、合作出售、近亲交配、出售病猫等行为",
    },
  ],
  healthItems: [
    { id: "aftercare-health-vaccine-antibody", text: "疫苗 3 针，抗体浓度检测" },
    { id: "aftercare-health-basic-checks", text: "血常规，粪检，基础检查" },
    { id: "aftercare-health-heart-ultrasound", text: "小猫成年心超报销一次" },
    { id: "aftercare-health-neuter", text: "公猫 / 母猫微创绝育" },
    { id: "aftercare-health-recovery", text: "术后消炎针，营养补充" },
    { id: "aftercare-health-deworming", text: "3–5 月龄大宠爱外驱，海乐妙内驱一次" },
  ],
  contractNotice: "售后页面仅为摘要，具体内容以《合同模板 2026》为准。",
};

export function cloneAftercareContent(content: AftercareContent = DEFAULT_AFTERCARE_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as AftercareContent;
}

export function normalizeAftercareContent(value: unknown): AftercareContent {
  if (!value || typeof value !== "object") return cloneAftercareContent();

  const input = value as Partial<AftercareContent>;
  const base = cloneAftercareContent();

  return {
    version: 1,
    promises: normalizeTextList(input.promises, base.promises, "aftercare-promise"),
    healthItems: normalizeTextList(input.healthItems, base.healthItems, "aftercare-health"),
    contractNotice:
      typeof input.contractNotice === "string" ? input.contractNotice : base.contractNotice,
  };
}

function normalizeTextList(
  value: unknown,
  fallback: TextListItem[],
  section: string,
): TextListItem[] {
  if (!Array.isArray(value)) return fallback;

  const usedIds = new Set<string>();
  return value.map((item, index) => {
    const input = item && typeof item === "object" ? (item as Partial<TextListItem>) : {};
    return {
      id: normalizeItemId(input.id, section, index, usedIds),
      text: typeof input.text === "string" ? input.text : "",
    };
  });
}

function normalizeItemId(value: unknown, section: string, index: number, usedIds: Set<string>) {
  if (typeof value === "string" && value.trim() && !usedIds.has(value)) {
    usedIds.add(value);
    return value;
  }

  const baseId = `${section}-${index + 1}`;
  let candidate = baseId;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}
