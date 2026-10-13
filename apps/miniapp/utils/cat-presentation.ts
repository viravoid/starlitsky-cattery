import type { CatData, CatMediaAssetData } from "@starlitsky/shared";

export type CatPresentationEntry = "listCard" | "breedingPlanCard" | "communityProfile";
export type ImageFrameMode = "aspectFill" | "aspectFit";

export interface ImageFrameView {
  aspectRatio: number;
  id: string;
  mode: ImageFrameMode;
  style: string;
  url: string;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LegacyPresentation {
  objectPositionX: number;
  objectPositionY: number;
  zoom: number;
}

const LIST_CARD_FALLBACK_OVERRIDES: Record<string, Partial<LegacyPresentation>> = {
  "public-content-cat-luoyiyi": { objectPositionY: 20 },
  "public-content-cat-xiaobianmu": { objectPositionY: 20 },
  "public-content-cat-manao": { objectPositionY: 20 },
  "public-content-cat-shuilongyin": { objectPositionY: 20 },
};

const ENTRY_ASPECT_RATIO: Record<CatPresentationEntry, number> = {
  listCard: 16 / 10,
  breedingPlanCard: 1,
  communityProfile: 4 / 3,
};

export function resolveCatFrame(cat: CatData, entry: CatPresentationEntry): ImageFrameView | null {
  const media = sortedImageMedia(cat.mediaAssets);
  if (!media.length) return null;
  const cover = media.find((item) => item.usage === "cover") ?? media[0];
  const galleryIds = media.map((item) => item.id);
  const availableIds = uniqueIds([cover.id, ...galleryIds]);
  const manualSelections = asRecord(cat.entryCoverSelections);
  const selection = asRecord(manualSelections?.[entry]);
  const selectedId = stringOr(selection?.imageId, "");
  const selectedMedia =
    selectedId && availableIds.includes(selectedId)
      ? media.find((item) => item.id === selectedId)
      : null;
  const targetMedia = selectedMedia ?? cover;
  const aspectRatio = ENTRY_ASPECT_RATIO[entry];

  if (selectedMedia) {
    const cropRect = normalizeCropRect(selection?.cropRect);
    if (cropRect) return toCropFrame(targetMedia, aspectRatio, cropRect);
  }

  const legacy = normalizeLegacyPresentation(asRecord(cat.coverPresentations)?.[entry]);
  if (legacy) return toLegacyFrame(targetMedia, aspectRatio, legacy);

  const fallbackAspectRatio = entry === "listCard" ? 218 / 236 : aspectRatio;
  return toLegacyFrame(
    targetMedia,
    fallbackAspectRatio,
    fallbackLegacy(entry, cat.id),
  );
}

export function resolveCatDetailFrames(cat: CatData): ImageFrameView[] {
  const media = sortedImageMedia(cat.mediaAssets);
  if (!media.length) return [];
  const cover = media.find((item) => item.usage === "cover") ?? media[0];
  const manualPresentations = asRecord(cat.detailImagePresentations);
  const legacyCoverPresentations = asRecord(cat.coverPresentations);
  const legacyDetailPresentations = asRecord(cat.detailCarouselPresentations);

  return media
    .map((item) => {
      const manual = asRecord(manualPresentations?.[item.id]);
      if (manual?.mode === "original") return toOriginalFrame(item, 4 / 5);
      if (manual?.mode === "crop") {
        const cropRect = normalizeCropRect(manual.cropRect);
        if (cropRect) return toCropFrame(item, 4 / 5, cropRect);
      }

      const legacy =
        normalizeLegacyPresentation(legacyDetailPresentations?.[item.id]) ??
        (item.id === cover.id
          ? normalizeLegacyPresentation(legacyCoverPresentations?.detailHero)
          : null);
      return toLegacyFrame(item, 4 / 5, legacy ?? fallbackLegacy("breedingPlanCard"));
    })
    .filter((item): item is ImageFrameView => Boolean(item.url));
}

export function firstCatImageUrl(cat: CatData) {
  return resolveCatFrame(cat, "listCard")?.url || "";
}

function toOriginalFrame(media: CatMediaAssetData, aspectRatio: number): ImageFrameView {
  return {
    aspectRatio,
    id: media.id,
    mode: "aspectFit",
    style: "",
    url: media.sourceUrl || media.thumbnailUrl || "",
  };
}

function toCropFrame(
  media: CatMediaAssetData,
  aspectRatio: number,
  cropRect: CropRect,
): ImageFrameView {
  const naturalWidth = positiveNumber(media.width);
  const naturalHeight = positiveNumber(media.height);
  if (!naturalWidth || !naturalHeight) return toCoverFrame(media, aspectRatio);

  const cropPixelWidth = cropRect.width * naturalWidth;
  const cropPixelHeight = cropRect.height * naturalHeight;
  const scale = Math.max(100 / cropPixelWidth, 100 / aspectRatio / cropPixelHeight);
  const widthPercent = naturalWidth * scale;
  const heightPercent = naturalHeight * scale * aspectRatio;
  const leftPercent = clampCoverOffset(-(cropRect.x * naturalWidth * scale), widthPercent);
  const topPercent = clampCoverOffset(
    -(cropRect.y * naturalHeight * scale * aspectRatio),
    heightPercent,
  );

  if (!coversFrame(widthPercent, heightPercent, leftPercent, topPercent)) {
    return toCoverFrame(media, aspectRatio);
  }

  return {
    aspectRatio,
    id: media.id,
    mode: "aspectFit",
    style: [
      `width:${round(widthPercent)}%`,
      `height:${round(heightPercent)}%`,
      `left:${round(leftPercent)}%`,
      `top:${round(topPercent)}%`,
    ].join(";"),
    url: media.sourceUrl || media.thumbnailUrl || "",
  };
}

function toLegacyFrame(
  media: CatMediaAssetData,
  aspectRatio: number,
  legacy: LegacyPresentation,
): ImageFrameView {
  const naturalWidth = positiveNumber(media.width);
  const naturalHeight = positiveNumber(media.height);
  if (!naturalWidth || !naturalHeight) return toCoverFrame(media, aspectRatio);

  const frameWidth = 100;
  const frameHeight = frameWidth / aspectRatio;
  const scale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight) * legacy.zoom;
  const widthPercent = naturalWidth * scale;
  const heightPercent = naturalHeight * scale * aspectRatio;
  const leftPercent = clampCoverOffset(
    (100 - widthPercent) * (legacy.objectPositionX / 100),
    widthPercent,
  );
  const topPercent = clampCoverOffset(
    (100 - heightPercent) * (legacy.objectPositionY / 100),
    heightPercent,
  );

