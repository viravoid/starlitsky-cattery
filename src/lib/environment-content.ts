import { ENVIRONMENT_REAL_IMAGE_ASSIGNMENTS } from "./real-photo-manifest.generated";

export type EnvironmentImageFocalPoint = {
  x: number;
  y: number;
};

export type EnvironmentAspectRatioValue = {
  width: number;
  height: number;
};

export type EnvironmentRoomImage = {
  id: string;
  imageId?: string;
  focalPoint: EnvironmentImageFocalPoint;
};

export type EnvironmentRoom = {
  id: string;
  title: string;
  description: string;
  images: EnvironmentRoomImage[];
};

export type EnvironmentSection = {
  id: string;
  title: string;
  summary: string;
  meta: string;
  coverImageId?: string;
  rooms: EnvironmentRoom[];
};

export type EnvironmentContent = {
  version: 1;
  intro: string;
  imageAspectRatio: EnvironmentAspectRatioValue;
  sections: EnvironmentSection[];
};

type LegacyEnvironmentZone = {
  id?: string;
  name?: string;
  area?: string;
  description?: string;
  images?: EnvironmentRoomImage[];
};

type LegacyEnvironmentContent = {
  version?: 1;
  intro?: string;
  imageAspectRatio?: EnvironmentAspectRatioValue;
  zones?: LegacyEnvironmentZone[];
};

const DEFAULT_INTRO =
  "猫舍共四层，室内面积 600 余平，绝大部分空间用于饲养猫咪，有科学的空间规划，保证动物福利，拒绝笼养。小部分为人类生活区，允许宠物猫和退役种猫自由活动。有两个室外庭院和一个下沉式院子，供小猫放风散步。";

