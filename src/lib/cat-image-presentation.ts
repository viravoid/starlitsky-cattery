import {
  CAT_COVER_PRESENTATION_KEYS,
  type CatCoverPresentations,
  type CropRect,
  type DetailCarouselPresentations,
  type DetailImagePresentation,
  type DetailImagePresentations,
  type EntryCoverSelections,
} from "./cattery-store";
import { REAL_PHOTO_ASSET_MAP } from "./real-photo-manifest.generated";

export type CatImageFrame = "landscape-card" | "square-gallery" | "wide-cover";

export type CatImageFocalPoint = {
  x: number;
  y: number;
};

export type LegacyResolvedPresentation = {
  objectPositionX: number;
  objectPositionY: number;
  zoom: number;
};

export type ResolvedCatCoverPresentation =
  | {
      mode: "crop";
      imageId?: string;
      cropRect: CropRect;
      aspectRatio: number;
      source: "manual";
    }
  | {
      mode: "legacy";
      imageId?: string;
      legacy: LegacyResolvedPresentation;
      aspectRatio: number;
      source: "legacy" | "fallback";
    };

export type ResolvedDetailCarouselPresentation =
  | {
      mode: "original";
      imageId?: string;
      source: "manual";
    }
  | {
      mode: "crop";
      imageId?: string;
      cropRect: CropRect;
      aspectRatio: number;
      source: "manual";
    }
  | {
      mode: "legacy";
      imageId?: string;
      legacy: LegacyResolvedPresentation;
      aspectRatio: number;
      source: "legacy" | "fallback";
    };

export type CatCoverPresentationEntry = Exclude<
  (typeof CAT_COVER_PRESENTATION_KEYS)[number],
  "detailHero"
>;

const DETAIL_ASPECT_RATIO_LABELS = new Map<number, string>([
  [1, "1:1"],
  [4 / 3, "4:3"],
  [3 / 4, "3:4"],
  [4 / 5, "4:5"],
  [16 / 9, "16:9"],
]);

export const DETAIL_CAROUSEL_ASPECT_RATIO_OPTIONS = [
  { value: 1, label: "1:1" },
  { value: 4 / 3, label: "4:3" },
  { value: 3 / 4, label: "3:4" },
  { value: 4 / 5, label: "4:5" },
  { value: 16 / 9, label: "16:9" },
  { value: 0, label: "自定义" },
] as const;

export const CAT_COVER_PRESENTATION_ENTRY_META: Record<
  CatCoverPresentationEntry,
  {
    label: string;
    aspectRatio: number;
    aspectRatioText: string;
    frame: CatImageFrame;
  }
> = {
  listCard: {
    label: "列表卡片",
    aspectRatio: 16 / 10,
    aspectRatioText: "16 / 10",
    frame: "landscape-card",
  },
  breedingPlanCard: {
    label: "繁育计划",
    aspectRatio: 1,
    aspectRatioText: "1 / 1",
    frame: "square-gallery",
  },
  communityProfile: {
    label: "社区档案",
    aspectRatio: 4 / 3,
    aspectRatioText: "4 / 3",
    frame: "wide-cover",
  },
};

type ImageOrientation = "portrait" | "landscape" | "square" | "unknown";

const DEFAULT_FRAME_FOCAL_POINTS: Record<
  CatImageFrame,
  Record<ImageOrientation, CatImageFocalPoint>
> = {
  "landscape-card": {
    portrait: { x: 50, y: 24 },
    landscape: { x: 50, y: 46 },
    square: { x: 50, y: 42 },
    unknown: { x: 50, y: 30 },
  },
  "square-gallery": {
    portrait: { x: 50, y: 28 },
    landscape: { x: 50, y: 48 },
    square: { x: 50, y: 45 },
    unknown: { x: 50, y: 34 },
  },
  "wide-cover": {
    portrait: { x: 50, y: 26 },
    landscape: { x: 50, y: 46 },
    square: { x: 50, y: 43 },
    unknown: { x: 50, y: 32 },
  },
};

