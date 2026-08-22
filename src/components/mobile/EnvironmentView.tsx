import { PhoneFrame } from "./PhoneFrame";
import { Section, Card, Pill } from "./ui";
import { LeafIcon, ChevronRightIcon } from "./icons";
import {
  getEnvironmentSectionImages,
  type EnvironmentContent,
  type EnvironmentSection,
} from "@/lib/environment-content";

const FIXED_TAGS = [
  { label: "共四层", tone: "sky" },
  { label: "600+ ㎡ 室内", tone: "creamblue" },
  { label: "两个庭院 + 下沉院", tone: "mint" },
  { label: "科学规划", tone: "creamblue" },
] as const;

export function EnvironmentView({
  content,
  preview = false,
  previewToken,
}: {
  content: EnvironmentContent;
  preview?: boolean;
  previewToken?: string;
}) {
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
          {content.sections.map((section) => (
            <EnvironmentOverviewCard
              key={section.id}
              section={section}
              preview={preview}
              previewToken={previewToken}
            />
          ))}
        </div>
      </Section>
    </PhoneFrame>
  );
}

function EnvironmentOverviewCard({
  section,
  preview,
  previewToken,
}: {
  section: EnvironmentSection;
  preview: boolean;
  previewToken?: string;
}) {
  const hasAnyRoomImages = section.rooms.some((room) => room.images.length > 0);
  const roomCount = !preview && hasAnyRoomImages ? section.rooms.filter((room) => room.images.length > 0).length : section.rooms.length;
  const photoCount = getEnvironmentSectionImages(section).length;
  if (!preview && section.id === "environment-zone-common" && photoCount === 0) {
    return null;
  }
  const detailHref = buildEnvironmentSectionHref(section.id, previewToken);
  const content = (
    <Card className="h-full p-0">
      <div className="px-4 py-4">
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

        <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
          查看环境
          <ChevronRightIcon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );

  if (preview) {
    return content;
  }

  return (
    <a
      href={detailHref}
      className="pressable block rounded-[1.5rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {content}
    </a>
  );
}

function buildEnvironmentSectionHref(sectionId: string, previewToken?: string) {
  const previewQuery = previewToken ? `?sitePagePreview=${encodeURIComponent(previewToken)}` : "";
  return `/environment/${encodeURIComponent(sectionId)}${previewQuery}`;
}
