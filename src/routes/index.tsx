import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { CopyText } from "@/components/mobile/CopyText";
import { PaperIcon } from "@/components/mobile/icons";
import {
  CatProfile,
  Cottage,
  WindingPath,
  CurledCat,
  PawTrail,
  TailArc,
} from "@/components/mobile/illustrations";
import { WECHAT_ID } from "@/lib/cattery-data";
import type { ComponentType, SVGProps } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "星月缅因猫舍 — 做一家有温度的缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍 StarlitSky Maine Coon Cattery，2019 年成立于西安，注册于 WCF、CFA。坚持自繁自养、低频率繁育与社会化训练，陪伴小猫从出生到去新家。",
      },
      { property: "og:title", content: "星月缅因猫舍 — 做一家有温度的缅因猫舍" },
      {
        property: "og:description",
        content:
          "了解星月缅因猫舍的介绍、繁育理念、环境、喂养、接猫流程与售后保障，查看在售小猫与种猫。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

interface Item {
  no: string;
  label: string;
  desc: string;
  to: string;
}

interface Group {
  en: string;
  cn: string;
  lead: string;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
  tint: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    en: "About StarlitSky",
    cn: "关于星月",
    lead: "了解星月缅因猫舍的成立时间、主理人、繁育方向与我们希望坚持的猫舍理念。",
    Art: CatProfile,
    tint: "text-[#4a5e8f]/70",
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
    en: "How We Care",
    cn: "照顾方式",
    lead: "从生活空间、母婴照护到日常喂养，了解小猫在星月的成长环境。",
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
    en: "Before You Adopt",
    cn: "接猫前了解",
    lead: "在正式咨询和接猫前，可以先了解流程、保障、问卷和联系方式。",
    Art: WindingPath,
    tint: "text-violet/60",
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
        to: "/aftercare",
      },
      {
        no: "07",
        label: "选猫问卷",
        desc: "填写一份问卷，让我们更好地了解你的期待与生活方式。",
        to: "/questionnaire",
      },
      {
        no: "08",
        label: "联系方式",
        desc: "微信、小红书、微博、抖音与小猫日常号，都可一键复制。",
        to: "/contact",
      },
    ],
  },
];

function Home() {
  return (
    <PhoneFrame activeTab="home" showTabBar>
      {/* ── Photo carousel hero ─────────────────── */}
      <div className="px-3 pt-3">
        <Carousel
          slides={[
            { label: "示例图片（首页轮播照片 1，待替换）" },
            { label: "示例图片（首页轮播照片 2，待替换）" },
            { label: "示例图片（首页轮播照片 3，待替换）" },
          ]}
          ratio="aspect-[4/5]"
          rounded="rounded-[1.75rem]"
        />
      </div>

      {/* ── Brand intro ─────────────────────────── */}
      <header className="px-6 pb-1 pt-6 text-center">
        <h1 className="text-[27px] font-bold leading-tight text-heading">
          星月缅因猫舍
        </h1>
        <p className="mt-1 font-display text-[13px] italic text-[#4a5e8f]">
          StarlitSky Maine Coon Cattery
        </p>
        <p className="mt-3 font-display text-[10.5px] uppercase tracking-[0.3em] text-warm">
          Est. 2019 · Xi&apos;an · WCF / CFA 注册
        </p>
        <p className="mx-auto mt-4 max-w-[19rem] text-[13px] leading-[2] text-foreground">
          做一家有温度的缅因猫舍。坚持自繁自养、低频率繁育与社会化训练，陪伴小猫从出生到去新家。
        </p>
        <PawTrail className="mx-auto mt-5" />
      </header>

      {/* ── 了解星月 — chaptered editorial guide ─── */}
      <Section className="mt-9">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
        </div>
        <h2 className="mt-3 text-center text-[20px] font-bold text-heading">
          了解星月
        </h2>
      </Section>

      <div className="mt-9 space-y-14">
        {GROUPS.map(({ en, cn, lead, Art, tint, items }, gi) => (
          <Section key={en}>
            {/* group header — illustration alternates side for gentle rhythm */}
            <div
              className={`flex items-start gap-4 ${
                gi % 2 === 1 ? "flex-row-reverse text-right" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="font-display text-[10px] uppercase tracking-[0.26em] text-warm">
                  {`Part ${["One", "Two", "Three"][gi]} · ${en}`}
                </p>
                <h3 className="mt-1 text-[20px] font-bold text-heading">{cn}</h3>
                <p
                  className={`mt-2 max-w-[15rem] text-[12.5px] leading-[1.85] text-foreground ${
                    gi % 2 === 1 ? "ml-auto" : ""
                  }`}
                >
                  {lead}
                </p>
              </div>
              <Art className={`-mt-1 h-[64px] w-[64px] shrink-0 ${tint}`} />
            </div>

            {/* items — light numbered index, no boxes */}
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

      {/* ── 我们的猫 preview ─────────────────────── */}
      <Section className="mt-16">
        <Link
          to="/cats"
          className="pressable relative block overflow-hidden rounded-[1.75rem] border border-border bg-gradient-cream p-6"
        >
          <CurledCat className="absolute -right-3 -bottom-3 h-24 w-24 text-[#a0876a]/25" />
          <p className="font-display text-[10.5px] uppercase tracking-[0.24em] text-warm">
            Our Cats
          </p>
          <h2 className="mt-1 text-[22px] font-bold leading-none text-heading">
            我们的猫
          </h2>
          <p className="mt-3 max-w-[15rem] text-[12.5px] leading-[1.9] text-foreground">
            在售与观察中的小猫，以及陪伴我们的种猫，血线清晰、健康透明。
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet">
            查看小猫与种猫 <span aria-hidden>→</span>
          </span>
        </Link>
      </Section>

      {/* ── Gentle conversion — questionnaire + wechat ── */}
      <Section className="mb-12 mt-14 text-center">
        <TailArc className="mx-auto h-11 w-11 text-violet/45" />
        <p className="mt-3 text-[16px] font-semibold text-heading">
          想进一步了解星月的小猫
        </p>
        <p className="mx-auto mt-2 max-w-[16rem] text-[12.5px] leading-[1.9] text-foreground">
          可以先填写一份选猫问卷，或直接复制微信号添加咨询。
        </p>
        <Link
          to="/questionnaire"
          className="pressable mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-violet px-6 py-3.5 text-sm font-semibold text-white shadow-card"
        >
          <PaperIcon className="h-4 w-4" /> 填写选猫问卷
        </Link>
        <div className="mx-auto mt-4 max-w-[17rem]">
          <CopyText label="微信号" value={WECHAT_ID} />
        </div>
      </Section>
    </PhoneFrame>
  );
}