const CAT_FOCAL_POINT_OVERRIDES: Partial<Record<string, CatImageFocalPoint>> = {
  chonglou: { x: 50, y: 20 },
  huqing: { x: 50, y: 27 },
  luoyiyi: { x: 50, y: 25 },
  tianhe: { x: 50, y: 30 },
  xiaoxiaxian: { x: 50, y: 25 },
  yunmu: { x: 50, y: 26 },
  zhaoyue: { x: 50, y: 27 },
};

export function getResolvedCatCoverPresentation({
  catId,
  entry,
  coverImageId,
  galleryImageIds,
  manualSelections,
  legacyPresentations,
}: {
  catId?: string;
  entry: CatCoverPresentationEntry;
  coverImageId?: string;
  galleryImageIds?: string[];
  manualSelections?: EntryCoverSelections;
  legacyPresentations?: CatCoverPresentations;
}): ResolvedCatCoverPresentation {
  const availableImageIds = getAvailableImageIds(coverImageId, galleryImageIds);
  const manual = manualSelections?.[entry];
  const selectedImageId =
    manual?.imageId && availableImageIds.includes(manual.imageId) ? manual.imageId : undefined;
  if (manual?.imageId && availableImageIds.includes(manual.imageId) && manual.cropRect) {
    return {
      mode: "crop",
      imageId: manual.imageId,
      cropRect: manual.cropRect,
      aspectRatio: CAT_COVER_PRESENTATION_ENTRY_META[entry].aspectRatio,
      source: "manual",
    };
  }

  const imageId = selectedImageId ?? coverImageId ?? availableImageIds[0];
  const legacy = legacyPresentations?.[entry];
  if (legacy) {
    return {
      mode: "legacy",
      imageId,
      legacy,
      aspectRatio: CAT_COVER_PRESENTATION_ENTRY_META[entry].aspectRatio,
      source: "legacy",
    };
  }

  return {
    mode: "legacy",
    imageId,
    legacy: {
      objectPositionX: getCatImageFocalPoint({
        catId,
        imageId,
        frame: CAT_COVER_PRESENTATION_ENTRY_META[entry].frame,
      }).x,
      objectPositionY: getCatImageFocalPoint({
        catId,
        imageId,
        frame: CAT_COVER_PRESENTATION_ENTRY_META[entry].frame,
      }).y,
      zoom: 1,
    },
    aspectRatio: CAT_COVER_PRESENTATION_ENTRY_META[entry].aspectRatio,
    source: "fallback",
  };
}

export function getResolvedDetailCarouselPresentation({
  catId,
  imageId,
  coverImageId,
  manualPresentations,
  legacyCoverPresentations,
  legacyDetailPresentations,
}: {
  catId?: string;
  imageId?: string;
  coverImageId?: string;
  manualPresentations?: DetailImagePresentations;
  legacyCoverPresentations?: CatCoverPresentations;
  legacyDetailPresentations?: DetailCarouselPresentations;
}): ResolvedDetailCarouselPresentation {
  const manual = imageId ? manualPresentations?.[imageId] : undefined;
  if (manual?.mode === "original") {
    return {
      mode: "original",
      imageId,
      source: "manual",
    };
  }
  if (manual?.mode === "crop") {
    return {
      mode: "crop",
      imageId,
      cropRect: manual.cropRect,
      aspectRatio: manual.aspectRatio,
      source: "manual",
    };
  }

  const legacyManual = imageId ? legacyDetailPresentations?.[imageId] : undefined;
  if (legacyManual) {
    return {
      mode: "legacy",
      imageId,
      legacy: legacyManual,
      aspectRatio: 1,
      source: "legacy",
    };
  }

  const legacyDetailHero =
    imageId && coverImageId && imageId === coverImageId
      ? legacyCoverPresentations?.detailHero
      : undefined;
  if (legacyDetailHero) {
    return {
      mode: "legacy",
      imageId,
      legacy: legacyDetailHero,
      aspectRatio: 1,
      source: "legacy",
    };
  }

  const focalPoint = getCatImageFocalPoint({
    catId,
    imageId,
    frame: "square-gallery",
  });

  return {
    mode: "legacy",
    imageId,
    legacy: {
      objectPositionX: focalPoint.x,
      objectPositionY: focalPoint.y,
      zoom: 1,
    },
    aspectRatio: 1,
    source: "fallback",
  };
}

