import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, SectionTitle, Card } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import {
  CatIcon,
  PawIcon,
  HouseIcon,
  BowlIcon,
  DnaIcon,
  RouteIcon,
  PaperIcon,
  ShieldIcon,
  ChevronRightIcon,
  StarIcon,
  MoonIcon,
} from "@/components/mobile/icons";
import { SOCIALS } from "@/lib/cattery-data";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

const LINKS = [
  { label: "猫舍介绍", to: "/about", Icon: CatIcon },
  { label: "繁育理念", to: "/philosophy", Icon: DnaIcon },
  { label: "喂养体系", to: "/feeding", Icon: BowlIcon },
  { label: "猫舍环境", to: "/environment", Icon: HouseIcon },
  { label: "种猫介绍", to: "/studs", Icon: PawIcon },
  { label: "接猫流程 / 价格", to: "/process", Icon: RouteIcon },
  { label: "现猫介绍", to: "/kittens", Icon: CatIcon },
  { label: "选猫问卷", to: "/questionnaire", Icon: PaperIcon },
];

function Profile() {
  return (
    <PhoneFrame activeTab="profile" showTabBar>
      <div className="relative overflow-hidden bg-gradient-hero px-5 pb-7 pt-6">
        <MoonIcon className="absolute right-6 top-5 h-7 w-7 text-white/60" />
        <StarIcon className="absolute right-16 top-8 h-4 w-4 text-white/70" />
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-card shadow-card">
            <CatIcon className="h-8 w-8 text-violet" />
          </span>
          <div>
            <h1 className="text-[18px] font-semibold text-heading">星月缅因猫舍</h1>
            <p className="font-display text-[11px] italic text-[#4a5e8f]">
              StarlitSky Maine Coon
            </p>
          </div>
        </div>
      </div>

      <Section className="-mt-3">
        <Card className="space-y-2.5 p-4">
          <SectionTitle cn="联系与社交" en="Contact" />
          {SOCIALS.map((s) => (
            <CopyText key={s.label} label={s.label} value={s.value} />
          ))}
        </Card>
      </Section>

      <Section className="mt-6">
        <SectionTitle cn="全部内容" en="Menu" />
        <Card className="divide-y divide-border p-0">
          {LINKS.map(({ label, to, Icon }) => (
            <Link
              key={label}
              to={to}
              className="pressable flex items-center gap-3 px-4 py-3.5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky/20">
                <Icon className="h-5 w-5 text-heading" />
              </span>
              <span className="flex-1 text-[14px] font-medium text-card-foreground">{label}</span>
              <ChevronRightIcon className="h-4 w-4 text-warm" />
            </Link>
          ))}
        </Card>
      </Section>

      <Section className="mb-10 mt-6">
        <Link
          to="/admin"
          className="pressable flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-card"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet/15">
            <ShieldIcon className="h-5 w-5 text-violet" />
          </span>
          <span className="flex-1 text-[14px] font-medium text-card-foreground">
            后台管理
          </span>
          <ChevronRightIcon className="h-4 w-4 text-warm" />
        </Link>
        <p className="mt-3 text-center font-display text-[11px] uppercase tracking-[0.25em] text-warm">
          做一家有温度的缅因猫舍
        </p>
      </Section>
    </PhoneFrame>
  );
}
