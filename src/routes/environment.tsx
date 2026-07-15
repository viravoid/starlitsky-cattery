import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Card, Pill, Placeholder } from "@/components/mobile/ui";
import { HouseIcon, LeafIcon } from "@/components/mobile/icons";

export const Route = createFileRoute("/environment")({
  component: Environment,
});

const ZONES = [
  { name: "母婴区", area: "约 52㎡", img: "示例图片（母婴区照片，待替换）" },
  { name: "幼猫生活区", area: "约 66㎡", img: "示例图片（幼猫生活区照片，待替换）" },
  { name: "种母生活区", area: "约 102㎡", img: "示例图片（种母生活区照片，待替换）" },
  {
    name: "种公生活区",
    area: "室内约 65㎡ · 室外约 40㎡",
    img: "示例图片（种公生活区照片，待替换）",
  },
  {
    name: "公共活动区",
    area: "室内 220㎡ · 花园 70㎡",
    img: "示例图片（公共活动区照片，待替换）",
  },
  { name: "隔离房 · 医疗间 · 洗护间", area: "功能空间", img: "示例图片（医疗 / 洗护空间照片，待替换）" },
];

function Environment() {
  return (
    <PhoneFrame title="猫舍环境" backTo="/">
      <Section className="pt-1">
        <Card className="bg-gradient-cream p-4">
          <div className="mb-1 flex items-center gap-2">
            <LeafIcon className="h-5 w-5 text-violet" />
            <p className="font-display text-[11px] uppercase tracking-[0.25em] text-warm">
              Environment
            </p>
          </div>
          <p className="text-[13px] leading-[1.9] text-foreground">
            猫舍室内面积 600 余平，绝大部分空间用于饲养猫咪，有科学的空间规划，保证动物福利，拒绝笼养。小部分为人类生活区，允许宠物猫和退役种猫自由活动。有三个院子方便小猫小狗跑动。
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone="sky">600+ ㎡ 室内</Pill>
            <Pill tone="sunny">3 个院子</Pill>
            <Pill tone="violet">拒绝笼养</Pill>
          </div>
        </Card>
      </Section>

      <Section className="mb-10 mt-5 space-y-4">
        {ZONES.map((z) => (
          <Card key={z.name} className="overflow-hidden p-0">
            <Placeholder label={z.img} ratio="aspect-[16/9]" rounded="rounded-none" />
            <div className="flex items-center justify-between gap-2 p-3.5">
              <div className="flex items-center gap-2">
                <HouseIcon className="h-5 w-5 text-heading" />
                <h3 className="text-[14px] font-semibold text-heading">{z.name}</h3>
              </div>
              <span className="text-[12px] font-medium text-muted-foreground">{z.area}</span>
            </div>
          </Card>
        ))}
      </Section>
    </PhoneFrame>
  );
}
