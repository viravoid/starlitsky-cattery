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
  "每天白天有 1-2 餐湿粮（罐头或熟自制），晚上有猫粮自助，冻干以及营养品补充。我们从小猫开食起慢慢尝试多种食物，培养不挑食小猫，方便回新家后快速适应各种食物。";

const COOKED_MODULE_ID = "feeding-module-cooked";
const MERGED_MODULE_ID = "feeding-module-kibble";
const CANS_MODULE_ID = "feeding-module-cans";
const FREEZEDRIED_MODULE_ID = "feeding-module-freezedried";
const SUPPLEMENTS_MODULE_ID = "feeding-module-supplements";

function createMergedModuleBody() {
  return [
    "猫粮",
    "目前猫粮为百利高蛋白、百利无谷鸡、NG 猪肉、NG 紫鸡等配方良好的进口粮为主，不定期更换。",
    "",
    "罐头",
    "macs、mja、ven、小李子等德罐为主。",
    "奶猫开食皇家奶糕。",
    "",
    "冻干",
    "sc、pr、ve、爱立方、丸味等。",
  ].join("\n");
}

const DEFAULT_FEEDING_CONTENT: FeedingContent = {
  version: 1,
  intro: DEFAULT_INTRO,
  imageAspectRatio: { width: 4, height: 3 },
  modules: [
    {
      id: COOKED_MODULE_ID,
      title: "熟自制",
      body: "考虑到小猫饮食多样营养均衡，我们会采购各种不同种类的白肉红肉及内脏，按照正确的配比添加营养补剂。\n红肉（不同部位牛肉鹿肉，偶尔鸵鸟）\n内脏（牛，兔，鸡内脏）\n白肉（鸡胸鸡腿，鸭胸）",
      images: [
        createDefaultFeedingImage(COOKED_MODULE_ID, 1, "static:feeding/cooked/1"),
        createDefaultFeedingImage(COOKED_MODULE_ID, 2, "static:feeding/cooked/2"),
        createDefaultFeedingImage(COOKED_MODULE_ID, 3, "static:feeding/cooked/3"),
        createDefaultFeedingImage(COOKED_MODULE_ID, 4, "static:feeding/cooked/4"),
      ],
    },
    {
      id: MERGED_MODULE_ID,
      title: "猫粮 · 罐头 · 冻干",
      body: createMergedModuleBody(),
      images: [createDefaultFeedingImage(MERGED_MODULE_ID, 1, "static:feeding/combined/1")],
    },
    {
      id: SUPPLEMENTS_MODULE_ID,
      title: "保健品",
      body: "布拉迪益生菌、jarrow 乳铁蛋白、nowfoods 鱼油、添赐力、nucat 多种维生素片等。",
      images: [createDefaultFeedingImage(SUPPLEMENTS_MODULE_ID, 1, "static:feeding/supplements/1")],
    },
  ],
};

export { DEFAULT_FEEDING_CONTENT };

export function cloneFeedingContent(content: FeedingContent = DEFAULT_FEEDING_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as FeedingContent;
}

export function normalizeFeedingContent(value: unknown): FeedingContent {
  if (!value || typeof value !== "object") return cloneFeedingContent();

  const input = value as Partial<FeedingContent>;
  const base = cloneFeedingContent();
  const rawModules = Array.isArray(input.modules)
    ? input.modules
        .filter((module) => Boolean(module && typeof module === "object"))
        .map((module, index) => normalizeFeedingModule(module, index))
    : base.modules;

  return {
    version: 1,
    intro: typeof input.intro === "string" ? input.intro : base.intro,
    imageAspectRatio: normalizeFeedingAspectRatio(input.imageAspectRatio),
    modules: normalizeFeedingModules(rawModules, base.modules),
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

function normalizeFeedingModules(
  modules: FeedingModule[],
  defaults: FeedingModule[],
): FeedingModule[] {
  const defaultsById = new Map(defaults.map((module) => [module.id, module]));
  const modulesById = new Map(modules.map((module) => [module.id, module]));
  const hasLegacySplitModules = modules.some(
    (module) => module.id === CANS_MODULE_ID || module.id === FREEZEDRIED_MODULE_ID,
  );

  const cooked = finalizeFeedingModule(
    modulesById.get(COOKED_MODULE_ID),
    defaultsById.get(COOKED_MODULE_ID)!,
  );
  const supplements = finalizeFeedingModule(
    modulesById.get(SUPPLEMENTS_MODULE_ID),
    defaultsById.get(SUPPLEMENTS_MODULE_ID)!,
  );

  const merged = hasLegacySplitModules
    ? finalizeMergedLegacyModule(modulesById, defaultsById.get(MERGED_MODULE_ID)!)
    : finalizeFeedingModule(modulesById.get(MERGED_MODULE_ID), defaultsById.get(MERGED_MODULE_ID)!);

  return [cooked, merged, supplements];
}

function finalizeMergedLegacyModule(
  modulesById: Map<string, FeedingModule>,
  fallback: FeedingModule,
): FeedingModule {
  const kibble = modulesById.get(MERGED_MODULE_ID);
  const cans = modulesById.get(CANS_MODULE_ID);
  const freezedried = modulesById.get(FREEZEDRIED_MODULE_ID);
  const mergedImages = dedupeFeedingImages(
    [kibble, cans, freezedried].flatMap((module) => module?.images ?? []),
  );

  return {
    id: fallback.id,
    title: fallback.title,
    body: mergeLegacyModuleBodies(kibble?.body, cans?.body, freezedried?.body, fallback.body),
    images: mergedImages.length ? mergedImages : cloneFeedingImages(fallback.images),
  };
}

function mergeLegacyModuleBodies(
  kibbleBody: string | undefined,
  cansBody: string | undefined,
  freezedriedBody: string | undefined,
  fallback: string,
) {
  const sections = [
    { heading: "猫粮", body: kibbleBody },
    { heading: "罐头", body: cansBody },
    { heading: "冻干", body: freezedriedBody },
  ]
    .map(({ heading, body }) => ({ heading, body: body?.trim() ?? "" }))
    .filter((section) => Boolean(section.body));

  if (sections.length === 0) return fallback;
  return sections
    .flatMap((section, index) =>
      index === 0 ? [section.heading, section.body] : ["", section.heading, section.body],
    )
    .join("\n");
}

function finalizeFeedingModule(
  module: FeedingModule | undefined,
  fallback: FeedingModule,
): FeedingModule {
  return {
    id: fallback.id,
    title: typeof module?.title === "string" && module.title.trim() ? module.title : fallback.title,
    body: typeof module?.body === "string" ? module.body : fallback.body,
    images:
      module && module.images.length
        ? cloneFeedingImages(module.images)
        : cloneFeedingImages(fallback.images),
  };
}

function dedupeFeedingImages(images: FeedingModuleImage[]) {
  const seen = new Set<string>();
  const next: FeedingModuleImage[] = [];

  for (const image of images) {
    const key = image.imageId?.trim() || image.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push({
      id: image.id,
      imageId: image.imageId,
      focalPoint: { ...image.focalPoint },
    });
  }

  return next;
}

function cloneFeedingImages(images: FeedingModuleImage[]) {
  return images.map((image) => ({
    id: image.id,
    imageId: image.imageId,
    focalPoint: { ...image.focalPoint },
  }));
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
    images,
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

function createDefaultFeedingImage(
  moduleId: string,
  index: number,
  imageId?: string,
): FeedingModuleImage {
  return {
    id: `${moduleId}-image-${index}`,
    imageId,
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