export function getCatImageFocalPoint({
  catId,
  imageId,
  frame,
}: {
  catId?: string;
  imageId?: string;
  frame: CatImageFrame;
}): CatImageFocalPoint {
  const override = catId ? CAT_FOCAL_POINT_OVERRIDES[catId] : undefined;
  if (override) return override;
  return DEFAULT_FRAME_FOCAL_POINTS[frame][getImageOrientation(imageId)];
}

export function createDefaultCropRect({
  imageWidth,
  imageHeight,
  aspectRatio,
  focalPoint,
}: {
  imageWidth: number;
  imageHeight: number;
  aspectRatio: number;
  focalPoint?: CatImageFocalPoint;
}): CropRect {
  if (imageWidth <= 0 || imageHeight <= 0 || aspectRatio <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const imageAspectRatio = imageWidth / imageHeight;
  const cropWidth =
    imageAspectRatio >= aspectRatio ? clampUnit(aspectRatio / imageAspectRatio, 1) : 1;
  const cropHeight =
    imageAspectRatio >= aspectRatio ? 1 : clampUnit(imageAspectRatio / aspectRatio, 1);

  const centerX = clampUnit((focalPoint?.x ?? 50) / 100, 0.5);
  const centerY = clampUnit((focalPoint?.y ?? 50) / 100, 0.5);
  const x = clampUnit(centerX - cropWidth / 2, 0, 1 - cropWidth);
  const y = clampUnit(centerY - cropHeight / 2, 0, 1 - cropHeight);
  return { x, y, width: cropWidth, height: cropHeight };
}

export function getCatCoverImageStyle(presentation: LegacyResolvedPresentation) {
  return {
    objectPosition: `${presentation.objectPositionX}% ${presentation.objectPositionY}%`,
    transform: `scale(${presentation.zoom})`,
    transformOrigin: "center center",
  } as const;
}

export function getAvailableImageIds(coverImageId?: string, galleryImageIds: string[] = []) {
  return [coverImageId, ...galleryImageIds].filter(
    (imageId, index, list): imageId is string =>
      Boolean(imageId) && list.indexOf(imageId) === index,
  );
}

export function sanitizeEntryCoverSelections(
  value: EntryCoverSelections | undefined,
  availableImageIds: string[],
): EntryCoverSelections | undefined {
  if (!value) return undefined;
  const next: EntryCoverSelections = {};
  for (const key of Object.keys(value) as CatCoverPresentationEntry[]) {
    const selection = value[key];
    if (!selection?.imageId || !availableImageIds.includes(selection.imageId)) continue;
    next[key] = selection;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function sanitizeDetailImagePresentations(
  value: DetailImagePresentations | undefined,
  availableImageIds: string[],
): DetailImagePresentations | undefined {
  if (!value) return undefined;
  const next: DetailImagePresentations = {};
  for (const [imageId, presentation] of Object.entries(value)) {
    if (!availableImageIds.includes(imageId) || !presentation) continue;
    next[imageId] = presentation;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function describeDetailAspectRatio(presentation?: DetailImagePresentation) {
  if (!presentation) return "自动";
  if (presentation.mode === "original") return "原图";
  return DETAIL_ASPECT_RATIO_LABELS.get(presentation.aspectRatio) ?? "自定义";
}

function getImageOrientation(imageId?: string): ImageOrientation {
  if (!imageId) return "unknown";
  const asset = REAL_PHOTO_ASSET_MAP[imageId];
  if (!asset) return "unknown";
  if (asset.outputHeight > asset.outputWidth) return "portrait";
  if (asset.outputWidth > asset.outputHeight) return "landscape";
  return "square";
}

function clampUnit(value: number, fallback: number, max = 1) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(max, Math.round(value * 10000) / 10000));
}
