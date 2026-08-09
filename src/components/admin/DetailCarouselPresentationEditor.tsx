import { useEffect, useMemo, useState } from "react";
import { useCatteryImageUrls } from "@/hooks/use-cattery-image-urls";
import { TraditionalCropEditor } from "./TraditionalCropEditor";
import { fitCropRectToAspectRatio } from "./crop-utils";
import {
  getAvailableImageIds,
  getCatImageFocalPoint,
  getResolvedDetailCarouselPresentation,
} from "@/lib/cat-image-presentation";
import { REAL_PHOTO_ASSET_MAP } from "@/lib/real-photo-manifest.generated";
import type {
  CatCoverPresentations,
  DetailCarouselPresentations,
  DetailImagePresentations,
} from "@/lib/cattery-store";
import { cn } from "@/lib/utils";

export function DetailCarouselPresentationEditor({
  catId,
  coverImageId,
  galleryImageIds,
  value,
  legacyCoverPresentations,
  legacyDetailPresentations,
  onChange,
}: {
  catId?: string;
  coverImageId?: string;
  galleryImageIds: string[];
  value?: DetailImagePresentations;
  legacyCoverPresentations?: CatCoverPresentations;
  legacyDetailPresentations?: DetailCarouselPresentations;
  onChange: (next: DetailImagePresentations | undefined) => void;
}) {
  const targets = useMemo(
    () =>
      getAvailableImageIds(coverImageId, galleryImageIds).map((imageId, index) => ({
        imageId,
        label: index === 0 && imageId === coverImageId ? "封面图" : `相册图 ${index}`,
      })),
    [coverImageId, galleryImageIds],
  );
  const [activeImageId, setActiveImageId] = useState<string>(targets[0]?.imageId ?? "");
  const urls = useCatteryImageUrls(targets.map((target) => target.imageId));

  useEffect(() => {
    if (targets.some((target) => target.imageId === activeImageId)) return;
    setActiveImageId(targets[0]?.imageId ?? "");
  }, [activeImageId, targets]);

  const activeTarget = targets.find((target) => target.imageId === activeImageId) ?? targets[0];
  const resolved = useMemo(
    () =>
      getResolvedDetailCarouselPresentation({
        catId,
        imageId: activeTarget?.imageId,
        coverImageId,
        manualPresentations: value,
        legacyCoverPresentations,
        legacyDetailPresentations,
      }),
    [
      activeTarget?.imageId,
      catId,
      coverImageId,
      legacyCoverPresentations,
      legacyDetailPresentations,
      value,
    ],
  );

  const currentManual = activeTarget ? value?.[activeTarget.imageId] : undefined;
  const activeAspectRatio = 4 / 5;
  const activeImageAspectRatio = useMemo(() => {
    if (!activeTarget?.imageId) return undefined;
    const asset = REAL_PHOTO_ASSET_MAP[activeTarget.imageId];
    return asset && asset.outputWidth > 0 && asset.outputHeight > 0
      ? asset.outputWidth / asset.outputHeight
      : undefined;
  }, [activeTarget?.imageId]);

  const applyPatch = (next: DetailImagePresentations[string] | undefined) => {
    if (!activeTarget) return;
    const updated = { ...(value ?? {}) };
    if (!next) delete updated[activeTarget.imageId];
    else updated[activeTarget.imageId] = next;
    onChange(compactPresentations(updated));
  };

  return (
    <div className="rounded-[10px] border border-border/80 bg-card px-3 py-3">
      <div className="mb-3">
        <p className="text-[12px] font-semibold text-heading">详情轮播图片管理</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          每张图按稳定图片 ID 单独保存裁剪框；详情轮播固定使用同一展示比例，灯箱继续展示完整原图。
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {targets.map((target) => {
          const active = activeTarget?.imageId === target.imageId;
          return (
            <button
              key={target.imageId}
              type="button"
              onClick={() => setActiveImageId(target.imageId)}
              className={cn(
                "pressable rounded-full px-3 py-1.5 text-[12px] font-medium",
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground",
              )}
            >
              {target.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3">
        <TraditionalCropEditor
          imageUrl={activeTarget ? urls[activeTarget.imageId] : undefined}
          aspectRatio={activeAspectRatio}
          cropRect={
            currentManual?.mode === "crop"
              ? fitCropRectToAspectRatio(
                  currentManual.cropRect,
                  activeAspectRatio,
                  activeImageAspectRatio,
                )
              : resolved.mode === "crop"
                ? fitCropRectToAspectRatio(
                    resolved.cropRect,
                    activeAspectRatio,
                    activeImageAspectRatio,
                  )
                : undefined
          }
          fallbackFocalPoint={getCatImageFocalPoint({
            catId,
            imageId: activeTarget?.imageId,
            frame: "square-gallery",
          })}
          onChange={(cropRect) =>
            applyPatch({
              mode: "crop",
              aspectRatio: activeAspectRatio,
              cropRect,
            })
          }
          previewLabel={`${activeTarget?.label ?? "当前图片"} 预览`}
        />

        <div className="rounded-[8px] border border-border/70 bg-background px-3 py-2 text-[11px] text-muted-foreground">
          状态：
          {currentManual
            ? "已手动设置"
            : resolved.source === "legacy"
              ? "沿用旧详情裁切字段"
              : "自动回退"}{" "}
          · 当前模式：固定比例 4:5
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPatch(undefined)}
            className="pressable inline-flex h-8 items-center justify-center rounded-[7px] border border-border bg-background px-3 text-[12px] font-medium text-heading"
          >
            重置当前图片
          </button>
        </div>
      </div>
    </div>
  );
}

function compactPresentations(
  value: DetailImagePresentations | undefined,
): DetailImagePresentations | undefined {
  if (!value) return undefined;
  const next: DetailImagePresentations = {};
  for (const [imageId, presentation] of Object.entries(value)) {
    if (!imageId || !presentation) continue;
    next[imageId] = presentation;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
