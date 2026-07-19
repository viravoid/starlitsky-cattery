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
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${safeSlides.length}, 1fr)` }}
        >
          {safeSlides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`第 ${slideIndex + 1} 张`}
              onClick={() => showSlide(slideIndex)}
              className={cn(
                "h-1.5 rounded-full transition-colors",
                slideIndex === index ? "bg-sunflower" : "bg-border",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
