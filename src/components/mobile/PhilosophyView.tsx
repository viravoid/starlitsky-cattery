import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import type { PhilosophyContent, PhilosophyMilestone } from "@/lib/philosophy-content";
import type { ReactNode } from "react";

export function PhilosophyView({
  content,
  preview = false,
}: {
  content: PhilosophyContent;
  preview?: boolean;
}) {
  return (
    <PhoneFrame
      title="繁育理念"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      {/* English label */}
      <Section className="pt-4 text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[#7a9ac0]">
          Breeding Philosophy
        </p>
      </Section>

      {/* Opening — lightweight card */}
      <Section className="mt-3">
        <div className="rounded-xl border border-[#d5dfec]/80 bg-[#fff7df]/70 px-4 py-3.5">
          <P>{content.openingBelief}</P>
        </div>
      </Section>

      {/* Continuous self-narrative */}
      <Section className="mt-8 space-y-4">
        <P>{content.growthEffortParagraph}</P>
        <P>{content.growthCommunityParagraph}</P>
        <P>{content.growthFuturePlanParagraph}</P>
      </Section>

      {/* Time node — 05 / 07 years */}
      <Section className="mt-10">
        <div className="flex items-baseline justify-center gap-10">
          <MilestoneNode milestone={content.milestones.founder} fallbackWidth="05" />
          <MilestoneNode milestone={content.milestones.yueqi} fallbackWidth="07" />
        </div>
      </Section>

      {/* Stage change narrative */}
      <Section className="mt-8 space-y-4">
        <P>{content.stageNewHomeParagraph}</P>
        <P className="font-medium tracking-[0.02em] text-[#58616c]">
          {content.stageClearGoalParagraph}
        </P>
      </Section>

      {/* Theme transition */}
      <Section className="mt-12 text-center">
        <p className="font-display text-[9px] uppercase tracking-[0.35em] text-[#7a9ac0]/80">
          Bloodline · Style · Breeding
        </p>
        <h3 className="mt-2 text-[21px] font-semibold tracking-[0.04em] text-[#7a9ac0]">
          我们理解的缅因与风格
        </h3>
        <div className="mx-auto mt-4 h-px w-12 bg-[#e7c15d]/40" />
      </Section>

      {/* Style narrative */}
      <Section className="mt-8 space-y-4">
        <P>{content.styleBloodlineParagraph}</P>
        <P>{content.styleBeyondLabelsParagraph}</P>
      </Section>

      {/* Highlighted original sentence */}
      <Section className="mt-8 px-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-px w-10 bg-[#e7c15d]/30" />
          <p className="text-center text-[16px] font-medium leading-[1.8] tracking-[0.02em] text-[#58616c]">
            {content.highlightLineOne}
            <br />
            {content.highlightLineTwo}
          </p>
          <div className="h-px w-10 bg-[#e7c15d]/30" />
        </div>
      </Section>

      <Section className="mt-8 space-y-4">
        <P>{content.directionGlobalBreedersParagraph}</P>
        <P>{content.directionGoalParagraph}</P>
      </Section>

      {/* Closing — natural continuation */}
      <Section className="mt-10 space-y-4">
        <P>{content.closingLifeParagraph}</P>
        <P>{content.closingCareerParagraph}</P>
        <P>{content.closingParentParagraph}</P>
        <P>{content.closingAftercareParagraph}</P>
      </Section>

      {/* Final closing node */}
      <Section className="mt-12 pb-12">
        <div className="flex flex-col items-center gap-4">
          <div className="h-px w-10 bg-[#e7c15d]/40" />
          <div className="flex items-center gap-3 font-display text-[13px] tracking-[0.2em] text-[#e7c15d]/80">
            <span>互相尊重</span>
            <span className="h-1 w-1 rounded-full bg-[#e7c15d]/60" />
            <span>互相选择</span>
            <span className="h-1 w-1 rounded-full bg-[#e7c15d]/60" />
            <span>互相信任</span>
          </div>
        </div>
      </Section>
    </PhoneFrame>
  );
}

function P({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[15px] leading-[1.9] text-[#58616c] ${className ?? ""}`}>{children}</p>
  );
}

function MilestoneNode({
  milestone,
  fallbackWidth,
}: {
  milestone: PhilosophyMilestone;
  fallbackWidth: string;
}) {
  const visibleValue = milestone.value.trim();

  return (
    <div className="text-center">
      <div className="font-display text-[34px] font-light leading-none tracking-[0.05em] text-[#e7c15d]/80">
        {visibleValue || (
          <span aria-hidden="true" className="invisible">
            {fallbackWidth}
          </span>
        )}
      </div>
      <div className="mt-1.5 font-display text-[9px] uppercase tracking-[0.3em] text-[#e7c15d]/60">
        Years
      </div>
      <div className="mt-2 min-h-[1.25rem] text-[13px] text-[#58616c]">{milestone.description}</div>
    </div>
  );
}
