import type { CatData, CatMediaAssetData } from "@starlitsky/shared";

export type CatPresentationEntry = "listCard" | "breedingPlanCard" | "communityProfile";
export type ImageFrameMode = "aspectFill" | "aspectFit" | "scaleToFill";

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

const ENTRY_ASPECT_RATIO: Record<CatPresentationEntry, number> = {
  listCard: 16 / 10,
  breedingPlanCard: 1,
  communityProfile: 4 / 3,
};

export function resolveCatFrame(
  cat: CatData,
  entry: CatPresentationEntry,
): ImageFrameView | null {
  const media = sortedImageMedia(cat.mediaAssets);
  if (!media.length) return null;
  const cover = media.find((item) => item.usage === "cover") ?? media[0];
  const galleryIds = media.map((item) => item.id);
  const availableIds = uniqueIds([cover.id, ...galleryIds]);
  const manualSelections = asRecord(cat.entryCoverSelections);
  const selection = asRecord(manualSelections?.[entry]);
  const selectedId = stringOr(selection?.imageId, "");
  const selectedMedia = selectedId && availableIds.includes(selectedId)
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

  return toLegacyFrame(targetMedia, aspectRatio, fallbackLegacy(entry));
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
  const naturalWidth = positiveNumber(media.width) ?? 1;
  const naturalHeight = positiveNumber(media.height) ?? 1;
  const cropPixelWidth = cropRect.width * naturalWidth;
  const cropPixelHeight = cropRect.height * naturalHeight;
  const scale = Math.max(100 / cropPixelWidth, 100 / aspectRatio / cropPixelHeight);
  const widthPercent = naturalWidth * scale;
  const heightPercent = naturalHeight * scale * aspectRatio;
  const leftPercent = -(cropRect.x * naturalWidth * scale);
  const topPercent = -(cropRect.y * naturalHeight * scale * aspectRatio);

  return {
    aspectRatio,
    id: media.id,
    mode: "scaleToFill",
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
  return {
    aspectRatio,
    id: media.id,
    mode: "aspectFill",
    style: [
      `object-position:${round(legacy.objectPositionX)}% ${round(legacy.objectPositionY)}%`,
      `transform:scale(${round(legacy.zoom)})`,
      "transform-origin:center center",
    ].join(";"),
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
  const x = unit(input?.x);
  const y = unit(input?.y);
  const width = unit(input?.width);
  const height = unit(input?.height);
  if (x == null || y == null || width == null || height == null || width <= 0 || height <= 0) {
    return null;
  }
  return {
    x: Math.min(x, 1 - width),
    y: Math.min(y, 1 - height),
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

function fallbackLegacy(entry: CatPresentationEntry): LegacyPresentation {
  return {
    objectPositionX: 50,
    objectPositionY: entry === "listCard" ? 30 : 34,
    zoom: 1,
  };
}

function uniqueIds(values: Array<string | undefined>) {
  return values.filter(
    (value, index, list): value is string => Boolean(value) && list.indexOf(value) === index,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
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

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
