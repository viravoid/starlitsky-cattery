import { Fragment, useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { Link } from "@tanstack/react-router";
import { PhoneFrame } from "./PhoneFrame";
import { Section } from "./ui";
import { Carousel } from "./Carousel";
import { StarIcon, MoonIcon } from "./icons";
import { CatProfile, WindingPath, CurledCat, PawTrail } from "./illustrations";
import {
  getHomepageEntryNo,
  type HomepageContent,
  type HomepageArtKey,
} from "@/lib/homepage-content";
import { getHomepageImageBlob } from "@/lib/homepage-storage";

const ART: Record<HomepageArtKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  catProfile: CatProfile,
  windingPath: WindingPath,
};

const PARTS = ["One", "Two", "Three"];

export function HomepageView({
  content,
  preview = false,
}: {
  content: HomepageContent;
  preview?: boolean;
}) {
  const imageUrls = useHomepageImageUrls(content);
  const slides = content.hero.slides.map((slide) => ({
    label: slide.label,
    imageUrl: slide.imageId ? imageUrls[slide.imageId] : undefined,
  }));

  return (
    <PhoneFrame
      activeTab="home"
      showTabBar
      outerClassName={preview ? "min-h-0 p-0 sm:py-0" : ""}
      frameClassName={preview ? "h-[760px] max-w-[360px] sm:h-[760px] sm:rounded-[2.25rem]" : ""}
    >
      <div className="relative px-3 pt-3">
        <div className="pointer-events-none absolute inset-x-3 bottom-0 z-10 flex flex-col items-center justify-end rounded-b-[1.75rem] px-4 pb-7 pt-12 text-center">
          <h1
            className="text-[27px] font-bold leading-tight drop-shadow-sm"
            style={{ color: "#7a9ac0" }}
          >
            {content.hero.title}
          </h1>
          <p
            className="mt-1 font-display text-[13px] italic drop-shadow-sm"
            style={{ color: "#86a6d2" }}
          >
            {content.hero.subtitle}
          </p>
        </div>

        <Carousel slides={slides} ratio="aspect-[4/5]" rounded="rounded-[1.75rem]" />
      </div>

      <header className="px-6 pb-1 pt-6 text-center">
        <p className="font-display text-[10.5px] uppercase tracking-[0.3em] text-warm">
          {[content.intro.eyebrowPrefix, content.intro.fixedMeta].filter(Boolean).join(" ")}
        </p>
        <p className="mx-auto mt-4 max-w-[19rem] whitespace-pre-line text-[13px] leading-[2] text-foreground">
          {content.intro.body}
        </p>
      </header>

      <Section className="mt-6">
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
          <div className="flex items-center gap-2 rounded-full bg-muted/70 px-3 py-2">
            <StarIcon className="h-3 w-3 text-heading" />
            <MoonIcon className="h-3.5 w-3.5 text-lilac" />
            <StarIcon className="h-3 w-3 text-heading" />
          </div>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border" />
        </div>
      </Section>

      <div className="mt-6 space-y-12">
        {content.groups.map((group, gi) => {
          const Art = ART[group.artKey];
          const items = group.entryOrder.map((id) => content.entries[id]).filter(Boolean);

          return (
            <Fragment key={group.id}>
              <Section>
                <div
                  className={`flex items-start gap-4 ${
                    gi % 2 === 1 ? "flex-row-reverse text-right" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[10px] uppercase tracking-[0.26em] text-warm">
                      {`Part ${PARTS[gi] ?? gi + 1} · ${group.en}`}
                    </p>
                    <h3 className="mt-1 text-[20px] font-bold text-heading">{group.cn}</h3>
                    <p
                      className={`mt-2 max-w-[15rem] whitespace-pre-line text-[12.5px] leading-[1.85] text-foreground ${
                        gi % 2 === 1 ? "ml-auto" : ""
                      }`}
                    >
                      {group.lead}
                    </p>
                  </div>
                  <Art className={`-mt-1 h-[64px] w-[64px] shrink-0 ${group.tint}`} />
                </div>

                <div className="mt-4 pl-1">
                  {items.map((item, idx) => (
                    <HomepageEntryLink
                      key={item.id}
                      no={getHomepageEntryNo(idx)}
                      title={item.title}
                      desc={item.desc}
                      to={item.to}
                      statusLabel={item.statusLabel}
                      bordered={idx > 0}
                    />
                  ))}
                </div>
              </Section>
              {gi === 0 && <PawTrail className="w-full" />}
            </Fragment>
          );
        })}
      </div>

      <Section className="mt-16">
        <Link
          to={content.catsPreview.to}
          className="pressable relative block overflow-hidden rounded-[1.75rem] border border-border bg-gradient-cream p-6"
        >
          <CurledCat className="absolute -right-3 -bottom-3 h-24 w-24 text-warm/25" />
          <p className="font-display text-[10.5px] uppercase tracking-[0.24em] text-warm">
            {content.catsPreview.eyebrow}
          </p>
          <h2 className="mt-1 text-[22px] font-bold leading-none text-heading">
            {content.catsPreview.title}
          </h2>
          <p className="mt-3 max-w-[15rem] text-[12.5px] leading-[1.9] text-foreground">
            {content.catsPreview.description}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet">
            {content.catsPreview.buttonText} <span aria-hidden>→</span>
          </span>
        </Link>
      </Section>
    </PhoneFrame>
  );
}

function HomepageEntryLink({
  no,
  title,
  desc,
  to,
  statusLabel,
  bordered,
}: {
  no: string;
  title: string;
  desc: string;
  to: string | null;
  statusLabel?: string;
  bordered: boolean;
}) {
  const className = `pressable group flex items-baseline gap-3.5 py-3.5 ${
    bordered ? "border-t border-dashed border-border/70" : ""
  }`;
  const content = (
    <>
      <span className="font-display text-[13px] italic text-warm/70">{no}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[15.5px] font-semibold text-heading">
          {title}
          {!to && (
            <span className="rounded-full bg-sunny/65 px-1.5 py-0.5 text-[10px] font-semibold text-[#9b7927]">
              {statusLabel ?? "即将上线"}
            </span>
          )}
        </span>
        <span className="mt-1 block text-[12px] leading-[1.8] text-muted-foreground">{desc}</span>
      </span>
      {to && (
        <span
          aria-hidden
          className="mt-0.5 text-[15px] text-secondary transition-transform group-active:translate-x-0.5"
        >
          →
        </span>
      )}
    </>
  );

  if (!to) {
    return (
      <div className={`${className} cursor-default`} aria-disabled>
        {content}
      </div>
    );
  }

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

function useHomepageImageUrls(content: HomepageContent) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const imageKey = useMemo(
    () => content.hero.slides.map((slide) => slide.imageId ?? "").join("|"),
    [content.hero.slides],
  );

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    async function load() {
      const next: Record<string, string> = {};
      for (const slide of content.hero.slides) {
        if (!slide.imageId) continue;
        const blob = await getHomepageImageBlob(slide.imageId);
        if (!blob || !active) continue;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        next[slide.imageId] = url;
      }
      if (active) setUrls(next);
    }

    void load();

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [content.hero.slides, imageKey]);

  return urls;
}
