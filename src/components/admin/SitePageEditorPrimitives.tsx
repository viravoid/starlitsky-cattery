import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Placeholder } from "@/components/mobile/ui";
import { saveSitePageImage } from "@/lib/site-page-storage";
import { cn } from "@/lib/utils";
import { createStableId, moveById, moveToId } from "./site-page-editor-utils";

export type EditorFocalPoint = {
  x: number;
  y: number;
};

export type EditablePageImage = {
  id: string;
  imageId?: string;
  focalPoint: EditorFocalPoint;
};

export type EditorAspectRatio = {
  width: number;
  height: number;
};

const ASPECT_PRESETS: EditorAspectRatio[] = [
  { width: 16, height: 9 },
  { width: 16, height: 10 },
  { width: 4, height: 3 },
  { width: 3, height: 2 },
  { width: 1, height: 1 },
];

export function EditorSection({
  title,
  desc,
  open,
  onToggle,
  children,
}: {
  title: string;
  desc: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-[6px] border border-border/80 bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left lg:px-4 lg:py-3"
      >
        <span>
          <span className="block text-[14px] font-semibold text-heading lg:text-[16px]">
            {title}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-muted-foreground lg:text-[13px]">
            {desc}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-muted-foreground">
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open && <div className="border-t border-border/80 px-3 py-3 lg:px-4">{children}</div>}
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal";
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-[7px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
      />
    </label>
  );
}

export function TextareaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-[7px] border border-border bg-background px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-primary"
      />
    </label>
  );
}

export function ReadonlyLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-border/60 py-1.5 text-[12px] last:border-0 lg:grid-cols-[100px_minmax(0,1fr)] lg:py-2.5 lg:text-[13.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-card-foreground">{value}</span>
    </div>
  );
}

export function EditorButton({
  children,
  onClick,
  tone = "default",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "quiet" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "pressable inline-flex h-8 items-center justify-center rounded-[6px] px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-45 lg:text-[13px]",
        tone === "default" && "bg-primary text-primary-foreground",
        tone === "quiet" && "border border-border bg-background text-muted-foreground",
        tone === "danger" && "border border-wine/35 bg-wine/10 text-wine",
      )}
    >
      {children}
    </button>
  );
}

