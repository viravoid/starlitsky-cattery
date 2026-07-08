import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { StarIcon, PaperIcon } from "@/components/mobile/icons";
import {
  CatProfile,
  CurledCat,
  MoonStars,
  StarDivider,
} from "@/components/mobile/illustrations";
import { WECHAT_ID } from "@/lib/cattery-data";
import heroCats from "@/assets/hero-cats.png";
import catMotif from "@/assets/placeholder-cat.png";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <PhoneFrame activeTab="home" showTabBar>
      {/* ── Brand hero ───────────────────────────── */}
      <header className="relative px-6 pb-2 pt-4 text-center">
        <StarIcon className="absolute left-7 top-7 h-4 w-4 text-primary/60" />
        <StarIcon className="absolute right-9 top-14 h-3 w-3 text-violet/45" />
        <p className="font-display text-[11px] uppercase tracking-[0.3em] text-warm">
          Est. 2019 · Xi&apos;an
        </p>
        <img
          src={heroCats}
          alt="星月缅因猫舍 手绘缅因猫插画"
          width={1440}
          height={1040}
          className="mx-auto mt-1 w-[74%] max-w-[272px]"
        />
        <h1 className="-mt-3 text-[27px] font-bold leading-tight text-heading">
          星月缅因猫舍
        </h1>
        <p className="mt-0.5 font-display text-[13px] italic text-[#4a5e8f]">
          StarlitSky Maine Coon Cattery
        </p>
        <p className="mx-auto mt-3.5 max-w-[17rem] text-[13px] leading-[1.9] text-foreground">
          做一家有温度的缅因猫舍。坚持自繁自养、低频率繁育与小猫社会化训练，陪伴小猫从出生到去新家。
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 text-[11.5px] font-medium text-warm">
          <span>2019 年成立</span>
          <span className="h-3 w-px bg-border" />
          <span>WCF · CFA 注册</span>
          <span className="h-3 w-px bg-border" />
          <span>自繁自养</span>
        </div>
      </header>

      {/* ── Main visual ──────────────────────────── */}
      <Section className="mt-5">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] border border-border bg-gradient-cream shadow-card">
          <img
            src={catMotif}
            alt=""
            aria-hidden
            className="absolute left-1/2 top-1/2 w-[60%] max-w-[210px] -translate-x-1/2 -translate-y-[58%] opacity-60 mix-blend-multiply"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f4ead6]/90 to-transparent px-5 pb-5 pt-14">
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-warm">
              StarlitSky · 2019
            </p>
            <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-heading">
              示例图片（首页主视觉猫舍照片，待替换）
            </p>
          </div>
          <MoonStars className="absolute right-5 top-5 h-9 w-9 text-violet/40" />
        </div>
      </Section>

      <StarDivider className="mt-9" />

      {/* ── Entry: 了解星月 (illustration left) ───── */}
      <Section className="mt-6">
        <div className="flex items-center gap-4">
          <CatProfile className="h-[76px] w-[76px] shrink-0 text-[#4a5e8f]/80" />
          <div className="min-w-0">
            <p className="font-display text-[10.5px] uppercase tracking-[0.24em] text-warm">
              About StarlitSky
            </p>
            <h2 className="mt-0.5 text-[19px] font-bold text-heading">了解星月</h2>
            <p className="mt-1.5 text-[12.5px] leading-[1.8] text-foreground">
              我们是谁、如何繁育、住在怎样的环境里，以及接猫流程与售后。
            </p>
            <Link
              to="/discover"
              className="pressable mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet"
            >
              走进猫舍
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </Section>

      {/* ── Entry: 我们的猫 (illustration right) ───── */}
      <Section className="mt-7">
        <div className="flex items-center gap-4">
          <div className="min-w-0 text-right">
            <p className="font-display text-[10.5px] uppercase tracking-[0.24em] text-warm">
              Our Cats
            </p>
            <h2 className="mt-0.5 text-[19px] font-bold text-heading">我们的猫</h2>
            <p className="mt-1.5 text-[12.5px] leading-[1.8] text-foreground">
              在售与观察中的小猫，以及陪伴我们的种猫，血线清晰、健康筛查透明。
            </p>
            <Link
              to="/cats"
              className="pressable mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet"
            >
              看看小猫
              <span aria-hidden>→</span>
            </Link>
          </div>
          <CurledCat className="h-[76px] w-[76px] shrink-0 text-[#a0876a]" />
        </div>
      </Section>

      <StarDivider className="mt-9" />

      {/* ── Gentle conversion ────────────────────── */}
      <Section className="mb-12 mt-8">
        <div className="rounded-[1.75rem] bg-gradient-cream px-6 py-7 text-center">
          <MoonStars className="mx-auto h-9 w-9 text-violet/55" />
          <p className="mt-2.5 text-[15px] font-semibold text-heading">
            想进一步了解星月的小猫
          </p>
          <p className="mx-auto mt-2 max-w-[16rem] text-[12.5px] leading-relaxed text-foreground">
            可以先填写选猫问卷，或复制微信号与我们慢慢聊。
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link
              to="/questionnaire"
              className="pressable inline-flex items-center justify-center gap-2 rounded-full bg-violet px-5 py-3 text-sm font-semibold text-white shadow-card"
            >
              <PaperIcon className="h-4 w-4" /> 填写选猫问卷
            </Link>
            <div className="mx-auto w-full max-w-[15rem]">
              <CopyText label="微信号" value={WECHAT_ID} />
            </div>
          </div>
        </div>
      </Section>
    </PhoneFrame>
  );
}
