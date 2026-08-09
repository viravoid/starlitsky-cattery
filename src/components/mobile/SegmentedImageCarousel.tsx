import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { CroppedImageFrame } from "@/components/CroppedImageFrame";
import type { LegacyResolvedPresentation } from "@/lib/cat-image-presentation";
import type { CropRect } from "@/lib/cattery-store";
import { Placeholder } from "./ui";
import { cn } from "@/lib/utils";

export type SegmentedImageSlide = {
  id: string;
  label: string;
  imageUrl?: string;
  aspectRatio?: number;
  cropRect?: CropRect;
  legacyPresentation?: LegacyResolvedPresentation;
  mode?: "original" | "crop" | "legacy";
};

export function SegmentedImageCarousel({
  slides,
  aspectRatio,
  rounded = "rounded-[8px]",
  placeholderCompact = false,
  onSlideClick,
}: {
  slides: SegmentedImageSlide[];
  aspectRatio: string;
  rounded?: string;
  placeholderCompact?: boolean;
  onSlideClick?: (index: number) => void;
}) {
  const safeSlides = slides.length ? slides : [{ id: "placeholder", label: "示例图片（待替换）" }];
  const [index, setIndex] = useState(0);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (index >= safeSlides.length) setIndex(0);
  }, [index, safeSlides.length]);

  const showSlide = (nextIndex: number) => {
    setIndex(Math.max(0, Math.min(safeSlides.length - 1, nextIndex)));
  };

  const showPrevious = () => {
    if (safeSlides.length <= 1) return;
    setIndex((current) => (current - 1 + safeSlides.length) % safeSlides.length);
  };

  const showNext = () => {
    if (safeSlides.length <= 1) return;
    setIndex((current) => (current + 1) % safeSlides.length);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (safeSlides.length <= 1) return;
    dragStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragStart.current || safeSlides.length <= 1) return;
    const deltaX = event.clientX - dragStart.current.x;
    const deltaY = event.clientY - dragStart.current.y;
    dragStart.current = null;

    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    showSlide(index + (deltaX < 0 ? 1 : -1));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (safeSlides.length <= 1) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  };

  const activeAspectRatio = safeSlides[index]?.aspectRatio ?? parseAspectRatio(aspectRatio);
  const frameStyle: CSSProperties = { aspectRatio: activeAspectRatio };

  return (
    <div className="grid gap-2">
      <div
        className={cn("relative overflow-hidden bg-muted [touch-action:pan-y]", rounded)}
        role="region"
        style={frameStyle}
        tabIndex={safeSlides.length > 1 ? 0 : -1}
        aria-label="图片轮播"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        {safeSlides.length > 1 && (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
            {index + 1} / {safeSlides.length}
          </span>
        )}
        {safeSlides.length > 1 && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label="上一张"
              className="absolute left-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg font-semibold text-white backdrop-blur-sm transition hover:bg-black/55"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="下一张"
              className="absolute right-3 top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg font-semibold text-white backdrop-blur-sm transition hover:bg-black/55"
            >
              ›
            </button>
          </>
        )}
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {safeSlides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              className="relative h-full w-full shrink-0 text-left"
              style={frameStyle}
              onClick={() => onSlideClick?.(slideIndex)}
              disabled={!onSlideClick}
            >
              {slide.imageUrl ? (
                <CroppedImageFrame
                  imageUrl={slide.imageUrl}
                  aspectRatio={slide.aspectRatio ?? activeAspectRatio}
                  cropRect={slide.cropRect}
                  legacyPresentation={slide.legacyPresentation}
                  mode={slide.mode ?? "legacy"}
                  className="h-full w-full"
                />
              ) : (
                <Placeholder
                  label={slide.label}
                  ratio=""
                  rounded={rounded}
                  compact={placeholderCompact}
                  style={frameStyle}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {safeSlides.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {safeSlides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`第 ${slideIndex + 1} 张`}
              onClick={() => showSlide(slideIndex)}
              className={cn(
                "shrink-0 rounded-2xl p-0.5 transition",
                slideIndex === index && "bg-sunflower/70",
              )}
            >
              <div
                className={cn(
                  "relative h-14 w-16 overflow-hidden rounded-[14px] border border-border/70 bg-card",
                  slideIndex === index && "border-sunflower/70",
                )}
              >
                {slide.imageUrl ? (
                  <CroppedImageFrame
                    imageUrl={slide.imageUrl}
                    aspectRatio={slide.aspectRatio ?? 1}
                    cropRect={slide.cropRect}
                    legacyPresentation={slide.legacyPresentation}
                    mode={slide.mode ?? "legacy"}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-cream text-[11px] font-semibold text-warm">
                    {slideIndex + 1}
                  </div>
                )}
                {slideIndex === index && (
                  <span className="absolute inset-x-2 bottom-1 h-1 rounded-full bg-white/85" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function parseAspectRatio(value: string) {
  const [left, right] = value.split("/").map((part) => Number(part.trim()));
  if (!left || !right) return 1;
  return left / right;
}
