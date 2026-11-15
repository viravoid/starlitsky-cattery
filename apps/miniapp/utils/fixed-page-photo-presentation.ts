import type { FixedPageMediaAssetData } from "@starlitsky/shared";

export function resolveFixedPageFocalFrame(
  media: FixedPageMediaAssetData | null,
  aspect: unknown,
  focalPoint: unknown,
) {
  const ratio = asRecord(aspect);
  const naturalWidth = Number(media?.width);
  const naturalHeight = Number(media?.height);
  const ratioWidth = Number(ratio?.width ?? 4);
  const ratioHeight = Number(ratio?.height ?? 3);
  if (!(naturalWidth > 0 && naturalHeight > 0 && ratioWidth > 0 && ratioHeight > 0)) {
    return { mode: "aspectFill" as const, style: "" };
  }

  const aspectRatio = ratioWidth / ratioHeight;
  if (aspectRatio < 0.35 || aspectRatio > 3.5) {
    return { mode: "aspectFill" as const, style: "" };
  }
  const scale = Math.max(100 / naturalWidth, 100 / aspectRatio / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale * aspectRatio;
  const focal = asRecord(focalPoint);
  const x = percent(focal?.x);
  const y = percent(focal?.y);
  const left = Math.max(100 - width, Math.min(0, (100 - width) * x / 100));
  const top = Math.max(100 - height, Math.min(0, (100 - height) * y / 100));
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    mode: "aspectFit" as const,
    style: `width:${round(width)}%;height:${round(height)}%;left:${round(left)}%;top:${round(top)}%`,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function percent(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 50;
}
