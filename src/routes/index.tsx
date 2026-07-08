import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import {
  CatIcon,
  StarIcon,
  PaperIcon,
  ChevronRightIcon,
} from "@/components/mobile/icons";
import { WECHAT_ID } from "@/lib/cattery-data";
import heroCats from "@/assets/hero-cats.png";
import catMotif from "@/assets/placeholder-cat.png";

export const Route = createFileRoute("/")({
  component: Home,
});

/** Two primary destinations — the whole app funnels through these. */
const ENTRIES = [
  {
    label: "了解星月",
    en: "About StarlitSky",
    desc: "猫舍介绍 · 理念 · 环境 · 流程 · 售后",
    to: "/discover",
    Icon: StarIcon,
  },
  {
    label: "我们的猫",
    en: "Our Cats",
    desc: "在售小猫 · 观察中 · 种猫介绍",
    to: "/cats",
    Icon: CatIcon,
  },
] as const;

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
          <StarIcon className="absolute right-6 top-6 h-4 w-4 text-violet/40" />
        </div>
      </Section>

      {/* ── Two primary entries ──────────────────── */}
      <Section className="mt-7 space-y-3">
        {ENTRIES.map(({ label, en, desc, to, Icon }) => (
          <Link
            key={label}
            to={to}
            className="pressable flex items-center gap-4 rounded-[1.5rem] border border-border bg-card p-4 shadow-card"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sky/25 text-heading">
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-heading">
                {label}
              </span>
              <span className="mt-0.5 block font-display text-[10px] uppercase tracking-[0.22em] text-warm">
                {en}
              </span>
              <span className="mt-1 block truncate text-[12px] text-muted-foreground">
                {desc}
              </span>
            </span>
            <ChevronRightIcon className="h-5 w-5 shrink-0 text-warm" />
          </Link>
        ))}
      </Section>

      {/* ── Gentle conversion ────────────────────── */}
      <Section className="mb-12 mt-9">
        <div className="rounded-[1.75rem] bg-gradient-cream p-6 text-center">
          <StarIcon className="mx-auto h-5 w-5 text-violet/60" />
          <p className="mt-2 text-[15px] font-semibold text-heading">
            想进一步了解星月的小猫
          </p>
          <p className="mx-auto mt-2 max-w-[16rem] text-[12.5px] leading-relaxed text-foreground">
            可以先填写选猫问卷，或复制微信号与我们聊聊。
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
