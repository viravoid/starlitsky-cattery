import { useEffect, useMemo, useState } from "react";
import { useCatteryImageUrls } from "@/hooks/use-cattery-image-urls";
import { TraditionalCropEditor } from "./TraditionalCropEditor";
import {
  CAT_COVER_PRESENTATION_ENTRY_META,
  getAvailableImageIds,
  getCatImageFocalPoint,
  getResolvedCatCoverPresentation,
  type CatCoverPresentationEntry,
} from "@/lib/cat-image-presentation";
import type { CatCoverPresentations, CropRect, EntryCoverSelections } from "@/lib/cattery-store";
import { cn } from "@/lib/utils";

export function CatCoverPresentationEditor({
  catId,
  coverImageId,
  galleryImageIds,
  value,
  legacyValue,
  entries,
  onChange,
}: {
  catId?: string;
  coverImageId?: string;
  galleryImageIds: string[];
  value?: EntryCoverSelections;
  legacyValue?: CatCoverPresentations;
  entries: readonly CatCoverPresentationEntry[];
  onChange: (next: EntryCoverSelections | undefined) => void;
}) {
  const [activeEntry, setActiveEntry] = useState<CatCoverPresentationEntry>(
    entries[0] ?? "listCard",
  );
  const availableImageIds = useMemo(
    () => getAvailableImageIds(coverImageId, galleryImageIds),
    [coverImageId, galleryImageIds],
  );
  const urls = useCatteryImageUrls(availableImageIds);

  useEffect(() => {
    if (entries.includes(activeEntry)) return;
    setActiveEntry(entries[0] ?? "listCard");
  }, [activeEntry, entries]);

  const resolved = useMemo(
    () =>
      getResolvedCatCoverPresentation({
        catId,
        entry: activeEntry,
        coverImageId,
        galleryImageIds,
        manualSelections: value,
        legacyPresentations: legacyValue,
      }),
    [activeEntry, catId, coverImageId, galleryImageIds, legacyValue, value],
  );

  const selectedImageId =
    value?.[activeEntry]?.imageId && availableImageIds.includes(value[activeEntry]!.imageId)
      ? value[activeEntry]!.imageId
      : resolved.imageId;

  const updateSelection = (patch: { imageId?: string; clear?: boolean; cropRect?: CropRect }) => {
    const next = { ...(value ?? {}) };
    if (patch.clear) {
      delete next[activeEntry];
      onChange(compactSelections(next));
      return;
    }
    const imageId = patch.imageId ?? selectedImageId;
    if (!imageId) return;
    next[activeEntry] = {
      imageId,
      cropRect: patch.cropRect ?? value?.[activeEntry]?.cropRect,
    };
    onChange(compactSelections(next));
  };

  return (
    <div className="rounded-[10px] border border-border/80 bg-card px-3 py-3">
      <div className="mb-3">
        <p className="text-[12px] font-semibold text-heading">入口封面管理</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          每个入口单独选择图片并保存裁剪框；未手动设置时，继续回退到旧配置或自动焦点。
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {entries.map((entry) => {
          const active = entry === activeEntry;
          return (
            <button
              key={entry}
              type="button"
              onClick={() => setActiveEntry(entry)}
              className={cn(
                "pressable rounded-full px-3 py-1.5 text-[12px] font-medium",
                active
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground",
              )}
            >
              {CAT_COVER_PRESENTATION_ENTRY_META[entry].label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-[11.5px] font-semibold text-heading">选择图片</span>
          <select
            value={selectedImageId ?? ""}
            onChange={(event) => updateSelection({ imageId: event.target.value || undefined })}
            className="h-9 rounded-[8px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          >
            {availableImageIds.length === 0 && <option value="">暂无可选图片</option>}
            {availableImageIds.map((imageId, index) => (
              <option key={imageId} value={imageId}>
                {index === 0 && imageId === coverImageId
                  ? "当前封面"
                  : `相册图 ${index + (imageId === coverImageId ? 0 : 1)}`}
              </option>
            ))}
          </select>
        </label>

        <TraditionalCropEditor
          imageUrl={selectedImageId ? urls[selectedImageId] : undefined}
          aspectRatio={CAT_COVER_PRESENTATION_ENTRY_META[activeEntry].aspectRatio}
          cropRect={
            value?.[activeEntry]?.imageId === selectedImageId
              ? value?.[activeEntry]?.cropRect
              : undefined
          }
          fallbackFocalPoint={getCatImageFocalPoint({
            catId,
            imageId: selectedImageId,
            frame: CAT_COVER_PRESENTATION_ENTRY_META[activeEntry].frame,
          })}
          onChange={(cropRect) => updateSelection({ cropRect })}
          previewLabel={`${CAT_COVER_PRESENTATION_ENTRY_META[activeEntry].label} 预览`}
        />

        <div className="rounded-[8px] border border-border/70 bg-background px-3 py-2 text-[11px] text-muted-foreground">
          状态：
          {value?.[activeEntry]
            ? "已手动设置"
            : resolved.source === "legacy"
              ? "沿用旧裁切字段"
              : "自动回退"}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateSelection({ clear: true })}
            className="pressable inline-flex h-8 items-center justify-center rounded-[7px] border border-border bg-background px-3 text-[12px] font-medium text-heading"
          >
            重置当前入口
          </button>
        </div>
      </div>
    </div>
  );
}

function compactSelections(
  value: EntryCoverSelections | undefined,
): EntryCoverSelections | undefined {
  if (!value) return undefined;
  const next: EntryCoverSelections = {};
  for (const [key, selection] of Object.entries(value) as [
    CatCoverPresentationEntry,
    EntryCoverSelections[CatCoverPresentationEntry] | undefined,
  ][]) {
    if (!selection?.imageId) continue;
    next[key] = selection;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}
