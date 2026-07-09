import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, SectionTitle, Card } from "@/components/mobile/ui";
import { PriceTagIcon, GiftIcon, RouteIcon, MoonIcon } from "@/components/mobile/icons";

export const Route = createFileRoute("/process")({
  component: Process,
});

const PRICES = [
  { label: "宠物级", value: "10000 – 20000", tone: "bg-sky/25" },
  { label: "赛级", value: "20000 – 30000", tone: "bg-creamblue/45" },
  { label: "退役种猫", value: "0 – 15000", tone: "bg-sunny/45" },
  { label: "小偿领养", value: "0 – 5000", tone: "bg-warm/30" },
  { label: "繁育权 · 母猫", value: "30000 – 50000", tone: "bg-sky/25" },
  { label: "繁育权 · 公猫", value: "40000 – 70000", tone: "bg-creamblue/45" },
];

const STEPS = [
  "阅读猫舍介绍",
  "填写选猫问卷",
  "排队订金 3000 元",
  "选中心仪小猫",
  "支付 50% 定金并签合同",
  "小猫完成疫苗、体检、绝育",
  "康复后沟通运输方式",
  "提供接猫指导和新家礼包",
];

const GIFTS = [
  "过渡粮",
  "罐头",
  "随机零食",
  "药品分装",
  "湿巾",
  "大号航空箱",
  "喜欢的玩具",
  "体检报告",
];

function Process() {
  return (
    <PhoneFrame title="接猫流程" backTo="/">
      {/* Prices */}
      <Section className="pt-1">
        <SectionTitle
          cn="价格区间"
          en="Pricing"
          icon={<PriceTagIcon className="h-5 w-5" />}
        />
        <p className="mb-3 text-[12px] text-muted-foreground">传统色 · 绝育价格（元）</p>
        <div className="grid grid-cols-2 gap-2.5">
          {PRICES.map((p) => (
            <Card key={p.label} className={`p-3.5 ${p.tone}`}>
              <p className="text-[12px] font-medium text-card-foreground">{p.label}</p>
              <p className="mt-1 text-[15px] font-semibold text-heading">{p.value}</p>
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
              <li key={s} className="relative flex items-start gap-3">
                <span className="z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet text-[13px] font-semibold text-white shadow-card">
                  {i + 1}
                </span>
                <div className="flex-1 rounded-2xl border border-border bg-card px-3.5 py-2.5 shadow-card">
                  <p className="text-[13px] font-medium text-card-foreground">{s}</p>
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
