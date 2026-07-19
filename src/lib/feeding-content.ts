export type FeedingImageFocalPoint = {
  x: number;
  y: number;
};

export type FeedingAspectRatioValue = {
  width: number;
  height: number;
};

export type FeedingModuleImage = {
  id: string;
  imageId?: string;
  focalPoint: FeedingImageFocalPoint;
};

export type FeedingModule = {
  id: string;
  title: string;
  body: string;
  images: FeedingModuleImage[];
};

export type FeedingContent = {
  version: 1;
  intro: string;
  imageAspectRatio: FeedingAspectRatioValue;
  modules: FeedingModule[];
};

const DEFAULT_INTRO =
  "每天白天有 1-2 餐湿粮（罐头或熟自制），夜晚有猫粮自助，冻干以及营养品补充。我们从小猫开食起慢慢尝试多种食物，培养不挑食小猫，方便回新家后快速适应各种食物。";

export const DEFAULT_FEEDING_CONTENT: FeedingContent = {
  version: 1,
  intro: DEFAULT_INTRO,
  imageAspectRatio: { width: 4, height: 3 },
  modules: [
    {
      id: "feeding-module-cooked",
      title: "熟自制",
      body: "考虑到小猫饮食多样营养均衡，我们会采购各种不同种类的白肉红肉及内脏，按照正确的配比添加营养补剂。\n红肉（不同部位牛肉鹿肉，偶尔鸵鸟）\n内脏（牛，兔，鸡内脏）\n白肉（鸡胸鸡腿，鸭胸）",
      images: [createDefaultFeedingImage("feeding-module-cooked", 1)],
    },
    {
      id: "feeding-module-kibble",
      title: "猫粮",
      body: "目前猫粮为百利高蛋白、百利无谷鸡、NG 猪肉、NG 紫鸡等配方良好的进口粮为主，不定期更换。",
      images: [createDefaultFeedingImage("feeding-module-kibble", 1)],
    },
    {
      id: "feeding-module-cans",
      title: "罐头",
      body: "macs、mja、ven、小李子等德罐为主。\n奶猫开食皇家奶糕。",
      images: [createDefaultFeedingImage("feeding-module-cans", 1)],
    },
    {
      id: "feeding-module-freezedried",
      title: "冻干",
      body: "sc、pr、ve、爱立方、丸味等。",
      images: [createDefaultFeedingImage("feeding-module-freezedried", 1)],
    },
    {
      id: "feeding-module-supplements",
      title: "保健品",
      body: "布拉迪益生菌、jarrow 乳铁蛋白、nowfoods 鱼油、添赐力、nucat 多种维生素片等。",
      images: [createDefaultFeedingImage("feeding-module-supplements", 1)],
    },
  ],
};

export function cloneFeedingContent(content: FeedingContent = DEFAULT_FEEDING_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as FeedingContent;
}

export function normalizeFeedingContent(value: unknown): FeedingContent {
  if (!value || typeof value !== "object") return cloneFeedingContent();

  const input = value as Partial<FeedingContent>;
  const base = cloneFeedingContent();
  const modules = Array.isArray(input.modules)
    ? input.modules
        .filter((module) => Boolean(module && typeof module === "object"))
        .map((module, index) => normalizeFeedingModule(module, index))
    : base.modules;

  return {
    version: 1,
    intro: typeof input.intro === "string" ? input.intro : base.intro,
    imageAspectRatio: normalizeFeedingAspectRatio(input.imageAspectRatio),
    modules,
  };
}

export function normalizeFeedingAspectRatio(value: unknown): FeedingAspectRatioValue {
  if (!value || typeof value !== "object") return { width: 4, height: 3 };
  const input = value as Partial<FeedingAspectRatioValue>;
  return sanitizeFeedingAspectRatio(input.width, input.height);
}

export function sanitizeFeedingAspectRatio(
  width: unknown,
  height: unknown,
): FeedingAspectRatioValue {
  const parsedWidth = typeof width === "number" ? width : Number(width);
  const parsedHeight = typeof height === "number" ? height : Number(height);
  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) {
    return { width: 4, height: 3 };
  }

  const nextWidth = Math.max(1, Math.min(32, parsedWidth));
  const nextHeight = Math.max(1, Math.min(32, parsedHeight));
  const ratio = nextWidth / nextHeight;
  if (ratio < 0.35 || ratio > 3.5) return { width: 4, height: 3 };

  return {
    width: roundRatioValue(nextWidth),
    height: roundRatioValue(nextHeight),
  };
}

export function formatFeedingAspectRatio({ width, height }: FeedingAspectRatioValue) {
  return `${width} / ${height}`;
}

function normalizeFeedingModule(value: unknown, index: number): FeedingModule {
  const input = value as Partial<FeedingModule>;
  const fallbackId = `feeding-module-${index + 1}`;
  const id = normalizeId(input.id, fallbackId);
  const images = Array.isArray(input.images)
    ? input.images
        .filter((image) => Boolean(image && typeof image === "object"))
        .map((image, imageIndex) => normalizeFeedingImage(image, id, imageIndex))
    : [];

  return {
    id,
    title: normalizeText(input.title, `喂养模块 ${index + 1}`),
    body: typeof input.body === "string" ? input.body : "",
    images: images.length ? images : [createDefaultFeedingImage(id, 1)],
  };
}

function normalizeFeedingImage(
  value: unknown,
  moduleId: string,
  index: number,
): FeedingModuleImage {
  const input = value as Partial<FeedingModuleImage>;
  return {
    id: normalizeId(input.id, `${moduleId}-image-${index + 1}`),
    imageId: typeof input.imageId === "string" && input.imageId ? input.imageId : undefined,
    focalPoint: normalizeFocalPoint(input.focalPoint),
  };
}

function createDefaultFeedingImage(moduleId: string, index: number): FeedingModuleImage {
  return {
    id: `${moduleId}-image-${index}`,
    focalPoint: { x: 50, y: 50 },
  };
}

function normalizeFocalPoint(value: unknown): FeedingImageFocalPoint {
  if (!value || typeof value !== "object") return { x: 50, y: 50 };
  const input = value as Partial<FeedingImageFocalPoint>;
  return {
    x: clampPercent(input.x),
    y: clampPercent(input.y),
  };
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function normalizeId(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function clampPercent(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function roundRatioValue(value: number) {
  return Math.round(value * 100) / 100;
}
