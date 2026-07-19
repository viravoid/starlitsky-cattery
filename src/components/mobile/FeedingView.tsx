import { PhoneFrame } from "./PhoneFrame";
import { Section } from "./ui";
import { BowlIcon } from "./icons";
import { SegmentedImageCarousel } from "./SegmentedImageCarousel";
import { formatFeedingAspectRatio, type FeedingContent } from "@/lib/feeding-content";
import { useSitePageImageUrls } from "@/hooks/use-site-page-image-urls";

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
  const aspectRatio = formatFeedingAspectRatio(content.imageAspectRatio);

  return (
    <PhoneFrame
      title="猫舍喂养"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      <Section className="pt-2">
        <div className="mb-2 flex items-center gap-2">
          <BowlIcon className="h-5 w-5 text-violet" />
          <p className="font-display text-[11px] uppercase tracking-[0.25em] text-warm">Feeding</p>
        </div>
        <p className="whitespace-pre-line text-[14px] leading-[2] text-foreground">
          {content.intro}
        </p>
      </Section>

      <div className="mt-7 space-y-9">
        {content.modules.map((module, index) => (
          <Section key={module.id}>
            <div className="mb-3 flex items-baseline gap-3">
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

            <SegmentedImageCarousel
              slides={module.images.map((image) => ({
                id: image.id,
                label: `示例图片（${module.title}轮播图，待替换）`,
                imageUrl: image.imageId ? imageUrls[image.imageId] : undefined,
                focalPoint: image.focalPoint,
              }))}
              aspectRatio={aspectRatio}
              rounded="rounded-2xl"
            />
          </Section>
        ))}
      </div>

      <div className="h-10" />
    </PhoneFrame>
  );
}
