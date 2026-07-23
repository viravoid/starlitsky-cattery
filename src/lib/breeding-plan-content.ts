export const BREEDING_PLAN_PAGE_TITLE = "繁育计划";
export const BREEDING_PLAN_PAGE_EYEBROW = "Breeding Plan";

export interface BreedingPlanPairing {
  id: string;
  maleStudId: string;
  femaleStudId: string;
  timeLabel: string;
  expectedColors: string[];
}

export interface BreedingPlanGroup {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  pairings: BreedingPlanPairing[];
}

export interface BreedingPlanContent {
  version: 1;
  period: string;
  introduction: string;
  groups: BreedingPlanGroup[];
  disclaimer: string;
}

export const DEFAULT_BREEDING_PLAN_CONTENT: BreedingPlanContent = {
  version: 1,
  period: "2026 下半年",
  introduction: "记录星月接下来的繁育安排，也方便家长提前了解感兴趣的血线组合。",
  groups: [
    {
      id: "upcoming-litters",
      eyebrow: "Upcoming Litters",
      title: "近期窝次",
      description: "",
      pairings: [
        {
          id: "chonglou-yunmu-2026-07",
          maleStudId: "chonglou",
          femaleStudId: "yunmu",
          timeLabel: "预产期 7.24–7.26",
          expectedColors: [],
        },
        {
          id: "tianhe-xiaoxiaxian-2026-09",
          maleStudId: "tianhe",
          femaleStudId: "xiaoxiaxian",
          timeLabel: "预产期 9.4–9.6",
          expectedColors: [],
        },
        {
          id: "chonglou-xiongmao-recent",
          maleStudId: "chonglou",
          femaleStudId: "xiongmao",
          timeLabel: "近期",
          expectedColors: [],
        },
        {
          id: "shulongyin-niaotuan-recent",
          maleStudId: "shulongyin",
          femaleStudId: "niaotuan",
          timeLabel: "近期",
          expectedColors: [],
        },
      ],
    },
    {
      id: "later-this-year",
      eyebrow: "Later This Year",
      title: "8–12 月计划",
      description: "",
      pairings: [
        {
          id: "tianhe-zhaoyue-2026-h2",
          maleStudId: "tianhe",
          femaleStudId: "zhaoyue",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "tianhe-manao-2026-h2",
          maleStudId: "tianhe",
          femaleStudId: "manao",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "tianhe-yunyue-2026-h2",
          maleStudId: "tianhe",
          femaleStudId: "yunyue",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "tianhe-guihuagao-2026-h2",
          maleStudId: "tianhe",
          femaleStudId: "guihuagao",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "huqing-luoyiyi-2026-h2",
          maleStudId: "huqing",
          femaleStudId: "luoyiyi",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
        {
          id: "shulongyin-xiaobianmu-2026-h2",
          maleStudId: "shulongyin",
          femaleStudId: "xiaobianmu",
          timeLabel: "预计 8–12 月",
          expectedColors: [],
        },
      ],
    },
  ],
  disclaimer: "具体窝次和预计时间受公猫状态、母猫发情时间影响，以实际情况为准。",
};

export const BREEDING_PLAN_CONTENT = DEFAULT_BREEDING_PLAN_CONTENT;

export function cloneBreedingPlanContent(
  content: BreedingPlanContent = DEFAULT_BREEDING_PLAN_CONTENT,
) {
  return JSON.parse(JSON.stringify(content)) as BreedingPlanContent;
}

export function normalizeBreedingPlanContent(value: unknown): BreedingPlanContent {
  if (!value || typeof value !== "object") return cloneBreedingPlanContent();

  const input = value as Partial<BreedingPlanContent>;
  const base = cloneBreedingPlanContent();

  return {
    version: 1,
    period: optionalString(input.period, base.period),
    introduction: optionalString(input.introduction, base.introduction),
    groups: normalizeGroups(input.groups, base.groups),
    disclaimer: optionalString(input.disclaimer, base.disclaimer),
  };
}

function normalizeGroups(value: unknown, fallback: BreedingPlanGroup[]): BreedingPlanGroup[] {
  if (!Array.isArray(value)) return fallback;

  const reservedIds = collectCanonicalIds(value);
  const usedIds = new Set<string>();

  return value.map((item, index) => {
    const input = item && typeof item === "object" ? (item as Partial<BreedingPlanGroup>) : {};
    const fallbackGroup = fallback[index] ?? fallback[0];
    return {
      id: normalizeItemId(input.id, "breeding-plan-group", index, usedIds, reservedIds),
      eyebrow: optionalString(input.eyebrow, fallbackGroup?.eyebrow ?? ""),
      title: optionalString(input.title, fallbackGroup?.title ?? ""),
      description: optionalString(input.description, ""),
      pairings: normalizePairings(input.pairings, fallbackGroup?.pairings ?? []),
    };
  });
}

function normalizePairings(value: unknown, fallback: BreedingPlanPairing[]): BreedingPlanPairing[] {
  if (!Array.isArray(value)) return fallback;

  const reservedIds = collectCanonicalIds(value);
  const usedIds = new Set<string>();

  return value.map((item, index) => {
    const input = item && typeof item === "object" ? (item as Partial<BreedingPlanPairing>) : {};
    const fallbackPairing = fallback[index] ?? fallback[0];
    return {
      id: normalizeItemId(input.id, "breeding-plan-pairing", index, usedIds, reservedIds),
      maleStudId: optionalString(input.maleStudId, fallbackPairing?.maleStudId ?? ""),
      femaleStudId: optionalString(input.femaleStudId, fallbackPairing?.femaleStudId ?? ""),
      timeLabel: optionalString(input.timeLabel, fallbackPairing?.timeLabel ?? ""),
      expectedColors: normalizeExpectedColors(input.expectedColors),
    };
  });
}

function normalizeExpectedColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((color) => (typeof color === "string" ? color.trim() : "")).filter(Boolean);
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

function optionalString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}
