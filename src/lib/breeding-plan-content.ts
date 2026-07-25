export const BREEDING_PLAN_PAGE_TITLE = "繁育计划";
export const BREEDING_PLAN_PAGE_EYEBROW = "Breeding Plan";

export interface BreedingPlanPairing {
  id: string;
  maleStudId: string;
  femaleStudId: string;
  timeLabel: string;
  possibleColors: string[];
  colorPossibilityNote: string;
}

export interface BreedingPlanGroup {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  pairings: BreedingPlanPairing[];
}

export interface BreedingPlanDisclaimer {
  color: string;
  schedule: string;
}

export interface BreedingPlanContent {
  version: 2;
  period: string;
  introduction: string;
  groups: BreedingPlanGroup[];
  disclaimer: BreedingPlanDisclaimer;
}

type CanonicalPairingDetails = Pick<BreedingPlanPairing, "possibleColors" | "colorPossibilityNote">;

const LEGACY_BREEDING_PLAN_SCHEDULE_DISCLAIMER =
  "具体窝次和预计时间受公猫状态、母猫发情时间影响，以实际情况为准。";
const DEFAULT_BREEDING_PLAN_COLOR_DISCLAIMER =
  "可能花色仅为当前繁育组合的预估，实际以小猫出生后的花色表现为准。";