  if (!coversFrame(widthPercent, heightPercent, leftPercent, topPercent)) {
    return toCoverFrame(media, aspectRatio);
  }

  return {
    aspectRatio,
    id: media.id,
    mode: "aspectFit",
    style: [
      `width:${round(widthPercent)}%`,
      `height:${round(heightPercent)}%`,
      `left:${round(leftPercent)}%`,
      `top:${round(topPercent)}%`,
    ].join(";"),
    url: media.sourceUrl || media.thumbnailUrl || "",
  };
}

function toCoverFrame(media: CatMediaAssetData, aspectRatio: number): ImageFrameView {
  return {
    aspectRatio,
    id: media.id,
    mode: "aspectFill",
    style: "",
    url: media.sourceUrl || media.thumbnailUrl || "",
  };
}

function sortedImageMedia(mediaAssets: CatMediaAssetData[] = []) {
  return mediaAssets
    .filter((item) => item.kind === "image" && (item.sourceUrl || item.thumbnailUrl))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

function normalizeCropRect(value: unknown): CropRect | null {
  const input = asRecord(value);
  const rawX = numberOr(input?.x, NaN);
  const rawY = numberOr(input?.y, NaN);
  const width = unit(input?.width);
  const height = unit(input?.height);
  if (
    !Number.isFinite(rawX) ||
    !Number.isFinite(rawY) ||
    width == null ||
    height == null ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  const maxX = Math.max(0, 1 - width);
  const maxY = Math.max(0, 1 - height);
  return {
    x: clamp(rawX, 0, maxX),
    y: clamp(rawY, 0, maxY),
    width,
    height,
  };
}

function normalizeLegacyPresentation(value: unknown): LegacyPresentation | null {
  const input = asRecord(value);
  const x = numberOr(input?.objectPositionX, NaN);
  const y = numberOr(input?.objectPositionY, NaN);
  const zoom = numberOr(input?.zoom, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) return null;
  return {
    objectPositionX: Math.max(0, Math.min(100, x)),
    objectPositionY: Math.max(0, Math.min(100, y)),
    zoom: Math.max(1, Math.min(3, zoom)),
  };
}

function fallbackLegacy(
  entry: CatPresentationEntry,
  catId = "",
): LegacyPresentation {
  const base: LegacyPresentation = {
    objectPositionX: 50,
    objectPositionY: entry === "listCard" ? 30 : 34,
    zoom: 1,
  };

  if (entry !== "listCard") return base;

  return {
    ...base,
    ...(LIST_CARD_FALLBACK_OVERRIDES[catId] ?? {}),
  };
}

function uniqueIds(values: Array<string | undefined>) {
  return values.filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function positiveNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function numberOr(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampCoverOffset(offset: number, size: number) {
  if (!Number.isFinite(offset) || !Number.isFinite(size) || size < 100) return 0;
  return clamp(offset, 100 - size, 0);
}

function coversFrame(width: number, height: number, left: number, top: number) {
  return (
    width >= 100 &&
    height >= 100 &&
    left <= 0 &&
    top <= 0 &&
    left + width >= 100 &&
    top + height >= 100
  );
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
