import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { StarIcon, PaperIcon } from "@/components/mobile/icons";
import {
  CatProfile,
  CurledCat,
  MoonStars,
  PawTrail,
  TailArc,
} from "@/components/mobile/illustrations";
import heroCats from "@/assets/hero-cats.png";
import catMotif from "@/assets/placeholder-cat.png";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <PhoneFrame activeTab="home" showTabBar>
      {/* ── Brand hero ───────────────────────────── */}
      <header className="relative px-6 pb-2 pt-5 text-center">
        <StarIcon className="absolute left-7 top-8 h-4 w-4 text-primary/60" />
        <StarIcon className="absolute right-9 top-16 h-3 w-3 text-violet/45" />
        <p className="font-display text-[11px] uppercase tracking-[0.34em] text-warm">
          Est. 2019 · Xi&apos;an
        </p>
        <img
          src={heroCats}
          alt="星月缅因猫舍 手绘缅因猫插画"
          width={1440}
          height={1040}
          className="mx-auto mt-1 w-[74%] max-w-[272px]"
        />
        <h1 className="-mt-3 text-[28px] font-bold leading-tight text-heading">
          星月缅因猫舍
        </h1>
        <p className="mt-0.5 font-display text-[13px] italic text-[#4a5e8f]">
          StarlitSky Maine Coon Cattery
        </p>
        <p className="mx-auto mt-4 max-w-[17rem] text-[13px] leading-[2] text-foreground">
          做一家有温度的缅因猫舍。坚持自繁自养、低频率繁育与社会化训练，陪伴小猫从出生到去新家。
        </p>
      </header>

      {/* ── Main visual — full-bleed hero photo ──── */}
      <div className="relative mt-6 px-3">
        <div className="relative aspect-[5/6] w-full overflow-hidden rounded-[2rem] bg-gradient-cream">
          <img
            src={catMotif}
            alt=""
            aria-hidden
            className="absolute left-1/2 top-1/2 w-[58%] max-w-[210px] -translate-x-1/2 -translate-y-[58%] opacity-55 mix-blend-multiply"
          />
          <MoonStars className="absolute right-6 top-6 h-10 w-10 text-violet/35" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f4ead6]/95 via-[#f4ead6]/60 to-transparent px-6 pb-6 pt-16 text-left">
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-warm">
              StarlitSky · 2019
            </p>
            <p className="mt-1.5 max-w-[15rem] text-[13px] font-medium leading-relaxed text-heading">
              示例图片（首页主视觉猫舍照片，待替换）
            </p>
          </div>
        </div>
        {/* small credential line, understated */}
        <div className="mt-4 flex items-center justify-center gap-3 text-[11.5px] font-medium text-warm">
          <span>WCF · CFA 注册</span>
          <span className="h-3 w-px bg-border" />
          <span>自繁自养</span>
          <span className="h-3 w-px bg-border" />
          <span>别墅散养</span>
        </div>
      </div>

      {/* ── Two doorways, as a hand-drawn guide ──── */}
      <div className="mt-14">
        {/* 01 · 了解星月 */}
        <Section>
          <Link to="/discover" className="pressable block">
            <div className="flex items-center gap-5">
              <CatProfile className="h-[86px] w-[86px] shrink-0 text-[#4a5e8f]/80" />
              <div className="min-w-0">
                <p className="font-display text-[10.5px] uppercase tracking-[0.24em] text-warm">
                  01 · About StarlitSky
                </p>
                <h2 className="mt-1 text-[20px] font-bold text-heading">
                  了解星月
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-[1.85] text-foreground">
                  我们是谁、如何繁育、住在怎样的环境，以及接猫流程与售后。
                </p>
                <span className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet">
                  走进猫舍 <span aria-hidden>→</span>
                </span>
              </div>
            </div>
          </Link>
        </Section>

        {/* connecting hand-drawn trail */}
        <div className="my-6 flex justify-center">
          <PawTrail />
        </div>

        {/* 02 · 我们的猫 */}
        <Section>
          <Link to="/cats" className="pressable block">
            <div className="flex items-center gap-5">
              <div className="min-w-0 text-right">
                <p className="font-display text-[10.5px] uppercase tracking-[0.24em] text-warm">
                  02 · Our Cats
                </p>
                <h2 className="mt-1 text-[20px] font-bold text-heading">
                  我们的猫
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-[1.85] text-foreground">
                  在售与观察中的小猫，以及陪伴我们的种猫，血线清晰、健康透明。
                </p>
                <span className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet">
                  看看小猫 <span aria-hidden>→</span>
                </span>
              </div>
              <CurledCat className="h-[86px] w-[86px] shrink-0 text-[#a0876a]" />
            </div>
          </Link>
        </Section>
      </div>

      {/* ── Gentle conversion — no box, just breathing space ── */}
      <Section className="mb-12 mt-16 text-center">
        <TailArc className="mx-auto h-11 w-11 text-violet/45" />
        <p className="mt-3 text-[16px] font-semibold text-heading">
          想进一步了解星月的小猫
        </p>
        <p className="mx-auto mt-2 max-w-[16rem] text-[12.5px] leading-[1.9] text-foreground">
          可以先填写一份选猫问卷，我们会认真查看每一份回复。
        </p>
        <Link
          to="/questionnaire"
          className="pressable mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-violet px-6 py-3.5 text-sm font-semibold text-white shadow-card"
        >
          <PaperIcon className="h-4 w-4" /> 填写选猫问卷
        </Link>
      </Section>
    </PhoneFrame>
  );
}