const CANONICAL_PAIRING_DETAILS: Record<string, CanonicalPairingDetails> = {
  "chonglou-yunmu-2026-07": {
    possibleColors: ["棕虎斑加白", "银虎斑加白", "三花", "银三花"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如蓝虎斑），以及麻纹。",
  },
  "tianhe-xiaoxiaxian-2026-09": {
    possibleColors: ["红银虎斑加白", "黑银虎斑加白", "银三花"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如乳银虎斑），以及高银、浅银和麻纹。",
  },
  "chonglou-xiongmao-recent": {
    possibleColors: ["棕虎斑", "玳瑁", "三花"],
    colorPossibilityNote: "以上颜色有概率出现加白和麻纹。",
  },
  "shulongyin-niaotuan-recent": {
    possibleColors: ["红银虎斑", "黑银虎斑", "银玳瑁"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如乳银虎斑），以及鱼骨纹。",
  },
  "tianhe-zhaoyue-2026-h2": {
    possibleColors: ["黑银虎斑加白"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如蓝银虎斑），以及高银、浅银和鱼骨纹。",
  },
  "tianhe-manao-2026-h2": {
    possibleColors: ["红银虎斑加白", "黑银虎斑加白", "银三花"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如乳银虎斑），以及高银、浅银。",
  },
  "tianhe-yunyue-2026-h2": {
    possibleColors: ["红银虎斑加白", "黑银虎斑加白", "银三花"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如乳银虎斑），以及阴影色高银。",
  },
  "tianhe-guihuagao-2026-h2": {
    possibleColors: ["红银虎斑加白", "黑银虎斑加白", "银三花"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如乳银虎斑），以及高银、浅银。",
  },
  "huqing-luoyiyi-2026-h2": {
    possibleColors: ["红虎斑", "棕虎斑", "三花"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如乳色虎斑），以及加白、麻纹。",
  },
  "shulongyin-xiaobianmu-2026-h2": {
    possibleColors: ["红银虎斑", "黑银虎斑", "银玳瑁"],
    colorPossibilityNote: "以上颜色有概率出现稀释色（如乳银虎斑），以及高银、浅银。",
  },
};

export const DEFAULT_BREEDING_PLAN_CONTENT: BreedingPlanContent = {
  version: 2,
  period: "2026 下半年",
  introduction: "记录星月接下来的繁育安排，也方便家长提前了解感兴趣的血线组合。",
  groups: [
    {
      id: "upcoming-litters",
      eyebrow: "Upcoming Litters",
      title: "近期窝次",
      description: "",
      pairings: [
        createCanonicalPairing("chonglou-yunmu-2026-07", "chonglou", "yunmu", "预产期 7.24–7.26"),
        createCanonicalPairing(
          "tianhe-xiaoxiaxian-2026-09",
          "tianhe",
          "xiaoxiaxian",
          "预产期 9.4–9.6",
        ),
        createCanonicalPairing("chonglou-xiongmao-recent", "chonglou", "xiongmao", "近期"),
        createCanonicalPairing("shulongyin-niaotuan-recent", "shulongyin", "niaotuan", "近期"),
      ],
    },
    {
      id: "later-this-year",
      eyebrow: "Later This Year",
      title: "8–12 月计划",
      description: "",
      pairings: [
        createCanonicalPairing("tianhe-zhaoyue-2026-h2", "tianhe", "zhaoyue", "预计 8–12 月"),
        createCanonicalPairing("tianhe-manao-2026-h2", "tianhe", "manao", "预计 8–12 月"),
        createCanonicalPairing("tianhe-yunyue-2026-h2", "tianhe", "yunyue", "预计 8–12 月"),
        createCanonicalPairing("tianhe-guihuagao-2026-h2", "tianhe", "guihuagao", "预计 8–12 月"),
        createCanonicalPairing("huqing-luoyiyi-2026-h2", "huqing", "luoyiyi", "预计 8–12 月"),
        createCanonicalPairing(
          "shulongyin-xiaobianmu-2026-h2",
          "shulongyin",
          "xiaobianmu",
          "预计 8–12 月",
        ),
      ],
    },
  ],
  disclaimer: {
    color: DEFAULT_BREEDING_PLAN_COLOR_DISCLAIMER,
    schedule: LEGACY_BREEDING_PLAN_SCHEDULE_DISCLAIMER,
  },
};

export const BREEDING_PLAN_CONTENT = DEFAULT_BREEDING_PLAN_CONTENT;

export function cloneBreedingPlanContent(
  content: BreedingPlanContent = DEFAULT_BREEDING_PLAN_CONTENT,
) {
  return JSON.parse(JSON.stringify(content)) as BreedingPlanContent;
}

export function normalizeBreedingPlanContent(value: unknown): BreedingPlanContent {
  if (!value || typeof value !== "object") return cloneBreedingPlanContent();

  const input = value as Partial<BreedingPlanContent> & {
    version?: unknown;
    disclaimer?: unknown;
  };
  const base = cloneBreedingPlanContent();
  const isLegacy = input.version !== 2;

  return {
    version: 2,
    period: optionalString(input.period, base.period),
    introduction: optionalString(input.introduction, base.introduction),
    groups: normalizeGroups(input.groups, base.groups, isLegacy),
    disclaimer: normalizeDisclaimer(input.disclaimer, base.disclaimer, isLegacy),
  };
}

function createCanonicalPairing(
  id: keyof typeof CANONICAL_PAIRING_DETAILS,
  maleStudId: string,
  femaleStudId: string,
  timeLabel: string,
): BreedingPlanPairing {
  const details = CANONICAL_PAIRING_DETAILS[id];
  return {
    id,
    maleStudId,
    femaleStudId,
    timeLabel,
    possibleColors: [...details.possibleColors],
    colorPossibilityNote: details.colorPossibilityNote,
  };
}

function normalizeGroups(
  value: unknown,
  fallback: BreedingPlanGroup[],
  isLegacy: boolean,
): BreedingPlanGroup[] {
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
      pairings: normalizePairings(input.pairings, fallbackGroup?.pairings ?? [], isLegacy),
    };
  });
}

function normalizePairings(
  value: unknown,
  fallback: BreedingPlanPairing[],
  isLegacy: boolean,
): BreedingPlanPairing[] {
  if (!Array.isArray(value)) return fallback;

  const reservedIds = collectCanonicalIds(value);
  const usedIds = new Set<string>();

  return value.map((item, index) => {
    const input =
      item && typeof item === "object"
        ? (item as Partial<BreedingPlanPairing> & { expectedColors?: unknown })
        : {};
    const fallbackPairing = fallback[index] ?? fallback[0];
    const id = normalizeItemId(input.id, "breeding-plan-pairing", index, usedIds, reservedIds);
    const legacyExpectedColors = normalizeColorTags(input.expectedColors);

    return {
      id,
      maleStudId: optionalString(input.maleStudId, fallbackPairing?.maleStudId ?? ""),
      femaleStudId: optionalString(input.femaleStudId, fallbackPairing?.femaleStudId ?? ""),
      timeLabel: optionalString(input.timeLabel, fallbackPairing?.timeLabel ?? ""),
      possibleColors: resolvePossibleColors({
        input,
        pairingId: id,
        legacyExpectedColors,
        isLegacy,
      }),
      colorPossibilityNote: resolveColorPossibilityNote({
        input,
        pairingId: id,
        legacyExpectedColors,
        isLegacy,
      }),
    };
  });
}

function resolvePossibleColors({
  input,
  pairingId,
  legacyExpectedColors,
  isLegacy,
}: {
  input: Partial<BreedingPlanPairing> & { expectedColors?: unknown };
  pairingId: string;
  legacyExpectedColors: string[];
  isLegacy: boolean;
}) {
  if (hasOwn(input, "possibleColors")) {
    return normalizeColorTags(input.possibleColors);
  }

  if (isLegacy) {
    if (legacyExpectedColors.length > 0) return legacyExpectedColors;
    return getCanonicalPairingDetails(pairingId)?.possibleColors ?? [];
  }

  return [];
}

function resolveColorPossibilityNote({
  input,
  pairingId,
  legacyExpectedColors,
  isLegacy,
}: {
  input: Partial<BreedingPlanPairing> & { expectedColors?: unknown };
  pairingId: string;
  legacyExpectedColors: string[];
  isLegacy: boolean;
}) {
  if (hasOwn(input, "colorPossibilityNote")) {
    return normalizeMultilineString(input.colorPossibilityNote, "");
  }

  if (isLegacy && legacyExpectedColors.length === 0) {
    return getCanonicalPairingDetails(pairingId)?.colorPossibilityNote ?? "";
  }

  return "";
}

function normalizeDisclaimer(
  value: unknown,
  fallback: BreedingPlanDisclaimer,
  isLegacy: boolean,
): BreedingPlanDisclaimer {
  if (isLegacy) {
    const legacyValue = normalizeMultilineString(value, "");
    return {
      color: fallback.color,
      schedule: legacyValue || fallback.schedule,
    };
  }

  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  const input = value as Partial<BreedingPlanDisclaimer>;
  return {
    color: normalizeMultilineString(input.color, fallback.color),
    schedule: normalizeMultilineString(input.schedule, fallback.schedule),
  };
}

function normalizeColorTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const used = new Set<string>();
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => {
      if (!item || used.has(item)) return false;
      used.add(item);
      return true;
    });
}

function getCanonicalPairingDetails(pairingId: string): CanonicalPairingDetails | null {
  const details = CANONICAL_PAIRING_DETAILS[pairingId];
  if (!details) return null;
  return {
    possibleColors: [...details.possibleColors],
    colorPossibilityNote: details.colorPossibilityNote,
  };
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

function normalizeMultilineString(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function hasOwn(value: object, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
