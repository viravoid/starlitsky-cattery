export type EnvironmentImageFocalPoint = {
  x: number;
  y: number;
};

export type EnvironmentAspectRatioValue = {
  width: number;
  height: number;
};

export type EnvironmentZoneImage = {
  id: string;
  imageId?: string;
  focalPoint: EnvironmentImageFocalPoint;
};

export type EnvironmentZone = {
  id: string;
  name: string;
  area: string;
  description: string;
  images: EnvironmentZoneImage[];
};

export type EnvironmentContent = {
  version: 1;
  intro: string;
  imageAspectRatio: EnvironmentAspectRatioValue;
  zones: EnvironmentZone[];
};

const DEFAULT_INTRO =
  "猫舍室内面积 600 余平，绝大部分空间用于饲养猫咪，有科学的空间规划，保证动物福利，拒绝笼养。小部分为人类生活区，允许宠物猫和退役种猫自由活动。有三个院子方便小猫小狗跑动。";

export const DEFAULT_ENVIRONMENT_CONTENT: EnvironmentContent = {
  version: 1,
  intro: DEFAULT_INTRO,
  imageAspectRatio: { width: 16, height: 9 },
  zones: [
    {
      id: "environment-zone-nursery",
      name: "母婴区",
      area: "约 52㎡",
      description:
        "孕猫房和育婴房挨着我们的卧室。怀孕 30 天以上的母猫和 1-2 月龄小奶猫生活在这里。",
      images: [createDefaultEnvironmentImage("environment-zone-nursery", 1)],
    },
    {
      id: "environment-zone-kitten",
      name: "幼猫生活区",
      area: "约 66㎡",
      description:
        "幼猫区共分为四个房间，有三个小房间供 2-4 月龄不同窝次的小猫生活，和一个大房间供 4 月龄以上打齐疫苗的宝宝们自由活动。",
      images: [createDefaultEnvironmentImage("environment-zone-kitten", 1)],
    },
    {
      id: "environment-zone-queen",
      name: "种母生活区",
      area: "约 102㎡",
      description:
        "共有四间母猫房供我们的种母生活。我们会按母猫的猫际关系为她们分配合适的房间，有部分母猫和我们生活在客厅卧室。",
      images: [createDefaultEnvironmentImage("environment-zone-queen", 1)],
    },
    {
      id: "environment-zone-king",
      name: "种公生活区",
      area: "室内约 65㎡ · 室外约 40㎡",
      description:
        "我们准备了三个种公房间单独隔离公猫，还有一个院子可以让我们的猫猫国王充分晒太阳、呼吸新鲜空气。打齐疫苗的小猫也可以来院子玩耍。",
      images: [createDefaultEnvironmentImage("environment-zone-king", 1)],
    },
    {
      id: "environment-zone-common",
      name: "公共活动区",
      area: "室内 220㎡ · 花园 70㎡",
      description:
        "公区主要作为人类生活区以及我们宠物猫和退役种猫的生活空间，会有粘人母猫和打齐疫苗的小猫散养在这里。",
      images: [createDefaultEnvironmentImage("environment-zone-common", 1)],
    },
    {
      id: "environment-zone-care",
      name: "隔离房 · 医疗间 · 洗护间",
      area: "功能空间",
      description:
        "一间小的隔离房用于隔离新到家的小猫；一间医疗间可以为小猫进行基础体检和隔离生病的小猫；一间洗护间配有全套赛洗设备。",
      images: [createDefaultEnvironmentImage("environment-zone-care", 1)],
    },
  ],
};

export function cloneEnvironmentContent(content: EnvironmentContent = DEFAULT_ENVIRONMENT_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as EnvironmentContent;
}

export function normalizeEnvironmentContent(value: unknown): EnvironmentContent {
  if (!value || typeof value !== "object") return cloneEnvironmentContent();

  const input = value as Partial<EnvironmentContent>;
  const base = cloneEnvironmentContent();
  const zones = Array.isArray(input.zones)
    ? input.zones
        .filter((zone) => Boolean(zone && typeof zone === "object"))
        .map((zone, index) => normalizeEnvironmentZone(zone, index))
    : base.zones;

  return {
    version: 1,
    intro: typeof input.intro === "string" ? input.intro : base.intro,
    imageAspectRatio: normalizeEnvironmentAspectRatio(input.imageAspectRatio),
    zones,
  };
}

export function normalizeEnvironmentAspectRatio(value: unknown): EnvironmentAspectRatioValue {
  if (!value || typeof value !== "object") return { width: 16, height: 9 };
  const input = value as Partial<EnvironmentAspectRatioValue>;
  return sanitizeEnvironmentAspectRatio(input.width, input.height);
}

export function sanitizeEnvironmentAspectRatio(
  width: unknown,
  height: unknown,
): EnvironmentAspectRatioValue {
  const parsedWidth = typeof width === "number" ? width : Number(width);
  const parsedHeight = typeof height === "number" ? height : Number(height);
  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) {
    return { width: 16, height: 9 };
  }

  const nextWidth = Math.max(1, Math.min(32, parsedWidth));
  const nextHeight = Math.max(1, Math.min(32, parsedHeight));
  const ratio = nextWidth / nextHeight;
  if (ratio < 0.35 || ratio > 3.5) return { width: 16, height: 9 };

  return {
    width: roundRatioValue(nextWidth),
    height: roundRatioValue(nextHeight),
  };
}

export function formatEnvironmentAspectRatio({ width, height }: EnvironmentAspectRatioValue) {
  return `${width} / ${height}`;
}

function normalizeEnvironmentZone(value: unknown, index: number): EnvironmentZone {
  const input = value as Partial<EnvironmentZone>;
  const fallbackId = `environment-zone-${index + 1}`;
  const id = normalizeId(input.id, fallbackId);
  const images = Array.isArray(input.images)
    ? input.images
        .filter((image) => Boolean(image && typeof image === "object"))
        .map((image, imageIndex) => normalizeEnvironmentImage(image, id, imageIndex))
    : [];

  return {
    id,
    name: normalizeText(input.name, `环境区域 ${index + 1}`),
    area: typeof input.area === "string" ? input.area : "",
    description: typeof input.description === "string" ? input.description : "",
    images: images.length ? images : [createDefaultEnvironmentImage(id, 1)],
  };
}

function normalizeEnvironmentImage(
  value: unknown,
  zoneId: string,
  index: number,
): EnvironmentZoneImage {
  const input = value as Partial<EnvironmentZoneImage>;
  return {
    id: normalizeId(input.id, `${zoneId}-image-${index + 1}`),
    imageId: typeof input.imageId === "string" && input.imageId ? input.imageId : undefined,
    focalPoint: normalizeFocalPoint(input.focalPoint),
  };
}

function createDefaultEnvironmentImage(zoneId: string, index: number): EnvironmentZoneImage {
  return {
    id: `${zoneId}-image-${index}`,
    focalPoint: { x: 50, y: 50 },
  };
}

function normalizeFocalPoint(value: unknown): EnvironmentImageFocalPoint {
  if (!value || typeof value !== "object") return { x: 50, y: 50 };
  const input = value as Partial<EnvironmentImageFocalPoint>;
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
