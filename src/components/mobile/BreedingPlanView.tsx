import { Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Placeholder, Pill, Section } from "@/components/mobile/ui";
import { PawTrail } from "@/components/mobile/illustrations";
import { StarIcon } from "@/components/mobile/icons";
import {
  BREEDING_PLAN_PAGE_EYEBROW,
  BREEDING_PLAN_PAGE_TITLE,
  type BreedingPlanContent,
  type BreedingPlanPairing,
} from "@/lib/breeding-plan-content";
import type { Stud } from "@/lib/cattery-data";

type StudMap = Map<string, Stud>;

export function BreedingPlanView({
  content,
  studs,
  preview = false,
}: {
  content: BreedingPlanContent;
  studs: Stud[];
  preview?: boolean;
}) {
  const studMap: StudMap = new Map(studs.map((stud) => [stud.id, stud]));
  const period = content.period.trim();
  const introduction = content.introduction.trim();
  const disclaimer = content.disclaimer.trim();
  const visibleGroups = content.groups.filter((group) => group.pairings.length > 0);

  return (
    <PhoneFrame
      title={BREEDING_PLAN_PAGE_TITLE}
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      <Section className="pt-4 text-center">
        <p className="font-display text-[10px] uppercase tracking-[0.38em] text-heading">
          {BREEDING_PLAN_PAGE_EYEBROW}
        </p>
        {period && (
          <>
            <h1 className="mt-2 text-[24px] font-semibold leading-tight text-heading">{period}</h1>
            <div className="mx-auto mt-4 h-px w-14 bg-sunflower/45" />
          </>
        )}
        {introduction && (
          <p className="mx-auto mt-4 max-w-[18rem] text-[13.5px] leading-[1.9] text-foreground">
            {introduction}
          </p>
        )}
        <p className="mx-auto mt-4 max-w-[18rem] rounded-full border border-border bg-card/70 px-3.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          点击种猫卡片，可查看对应种猫的详情介绍
        </p>
      </Section>

      <div className="mt-9 flex flex-col gap-12 pb-12">
        {visibleGroups.map((group, index) => {
          const groupEyebrow = group.eyebrow.trim();
          const groupTitle = group.title.trim();
          const groupDescription = group.description.trim();

          return (
            <Section key={group.id} className="flex flex-col gap-4">
              {index > 0 && <PawTrail className="mb-4 w-full" />}
              {(groupEyebrow || groupTitle || groupDescription) && (
                <div>
                  {groupEyebrow && (
                    <p className="font-display text-[10px] uppercase tracking-[0.28em] text-warm">
                      {groupEyebrow}
                    </p>
                  )}
                  {groupTitle && (
                    <h2 className="mt-1 text-[20px] font-semibold text-heading">{groupTitle}</h2>
                  )}
                  {groupDescription && (
                    <p className="mt-2 text-[12.5px] leading-[1.8] text-foreground">
                      {groupDescription}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-4">
                {group.pairings.map((pairing) => (
                  <PairingCard
                    key={pairing.id}
                    pairing={pairing}
                    male={studMap.get(pairing.maleStudId)}
                    female={studMap.get(pairing.femaleStudId)}
                  />
                ))}
              </div>
            </Section>
          );
        })}

        {disclaimer && (
          <Section>
            <div className="rounded-[1.25rem] border border-sunflower/35 bg-sunny/35 px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <StarIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm/75" />
                <p className="text-[12.5px] leading-[1.85] text-foreground">{disclaimer}</p>
              </div>
            </div>
          </Section>
        )}
      </div>
    </PhoneFrame>
  );
}

function PairingCard({
  pairing,
  male,
  female,
}: {
  pairing: BreedingPlanPairing;
  male?: Stud;
  female?: Stud;
}) {
  const timeLabel = pairing.timeLabel.trim();

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-border bg-card/85 shadow-card">
      {timeLabel && (
        <div className="flex items-center justify-between gap-3 border-b border-dashed border-border/75 bg-muted/45 px-4 py-3">
          <Pill tone="sunny" className="shrink-0 border border-sunflower/25">
            {timeLabel}
          </Pill>
        </div>
      )}

      <div className="px-3.5 pb-4 pt-3.5">
        <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-stretch gap-2.5">
          <StudLink stud={male} fallbackId={pairing.maleStudId} genderLabel="公猫" />
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <span className="font-display text-[24px] leading-none text-sunflower">×</span>
            <span className="h-px w-full bg-gradient-to-r from-transparent via-sunflower/40 to-transparent" />
          </div>
          <StudLink stud={female} fallbackId={pairing.femaleStudId} genderLabel="母猫" />
        </div>

        <ExpectedColors colors={pairing.expectedColors} />
      </div>
    </article>
  );
}

function StudLink({
  stud,
  fallbackId,
  genderLabel,
}: {
  stud?: Stud;
  fallbackId: string;
  genderLabel: string;
}) {
  if (!stud) {
    return (
      <div className="min-w-0 rounded-[1.15rem] border border-dashed border-border bg-muted/35 p-2.5 text-center">
        <Placeholder
          label="示例图片（种猫照片，待替换）"
          ratio="aspect-square"
          rounded="rounded-[0.95rem]"
          compact
        />
        <p className="mt-2 text-[13px] font-semibold leading-snug text-heading">资料待补充</p>
        <p className="mt-1 break-all text-[10.5px] leading-snug text-muted-foreground">
          {fallbackId}
        </p>
      </div>
    );
  }

  return (
    <Link
      to="/studs/$id"
      params={{ id: stud.id }}
      aria-label={`查看${stud.name}的种猫详情`}
      className="pressable group min-w-0 rounded-[1.15rem] border border-border bg-cream/90 p-2.5 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Placeholder
        label={`${stud.name}的种猫照片，待替换`}
        ratio="aspect-square"
        rounded="rounded-[0.95rem]"
        compact
      />
      <p className="mt-2 text-[10.5px] font-medium text-muted-foreground">{genderLabel}</p>
      <h3 className="mt-0.5 break-words text-[15px] font-semibold leading-snug text-heading">
        {stud.name}
      </h3>
      <p className="mt-1 break-words text-[11px] leading-[1.55] text-muted-foreground">
        {stud.color}
      </p>
    </Link>
  );
}

function ExpectedColors({ colors }: { colors: string[] }) {
  const visibleColors = colors.map((color) => color.trim()).filter(Boolean);

  return (
    <div className="mt-3.5 min-h-[4.4rem] rounded-[1.1rem] border border-dashed border-border/90 bg-muted/35 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-[12.5px] font-semibold text-heading">预计花色</h4>
        <span className="text-[10.5px] text-muted-foreground">待主理人补充</span>
      </div>
      {visibleColors.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {visibleColors.map((color, index) => (
            <Pill key={`${color}-${index}`} tone="creamblue" className="break-words">
              {color}
            </Pill>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5" aria-label="预计花色待补充">
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              className="h-7 rounded-full border border-dashed border-sunflower/35 bg-card/60"
            />
          ))}
        </div>
      )}
    </div>
  );
}
