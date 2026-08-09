import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { CroppedImageFrame } from "@/components/CroppedImageFrame";
import type { CatImageFocalPoint } from "@/lib/cat-image-presentation";
import { createDefaultCropRect } from "@/lib/cat-image-presentation";
import type { CropRect } from "@/lib/cattery-store";
import { cn } from "@/lib/utils";

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_CROP_SIZE = 0.08;

export function TraditionalCropEditor({
  imageUrl,
  aspectRatio,
  cropRect,
  fallbackFocalPoint,
  onChange,
  previewLabel,
}: {
  imageUrl?: string;
  aspectRatio: number;
  cropRect?: CropRect;
  fallbackFocalPoint?: CatImageFocalPoint;
  onChange: (next: CropRect) => void;
  previewLabel: string;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    handle: Handle;
    pointerId: number;
    target: HTMLElement;
    startX: number;
    startY: number;
    baseCropRect: CropRect;
    grabOffsetX: number;
    grabOffsetY: number;
  } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [stageRect, setStageRect] = useState<DOMRect | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setStageRect(node.getBoundingClientRect());
    });
    observer.observe(node);
    setStageRect(node.getBoundingClientRect());
    return () => observer.disconnect();
  }, []);

  const activeCropRect = useMemo(() => {
    if (cropRect) return cropRect;
    if (!naturalSize.width || !naturalSize.height) return undefined;
    return createDefaultCropRect({
      imageWidth: naturalSize.width,
      imageHeight: naturalSize.height,
      aspectRatio,
      focalPoint: fallbackFocalPoint,
    });
  }, [aspectRatio, cropRect, fallbackFocalPoint, naturalSize.height, naturalSize.width]);

  const imageBounds = useMemo(() => {
    if (!stageRect || !naturalSize.width || !naturalSize.height) return null;
    const imageAspectRatio = naturalSize.width / naturalSize.height;
    const stageAspectRatio = stageRect.width / stageRect.height;
    if (imageAspectRatio > stageAspectRatio) {
      const height = stageRect.width / imageAspectRatio;
      return {
        left: 0,
        top: (stageRect.height - height) / 2,
        width: stageRect.width,
        height,
      };
    }
    const width = stageRect.height * imageAspectRatio;
    return {
      left: (stageRect.width - width) / 2,
      top: 0,
      width,
      height: stageRect.height,
    };
  }, [naturalSize.height, naturalSize.width, stageRect]);

  const cropBoxStyle =
    activeCropRect && imageBounds
      ? {
          left: imageBounds.left + activeCropRect.x * imageBounds.width,
          top: imageBounds.top + activeCropRect.y * imageBounds.height,
          width: activeCropRect.width * imageBounds.width,
          height: activeCropRect.height * imageBounds.height,
        }
      : undefined;

  const beginDrag = (handle: Handle, event: ReactPointerEvent<HTMLElement>) => {
    if (!activeCropRect || !imageBounds) return;
    const pointerPosition = {
      x: clampUnit((event.clientX - imageBounds.left) / imageBounds.width, 0, 1),
      y: clampUnit((event.clientY - imageBounds.top) / imageBounds.height, 0, 1),
    };
    dragRef.current = {
      handle,
      pointerId: event.pointerId,
      target: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      baseCropRect: activeCropRect,
      grabOffsetX: pointerPosition.x - activeCropRect.x,
      grabOffsetY: pointerPosition.y - activeCropRect.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    event.preventDefault();
    event.stopPropagation();
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId || !imageBounds) return;
      const dx = (event.clientX - drag.startX) / imageBounds.width;
      const dy = (event.clientY - drag.startY) / imageBounds.height;
      const pointerPosition = {
        x: clampUnit((event.clientX - imageBounds.left) / imageBounds.width, 0, 1),
        y: clampUnit((event.clientY - imageBounds.top) / imageBounds.height, 0, 1),
      };
      const next = resizeCropRect({
        cropRect: drag.baseCropRect,
        handle: drag.handle,
        dx,
        dy,
        pointerX: pointerPosition.x,
        pointerY: pointerPosition.y,
        grabOffsetX: drag.grabOffsetX,
        grabOffsetY: drag.grabOffsetY,
        targetAspectRatio: aspectRatio,
        imageAspectRatio: imageBounds.width / imageBounds.height,
      });
      onChange(next);
    };

    const handleEnd = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && event.pointerId !== drag.pointerId) return;
      if (drag?.target.hasPointerCapture(drag.pointerId)) {
        drag.target.releasePointerCapture(drag.pointerId);
      }
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };
  }, [aspectRatio, dragging, imageBounds, onChange]);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px]">
      <div className="rounded-[12px] border border-border/70 bg-background p-3">
        <div
          ref={stageRef}
          className="relative overflow-hidden rounded-[10px] bg-black/5 [touch-action:none]"
          style={{ aspectRatio: "4 / 3" }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full select-none object-contain"
              draggable={false}
              onLoad={(event) => {
                setNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-[11px] text-muted-foreground">
              请先选择图片。
            </div>
          )}

          {cropBoxStyle && activeCropRect && (
            <>
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute left-0 top-0 right-0 bg-black/35"
                  style={{ height: cropBoxStyle.top }}
                />
                <div
                  className="absolute left-0 bg-black/35"
                  style={{
                    top: cropBoxStyle.top,
                    width: cropBoxStyle.left,
                    height: cropBoxStyle.height,
                  }}
                />
                <div
                  className="absolute right-0 bg-black/35"
                  style={{
                    top: cropBoxStyle.top,
                    width: imageBounds
                      ? imageBounds.left +
                        imageBounds.width -
                        cropBoxStyle.left -
                        cropBoxStyle.width
                      : 0,
                    height: cropBoxStyle.height,
                  }}
                />
                <div
                  className="absolute left-0 right-0 bg-black/35"
                  style={{
                    top: cropBoxStyle.top + cropBoxStyle.height,
                    bottom: 0,
                  }}
                />
              </div>
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.34)]"
                style={cropBoxStyle}
                onPointerDown={(event) => beginDrag("move", event)}
              >
                <div className="pointer-events-none absolute inset-0 border border-white/50" />
                {(
                  [
                    [
                      "n",
                      "left-1/2 top-0 h-3 w-6 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
                    ],
                    [
                      "s",
                      "bottom-0 left-1/2 h-3 w-6 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
                    ],
                    [
                      "e",
                      "right-0 top-1/2 h-6 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
                    ],
                    [
                      "w",
                      "left-0 top-1/2 h-6 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
                    ],
                    [
                      "ne",
                      "right-0 top-0 h-4 w-4 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
                    ],
                    [
                      "nw",
                      "left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
                    ],
                    [
                      "se",
                      "bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
                    ],
                    [
                      "sw",
                      "bottom-0 left-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
                    ],
                  ] as const
                ).map(([handle, className]) => (
                  <button
                    key={handle}
                    type="button"
                    className={cn(
                      "absolute rounded-full border border-white bg-primary shadow-card",
                      className,
                    )}
                    onPointerDown={(event) => beginDrag(handle, event)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-[12px] border border-border/70 bg-background p-3">
        <p className="text-[11.5px] font-semibold text-heading">{previewLabel}</p>
        <div className="mt-2 overflow-hidden rounded-[10px] border border-border/60 bg-cream/30">
          <CroppedImageFrame
            imageUrl={imageUrl}
            aspectRatio={aspectRatio}
            cropRect={activeCropRect}
            mode="crop"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

function resizeCropRect({
  cropRect,
  handle,
  dx,
  dy,
  pointerX,
  pointerY,
  grabOffsetX,
  grabOffsetY,
  targetAspectRatio,
  imageAspectRatio,
}: {
  cropRect: CropRect;
  handle: Handle;
  dx: number;
  dy: number;
  pointerX: number;
  pointerY: number;
  grabOffsetX: number;
  grabOffsetY: number;
  targetAspectRatio: number;
  imageAspectRatio: number;
}) {
  const normalizedAspectRatio =
    Number.isFinite(imageAspectRatio) && imageAspectRatio > 0
      ? targetAspectRatio / imageAspectRatio
      : targetAspectRatio;
  const minHeight = Math.max(MIN_CROP_SIZE, MIN_CROP_SIZE / normalizedAspectRatio);
  const minWidth = minHeight * normalizedAspectRatio;

  if (handle === "move") {
    return clampCropRect({
      x: cropRect.x + dx,
      y: cropRect.y + dy,
      width: cropRect.width,
      height: cropRect.height,
    });
  }

  if (handle === "e" || handle === "w") {
    const centerY = cropRect.y + cropRect.height / 2;
    const maxEdgeWidth = 2 * Math.min(centerY, 1 - centerY) * normalizedAspectRatio;
    if (handle === "e") {
      const fixedX = cropRect.x;
      const desiredWidth = pointerX - fixedX;
      const maxWidth = Math.min(1 - fixedX, maxEdgeWidth);
      const width = clampUnit(desiredWidth, minWidth, maxWidth);
      const height = width / normalizedAspectRatio;
      return clampCropRect({
        x: fixedX,
        y: centerY - height / 2,
        width,
        height,
      });
    }

    const fixedX = cropRect.x + cropRect.width;
    const desiredWidth = fixedX - pointerX;
    const maxWidth = Math.min(fixedX, maxEdgeWidth);
    const width = clampUnit(desiredWidth, minWidth, maxWidth);
    const height = width / normalizedAspectRatio;
    return clampCropRect({
      x: fixedX - width,
      y: centerY - height / 2,
      width,
      height,
    });
  }

  if (handle === "n" || handle === "s") {
    const centerX = cropRect.x + cropRect.width / 2;
    const maxEdgeHeight = (2 * Math.min(centerX, 1 - centerX)) / normalizedAspectRatio;
    if (handle === "s") {
      const fixedY = cropRect.y;
      const desiredHeight = pointerY - fixedY;
      const maxHeight = Math.min(1 - fixedY, maxEdgeHeight);
      const height = clampUnit(desiredHeight, minHeight, maxHeight);
      const width = height * normalizedAspectRatio;
      return clampCropRect({
        x: centerX - width / 2,
        y: fixedY,
        width,
        height,
      });
    }

    const fixedY = cropRect.y + cropRect.height;
    const desiredHeight = fixedY - pointerY;
    const maxHeight = Math.min(fixedY, maxEdgeHeight);
    const height = clampUnit(desiredHeight, minHeight, maxHeight);
    const width = height * normalizedAspectRatio;
    return clampCropRect({
      x: centerX - width / 2,
      y: fixedY - height,
      width,
      height,
    });
  }

  const corner =
    handle === "se"
      ? {
          anchorX: cropRect.x,
          anchorY: cropRect.y,
          signX: 1,
          signY: 1,
        }
      : handle === "sw"
        ? {
            anchorX: cropRect.x + cropRect.width,
            anchorY: cropRect.y,
            signX: -1,
            signY: 1,
          }
        : handle === "ne"
          ? {
              anchorX: cropRect.x,
              anchorY: cropRect.y + cropRect.height,
              signX: 1,
              signY: -1,
            }
          : {
              anchorX: cropRect.x + cropRect.width,
              anchorY: cropRect.y + cropRect.height,
              signX: -1,
              signY: -1,
            };

  const horizontalWidth = corner.signX > 0 ? cropRect.width + dx : cropRect.width - dx;
  const verticalWidth =
    (corner.signY > 0 ? cropRect.height + dy : cropRect.height - dy) * normalizedAspectRatio;
  const desiredWidth = Math.max(horizontalWidth, verticalWidth);
  const maxWidth = Math.min(
    corner.signX > 0 ? 1 - corner.anchorX : corner.anchorX,
    (corner.signY > 0 ? 1 - corner.anchorY : corner.anchorY) * normalizedAspectRatio,
  );
  const width = clampUnit(desiredWidth, minWidth, maxWidth);
  const height = width / normalizedAspectRatio;
  return clampCropRect({
    x: corner.signX > 0 ? corner.anchorX : corner.anchorX - width,
    y: corner.signY > 0 ? corner.anchorY : corner.anchorY - height,
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