export const DEFAULT_ENVIRONMENT_CONTENT: EnvironmentContent = {
  version: 1,
  intro: DEFAULT_INTRO,
  imageAspectRatio: { width: 4, height: 3 },
  sections: [
    {
      id: "environment-zone-nursery",
      title: "母婴区",
      summary: "孕猫房和育婴房挨着我们的卧室，怀孕 30 天以上的母猫和 1-2 月龄小奶猫生活在这里。",
      meta: "2 个房间 · 约 52㎡",
      rooms: [
        {
          id: "environment-room-nursery-pregnancy",
          title: "孕猫房",
          description: "临产前的母猫会先在这里适应待产环境，方便我们随时观察状态。",
          images: createDefaultEnvironmentImages("environment-room-nursery-pregnancy", 2),
        },
        {
          id: "environment-room-nursery-newborn",
          title: "育婴房",
          description: "小奶猫出生后会在这里和妈妈一起度过最需要安静陪伴的阶段。",
          images: createDefaultEnvironmentImages("environment-room-nursery-newborn", 3),
        },
      ],
    },
    {
      id: "environment-zone-kitten",
      title: "幼猫生活区",
      summary:
        "幼猫区共分为四个房间，有三个小房间供 2-4 月龄不同窝次的小猫生活，和一个大房间供 4 月龄以上打齐疫苗的宝宝们自由活动。",
      meta: "4 个房间 · 约 66㎡",
      rooms: [
        {
          id: "environment-room-kitten-1",
          title: "房间一",
          description: "供一窝小猫进行基础社会化训练和日常休息。",
          images: createDefaultEnvironmentImages("environment-room-kitten-1", 2),
        },
        {
          id: "environment-room-kitten-2",
          title: "房间二",
          description: "根据窝次和月龄差异，为小猫提供独立但稳定的生活空间。",
          images: createDefaultEnvironmentImages("environment-room-kitten-2", 2),
        },
        {
          id: "environment-room-kitten-3",
          title: "房间三",
          description: "用于不同窝次的小猫错峰活动和适应新的互动节奏。",
          images: createDefaultEnvironmentImages("environment-room-kitten-3", 2),
        },
        {
          id: "environment-room-kitten-common",
          title: "大活动房",
          description: "4 月龄以上并打齐疫苗的宝宝会在这里自由活动、奔跑和玩耍。",
          images: createDefaultEnvironmentImages("environment-room-kitten-common", 6),
        },
      ],
    },
    {
      id: "environment-zone-queen",
      title: "种母生活区",
      summary:
        "由五个房间组成。我们会按母猫的猫际关系为她们分配合适的房间，有部分母猫和我们生活在客厅卧室。",
      meta: "5 个房间 · 约 102㎡",
      rooms: [
        {
          id: "environment-room-queen-1",
          title: "房间一",
          description: "用于关系稳定的一组母猫生活、休息和观察状态。",
          images: createDefaultEnvironmentImages("environment-room-queen-1", 8),
        },
        {
          id: "environment-room-queen-2",
          title: "房间二",
          description: "根据不同母猫的性格和节奏做独立分房安排。",
          images: createDefaultEnvironmentImages("environment-room-queen-2", 4),
        },
        {
          id: "environment-room-queen-3",
          title: "房间三",
          description: "给需要单独安静空间的母猫使用。",
          images: createDefaultEnvironmentImages("environment-room-queen-3", 3),
        },
        {
          id: "environment-room-queen-4",
          title: "房间四",
          description: "日常会根据母猫之间的关系灵活调整分配。",
          images: createDefaultEnvironmentImages("environment-room-queen-4", 3),
        },
        {
          id: "environment-room-queen-common",
          title: "客厅 / 卧室共居区",
          description: "有部分母猫会和我们一起生活在客厅或卧室，保持更多陪伴和互动。",
          images: createDefaultEnvironmentImages("environment-room-queen-common", 2),
        },
      ],
    },
    {
      id: "environment-zone-king",
      title: "种公生活区",
      summary:
        "我们准备了三个种公房间单独隔离公猫，和三个室外隔间，还有一个院子可以让我们的猫猫国王充分晒太阳、呼吸新鲜空气。打齐疫苗的小猫也可以来院子玩耍。",
      meta: "3 个种公房 + 3 个室外隔间 · 室内约 65㎡ / 室外约 40㎡",
      rooms: [
        {
          id: "environment-room-king-1",
          title: "种公房一",
          description: "单独隔离公猫，确保各自有稳定而安全的活动节奏。",
          images: createDefaultEnvironmentImages("environment-room-king-1", 4),
        },
        {
          id: "environment-room-king-2",
          title: "种公房二",
          description: "根据状态安排轮换使用，保持空间利用和独处舒适度。",
          images: createDefaultEnvironmentImages("environment-room-king-2", 3),
        },
        {
          id: "environment-room-king-3",
          title: "种公房三",
          description: "用于需要单独观察和安静休息的种公。",
          images: createDefaultEnvironmentImages("environment-room-king-3", 3),
        },
        {
          id: "environment-room-king-outdoor",
          title: "室外隔间",
          description: "和三个室外隔间相连，方便晒太阳、通风和短时间放风。",
          images: createDefaultEnvironmentImages("environment-room-king-outdoor", 6),
        },
        {
          id: "environment-room-king-yard",
          title: "院子",
          description: "让我们的猫猫国王充分晒太阳、呼吸新鲜空气，打齐疫苗的小猫也会来院子玩耍。",
          images: createDefaultEnvironmentImages("environment-room-king-yard", 2),
        },
      ],
    },
    {
      id: "environment-zone-common",
      title: "公共活动区",
      summary:
        "公区主要作为人类生活区以及我们宠物猫和退役种猫的生活空间，会有粘人母猫和打齐疫苗的小猫散养在这里。",
      meta: "室内 220㎡ · 花园 70㎡",
      rooms: [
        {
          id: "environment-room-common-living",
          title: "客厅活动区",
          description: "宠物猫、退役种猫和部分粘人母猫会在这里和我们一起生活。",
          images: createDefaultEnvironmentImages("environment-room-common-living", 5),
        },
        {
          id: "environment-room-common-garden",
          title: "庭院 / 下沉院",
          description: "两个庭院和下沉式院子会在合适时段开放，供小猫和大猫放风散步。",
          images: createDefaultEnvironmentImages("environment-room-common-garden", 6),
        },
      ],
    },
    {
      id: "environment-zone-care",
      title: "隔离房 · 医疗间 · 洗护间",
      summary:
        "一间小的隔离房用于隔离新到家的小猫；一间医疗间可以为小猫进行基础体检和隔离生病的小猫；一间洗护间配有全套赛洗设备。",
      meta: "3 个功能空间",
      rooms: [
        {
          id: "environment-room-care-isolation",
          title: "隔离房",
          description: "新到家的小猫会先在隔离房独立观察，确认状态稳定后再进入日常生活区。",
          images: createDefaultEnvironmentImages("environment-room-care-isolation", 2),
        },
        {
          id: "environment-room-care-medical",
          title: "医疗间",
          description: "用于基础体检和生病小猫的短期隔离观察。",
          images: createDefaultEnvironmentImages("environment-room-care-medical", 2),
        },
        {
          id: "environment-room-care-grooming",
          title: "洗护间",
          description: "配有全套赛洗设备，方便洗护、吹毛和日常整理。",
          images: createDefaultEnvironmentImages("environment-room-care-grooming", 3),
        },
      ],
    },
  ],
};
applyDefaultEnvironmentImageAssignments(DEFAULT_ENVIRONMENT_CONTENT);

