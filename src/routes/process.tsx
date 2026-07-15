import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, SectionTitle, Card } from "@/components/mobile/ui";
import { PriceTagIcon, GiftIcon, RouteIcon, MoonIcon, PawIcon } from "@/components/mobile/icons";

export const Route = createFileRoute("/process")({
  component: Process,
});

const PRICES = [
  {
    label: "宠物级",
    value: "10000 – 20000 元",
    note: "符合品标有少量扣分项或性格有些许瑕疵，社会化达标，身体健康。",
    tone: "bg-sky/25",
  },
  {
    label: "赛级",
    value: "20000 – 30000 元",
    note: "符合品标无明显扣分项，性格同样非常好的小猫，参与比赛可以取得名次，社会化达标，身体健康。",
    tone: "bg-creamblue/45",
  },
  {
    label: "退役种猫",
    value: "0 – 10000 元",
    note: "老家长优先，退役种猫找家会严格审核，如无合适领养家庭会在猫舍养老。",
    tone: "bg-sunny/45",
  },
];

const BREEDING = [
  { label: "繁育权 · 母猫", value: "30000 – 50000 元" },
  { label: "繁育权 · 公猫", value: "40000 – 70000 元" },
];

const STEPS = [
  {
    title: "阅读猫舍介绍，填写选猫问卷",
    desc: "在正式咨询之前，请先阅读猫舍介绍、繁育理念、喂养体系与售后保障，并填写一份选猫问卷，让我们更好地了解你的期待与生活方式。",
  },
  {
    title: "排队订金 3000 元",
    desc: "沟通后如果双方合适，可以支付 3000 元排队订金进入排队队列，等待合适窝次的心仪小猫。排队订金可在正式定下小猫时抵扣定金。",
  },
  {
    title: "选中心仪小猫，支付 50% 定金并签合同",
    desc: "小猫出生并进入可预定阶段后，会优先联系已排队的家长。选中心仪小猫后，支付 50% 定金并签订正式合同，小猫将等待完成疫苗、体检、绝育。",
  },
  {
    title: "康复后沟通运输方式，接猫回家",
    desc: "小猫完成绝育并康复后，与家长沟通具体的运输方式与接猫时间，同时提供接猫指导和新家礼包，帮助小猫顺利过渡到新家。",
  },
];

const GIFTS = [
  "过渡粮",
  "罐头",
  "随机零食",
  "药品分装",
  "湿巾",
  "大号航空箱",
  "小猫喜欢的玩具",
  "体检报告",
];

function Process() {
  return (
    <PhoneFrame title="价格与流程" backTo="/">
      {/* Prices */}
      <Section className="pt-1">
        <SectionTitle
          cn="价格区间"
          en="Pricing"
          icon={<PriceTagIcon className="h-5 w-5" />}
        />
        <p className="mb-3 text-[12px] text-muted-foreground">传统色 · 绝育小猫价格</p>
        <div className="space-y-2.5">
          {PRICES.map((p) => (
            <Card key={p.label} className={`p-4 ${p.tone}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-semibold text-card-foreground">{p.label}</p>
                <p className="text-[15px] font-semibold text-heading">{p.value}</p>
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">{p.note}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Breeding rights */}
      <Section className="mt-7">
        <SectionTitle cn="繁育权" en="Breeding Rights" icon={<PawIcon className="h-5 w-5" />} />
        <p className="mb-3 text-[12px] text-muted-foreground">
          繁育权仅面向互相了解，并且主理人熟悉科学饲养科学繁育的猫舍。
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {BREEDING.map((b) => (
            <Card key={b.label} className="p-3.5">
              <p className="text-[12px] font-medium text-card-foreground">{b.label}</p>
              <p className="mt-1 text-[15px] font-semibold text-heading">{b.value}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Steps */}
      <Section className="mt-7">
        <SectionTitle cn="购买流程" en="Steps" icon={<RouteIcon className="h-5 w-5" />} />
        <div className="relative pl-2">
          <div className="absolute bottom-2 left-[18px] top-2 w-px bg-border" />
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex items-start gap-3">
                <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet text-[13px] font-semibold text-white shadow-card">
                  {i + 1}
                </span>
                <div className="flex-1 rounded-2xl border border-border bg-card p-3.5 shadow-card">
                  <p className="text-[13.5px] font-semibold text-heading">{s.title}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-foreground/90">
                    {s.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* Gifts */}
      <Section className="mt-7">
        <SectionTitle cn="新家礼包" en="Welcome Kit" icon={<GiftIcon className="h-5 w-5" />} />
        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            {GIFTS.map((g) => (
              <span
                key={g}
                className="rounded-full bg-muted px-3 py-1.5 text-[12px] font-medium text-card-foreground"
              >
                {g}
              </span>
            ))}
          </div>
        </Card>
      </Section>

      <Section className="mb-10 mt-6">
        <div className="flex items-start gap-2 rounded-2xl bg-sunny/40 p-3.5">
          <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#6b5f2f]" />
          <p className="text-[12px] leading-relaxed text-[#6b5f2f]">
            具体价格、接猫时间和售后内容以实际小猫情况及正式合同为准。
          </p>
        </div>
      </Section>
    </PhoneFrame>
  );
}
