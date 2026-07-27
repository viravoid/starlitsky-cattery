import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Placeholder } from "./ui";
import { cn } from "@/lib/utils";

type FocalPoint = {
  x: number;
  y: number;
};

export type SegmentedImageSlide = {
  id: string;
  label: string;
  imageUrl?: string;
  focalPoint?: FocalPoint;
};

export function SegmentedImageCarousel({
  slides,
  aspectRatio,
  rounded = "rounded-[8px]",
  placeholderCompact = false,
}: {
  slides: SegmentedImageSlide[];
  aspectRatio: string;
  rounded?: string;
  placeholderCompact?: boolean;
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

  const frameStyle: CSSProperties = { aspectRatio };

  return (
    <div className="grid gap-2">
      <div
        className={cn("relative overflow-hidden bg-muted [touch-action:pan-y]", rounded)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          dragStart.current = null;
        }}
      >
        {safeSlides.length > 1 && (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white">
            {index + 1} / {safeSlides.length}
          </span>
        )}
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {safeSlides.map((slide) => (
            <div key={slide.id} className="relative w-full shrink-0" style={frameStyle}>
              {slide.imageUrl ? (
                <img
                  src={slide.imageUrl}
                  alt=""
                  className="h-full w-full select-none object-cover"
                  style={{
                    objectPosition: `${slide.focalPoint?.x ?? 50}% ${slide.focalPoint?.y ?? 50}%`,
                  }}
                  draggable={false}
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
            </div>
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
                  <img
                    src={slide.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{
                      objectPosition: `${slide.focalPoint?.x ?? 50}% ${slide.focalPoint?.y ?? 50}%`,
                    }}
                    draggable={false}
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
