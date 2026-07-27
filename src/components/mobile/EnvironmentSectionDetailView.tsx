import { useEffect, useMemo, useState } from "react";
import { PhoneFrame } from "./PhoneFrame";
import { Card, Pill, Placeholder, Section } from "./ui";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "./icons";
import {
  getEnvironmentSectionCoverImage,
  getEnvironmentSectionImages,
  type EnvironmentContent,
  type EnvironmentRoom,
  type EnvironmentSection,
} from "@/lib/environment-content";
import { useSitePageImageUrls } from "@/hooks/use-site-page-image-urls";

type LightboxItem = {
  id: string;
  roomTitle: string;
  label: string;
  imageUrl?: string;
};

const HIDE_ROOM_DESCRIPTION_SECTION_IDS = new Set([
  "environment-zone-queen",
  "environment-zone-king",
]);

export function EnvironmentSectionDetailView({
  content,
  section,
  preview = false,
  previewToken,
}: {
  content: EnvironmentContent;
  section: EnvironmentSection;
  preview?: boolean;
  previewToken?: string;
}) {
  const sectionImages = useMemo(() => getEnvironmentSectionImages(section), [section]);
  const imageUrls = useSitePageImageUrls(sectionImages.map(({ image }) => image.imageId));
  const cover = getEnvironmentSectionCoverImage(section);
  const coverUrl = cover?.image.imageId ? imageUrls[cover.image.imageId] : undefined;
  const [lightbox, setLightbox] = useState<{ items: LightboxItem[]; index: number } | null>(null);
  const overviewHref = buildEnvironmentOverviewHref(previewToken);
  const showRoomDescriptions = !HIDE_ROOM_DESCRIPTION_SECTION_IDS.has(section.id);

  useEffect(() => {
    if (preview || typeof document === "undefined") return;
    const previousTitle = document.title;
    document.title = `${section.title} - 猫舍环境`;
    return () => {
      document.title = previousTitle;
    };
  }, [preview, section.title]);

  const openLightbox = (room: EnvironmentRoom, index: number) => {
    const items = room.images.map((image, imageIndex) => ({
      id: image.id,
      roomTitle: room.title,
      label: `${room.title} · 第 ${imageIndex + 1} 张`,
      imageUrl: image.imageId ? imageUrls[image.imageId] : undefined,
    }));
    setLightbox({ items, index });
  };

  return (
    <>
      <PhoneFrame
        title={section.title}
        backTo={overviewHref}
        outerClassName={preview ? "min-h-0 p-0 sm:py-0" : "sm:px-6"}
        frameClassName={
          preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : "sm:max-w-[980px]"
        }
      >
        <Section className="pt-1">
          <Card className="overflow-hidden bg-gradient-cream p-0">
            <div className="p-3">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  className="aspect-[16/10] w-full rounded-[22px] object-cover"
                  loading="lazy"
                />
              ) : (
                <Placeholder
                  label={`示例图片（${section.title}封面，待替换）`}
                  ratio="aspect-[16/10]"
                />
              )}
            </div>
            <div className="px-4 pb-4">
              <h2 className="text-[17px] font-semibold leading-tight text-heading">
                {section.title}
              </h2>
              <p className="mt-3 whitespace-pre-line text-[13px] leading-[1.85] text-muted-foreground">
                {section.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill tone="creamblue">{section.rooms.length} 个房间 / 子区域</Pill>
                <Pill tone="sky">{sectionImages.length} 张照片</Pill>
                {section.meta.trim() && <Pill tone="mint">{section.meta}</Pill>}
              </div>
            </div>
          </Card>
        </Section>

        <Section className="mb-10 mt-5 space-y-4">
          {section.rooms.map((room) => (
            <Card key={room.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-semibold leading-tight text-heading">
                    {room.title}
                  </h3>
                  {showRoomDescriptions && (
                    <p className="mt-2 whitespace-pre-line text-[13px] leading-[1.85] text-muted-foreground">
                      {room.description || "主理人后续可在后台补充该房间的说明。"}
                    </p>
                  )}
                </div>
                <Pill tone="creamblue" className="shrink-0">
                  {room.images.length} 张
                </Pill>
              </div>

              {room.images.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
                  {room.images.map((image, index) => {
                    const imageUrl = image.imageId ? imageUrls[image.imageId] : undefined;
                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => openLightbox(room, index)}
                        className="pressable overflow-hidden rounded-[20px] bg-background text-left"
                      >
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt=""
                            className="aspect-[4/3] w-full rounded-[20px] object-cover"
                            style={{
                              objectPosition: `${image.focalPoint.x}% ${image.focalPoint.y}%`,
                            }}
                            loading="lazy"
                          />
                        ) : (
                          <Placeholder
                            label={`示例图片（${room.title}照片 ${index + 1}，待替换）`}
                            ratio="aspect-[4/3]"
                            rounded="rounded-[20px]"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-[20px] border border-dashed border-border bg-background px-4 py-5 text-[13px] leading-[1.85] text-muted-foreground">
                  这个房间还没有上传照片。
                </div>
              )}
            </Card>
          ))}

          {!preview && (
            <div className="flex justify-start">
              <a
                href={overviewHref}
                className="pressable inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] font-semibold text-muted-foreground"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                返回环境总览
              </a>
            </div>
          )}
        </Section>
      </PhoneFrame>

      {lightbox && (
        <EnvironmentLightbox
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

export function EnvironmentSectionNotFoundView({ previewToken }: { previewToken?: string }) {
  const overviewHref = buildEnvironmentOverviewHref(previewToken);

  return (
    <PhoneFrame
      title="猫舍环境"
      backTo={overviewHref}
      outerClassName="sm:px-6"
      frameClassName="sm:max-w-[720px]"
    >
      <Section className="py-10">
        <Card className="p-6 text-center">
          <h1 className="text-[18px] font-semibold text-heading">没有找到这个环境分区</h1>
          <p className="mt-2 text-[13px] leading-[1.8] text-muted-foreground">
            这个链接可能已经失效，或者当前浏览器里的本地演示数据还没有配置这个分区。
          </p>
          <div className="mt-5 flex justify-center">
            <a
              href={overviewHref}
              className="pressable inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-[13px] font-semibold text-primary"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              返回环境总览
            </a>
          </div>
        </Card>
      </Section>
    </PhoneFrame>
  );
}

function EnvironmentLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const current = items[index];
  if (!current) return null;

  const previous = () => onIndexChange((index - 1 + items.length) % items.length);
  const next = () => onIndexChange((index + 1) % items.length);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85">
      <div className="flex items-center justify-between px-4 pt-6 text-white">
        <div>
          <p className="text-[13px] font-semibold">
            {index + 1} / {items.length}
          </p>
          <p className="mt-1 text-[11.5px] text-white/70">{current.roomTitle}</p>
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
        <div className="w-full max-w-[1080px]">
          {current.imageUrl ? (
            <img
              src={current.imageUrl}
              alt=""
              className="max-h-[78vh] w-full rounded-[24px] object-contain"
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

function buildEnvironmentOverviewHref(previewToken?: string) {
  const previewQuery = previewToken ? `?sitePagePreview=${encodeURIComponent(previewToken)}` : "";
  return `/environment${previewQuery}`;
}
