import { PhoneFrame } from "./PhoneFrame";
import { Section, SectionTitle, Card } from "./ui";
import { PriceTagIcon, GiftIcon, RouteIcon, MoonIcon, PawIcon, HeartIcon } from "./icons";
import type {
  ProcessContent,
  ProcessPriceCard,
  ProcessSimpleCard,
  ProcessStep,
} from "@/lib/process-content";

const PRICE_CARD_TONES = ["bg-sky/25", "bg-creamblue/45", "bg-sunny/45"];

export function ProcessView({
  content,
  preview = false,
}: {
  content: ProcessContent;
  preview?: boolean;
}) {
  const priceCards = content.priceCards.filter(hasPriceCardContent);
  const breedingCards = content.breedingCards.filter(hasSimpleCardContent);
  const returningBenefits = content.returningBenefits.filter(hasSimpleCardContent);
  const steps = content.steps.filter(hasStepContent);
  const welcomeKitItems = content.welcomeKitItems.filter((item) => item.text.trim());
  const showPricing = Boolean(content.pricingIntro.trim()) || priceCards.length > 0;
  const showBreeding = Boolean(content.breedingIntro.trim()) || breedingCards.length > 0;
  const showReturning =
    Boolean(content.returningFamiliesIntro.trim()) || returningBenefits.length > 0;
  const showWelcomeKit = welcomeKitItems.length > 0 || Boolean(content.welcomeKitNote.trim());
  const showContractNotice = Boolean(content.contractNotice.trim());

  return (
    <PhoneFrame
      title="价格与流程"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      {showPricing && (
        <Section className="pt-1">
          <SectionTitle cn="价格区间" en="Pricing" icon={<PriceTagIcon className="h-5 w-5" />} />
          {content.pricingIntro.trim() && (
            <p className="mb-3 whitespace-pre-line text-[12px] text-muted-foreground">
              {content.pricingIntro}
            </p>
          )}
          {priceCards.length > 0 && (
            <div className="space-y-2.5">
              {priceCards.map((card, index) => (
                <Card key={card.id} className={`p-4 ${priceCardTone(index)}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="whitespace-pre-line text-[13px] font-semibold text-card-foreground">
                      {card.label}
                    </p>
                    <p className="whitespace-pre-line text-right text-[15px] font-semibold text-heading">
                      {card.value}
                    </p>
                  </div>
                  {card.note.trim() && (
                    <p className="mt-1.5 whitespace-pre-line text-[12px] leading-relaxed text-foreground/90">
                      {card.note}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {showBreeding && (
        <Section className={showPricing ? "mt-7" : "pt-1"}>
          <SectionTitle cn="繁育权" en="Breeding Rights" icon={<PawIcon className="h-5 w-5" />} />
          {content.breedingIntro.trim() && (
            <p className="mb-3 whitespace-pre-line text-[12px] text-muted-foreground">
              {content.breedingIntro}
            </p>
          )}
          {breedingCards.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5">
              {breedingCards.map((card) => (
                <Card key={card.id} className="p-3.5">
                  <p className="whitespace-pre-line text-[12px] font-medium text-card-foreground">
                    {card.label}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-[15px] font-semibold text-heading">
                    {card.value}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {showReturning && (
        <Section className={showPricing || showBreeding ? "mt-7" : "pt-1"}>
          <SectionTitle
            cn="老家长福利"
            en="Returning Families"
            icon={<HeartIcon className="h-5 w-5" />}
          />
          {content.returningFamiliesIntro.trim() && (
            <p className="mb-3 whitespace-pre-line text-[12px] text-muted-foreground">
              {content.returningFamiliesIntro}
            </p>
          )}
          {returningBenefits.length > 0 && (
            <div className="grid grid-cols-4 gap-2.5">
              {returningBenefits.map((benefit) => (
                <Card key={benefit.id} className="flex flex-col p-3 text-center">
                  <p className="whitespace-pre-line text-[12px] font-medium text-card-foreground">
                    {benefit.label}
                  </p>
                  <div className="flex flex-1 items-center justify-center">
                    <p className="whitespace-pre-line text-[15px] font-semibold text-heading">
                      {benefit.value}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>
      )}

      {steps.length > 0 && (
        <Section className={showPricing || showBreeding || showReturning ? "mt-7" : "pt-1"}>
          <SectionTitle cn="购买流程" en="Steps" icon={<RouteIcon className="h-5 w-5" />} />
          <div className="relative pl-2">
            <div className="absolute bottom-2 left-[18px] top-2 w-px bg-border" />
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={step.id} className="relative flex items-start gap-3">
                  <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet text-[13px] font-semibold text-white shadow-card">
                    {index + 1}
                  </span>
                  <div className="flex-1 rounded-2xl border border-border bg-card p-3.5 shadow-card">
                    <p className="whitespace-pre-line text-[13.5px] font-semibold text-heading">
                      {step.title}
                    </p>
                    {step.description.trim() && (
                      <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-foreground/90">
                        {step.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Section>
      )}

      {showWelcomeKit && (
        <Section
          className={
            showPricing || showBreeding || showReturning || steps.length > 0 ? "mt-7" : "pt-1"
          }
        >
          <SectionTitle cn="新家礼包" en="Welcome Kit" icon={<GiftIcon className="h-5 w-5" />} />
          <Card className="p-4">
            {welcomeKitItems.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2.5">
                {welcomeKitItems.map((item) => (
                  <span
                    key={item.id}
                    className="min-w-[88px] whitespace-pre-line rounded-full bg-muted px-3 py-1.5 text-center text-[12px] font-medium text-card-foreground"
                  >
                    {item.text}
                  </span>
                ))}
              </div>
            )}
            {content.welcomeKitNote.trim() && (
              <p className="mt-3 whitespace-pre-line text-[12px] leading-relaxed text-foreground/70">
                {content.welcomeKitNote}
              </p>
            )}
          </Card>
        </Section>
      )}

      {showContractNotice && (
        <Section className="mb-10 mt-6">
          <div className="flex items-start gap-2 rounded-2xl bg-sunny/40 p-3.5">
            <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#b48725]" />
            <p className="whitespace-pre-line text-[12px] leading-relaxed text-[#b48725]">
              {content.contractNotice}
            </p>
          </div>
        </Section>
      )}
    </PhoneFrame>
  );
}

function priceCardTone(index: number) {
  return PRICE_CARD_TONES[index % PRICE_CARD_TONES.length];
}

function hasPriceCardContent(card: ProcessPriceCard) {
  return Boolean(card.label.trim() || card.value.trim() || card.note.trim());
}

function hasSimpleCardContent(card: ProcessSimpleCard) {
  return Boolean(card.label.trim() || card.value.trim());
}

function hasStepContent(step: ProcessStep) {
  return Boolean(step.title.trim() || step.description.trim());
}
