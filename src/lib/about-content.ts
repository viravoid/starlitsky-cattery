export type ImageFocalPoint = {
  x: number;
  y: number;
};

export type AspectRatioValue = {
  width: number;
  height: number;
};

export type AboutHeroSlide = {
  id: string;
  label: string;
  imageId?: string;
  focalPoint: ImageFocalPoint;
};

export type AboutContent = {
  version: 1;
  page: {
    title: string;
  };
  hero: {
    aspectRatio: AspectRatioValue;
    slides: AboutHeroSlide[];
  };
  body: string;
};

export const ABOUT_BODY_DEFAULT =
  "欢迎了解我们的猫舍~我们的猫舍成立于2019年位于十三朝古都西安，注册于WCF、CFA协会。由主理人星下和月七两人全职经营，作为全职“猫家长”，我们每天最重要的事就是陪伴小猫成长。\n\n我们会从小猫出生开始记录日常逐步完成各项社会化训练，会有窝次群给蹲猫家长更新这些。同时我们非常重视小猫的健康、喂养和生活环境；小猫均为别墅散养每天都会打扫消毒。\n\n目前主理人已完成繁育课g1课程和九月的行为学课程以及邓俊的响片课，仍在不断学习中。\n\n所有小猫均为自己繁育，种猫均来自国内外知名猫舍血线清晰透明，经健康筛查无先天问题，遗传病筛选（all n/n)，注重动物福利，低频率繁育保证种猫身心健康。";

export const DEFAULT_ABOUT_CONTENT: AboutContent = {
  version: 1,
  page: {
    title: "关于星月",
  },
  hero: {
    aspectRatio: { width: 16, height: 10 },
    slides: [
      {
        id: "about-hero-1",
        label: "示例图片（猫舍介绍主图，待替换）",
        focalPoint: { x: 50, y: 50 },
      },
    ],
  },
  body: ABOUT_BODY_DEFAULT,
};

export function cloneAboutContent(content: AboutContent = DEFAULT_ABOUT_CONTENT) {
  return JSON.parse(JSON.stringify(content)) as AboutContent;
}

export function normalizeFocalPoint(value: unknown): ImageFocalPoint {
  if (!value || typeof value !== "object") return { x: 50, y: 50 };
  const input = value as Partial<ImageFocalPoint>;
  return {
    x: clampPercent(input.x),
    y: clampPercent(input.y),
  };
}

export function normalizeAspectRatio(value: unknown): AspectRatioValue {
  if (!value || typeof value !== "object") return { width: 16, height: 10 };
  const input = value as Partial<AspectRatioValue>;
  return sanitizeAspectRatio(input.width, input.height);
}

export function sanitizeAspectRatio(width: unknown, height: unknown): AspectRatioValue {
  const parsedWidth = typeof width === "number" ? width : Number(width);
  const parsedHeight = typeof height === "number" ? height : Number(height);
  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) {
    return { width: 16, height: 10 };
  }

  const nextWidth = Math.max(1, Math.min(32, parsedWidth));
  const nextHeight = Math.max(1, Math.min(32, parsedHeight));
  const ratio = nextWidth / nextHeight;
  if (ratio < 0.35 || ratio > 3.5) return { width: 16, height: 10 };

  return {
    width: roundRatioValue(nextWidth),
    height: roundRatioValue(nextHeight),
  };
}

export function normalizeAboutContent(value: unknown): AboutContent {
  if (!value || typeof value !== "object") return cloneAboutContent();

  const input = value as Partial<AboutContent>;
  const base = cloneAboutContent();
  const slides = Array.isArray(input.hero?.slides)
    ? input.hero.slides
        .filter((slide) => Boolean(slide && typeof slide.id === "string" && slide.id))
        .map((slide, index) => ({
          id: String(slide.id),
          label:
            typeof slide.label === "string" && slide.label.trim()
              ? slide.label
              : `示例图片 ${index + 1}`,
          imageId: typeof slide.imageId === "string" ? slide.imageId : undefined,
          focalPoint: normalizeFocalPoint(slide.focalPoint),
        }))
    : base.hero.slides;

  return {
    version: 1,
    page: {
      title:
        typeof input.page?.title === "string" && input.page.title.trim()
          ? input.page.title
          : base.page.title,
    },
    hero: {
      aspectRatio: normalizeAspectRatio(input.hero?.aspectRatio),
      slides: slides.length ? slides : base.hero.slides,
    },
    body: typeof input.body === "string" ? input.body : base.body,
  };
}

export function formatAspectRatio({ width, height }: AspectRatioValue) {
  return `${width} / ${height}`;
}

function clampPercent(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function roundRatioValue(value: number) {
  return Math.round(value * 100) / 100;
}
