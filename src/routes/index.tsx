import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { StarIcon, PaperIcon } from "@/components/mobile/icons";
import {
  CatProfile,
  CurledCat,
  PawTrail,
  TailArc,
} from "@/components/mobile/illustrations";

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
        <div className="mx-auto mt-5 w-[84%] max-w-[300px]">
          <Carousel
            slides={[
              { label: "示例图片（首页轮播图 1，待替换）" },
              { label: "示例图片（首页轮播图 2，待替换）" },
              { label: "示例图片（首页轮播图 3，待替换）" },
            ]}
            ratio="aspect-[4/3]"
            rounded="rounded-[1.5rem]"
          />
        </div>
        <h1 className="mt-4 text-[28px] font-bold leading-tight text-heading">
          星月缅因猫舍
        </h1>
        <p className="mt-0.5 font-display text-[13px] italic text-[#4a5e8f]">
          StarlitSky Maine Coon Cattery
        </p>
        <p className="mx-auto mt-4 max-w-[17rem] text-[13px] leading-[2] text-foreground">
          做一家有温度的缅因猫舍。坚持自繁自养、低频率繁育与社会化训练，陪伴小猫从出生到去新家。
        </p>
      </header>


      {/* ── Two doorways — an editorial, off-balance guide ── */}
      <div className="mt-14">
        {/* 01 · 了解星月 — left-weighted, illustration hugging the title */}
        <Section>
          <Link to="/discover" className="pressable block max-w-[15.5rem]">
            <div className="flex items-start gap-3.5">
              <CatProfile className="-mt-1 h-14 w-14 shrink-0 text-[#4a5e8f]/45" />
              <div className="pt-0.5">
                <p className="font-display text-[10.5px] uppercase tracking-[0.24em] text-warm">
                  01 · About StarlitSky
                </p>
                <h2 className="mt-1 text-[21px] font-bold leading-none text-heading">
                  了解星月
                </h2>
              </div>
            </div>
            <p className="mt-3.5 text-[12.5px] leading-[1.85] text-foreground">
              我们是谁、如何繁育、住在怎样的环境，以及接猫流程与售后。
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet">
              走进猫舍 <span aria-hidden>→</span>
            </span>
          </Link>
        </Section>

        {/* connecting hand-drawn trail, nudged off-centre */}
        <div className="my-7 flex justify-end pr-14">
          <PawTrail />
        </div>

        {/* 02 · 我们的猫 — right-weighted, illustration as a corner accent */}
        <Section>
          <Link
            to="/cats"
            className="pressable relative ml-auto block max-w-[16.5rem] text-right"
          >
            <CurledCat className="absolute -left-3 bottom-1 h-16 w-16 text-[#a0876a]/30" />
            <p className="font-display text-[10.5px] uppercase tracking-[0.24em] text-warm">
              02 · Our Cats
            </p>
            <h2 className="mt-1 text-[22px] font-bold leading-none text-heading">
              我们的猫
            </h2>
            <p className="ml-auto mt-3 max-w-[13.5rem] text-[12.5px] leading-[1.9] text-foreground">
              在售与观察中的小猫，以及陪伴我们的种猫，血线清晰、健康透明。
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet">
              看看小猫 <span aria-hidden>→</span>
            </span>
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
