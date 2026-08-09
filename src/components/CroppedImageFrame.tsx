import { useEffect, useRef, useState } from "react";
import type { CropRect } from "@/lib/cattery-store";
import type { LegacyResolvedPresentation } from "@/lib/cat-image-presentation";
import { getCatCoverImageStyle } from "@/lib/cat-image-presentation";
import { cn } from "@/lib/utils";

export function CroppedImageFrame({
  imageUrl,
  aspectRatio,
  cropRect,
  legacyPresentation,
  mode,
  alt = "",
  className,
  imgClassName,
}: {
  imageUrl?: string;
  aspectRatio: number | string;
  cropRect?: CropRect;
  legacyPresentation?: LegacyResolvedPresentation;
  mode: "original" | "crop" | "legacy";
  alt?: string;
  className?: string;
  imgClassName?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setFrameSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const cropLayout =
    mode === "crop" && imageUrl && cropRect && naturalSize.width > 0 && naturalSize.height > 0
      ? getCropLayout({
          cropRect,
          naturalWidth: naturalSize.width,
          naturalHeight: naturalSize.height,
          frameWidth: frameSize.width,
          frameHeight: frameSize.height,
        })
      : null;

  return (
    <div
      ref={frameRef}
      className={cn("relative overflow-hidden", className)}
      style={{ aspectRatio }}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={alt}
            className={cn(
              "select-none",
              mode === "original" ? "h-full w-full object-contain" : "h-full w-full object-cover",
              mode === "crop" && cropLayout ? "absolute max-w-none" : "",
              imgClassName,
            )}
            style={
              mode === "crop" && cropLayout
                ? {
                    width: cropLayout.width,
                    height: cropLayout.height,
                    left: cropLayout.left,
                    top: cropLayout.top,
                  }
                : mode === "legacy" && legacyPresentation
                  ? getCatCoverImageStyle(legacyPresentation)
                  : undefined
            }
            draggable={false}
            onLoad={(event) => {
              setNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
            }}
          />
          {mode === "crop" && !cropLayout && (
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-0"
              draggable={false}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

function getCropLayout({
  cropRect,
  naturalWidth,
  naturalHeight,
  frameWidth,
  frameHeight,
}: {
  cropRect: CropRect;
  naturalWidth: number;
  naturalHeight: number;
  frameWidth: number;
  frameHeight: number;
}) {
  if (!frameWidth || !frameHeight || !naturalWidth || !naturalHeight) return null;
  const cropPixelWidth = cropRect.width * naturalWidth;
  const cropPixelHeight = cropRect.height * naturalHeight;
  if (cropPixelWidth <= 0 || cropPixelHeight <= 0) return null;
  const scale = Math.max(frameWidth / cropPixelWidth, frameHeight / cropPixelHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    width,
    height,
    left: -(cropRect.x * naturalWidth * scale),
    top: -(cropRect.y * naturalHeight * scale),
  };
}