export function cloneEnvironmentContent(content: EnvironmentContent = DEFAULT_ENVIRONMENT_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as EnvironmentContent;
}

export function normalizeEnvironmentContent(value: unknown): EnvironmentContent {
  if (!value || typeof value !== "object") return cloneEnvironmentContent();

  const input = value as Partial<EnvironmentContent> & LegacyEnvironmentContent;
  const base = cloneEnvironmentContent();
  const sections = Array.isArray(input.sections)
    ? input.sections
        .filter((section) => Boolean(section && typeof section === "object"))
        .map((section, index) => normalizeEnvironmentSection(section, index))
    : Array.isArray(input.zones)
      ? input.zones
          .filter((zone) => Boolean(zone && typeof zone === "object"))
          .map((zone, index) => migrateLegacyZone(zone, index))
      : base.sections;

  return {
    version: 1,
    intro: typeof input.intro === "string" ? input.intro : base.intro,
    imageAspectRatio: normalizeEnvironmentAspectRatio(input.imageAspectRatio),
    sections,
  };
}

export function normalizeEnvironmentAspectRatio(value: unknown): EnvironmentAspectRatioValue {
  if (!value || typeof value !== "object") return { width: 4, height: 3 };
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

export function formatEnvironmentAspectRatio({ width, height }: EnvironmentAspectRatioValue) {
  return `${width} / ${height}`;
}

export function getEnvironmentSectionById(
  content: EnvironmentContent,
  sectionId: string,
): EnvironmentSection | undefined {
  return content.sections.find((section) => section.id === sectionId);
}

export function getEnvironmentSectionCoverImage(section: EnvironmentSection) {
  const images = getEnvironmentSectionImages(section);
  if (!section.coverImageId) return images[0];
  return images.find(({ image }) => image.imageId === section.coverImageId) ?? images[0];
}

export function getEnvironmentSectionImages(section: EnvironmentSection) {
  return section.rooms.flatMap((room) =>
    room.images.map((image) => ({
      roomId: room.id,
      roomTitle: room.title,
      image,
    })),
  );
}

function normalizeEnvironmentSection(value: unknown, index: number): EnvironmentSection {
  const input = value as Partial<EnvironmentSection> & Partial<LegacyEnvironmentZone>;
  const fallbackId = `environment-section-${index + 1}`;
  const id = normalizeId(input.id, fallbackId);
  const rooms = Array.isArray(input.rooms)
    ? input.rooms
        .filter((room) => Boolean(room && typeof room === "object"))
        .map((room, roomIndex) => normalizeEnvironmentRoom(room, id, roomIndex))
    : Array.isArray(input.images)
      ? [createLegacyFallbackRoom(id, input.images, input.description)]
      : [];

  return {
    id,
    title: normalizeText(input.title ?? input.name, `环境分区 ${index + 1}`),
    summary:
      typeof input.summary === "string"
        ? input.summary
        : typeof input.description === "string"
          ? input.description
          : "",
    meta:
      typeof input.meta === "string"
        ? input.meta
        : typeof input.area === "string"
          ? input.area
          : "",
    coverImageId: normalizeOptionalId(input.coverImageId),
    rooms: rooms.length ? rooms : [createDefaultEnvironmentRoom(id, 1)],
  };
}

function migrateLegacyZone(value: unknown, index: number): EnvironmentSection {
  return normalizeEnvironmentSection(value, index);
}

function normalizeEnvironmentRoom(
  value: unknown,
  sectionId: string,
  index: number,
): EnvironmentRoom {
  const input = value as Partial<EnvironmentRoom>;
  const fallbackId = `${sectionId}-room-${index + 1}`;
  const id = normalizeId(input.id, fallbackId);
  const images = Array.isArray(input.images)
    ? input.images
        .filter((image) => Boolean(image && typeof image === "object"))
        .map((image, imageIndex) => normalizeEnvironmentImage(image, id, imageIndex))
    : [];

  return {
    id,
    title: normalizeText(input.title, `房间 ${index + 1}`),
    description: typeof input.description === "string" ? input.description : "",
    images,
  };
}

function normalizeEnvironmentImage(
  value: unknown,
  roomId: string,
  index: number,
): EnvironmentRoomImage {
  const input = value as Partial<EnvironmentRoomImage>;
  return {
    id: normalizeId(input.id, `${roomId}-image-${index + 1}`),
    imageId: typeof input.imageId === "string" && input.imageId ? input.imageId : undefined,
    focalPoint: normalizeFocalPoint(input.focalPoint),
  };
}

function createLegacyFallbackRoom(
  sectionId: string,
  images: unknown[],
  description: unknown,
): EnvironmentRoom {
  return {
    id: `${sectionId}-room-default`,
    title: "环境展示",
    description: typeof description === "string" ? description : "",
    images: images.map((image, index) =>
      normalizeEnvironmentImage(image, `${sectionId}-room-default`, index),
    ),
  };
}

function createDefaultEnvironmentRoom(sectionId: string, index: number): EnvironmentRoom {
  const roomId = `${sectionId}-room-${index}`;
  return {
    id: roomId,
    title: "环境展示",
    description: "",
    images: [],
  };
}

function createDefaultEnvironmentImages(roomId: string, count: number) {
  return Array.from({ length: count }, (_, index) =>
    createDefaultEnvironmentImage(roomId, index + 1),
  );
}

function createDefaultEnvironmentImage(roomId: string, index: number): EnvironmentRoomImage {
  return {
    id: `${roomId}-image-${index}`,
    focalPoint: { x: 50, y: 50 },
  };
}

function applyDefaultEnvironmentImageAssignments(content: EnvironmentContent) {
  content.sections = content.sections.map((section) => {
    const assignment =
      ENVIRONMENT_REAL_IMAGE_ASSIGNMENTS[
        section.id as keyof typeof ENVIRONMENT_REAL_IMAGE_ASSIGNMENTS
      ];

    return {
      ...section,
      coverImageId: assignment?.coverImageId,
      rooms: section.rooms.map((room) => {
        const imageIds = assignment?.rooms?.[room.id as keyof typeof assignment.rooms];
        return {
          ...room,
          images: imageIds ? createAssignedEnvironmentImages(room.id, imageIds) : [],
        };
      }),
    };
  });
}

function createAssignedEnvironmentImages(roomId: string, imageIds: readonly string[]) {
  return imageIds.map((imageId, index) => ({
    id: `${roomId}-image-${index + 1}`,
    imageId,
    focalPoint: { x: 50, y: 50 },
  }));
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

function normalizeOptionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function clampPercent(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function roundRatioValue(value: number) {
  return Math.round(value * 100) / 100;
}
