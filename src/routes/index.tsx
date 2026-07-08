import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import {
  CatIcon,
  PawIcon,
  HouseIcon,
  PaperIcon,
  StarIcon,
  ChevronRightIcon,
} from "@/components/mobile/icons";
import { WECHAT_ID } from "@/lib/cattery-data";
import heroCats from "@/assets/hero-cats.png";
import catMotif from "@/assets/placeholder-cat.png";

export const Route = createFileRoute("/")({
  component: Home,
});

/** Four — and only four — primary destinations. */
const PRIMARY = [
  { label: "现猫介绍", en: "Kittens", to: "/kittens", Icon: CatIcon },
  { label: "种猫介绍", en: "Studs", to: "/studs", Icon: PawIcon },
  { label: "猫舍环境", en: "Cattery", to: "/environment", Icon: HouseIcon },
  { label: "选猫问卷", en: "Enquiry", to: "/questionnaire", Icon: PaperIcon },
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
          成立于 2019 年，位于西安。我们坚持自繁自养、低频率繁育与小猫社会化训练，陪伴小猫从出生到去新家。
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

      {/* ── Primary destinations ─────────────────── */}
      <Section className="mt-7">
        <div className="grid grid-cols-2 gap-3">
          {PRIMARY.map(({ label, en, to, Icon }) => (
            <Link
              key={label}
              to={to}
              className="pressable group relative flex flex-col justify-between overflow-hidden rounded-[1.5rem] border border-border bg-card p-4 shadow-card"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky/25 text-heading">
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <div className="mt-6">
                <p className="text-[15px] font-semibold text-heading">{label}</p>
                <p className="mt-0.5 font-display text-[10px] uppercase tracking-[0.22em] text-warm">
                  {en}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── Short about ──────────────────────────── */}
      <Section className="mt-9">
        <p className="font-display text-[11px] uppercase tracking-[0.28em] text-warm">
          About
        </p>
        <h2 className="mt-1.5 text-[18px] font-semibold leading-snug text-heading">
          做一家有温度的缅因猫舍
        </h2>
        <p className="mt-3 text-[13.5px] leading-[2] text-foreground">
          星月缅因猫舍成立于 2019 年，位于西安，注册于 WCF、CFA 协会。由星下和月七两位主理人全职经营，日常陪伴小猫成长，记录窝次日常，并从小进行社会化训练。我们重视健康、喂养和生活环境，坚持自繁自养、别墅散养和低频率繁育。
        </p>
        <Link
          to="/about"
          className="pressable mt-3.5 inline-flex items-center gap-1 text-[13px] font-semibold text-violet"
        >
          了解猫舍故事 <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </Section>

      {/* ── Gentle conversion ────────────────────── */}
      <Section className="mb-12 mt-10">
        <div className="rounded-[1.75rem] bg-gradient-cream p-6 text-center">
          <StarIcon className="mx-auto h-5 w-5 text-violet/60" />
          <p className="mt-2 text-[15px] font-semibold text-heading">
            想进一步了解星月的小猫
          </p>
          <p className="mx-auto mt-2 max-w-[16rem] text-[12.5px] leading-relaxed text-foreground">
            可以先填写选猫问卷，了解接猫流程，或复制微信号与我们聊聊。
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link
              to="/questionnaire"
              className="pressable inline-flex items-center justify-center gap-2 rounded-full bg-violet px-5 py-3 text-sm font-semibold text-white shadow-card"
            >
              <PaperIcon className="h-4 w-4" /> 填写选猫问卷
            </Link>
            <div className="flex gap-2.5">
              <Link
                to="/process"
                className="pressable inline-flex flex-1 items-center justify-center rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-heading"
              >
                查看接猫流程
              </Link>
              <CopyText value={WECHAT_ID} variant="button" />
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[11.5px] text-muted-foreground">
          更多联系方式与内容导航见「更多」
        </p>
      </Section>
    </PhoneFrame>
  );
}
