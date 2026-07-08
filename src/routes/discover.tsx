import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { PaperIcon } from "@/components/mobile/icons";
import {
  CatProfile,
  HeartPaw,
  Cottage,
  FoodStation,
  WindingPath,
  ShieldHeart,
  MoonStars,
  StarDivider,
} from "@/components/mobile/illustrations";
import { SOCIALS, WECHAT_ID } from "@/lib/cattery-data";
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

interface Topic {
  en: string;
  label: string;
  desc: string;
  to: string;
  Art: ComponentType<SVGProps<SVGSVGElement>>;
  tint: string;
}

const TOPICS: Topic[] = [
  {
    en: "Our Story",
    label: "猫舍介绍",
    desc: "2019 年成立于西安，注册于 WCF、CFA。星下与月七两位全职猫家长，重视小猫健康与社会化成长。",
    to: "/about",
    Art: CatProfile,
    tint: "text-[#4a5e8f]/80",
  },
  {
    en: "Philosophy",
    label: "繁育理念",
    desc: "繁育体质好、亲人自信的小猫，从出生记录到去新家。不拘泥血系划分，追求健康与独特风格。",
    to: "/philosophy",
    Art: HeartPaw,
    tint: "text-violet/70",
  },
  {
    en: "Environment",
    label: "猫舍环境",
    desc: "室内 600 余平别墅散养，科学分区、拒绝笼养，另有三个院子供小猫小狗奔跑。",
    to: "/environment",
    Art: Cottage,
    tint: "text-[#7a9b8a]",
  },
  {
    en: "Feeding",
    label: "喂养体系",
    desc: "白天湿粮与熟自制，夜间猫粮自助并补充冻干、营养品，从小培养不挑食的小猫。",
    to: "/feeding",
    Art: FoodStation,
    tint: "text-[#a0876a]",
  },
  {
    en: "The Journey",
    label: "价格与接猫流程",
    desc: "阅读介绍、填写问卷、排队、选猫、疫苗体检绝育到接猫，附新家礼包，价格清晰不促销。",
    to: "/process",
    Art: WindingPath,
    tint: "text-violet/70",
  },
  {
    en: "Aftercare",
    label: "售后保障",
    desc: "种猫遗传病 all n/n，窝次清晰透明，去新家前完成疫苗、体检与绝育，售后以正式合同为准。",
    to: "/process",
    Art: ShieldHeart,
    tint: "text-[#4a5e8f]/80",
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
      <header className="px-6 pb-1 pt-5">
        <p className="font-display text-[11px] uppercase tracking-[0.3em] text-warm">
          About StarlitSky
        </p>
        <h1 className="mt-1 text-[22px] font-bold text-heading">了解星月</h1>
        <p className="mt-2.5 text-[13px] leading-[1.95] text-foreground">
          星月缅因猫舍成立于 2019 年，位于西安，注册于 WCF、CFA 协会。我们坚持自繁自养、别墅散养与低频率繁育，从小陪伴小猫成长并进行社会化训练。
        </p>
      </header>

      <Section className="mt-4">
        <div className="relative">
          <Placeholder
            label="示例图片（猫舍环境照片，待替换）"
            ratio="aspect-[16/10]"
            rounded="rounded-[1.5rem]"
          />
          <MoonStars className="absolute right-4 top-4 h-8 w-8 text-violet/35" />
        </div>
      </Section>

      <StarDivider className="mt-8" />

      {/* ── Brand guide: alternating editorial blocks ── */}
      <div className="mt-6 space-y-8">
        {TOPICS.map(({ en, label, desc, to, Art, tint }, i) => {
          const flip = i % 2 === 1;
          return (
            <Section key={en + label}>
              <Link
                to={to}
                className="pressable flex items-start gap-4"
                style={flip ? { flexDirection: "row-reverse" } : undefined}
              >
                <Art className={`mt-1 h-[70px] w-[70px] shrink-0 ${tint}`} />
                <div
                  className={`min-w-0 flex-1 ${flip ? "text-right" : ""}`}
                >
                  <p className="font-display text-[10px] uppercase tracking-[0.24em] text-warm">
                    {en}
                  </p>
                  <h2 className="mt-0.5 text-[17px] font-bold text-heading">
                    {label}
                  </h2>
                  <p className="mt-1.5 text-[12.5px] leading-[1.85] text-foreground">
                    {desc}
                  </p>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-violet ${
                      flip ? "flex-row-reverse" : ""
                    }`}
                  >
                    了解更多 <span aria-hidden>{flip ? "←" : "→"}</span>
                  </span>
                </div>
              </Link>
            </Section>
          );
        })}
      </div>

      <StarDivider className="mt-9" />

      {/* ── Contact ─────────────────────────────── */}
      <Section className="mt-7">
        <div className="rounded-[1.75rem] bg-gradient-cream px-5 py-6">
          <div className="mb-3 text-center">
            <p className="font-display text-[10.5px] uppercase tracking-[0.26em] text-warm">
              Say Hello
            </p>
            <h2 className="mt-1 text-[17px] font-bold text-heading">
              在这些地方找到星月
            </h2>
            <p className="mx-auto mt-1.5 max-w-[16rem] text-[12px] leading-relaxed text-foreground">
              点击即可复制账号，欢迎来聊聊猫、了解日常。
            </p>
          </div>
          <div className="space-y-2.5">
            {SOCIALS.map((s) => (
              <CopyText key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        </div>
      </Section>

      {/* ── Gentle tip ──────────────────────────── */}
      <Section className="mb-8 mt-6">
        <p className="mx-auto max-w-[18rem] text-center text-[12px] leading-[1.9] text-muted-foreground">
          咨询前建议先阅读接猫流程与选猫问卷，方便我们更好地了解你的需求。
        </p>
        <div className="mx-auto mt-3 max-w-[15rem]">
          <CopyText label="微信号" value={WECHAT_ID} />
        </div>
      </Section>
    </PhoneFrame>
  );
}
