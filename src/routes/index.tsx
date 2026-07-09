import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, SectionTitle, Card } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { StarIcon, PaperIcon } from "@/components/mobile/icons";
import {
  CatProfile,
  CurledCat,
  PawTrail,
  TailArc,
  MoonStars,
  Cottage,
  Rosette,
  HeartPaw,
  PawCheck,
} from "@/components/mobile/illustrations";

export const Route = createFileRoute("/")({
  component: Home,
});

const FACTS = [
  { label: "2019 年成立", Art: MoonStars },
  { label: "西安", Art: Cottage },
  { label: "WCF / CFA 注册", Art: Rosette },
  { label: "全职猫家长", Art: HeartPaw },
  { label: "自繁自养", Art: CurledCat },
  { label: "遗传病筛查 all n/n", Art: PawCheck },
];

function Home() {
  return (
    <PhoneFrame activeTab="home" showTabBar>
      {/* ── Full-bleed photo hero ─────────────────── */}
      <div className="relative">
        <Carousel
          slides={[
            { label: "示例图片（首页轮播图 1，待替换）" },
            { label: "示例图片（首页轮播图 2，待替换）" },
            { label: "示例图片（首页轮播图 3，待替换）" },
          ]}
          ratio="aspect-[4/5]"
          rounded="rounded-none"
        />
        {/* gentle fade into the page below the photo */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* ── Brand name & intro, beneath the photo ── */}
      <header className="relative -mt-2 px-6 pb-2 text-center">
        <StarIcon className="absolute left-8 top-1 h-3.5 w-3.5 text-primary/50" />
        <StarIcon className="absolute right-9 top-7 h-3 w-3 text-violet/40" />
        <p className="font-display text-[11px] uppercase tracking-[0.34em] text-warm">
          Est. 2019 · Xi&apos;an
        </p>
        <h1 className="mt-2.5 text-[28px] font-bold leading-tight text-heading">
          星月缅因猫舍
        </h1>
        <p className="mt-0.5 font-display text-[13px] italic text-[#4a5e8f]">
          StarlitSky Maine Coon Cattery
        </p>
        <p className="mx-auto mt-4 max-w-[17rem] text-[13px] leading-[2] text-foreground">
          做一家有温度的缅因猫舍。坚持自繁自养、低频率繁育与社会化训练，陪伴小猫从出生到去新家。
        </p>
      </header>

      {/* ── At a glance — cattery credentials ─────── */}
      <Section className="mt-8">
        <SectionTitle cn="猫舍名片" en="At a glance" />
        <div className="grid grid-cols-2 gap-2.5">
          {FACTS.map(({ label, Art }) => (
            <Card key={label} className="flex items-center gap-2.5 p-3">
              <Art className="h-9 w-9 shrink-0 text-violet/80" />
              <span className="text-[13px] font-medium leading-snug text-card-foreground">
                {label}
              </span>
            </Card>
          ))}
        </div>
      </Section>

      {/* ── Two doorways — an editorial, off-balance guide ── */}
      <div className="mt-12">
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

      {/* ── Owners — a warm note ──────────────────── */}
      <Section className="mt-14">
        <Card className="space-y-2 bg-gradient-cream p-4">
          <h3 className="text-[15px] font-semibold text-heading">
            主理人 · 星下 &amp; 月七
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground">
            两位全职猫家长，从小猫出生记录到去新家，希望家长不会缺席小猫成长的每一个阶段。
          </p>
        </Card>
      </Section>

      {/* ── Gentle conversion — no box, just breathing space ── */}
      <Section className="mb-12 mt-14 text-center">
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
