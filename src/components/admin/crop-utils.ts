import type { CropRect } from "@/lib/cattery-store";

const MIN_CROP_SIZE = 0.08;

export function fitCropRectToAspectRatio(
  cropRect: CropRect,
  aspectRatio: number,
  imageAspectRatio?: number,
): CropRect {
  const normalizedAspectRatio =
    Number.isFinite(aspectRatio) &&
    aspectRatio > 0 &&
    Number.isFinite(imageAspectRatio) &&
    imageAspectRatio &&
    imageAspectRatio > 0
      ? aspectRatio / imageAspectRatio
      : aspectRatio;

  if (!Number.isFinite(normalizedAspectRatio) || normalizedAspectRatio <= 0) {
    return clampCropRect(cropRect);
  }

  const centerX = cropRect.x + cropRect.width / 2;
  const centerY = cropRect.y + cropRect.height / 2;
  const currentAspectRatio = cropRect.width / cropRect.height;

  let width = cropRect.width;
  let height = cropRect.height;

  if (currentAspectRatio < normalizedAspectRatio) {
    width = height * normalizedAspectRatio;
  } else {
    height = width / normalizedAspectRatio;
  }

  width = clampUnit(width, MIN_CROP_SIZE, 1);
  height = clampUnit(height, MIN_CROP_SIZE, 1);

  if (width / height > normalizedAspectRatio) {
    width = clampUnit(height * normalizedAspectRatio, MIN_CROP_SIZE, 1);
  } else if (width / height < normalizedAspectRatio) {
    height = clampUnit(width / normalizedAspectRatio, MIN_CROP_SIZE, 1);
  }

  return clampCropRect({
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  });
}

function clampCropRect(cropRect: CropRect): CropRect {
  const width = clampUnit(cropRect.width, MIN_CROP_SIZE, 1);
  const height = clampUnit(cropRect.height, MIN_CROP_SIZE, 1);
  return {
    x: clampUnit(cropRect.x, 0, 1 - width),
    y: clampUnit(cropRect.y, 0, 1 - height),
    width,
    height,
  };
}

function clampUnit(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value * 10000) / 10000));
}
