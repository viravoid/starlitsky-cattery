import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Carousel } from "@/components/mobile/Carousel";
import { Section, SectionTitle, Card, Pill, Placeholder } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import {
  CatIcon,
  PawIcon,
  HouseIcon,
  BowlIcon,
  DnaIcon,
  RouteIcon,
  ShieldIcon,
  PaperIcon,
  MoonIcon,
  StarIcon,
  ChevronRightIcon,
  HeartIcon,
} from "@/components/mobile/icons";
import { KITTENS, WECHAT_ID, statusTone } from "@/lib/cattery-data";

export const Route = createFileRoute("/")({
  component: Home,
});

const ENTRIES = [
  { label: "现猫介绍", to: "/kittens", Icon: CatIcon, tone: "bg-sky/25" },
  { label: "种猫介绍", to: "/studs", Icon: PawIcon, tone: "bg-creamblue/45" },
  { label: "猫舍环境", to: "/environment", Icon: HouseIcon, tone: "bg-sunny/45" },
  { label: "喂养体系", to: "/feeding", Icon: BowlIcon, tone: "bg-warm/30" },
  { label: "繁育理念", to: "/philosophy", Icon: DnaIcon, tone: "bg-creamblue/45" },
  { label: "接猫流程", to: "/process", Icon: RouteIcon, tone: "bg-sky/25" },
  { label: "售后保障", to: "/process", Icon: ShieldIcon, tone: "bg-warm/30" },
  { label: "选猫问卷", to: "/questionnaire", Icon: PaperIcon, tone: "bg-sunny/45" },
];

const ADVANTAGES = [
  "2019 年成立",
  "西安猫舍",
  "WCF / CFA 注册",
  "自繁自养",
  "别墅散养",
  "拒绝笼养",
  "遗传病筛查 all n/n",
  "低频率繁育",
  "社会化训练",
  "完整售后",
];

function Home() {
  return (
    <PhoneFrame activeTab="home" showTabBar>
      {/* Brand hero */}
      <div className="relative px-6 pb-4 pt-4 text-center">
        <StarIcon className="absolute left-7 top-8 h-4 w-4 text-primary/70" />
        <StarIcon className="absolute right-8 top-16 h-3 w-3 text-violet/50" />
        <p className="font-display text-[11px] uppercase tracking-[0.32em] text-violet">
          Est. 2019 · Xi'an
        </p>
        <img
          src={heroCats}
          alt="星月缅因猫舍 手绘缅因猫插画"
          width={1440}
          height={1040}
          className="mx-auto mt-1 w-[82%] max-w-[300px]"
        />
        <h1 className="-mt-2 text-[26px] font-bold leading-tight text-heading">
          星月缅因猫舍
        </h1>
        <p className="font-display text-[13px] italic leading-snug text-[#4a5e8f]">
          StarlitSky Maine Coon Cattery
        </p>
        <p className="mx-auto mt-2.5 max-w-[16rem] text-[12.5px] leading-relaxed text-foreground">
          做一家有温度的缅因猫舍 · 自繁自养，陪伴小猫从出生到新家。
        </p>
        <div className="mt-3.5 flex flex-wrap justify-center gap-1.5">
          <Pill tone="sky">2019 年成立</Pill>
          <Pill tone="creamblue">西安猫舍</Pill>
          <Pill tone="violet">WCF / CFA 注册</Pill>
          <Pill tone="sunny">别墅散养</Pill>
        </div>
      </div>

      {/* Feature band */}
      <Section className="mt-3">
        <Carousel
          slides={[
            {
              label: "示例图片（首页轮播图 1 · 猫舍环境，待替换）",
              overlay: (
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone="violet">别墅散养</Pill>
                  <Pill tone="sky">拒绝笼养</Pill>
                </div>
              ),
            },
            {
              label: "示例图片（首页轮播图 2 · 小猫日常，待替换）",
              overlay: (
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone="violet">自繁自养</Pill>
                  <Pill tone="sunny">社会化训练</Pill>
                </div>
              ),
            },
            {
              label: "示例图片（首页轮播图 3 · 种猫风采，待替换）",
              overlay: (
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone="violet">血线清晰</Pill>
                  <Pill tone="sky">all n/n</Pill>
                </div>
              ),
            },
          ]}
        />
      </Section>


      {/* Quick entries */}
      <Section className="mt-7">
        <SectionTitle cn="快捷入口" en="Explore" icon={<PawIcon className="h-5 w-5" />} />
        <div className="grid grid-cols-4 gap-2.5">
          {ENTRIES.map(({ label, to, Icon, tone }) => (
            <Link
              key={label}
              to={to}
              className="pressable flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-2.5 text-center shadow-card"
            >
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
                <Icon className="h-6 w-6 text-heading" />
              </span>
              <span className="text-[11px] font-medium text-card-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Advantages */}
      <Section className="mt-7">
        <SectionTitle cn="猫舍优势" en="Why Us" icon={<StarIcon className="h-5 w-5" />} />
        <div className="flex flex-wrap gap-2">
          {ADVANTAGES.map((a) => (
            <span
              key={a}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-card-foreground shadow-card"
            >
              {a}
            </span>
          ))}
        </div>
      </Section>

      {/* Recommended kittens */}
      <Section className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle cn="推荐小猫" en="Kittens" icon={<HeartIcon className="h-5 w-5" />} />
          <Link
            to="/kittens"
            className="pressable mb-3 inline-flex items-center gap-0.5 text-[12px] font-semibold text-violet"
          >
            查看全部 <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {KITTENS.map((k) => (
            <Link
              key={k.id}
              to="/kittens/$id"
              params={{ id: k.id }}
              className="pressable w-[164px] shrink-0 overflow-hidden rounded-3xl border border-border bg-card shadow-card"
            >
              <Placeholder
                label="示例小猫（缺少小猫资料）"
                ratio="aspect-square"
                rounded="rounded-none"
              />
              <div className="space-y-1.5 p-3">
                <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-heading">
                  {k.name}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Pill tone="creamblue">{k.gender}</Pill>
                  <Pill tone={statusTone(k.status)}>{k.status}</Pill>
                </div>
                <p className="text-[11px] text-muted-foreground">价格：{k.price}</p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Contact */}
      <Section className="mb-8 mt-7">
        <Card className="space-y-3 p-4">
          <SectionTitle cn="联系我们" en="Contact" icon={<CatIcon className="h-5 w-5" />} />
          <CopyText label="微信号" value={WECHAT_ID} />
          <div className="flex gap-2.5">
            <CopyText value={WECHAT_ID} variant="button" />
            <Link
              to="/questionnaire"
              className="pressable inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-violet px-4 py-3 text-sm font-semibold text-white shadow-card"
            >
              <PaperIcon className="h-4 w-4" /> 填写选猫问卷
            </Link>
          </div>
        </Card>
      </Section>
    </PhoneFrame>
  );
}
