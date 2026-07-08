import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { ChevronRightIcon, StarIcon } from "@/components/mobile/icons";
import { SOCIALS } from "@/lib/cattery-data";

export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: "更多 · 联系我们 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍的联系方式与全部内容导航，包含微信、小红书、微博、抖音账号与各页面入口。",
      },
    ],
  }),
  component: More,
});

/** Site-wide navigation menu (replaces the personal-center concept). */
const MENU = [
  { label: "猫舍介绍", to: "/about" },
  { label: "繁育理念", to: "/philosophy" },
  { label: "猫舍环境", to: "/environment" },
  { label: "喂养体系", to: "/feeding" },
  { label: "种猫介绍", to: "/studs" },
  { label: "接猫流程 / 价格", to: "/process" },
  { label: "售后保障", to: "/process" },
  { label: "现猫介绍", to: "/kittens" },
  { label: "选猫问卷", to: "/questionnaire" },
] as const;

function More() {
  return (
    <PhoneFrame activeTab="more" showTabBar>
      <header className="px-6 pb-1 pt-5">
        <p className="font-display text-[11px] uppercase tracking-[0.3em] text-warm">
          StarlitSky
        </p>
        <h1 className="mt-1 text-[22px] font-bold text-heading">更多</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
          联系方式与全部内容导航
        </p>
      </header>

      {/* ── Contact ─────────────────────────────── */}
      <Section className="mt-4">
        <p className="mb-2.5 font-display text-[11px] uppercase tracking-[0.28em] text-warm">
          Contact
        </p>
        <div className="space-y-2.5">
          {SOCIALS.map((s) => (
            <CopyText key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </Section>

      {/* ── Site menu ───────────────────────────── */}
      <Section className="mt-8">
        <p className="mb-2 font-display text-[11px] uppercase tracking-[0.28em] text-warm">
          Menu
        </p>
        <div className="divide-y divide-border/70 rounded-[1.5rem] border border-border bg-card shadow-card">
          {MENU.map(({ label, to }) => (
            <Link
              key={label}
              to={to}
              className="pressable flex items-center justify-between px-4 py-3.5"
            >
              <span className="text-[14px] font-medium text-card-foreground">
                {label}
              </span>
              <ChevronRightIcon className="h-4 w-4 text-warm" />
            </Link>
          ))}
        </div>
      </Section>

      {/* ── Gentle tip ──────────────────────────── */}
      <Section className="mb-12 mt-8">
        <div className="rounded-[1.5rem] bg-gradient-cream px-5 py-5 text-center">
          <StarIcon className="mx-auto h-5 w-5 text-violet/60" />
          <p className="mx-auto mt-2 max-w-[17rem] text-[12.5px] leading-[1.9] text-foreground">
            咨询前建议先阅读接猫流程与选猫问卷，方便我们更好地了解你的需求。
          </p>
        </div>
      </Section>
    </PhoneFrame>
  );
}
