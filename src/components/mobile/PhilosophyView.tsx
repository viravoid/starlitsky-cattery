import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import type { PhilosophyContent } from "@/lib/philosophy-content";

export function PhilosophyView({
  content,
  preview = false,
}: {
  content: PhilosophyContent;
  preview?: boolean;
}) {
  const paragraphs = buildParagraphs(content);

  return (
    <PhoneFrame
      title="繁育理念"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      <Section className="pb-12 pt-6">
        <div className="space-y-5">
          {paragraphs.map((paragraph, index) => (
            <p
              key={`${index}-${paragraph}`}
              className="text-[15px] leading-[2] tracking-[0.01em] text-[#58616c]"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </Section>
    </PhoneFrame>
  );
}

function buildParagraphs(content: PhilosophyContent) {
  return [
    content.openingBelief,
    joinParagraphs([
      content.growthEffortParagraph,
      content.growthCommunityParagraph,
      content.growthFuturePlanParagraph,
    ]),
    joinParagraphs([
      `今年是${content.milestones.founder.description}，${content.milestones.yueqi.description}。`,
      content.stageNewHomeParagraph,
      content.stageClearGoalParagraph,
    ]),
    joinParagraphs([
      content.styleBloodlineParagraph,
      content.styleBeyondLabelsParagraph,
      `${content.highlightLineOne}${content.highlightLineTwo}`,
      content.directionGlobalBreedersParagraph,
      content.directionGoalParagraph,
    ]),
    joinParagraphs([
      content.closingLifeParagraph,
      content.closingCareerParagraph,
      content.closingParentParagraph,
      content.closingAftercareParagraph,
    ]),
  ].filter((paragraph) => paragraph.trim());
}

function joinParagraphs(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("");
}
