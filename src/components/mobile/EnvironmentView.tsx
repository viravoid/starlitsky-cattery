import { PhoneFrame } from "./PhoneFrame";
import { Section, Card, Pill, Placeholder } from "./ui";
import { LeafIcon, ChevronRightIcon } from "./icons";
import {
  getEnvironmentSectionCoverImage,
  getEnvironmentSectionImages,
  type EnvironmentContent,
  type EnvironmentSection,
} from "@/lib/environment-content";
import { useSitePageImageUrls } from "@/hooks/use-site-page-image-urls";

const FIXED_TAGS = [
  { label: "共四层", tone: "sky" },
  { label: "600+ ㎡ 室内", tone: "creamblue" },
  { label: "两个庭院 + 下沉院", tone: "mint" },
  { label: "科学规划", tone: "creamblue" },
];

export function EnvironmentView({
  content,
  preview = false,
  previewToken,
}: {
  content: EnvironmentContent;
  preview?: boolean;
  previewToken?: string;
}) {
  const imageUrls = useSitePageImageUrls(
    content.sections.flatMap((section) =>
      getEnvironmentSectionImages(section).map(({ image }) => image.imageId),
    ),
  );

  return (
    <PhoneFrame
      title="猫舍环境"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : "sm:px-6"}
      frameClassName={
        preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : "sm:max-w-[980px]"
      }
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

      <Section className="mb-10 mt-5">
        <div className="grid gap-4 xl:grid-cols-2">
          {content.sections.map((section) => {
            const cover = getEnvironmentSectionCoverImage(section);
            const coverUrl = cover?.image.imageId ? imageUrls[cover.image.imageId] : undefined;

            return (
              <EnvironmentOverviewCard
                key={section.id}
                section={section}
                coverUrl={coverUrl}
                coverLabel={
                  cover
                    ? `示例图片（${section.title} · ${cover.roomTitle}，待替换）`
                    : `示例图片（${section.title}封面，待替换）`
                }
                preview={preview}
                previewToken={previewToken}
              />
            );
          })}
        </div>
      </Section>
    </PhoneFrame>
  );
}

function EnvironmentOverviewCard({
  section,
  coverUrl,
  coverLabel,
  preview,
  previewToken,
}: {
  section: EnvironmentSection;
  coverUrl?: string;
  coverLabel: string;
  preview: boolean;
  previewToken?: string;
}) {
  const roomCount = section.rooms.length;
  const photoCount = getEnvironmentSectionImages(section).length;
  const detailHref = buildEnvironmentSectionHref(section.id, previewToken);

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-background p-3">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="aspect-[16/10] w-full rounded-[22px] object-cover"
            loading="lazy"
          />
        ) : (
          <Placeholder label={coverLabel} ratio="aspect-[16/10]" />
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold leading-tight text-heading">
              {section.title}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill tone="creamblue">{roomCount} 个房间 / 子区域</Pill>
              <Pill tone="sky">{photoCount} 张照片</Pill>
              {section.meta.trim() && <Pill tone="mint">{section.meta}</Pill>}
            </div>
          </div>
        </div>

        <p className="mt-3 whitespace-pre-line text-[13px] leading-[1.85] text-muted-foreground">
          {section.summary}
        </p>

        {preview ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-[13px] font-semibold text-primary">
            查看环境
            <ChevronRightIcon className="h-4 w-4" />
          </div>
        ) : (
          <a
            href={detailHref}
            className="pressable mt-4 inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-[13px] font-semibold text-primary"
          >
            查看环境
            <ChevronRightIcon className="h-4 w-4" />
          </a>
        )}
      </div>
    </Card>
  );
}

function buildEnvironmentSectionHref(sectionId: string, previewToken?: string) {
  const previewQuery = previewToken ? `?sitePagePreview=${encodeURIComponent(previewToken)}` : "";
  return `/environment/${encodeURIComponent(sectionId)}${previewQuery}`;
}
