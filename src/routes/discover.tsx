import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import {
  CatIcon,
  DnaIcon,
  HouseIcon,
  BowlIcon,
  RouteIcon,
  ShieldIcon,
  PaperIcon,
  ChevronRightIcon,
  StarIcon,
} from "@/components/mobile/icons";
import { SOCIALS, WECHAT_ID } from "@/lib/cattery-data";

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

/** Cattery content pages, with a one-line description each. */
const TOPICS = [
  { label: "猫舍介绍", desc: "2019 年成立，西安，星下与月七全职经营", to: "/about", Icon: CatIcon },
  { label: "繁育理念", desc: "健康、亲人、社会化，做有温度的猫舍", to: "/philosophy", Icon: DnaIcon },
  { label: "猫舍环境", desc: "600 余平别墅散养，拒绝笼养", to: "/environment", Icon: HouseIcon },
  { label: "喂养体系", desc: "湿粮 / 熟自制 / 冻干 / 营养品", to: "/feeding", Icon: BowlIcon },
  { label: "价格与接猫流程", desc: "问卷、排队、定金、疫苗到接猫", to: "/process", Icon: RouteIcon },
  { label: "售后保障", desc: "遗传病 all n/n，窝次清晰透明", to: "/process", Icon: ShieldIcon },
] as const;

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
        <Placeholder
          label="示例图片（猫舍环境照片，待替换）"
          ratio="aspect-[16/10]"
          rounded="rounded-[1.5rem]"
        />
      </Section>

      {/* ── Topics ──────────────────────────────── */}
      <Section className="mt-7">
        <p className="mb-2 font-display text-[11px] uppercase tracking-[0.28em] text-warm">
          Explore
        </p>
        <div className="divide-y divide-border/70 rounded-[1.5rem] border border-border bg-card shadow-card">
          {TOPICS.map(({ label, desc, to, Icon }) => (
            <Link
              key={label}
              to={to}
              className="pressable flex items-center gap-3.5 px-4 py-3.5"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-sky/25 text-heading">
                <Icon className="h-[21px] w-[21px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-card-foreground">
                  {label}
                </span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  {desc}
                </span>
              </span>
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-warm" />
            </Link>
          ))}
        </div>
      </Section>

      {/* ── Contact ─────────────────────────────── */}
      <Section className="mt-8">
        <p className="mb-2.5 font-display text-[11px] uppercase tracking-[0.28em] text-warm">
          Contact
        </p>
        <div className="space-y-2.5">
          {SOCIALS.map((s) => (
            <CopyText key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </Section>

      {/* ── Gentle tip ──────────────────────────── */}
      <Section className="mb-8 mt-8">
        <div className="rounded-[1.5rem] bg-gradient-cream px-5 py-5 text-center">
          <StarIcon className="mx-auto h-5 w-5 text-violet/60" />
          <p className="mx-auto mt-2 max-w-[17rem] text-[12.5px] leading-[1.9] text-foreground">
            咨询前建议先阅读接猫流程与选猫问卷，方便我们更好地了解你的需求。
          </p>
          <div className="mx-auto mt-4 max-w-[15rem]">
            <CopyText label="微信号" value={WECHAT_ID} />
          </div>
        </div>
      </Section>
    </PhoneFrame>
  );
}
