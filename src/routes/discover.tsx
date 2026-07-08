import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { PaperIcon } from "@/components/mobile/icons";
import {
  CatProfile,
  Cottage,
  WindingPath,
  MoonStars,
  PawTrail,
  TailArc,
} from "@/components/mobile/illustrations";
import { SOCIALS } from "@/lib/cattery-data";
import type { ComponentType, SVGProps } from "react";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "了解星月 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "了解星月缅因猫舍：猫舍介绍、繁育理念、猫舍环境、喂养体系、接猫流程、售后保障与联系方式。",
      },
    ],
  }),
  component: Discover,
});

interface Item {
  no: string;
  label: string;
  desc: string;
  to: string;
}

interface Group {
  part: string;
  en: string;
  cn: string;
  lead: string;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
  tint: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    part: "Part One",
    en: "About Us",
    cn: "关于我们",
    lead: "先认识星下与月七，以及我们为什么想做一家有温度的猫舍。",
    Art: CatProfile,
    tint: "text-[#4a5e8f]/75",
    items: [
      {
        no: "01",
        label: "猫舍介绍",
        desc: "2019 年成立于西安，注册于 WCF、CFA，由星下与月七全职经营。",
        to: "/about",
      },
      {
        no: "02",
        label: "繁育理念",
        desc: "繁育体质好、亲人自信的小猫，从出生记录到去新家的每一步。",
        to: "/philosophy",
      },
    ],
  },
  {
    part: "Part Two",
    en: "How We Care",
    cn: "照顾方式",
    lead: "小猫住在怎样的空间里，吃得怎么样——日常照料的两件大事。",
    Art: Cottage,
    tint: "text-[#7a9b8a]",
    items: [
      {
        no: "03",
        label: "猫舍环境",
        desc: "600 余平别墅散养，科学分区、拒绝笼养，另有三个院子供奔跑。",
        to: "/environment",
      },
      {
        no: "04",
        label: "喂养体系",
        desc: "白天湿粮与熟自制，夜间猫粮自助并补充冻干、营养品，从小不挑食。",
        to: "/feeding",
      },
    ],
  },
  {
    part: "Part Three",
    en: "Before You Adopt",
    cn: "接猫前了解",
    lead: "价格、流程与售后都在这里，看完再联系，会更从容。",
    Art: WindingPath,
    tint: "text-violet/65",
    items: [
      {
        no: "05",
        label: "价格与接猫流程",
        desc: "阅读介绍、填写问卷、排队、选猫，到疫苗体检绝育后接猫。",
        to: "/process",
      },
      {
        no: "06",
        label: "售后保障",
        desc: "种猫遗传病 all n/n，窝次透明，去新家前完成疫苗、体检与绝育。",
        to: "/process",
      },
    ],
  },
];

function Discover() {
  return (
    <PhoneFrame
      activeTab="discover"
      showTabBar
      bottomBar={
        <div className="border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
          <Link
            to="/questionnaire"
            className="pressable flex w-full items-center justify-center gap-2 rounded-full bg-violet py-3.5 text-[15px] font-semibold text-white shadow-card"
          >
            <PaperIcon className="h-5 w-5" /> 填写选猫问卷
          </Link>
        </div>
      }
    >
      {/* ── Intro ───────────────────────────────── */}
      <header className="px-6 pb-1 pt-6">
        <p className="font-display text-[11px] uppercase tracking-[0.32em] text-warm">
          About StarlitSky
        </p>
        <h1 className="mt-1.5 text-[26px] font-bold leading-tight text-heading">
          走进星月
        </h1>
        <p className="mt-3 max-w-[19rem] text-[13px] leading-[2] text-foreground">
          成立于 2019 年，位于西安，注册于 WCF、CFA。我们坚持自繁自养、别墅散养与低频率繁育——这一页是猫舍的一次完整导览。
        </p>
        <PawTrail className="mt-5" />
      </header>

      {/* ── Cover image, bleeding wide ───────────── */}
      <div className="relative mt-5 px-3">
        <Placeholder
          label="示例图片（猫舍环境照片，待替换）"
          ratio="aspect-[16/10]"
          rounded="rounded-[1.75rem]"
        />
        <MoonStars className="absolute right-6 top-4 h-9 w-9 text-violet/35" />
        <TailArc className="absolute -bottom-4 left-6 h-12 w-12 text-[#a0876a]/55" />
      </div>

      {/* ── Chaptered guide ─────────────────────── */}
      <div className="mt-16 space-y-14">
        {GROUPS.map(({ part, en, cn, lead, Art, tint, items }) => (
          <Section key={en}>
            {/* group header — illustration to the right, off-grid */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-display text-[10px] uppercase tracking-[0.26em] text-warm">
                  {part} · {en}
                </p>
                <h2 className="mt-1 text-[21px] font-bold text-heading">{cn}</h2>
                <p className="mt-2 max-w-[15rem] text-[12.5px] leading-[1.85] text-foreground">
                  {lead}
                </p>
              </div>
              <Art className={`-mt-1 h-[68px] w-[68px] shrink-0 ${tint}`} />
            </div>

            {/* items — a light numbered index, no boxes, no per-row icons */}
            <div className="mt-4 pl-1">
              {items.map((it, idx) => (
                <Link
                  key={it.no}
                  to={it.to}
                  className={`pressable group flex items-baseline gap-3.5 py-3.5 ${
                    idx > 0 ? "border-t border-dashed border-border/70" : ""
                  }`}
                >
                  <span className="font-display text-[13px] italic text-warm/70">
                    {it.no}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[15.5px] font-semibold text-heading">
                      {it.label}
                    </span>
                    <span className="mt-1 block text-[12px] leading-[1.8] text-muted-foreground">
                      {it.desc}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="mt-0.5 text-[15px] text-violet/55 transition-transform group-active:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        ))}
      </div>

      {/* ── Contact ─────────────────────────────── */}
      <Section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
          <p className="font-display text-[10.5px] uppercase tracking-[0.26em] text-warm">
            Say Hello
          </p>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
        </div>
        <h2 className="mt-3 text-center text-[19px] font-bold text-heading">
          在这些地方找到星月
        </h2>
        <p className="mx-auto mt-2 max-w-[17rem] text-center text-[12px] leading-[1.8] text-foreground">
          点击即可复制账号，欢迎来聊聊猫、看看小猫日常。
        </p>
        <div className="mt-5 space-y-2.5">
          {SOCIALS.map((s) => (
            <CopyText key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </Section>

      {/* ── Gentle tip ──────────────────────────── */}
      <Section className="mb-10 mt-8">
        <p className="mx-auto max-w-[18rem] text-center text-[12px] leading-[1.95] text-muted-foreground">
          咨询前建议先读完接猫流程、填写选猫问卷，方便我们更好地了解你的需求。
        </p>
      </Section>
    </PhoneFrame>
  );
}
