import { useMemo, useState } from "react";
import { PhoneFrame } from "./PhoneFrame";
import { BowlIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "./icons";
import { Placeholder, Section } from "./ui";
import { useSitePageImageUrls } from "@/hooks/use-site-page-image-urls";
import type { FeedingContent } from "@/lib/feeding-content";

type FeedingLightboxItem = {
  id: string;
  label: string;
  imageUrl?: string;
};

export function FeedingView({
  content,
  preview = false,
}: {
  content: FeedingContent;
  preview?: boolean;
}) {
  const imageUrls = useSitePageImageUrls(
    content.modules.flatMap((module) => module.images.map((image) => image.imageId)),
  );
  const [lightbox, setLightbox] = useState<{
    title: string;
    items: FeedingLightboxItem[];
    index: number;
  } | null>(null);

  const modules = useMemo(
    () =>
      content.modules.map((module) => ({
        ...module,
        renderedImages: module.images.map((image, index) => ({
          id: image.id,
          label: `${module.title} · 第 ${index + 1} 张`,
          imageUrl: image.imageId ? imageUrls[image.imageId] : undefined,
        })),
      })),
    [content.modules, imageUrls],
  );

  return (
    <>
      <PhoneFrame
        title="喂养体系"
        backTo="/"
        outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
        frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
      >
        <Section className="pt-2">
          <div className="mb-2 flex items-center gap-2">
            <BowlIcon className="h-5 w-5 text-violet" />
            <p className="font-display text-[11px] uppercase tracking-[0.25em] text-warm">
              Feeding
            </p>
          </div>
          <p className="whitespace-pre-line text-[14px] leading-[2] text-foreground">
            {content.intro}
          </p>
        </Section>

        <div className="mt-7 space-y-5 pb-10">
          {modules.map((module, index) => (
            <Section key={module.id} className="pt-0">
              <article
                data-feeding-module={module.id}
                className="rounded-[1.5rem] border border-border bg-card/85 px-4 py-4 shadow-card"
              >
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="font-display text-[13px] text-warm/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-[16px] font-semibold leading-tight text-heading">
                      {module.title}
                    </h3>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">
                      {module.body}
                    </p>
                  </div>
                </div>

                {module.renderedImages.length > 0 ? (
                  <div className="space-y-3">
                    {module.renderedImages.map((image, imageIndex) => (
                      <button
                        key={image.id}
                        type="button"
                        data-feeding-image-button={image.id}
                        onClick={() =>
                          setLightbox({
                            title: module.title,
                            items: module.renderedImages,
                            index: imageIndex,
                          })
                        }
                        className="pressable block w-full overflow-hidden rounded-[1.1rem] border border-border/80 bg-background/70 p-2 text-left"
                      >
                        {image.imageUrl ? (
                          <img
                            src={image.imageUrl}
                            alt=""
                            className="block w-full rounded-[0.95rem]"
                            draggable={false}
                          />
                        ) : (
                          <Placeholder
                            label={`示例图片（${module.title}图片 ${imageIndex + 1}，待替换）`}
                            ratio="aspect-[4/3]"
                            rounded="rounded-[0.95rem]"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-border bg-card/70 px-4 py-5 text-[13px] leading-[1.85] text-muted-foreground">
                    这个模块还没有上传照片。
                  </div>
                )}
              </article>
            </Section>
          ))}
        </div>
      </PhoneFrame>

      {lightbox && (
        <FeedingLightbox
          title={lightbox.title}
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) =>
            setLightbox((current) => (current ? { ...current, index } : current))
          }
        />
      )}
    </>
  );
}

function FeedingLightbox({
  title,
  items,
  index,
  onClose,
  onIndexChange,
}: {
  title: string;
  items: FeedingLightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const current = items[index];
  if (!current) return null;

  const previous = () => onIndexChange((index - 1 + items.length) % items.length);
  const next = () => onIndexChange((index + 1) % items.length);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/88" data-feeding-lightbox={title}>
      <div className="flex items-center justify-between px-4 pt-6 text-white">
        <div>
          <p className="text-[13px] font-semibold">
            {index + 1} / {items.length}
          </p>
          <p className="mt-1 text-[11.5px] text-white/70">{title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="pressable grid h-9 w-9 place-items-center rounded-full bg-white/10"
          aria-label="关闭大图"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-[1080px] text-center">
          {current.imageUrl ? (
            <img
              src={current.imageUrl}
              alt=""
              data-feeding-lightbox-image={current.id}
              className="mx-auto max-h-[78vh] max-w-full rounded-[24px] object-contain"
              draggable={false}
            />
          ) : (
            <Placeholder
              label={`示例图片（${current.label}，待替换）`}
              ratio="aspect-[4/3]"
              rounded="rounded-[24px]"
            />
          )}
        </div>

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={previous}
              className="pressable absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
              aria-label="上一张"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={next}
              className="pressable absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
              aria-label="下一张"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
