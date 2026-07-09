import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, SectionTitle, Card } from "@/components/mobile/ui";
import { ShieldIcon, PawIcon, CrossIcon, MoonIcon } from "@/components/mobile/icons";

export const Route = createFileRoute("/aftercare")({
  head: () => ({
    meta: [
      { title: "售后保障 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍售后保障：种猫遗传病筛查 all n/n，科学低频繁育，去新家前完成疫苗、抗体检测、基础检查、绝育与驱虫。",
      },
      { property: "og:title", content: "售后保障 — 星月缅因猫舍" },
      {
        property: "og:description",
        content: "遗传病筛查、疫苗、抗体检测、基础检查、绝育、驱虫与心超报销，具体以合同为准。",
      },
    ],
  }),
  component: Aftercare,
});

const PROMISES = [
  "种猫全部做遗传病检查，结果 all n/n",
  "科学繁育，根据母猫状态每窝间隔 8–16 个月",
  "窝次清晰透明",
  "所有小猫均为猫舍自己繁育，从小照顾并社会化训练",
  "拒绝高频繁育、借配、合作出售、近亲交配、出售病猫",
];

const HEALTH = [
  "疫苗 3 针",
  "抗体浓度检测",
  "血常规",
  "粪检",
  "基础检查",
  "小猫成年心超报销一次",
  "公猫 / 母猫微创绝育",
  "术后消炎针",
  "营养补充",
  "3–5 月龄大宠爱外驱一次",
  "3–5 月龄海乐妙内驱一次",
];

function Aftercare() {
  return (
    <PhoneFrame title="售后保障" backTo="/">
      {/* Breeding promises */}
      <Section className="pt-1">
        <SectionTitle
          cn="繁育与售后承诺"
          en="Our Promise"
          icon={<ShieldIcon className="h-5 w-5" />}
        />
        <div className="space-y-2.5">
          {PROMISES.map((p) => (
            <Card key={p} className="flex items-start gap-3 p-3.5">
              <PawIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet/70" />
              <p className="text-[13px] leading-relaxed text-card-foreground">{p}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Health before going home */}
      <Section className="mt-7">
        <SectionTitle
          cn="去新家前项目"
          en="Health Check"
          icon={<CrossIcon className="h-5 w-5" />}
        />
        <Card className="p-4">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {HEALTH.map((h) => (
              <li key={h} className="flex items-start gap-2 text-[12.5px] text-card-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="leading-snug">{h}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Section className="mb-10 mt-6">
        <div className="flex items-start gap-2 rounded-2xl bg-sunny/40 p-3.5">
          <MoonIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#6b5f2f]" />
          <p className="text-[12px] leading-relaxed text-[#6b5f2f]">
            售后页面仅为摘要，具体内容以《合同模板 2026》为准。
          </p>
        </div>
      </Section>
    </PhoneFrame>
  );
}