export function AspectRatioEditor({
  value,
  onApply,
  sanitize,
}: {
  value: EditorAspectRatio;
  onApply: (ratio: EditorAspectRatio) => void;
  sanitize: (width: unknown, height: unknown) => EditorAspectRatio;
}) {
  const [inputs, setInputs] = useState(() => ({
    width: String(value.width),
    height: String(value.height),
  }));

  useEffect(() => {
    setInputs({ width: String(value.width), height: String(value.height) });
  }, [value.height, value.width]);

  const applyCustom = () => {
    onApply(sanitize(inputs.width, inputs.height));
  };

  return (
    <div className="grid gap-2 rounded-[6px] border border-border/80 bg-background p-3">
      <span className="text-[12px] font-semibold text-heading lg:text-[13px]">统一图片比例</span>
      <div className="flex flex-wrap gap-1.5">
        {ASPECT_PRESETS.map((ratio) => {
          const active = ratio.width === value.width && ratio.height === value.height;
          return (
            <EditorButton
              key={`${ratio.width}:${ratio.height}`}
              tone={active ? "default" : "quiet"}
              onClick={() => onApply(sanitize(ratio.width, ratio.height))}
            >
              {ratio.width}:{ratio.height}
            </EditorButton>
          );
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <TextField
          label="自定义宽"
          value={inputs.width}
          inputMode="decimal"
          onChange={(next) => setInputs((current) => ({ ...current, width: next }))}
        />
        <TextField
          label="自定义高"
          value={inputs.height}
          inputMode="decimal"
          onChange={(next) => setInputs((current) => ({ ...current, height: next }))}
        />
        <div className="flex items-end">
          <EditorButton onClick={applyCustom}>应用比例</EditorButton>
        </div>
      </div>
    </div>
  );
}

export function ImageListEditor<TImage extends EditablePageImage>({
  pageId,
  images,
  imageUrls,
  aspectRatio,
  placeholderLabel,
  onImagesChange,
  onNotice,
}: {
  pageId: string;
  images: TImage[];
  imageUrls: Record<string, string>;
  aspectRatio: string;
  placeholderLabel: string;
  onImagesChange: (images: TImage[]) => void;
  onNotice: (message: string) => void;
}) {
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);

  const addImage = () => {
    onImagesChange([
      ...images,
      {
        id: `${pageId}-image-${createStableId()}`,
        focalPoint: { x: 50, y: 50 },
      } as TImage,
    ]);
  };

  const deleteImage = (id: string) => {
    if (images.length <= 1) {
      onNotice("图片列表至少保留 1 张图片。");
      return;
    }
    if (!window.confirm("确定删除这张图片吗？")) return;
    onImagesChange(images.filter((image) => image.id !== id));
  };

  const replaceImage = async (image: TImage, file: File | null) => {
    if (!file) return;
    try {
      const record = await saveSitePageImage(pageId, file);
      onImagesChange(
        images.map((item) =>
          item.id === image.id ? ({ ...item, imageId: record.id } as TImage) : item,
        ),
      );
      onNotice("已选择本地图片，保存更改后会应用到正式页面。");
    } catch {
      onNotice("图片保存失败，请确认浏览器支持 IndexedDB 后重试。");
    }
  };

  const updateFocalPoint = (id: string, focalPoint: EditorFocalPoint) => {
    onImagesChange(
      images.map((image) => (image.id === id ? ({ ...image, focalPoint } as TImage) : image)),
    );
  };

  const moveImage = (id: string, direction: -1 | 1) => {
    onImagesChange(moveById(images, id, direction));
  };

  const dropImage = (targetId: string) => {
    if (!draggingImageId) return;
    onImagesChange(moveToId(images, draggingImageId, targetId));
    setDraggingImageId(null);
  };

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <EditorButton onClick={addImage}>新增图片</EditorButton>
      </div>
      {images.map((image, index) => (
        <div
          key={image.id}
          draggable
          onDragStart={() => setDraggingImageId(image.id)}
          onDragEnd={() => setDraggingImageId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => dropImage(image.id)}
          className="grid gap-3 rounded-[6px] border border-border/80 bg-background p-3 lg:grid-cols-[minmax(180px,260px)_minmax(0,1fr)_auto]"
        >
          <FocalPointEditor
            label={placeholderLabel}
            imageUrl={image.imageId ? imageUrls[image.imageId] : undefined}
            aspectRatio={aspectRatio}
            focalPoint={image.focalPoint}
            onChange={(focalPoint) => updateFocalPoint(image.id, focalPoint)}
          />
          <div className="grid content-start gap-2">
            <div>
              <span className="font-display text-[13px] italic text-warm/80">#{index + 1}</span>
              <p className="mt-1 break-all text-[12.5px] font-medium text-heading">
                {image.imageId ?? placeholderLabel}
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => void replaceImage(image, event.target.files?.[0] ?? null)}
              className="text-[12px] text-muted-foreground file:mr-3 file:h-8 file:rounded-[6px] file:border-0 file:bg-primary file:px-3 file:text-[12px] file:font-semibold file:text-primary-foreground"
            />
            <EditorButton tone="quiet" onClick={() => updateFocalPoint(image.id, { x: 50, y: 50 })}>
              恢复居中
            </EditorButton>
          </div>
          <div className="flex flex-wrap items-start gap-1.5 lg:justify-end">
            <EditorButton
              tone="quiet"
              onClick={() => moveImage(image.id, -1)}
              disabled={index === 0}
            >
              上移
            </EditorButton>
            <EditorButton
              tone="quiet"
              onClick={() => moveImage(image.id, 1)}
              disabled={index === images.length - 1}
            >
              下移
            </EditorButton>
            <EditorButton
              tone="danger"
              onClick={() => deleteImage(image.id)}
              disabled={images.length <= 1}
            >
              删除
            </EditorButton>
          </div>
        </div>
      ))}
    </div>
  );
}

function FocalPointEditor({
  label,
  imageUrl,
  aspectRatio,
  focalPoint,
  onChange,
}: {
  label: string;
  imageUrl?: string;
  aspectRatio: string;
  focalPoint: EditorFocalPoint;
  onChange: (focalPoint: EditorFocalPoint) => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startFocus: EditorFocalPoint;
  } | null>(null);

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = frameRef.current?.getBoundingClientRect();
    const drag = dragRef.current;
    if (!rect || !drag) return;
    const deltaX = ((event.clientX - drag.startX) / rect.width) * 100;
    const deltaY = ((event.clientY - drag.startY) / rect.height) * 100;
    onChange({
      x: clampPercent(drag.startFocus.x + deltaX),
      y: clampPercent(drag.startFocus.y + deltaY),
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const frameStyle: CSSProperties = { aspectRatio };

  return (
    <div
      ref={frameRef}
      role="slider"
      tabIndex={0}
      aria-label="拖动调整图片裁切位置"
      aria-valuetext="图片裁切焦点"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startFocus: focalPoint,
        };
      }}
      onPointerMove={(event) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        updateFromPointer(event);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="relative cursor-grab overflow-hidden rounded-[8px] bg-muted [touch-action:none] active:cursor-grabbing"
      style={frameStyle}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full select-none object-cover"
          style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
          draggable={false}
        />
      ) : (
        <Placeholder label={label} ratio="" rounded="rounded-[8px]" compact style={frameStyle} />
      )}
      <span
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-card"
        style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
      />
    </div>
  );
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}
