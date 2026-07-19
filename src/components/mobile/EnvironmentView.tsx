import { PhoneFrame } from "./PhoneFrame";
import { Section, Card, Pill } from "./ui";
import { HouseIcon, LeafIcon } from "./icons";
import { SegmentedImageCarousel } from "./SegmentedImageCarousel";
import { formatEnvironmentAspectRatio, type EnvironmentContent } from "@/lib/environment-content";
import { useSitePageImageUrls } from "@/hooks/use-site-page-image-urls";

const FIXED_TAGS = [
  { label: "600+ ㎡ 室内", tone: "sky" },
  { label: "3 个院子", tone: "mint" },
  { label: "拒绝笼养", tone: "sunny" },
  { label: "科学规划", tone: "creamblue" },
];

export function EnvironmentView({
  content,
  preview = false,
}: {
  content: EnvironmentContent;
  preview?: boolean;
}) {
  const imageUrls = useSitePageImageUrls(
    content.zones.flatMap((zone) => zone.images.map((image) => image.imageId)),
  );
  const aspectRatio = formatEnvironmentAspectRatio(content.imageAspectRatio);

  return (
    <PhoneFrame
      title="猫舍环境"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      <Section className="pt-1">
        <Card className="bg-gradient-cream p-4">
          <div className="mb-1 flex items-center gap-2">
            <LeafIcon className="h-5 w-5 text-violet" />
            <p className="font-display text-[11px] uppercase tracking-[0.25em] text-warm">
              Environment
            </p>
          </div>
          <p className="whitespace-pre-line text-[13px] leading-[1.9] text-foreground">
            {content.intro}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FIXED_TAGS.map((tag) => (
              <Pill key={tag.label} tone={tag.tone}>
                {tag.label}
              </Pill>
            ))}
          </div>
        </Card>
      </Section>

      <Section className="mb-10 mt-5 space-y-4">
        {content.zones.map((zone) => (
          <Card key={zone.id} className="overflow-hidden p-0">
            <SegmentedImageCarousel
              slides={zone.images.map((image) => ({
                id: image.id,
                label: `示例图片（${zone.name}照片，待替换）`,
                imageUrl: image.imageId ? imageUrls[image.imageId] : undefined,
                focalPoint: image.focalPoint,
              }))}
              aspectRatio={aspectRatio}
              rounded="rounded-none"
            />
            <div className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <HouseIcon className="h-5 w-5 text-heading" />
                  <h3 className="text-[14px] font-semibold text-heading">{zone.name}</h3>
                </div>
                <span className="text-[12px] font-medium text-muted-foreground">{zone.area}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[12px] leading-[1.8] text-muted-foreground">
                {zone.description}
              </p>
            </div>
          </Card>
        ))}
      </Section>
    </PhoneFrame>
  );
}
