import { PhoneFrame } from "./PhoneFrame";
import { Carousel } from "./Carousel";
import { Section, SectionTitle, Card } from "./ui";
import { MoonStars, Cottage, Rosette, HeartPaw, CurledCat, DnaHelix } from "./illustrations";
import { formatAspectRatio, type AboutContent, type AboutFactKey } from "@/lib/about-content";
import { useSitePageImageUrls } from "@/hooks/use-site-page-image-urls";

const FACTS: { key: AboutFactKey; Art: typeof MoonStars }[] = [
  { key: "founded", Art: MoonStars },
  { key: "location", Art: Cottage },
  { key: "registration", Art: Rosette },
  { key: "socialization", Art: HeartPaw },
  { key: "aftercare", Art: CurledCat },
  { key: "screening", Art: DnaHelix },
];

export function AboutView({
  content,
  preview = false,
}: {
  content: AboutContent;
  preview?: boolean;
}) {
  const imageUrls = useSitePageImageUrls(content.hero.slides.map((slide) => slide.imageId));
  const slides = content.hero.slides.map((slide) => ({
    label: slide.label,
    imageUrl: slide.imageId ? imageUrls[slide.imageId] : undefined,
    focalPoint: slide.focalPoint,
  }));
  const paragraphs = content.body.split(/\n{2,}/).filter((paragraph) => paragraph.trim());

  return (
    <PhoneFrame
      title="关于星月"
      backTo="/"
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      <Section className="pt-1">
        <Carousel
          slides={slides}
          aspectRatio={formatAspectRatio(content.hero.aspectRatio)}
          rounded="rounded-3xl"
        />
      </Section>

      <Section className="mt-2">
        <SectionTitle cn="猫舍名片" en="At a glance" />
        <div className="grid grid-cols-2 gap-2.5">
          {FACTS.map(({ key, Art }) => (
            <Card key={key} className="flex min-h-[88px] items-center gap-2.5 p-3">
              <Art className="h-9 w-9 shrink-0 text-violet/80" />
              <span className="text-[13px] font-medium leading-snug text-card-foreground">
                {content.facts[key]}
              </span>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="mt-6">
        <Card className="space-y-2 bg-gradient-cream p-4">
          <h3 className="text-[15px] font-semibold text-heading">主理人 · 星下 & 月七</h3>
          <p className="text-[13px] leading-relaxed text-foreground">
            两位主理人全职经营猫舍，持续陪伴小猫成长，也在不断学习和完善繁育与行为学知识。
          </p>
        </Card>
      </Section>

      <Section className="mb-10 mt-10">
        <p className="font-display text-[12px] uppercase tracking-[0.25em] text-warm">
          About StarlitSky
        </p>
        <div className="mt-4 space-y-5 text-[14px] leading-[2] text-foreground">
          {paragraphs.length ? (
            paragraphs.map((paragraph, index) => (
              <p key={index} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">暂无正文内容</p>
          )}
        </div>
      </Section>
    </PhoneFrame>
  );
}
