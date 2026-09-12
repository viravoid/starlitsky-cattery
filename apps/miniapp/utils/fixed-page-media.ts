import type { FixedPageMediaAssetData } from "@starlitsky/shared";

export const ENVIRONMENT_MEDIA_USAGES = {
  maternity: "environment:maternity",
  publicArea: "environment:public-area",
  medical: "environment:medical",
} as const;

export type FixedPageMediaLike = FixedPageMediaAssetData;

type EnvironmentMediaUsage =
  (typeof ENVIRONMENT_MEDIA_USAGES)[keyof typeof ENVIRONMENT_MEDIA_USAGES];

const ENVIRONMENT_MEDIA_USAGE_VALUES = Object.values(
  ENVIRONMENT_MEDIA_USAGES,
) as EnvironmentMediaUsage[];

export function mapFixedPageMedia(slug: string, mediaAssets: FixedPageMediaLike[] = []) {
  const images = mediaAssets.filter((item) => item.kind === "image" && getFixedPageMediaUrl(item));
  const sortedImages = [...images].sort(compareFixedPageMedia);
  const coverMedia = selectCoverMedia(slug, sortedImages);
  const environmentSlots = {
    maternity: filterByUsage(sortedImages, ENVIRONMENT_MEDIA_USAGES.maternity),
    publicArea: filterByUsage(sortedImages, ENVIRONMENT_MEDIA_USAGES.publicArea),
    medical: filterByUsage(sortedImages, ENVIRONMENT_MEDIA_USAGES.medical),
  };
  const slottedMediaIds = new Set(
    Object.values(environmentSlots)
      .flat()
      .map((item) => item.id),
  );
  const environmentUsages = new Set<string>(ENVIRONMENT_MEDIA_USAGE_VALUES);
  const galleryMedia = sortedImages.filter((item) => {
    if (coverMedia && item.id === coverMedia.id && item.usage === coverMedia.usage) return false;
    if (slug === "environment" && slottedMediaIds.has(item.id)) return false;
    if (environmentUsages.has(item.usage)) return false;
    return true;
  });

  return {
    coverMedia,
    environmentSlots,
    galleryMedia,
    previewMedia: dedupeFixedPageMedia([
      ...(coverMedia ? [coverMedia] : []),
      ...environmentSlots.maternity,
      ...environmentSlots.publicArea,
      ...environmentSlots.medical,
      ...galleryMedia,
    ]),
  };
}

export function getFixedPageMediaUrl(media: FixedPageMediaLike) {
  return media.sourceUrl || media.thumbnailUrl || "";
}

function selectCoverMedia(slug: string, images: FixedPageMediaLike[]) {
  const explicitCover = images.find((item) => item.usage === "cover");
  if (explicitCover || slug === "environment") return explicitCover ?? null;
  return images[0] ?? null;
}

function filterByUsage(images: FixedPageMediaLike[], usage: EnvironmentMediaUsage) {
  return images.filter((item) => item.usage === usage);
}

function compareFixedPageMedia(left: FixedPageMediaLike, right: FixedPageMediaLike) {
  return (
    left.sortOrder - right.sortOrder ||
    left.usage.localeCompare(right.usage) ||
    left.id.localeCompare(right.id)
  );
}

function dedupeFixedPageMedia(items: FixedPageMediaLike[]) {
  const seen = new Set<string>();
  const result: FixedPageMediaLike[] = [];
  for (const item of items) {
    const key = getFixedPageMediaUrl(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
