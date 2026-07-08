import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, SectionTitle, Card, Placeholder } from "@/components/mobile/ui";
import {
  BowlIcon,
  KibbleIcon,
  CanIcon,
  CatIcon,
  StarIcon,
  BagIcon,
} from "@/components/mobile/icons";

export const Route = createFileRoute("/feeding")({
  component: Feeding,
});

const MODULES = [
  {
    title: "熟自制",
    desc: "红肉、白肉、内脏，按正确配比添加营养补剂。",
    Icon: BowlIcon,
    tone: "bg-sky/25",
  },
  {
    title: "猫粮",
    desc: "百利高蛋白、百利无谷鸡、NG 猪肉、NG 紫鸡等进口粮为主，不定期更换。",
    Icon: BagIcon,
    tone: "bg-sunny/45",
  },
  {
    title: "罐头",
    desc: "macs、mja、ven、小李子等德罐为主。",
    Icon: CanIcon,
    tone: "bg-creamblue/45",
  },
  {
    title: "奶猫开食",
    desc: "皇家奶糕。",
    Icon: CatIcon,
    tone: "bg-warm/30",
  },
  {
    title: "冻干",
    desc: "sc、pr、ve、爱立方、丸味等。",
    Icon: KibbleIcon,
    tone: "bg-sky/25",
  },
  {
    title: "保健品",
    desc: "布拉迪益生菌、jarrow 乳铁蛋白、nowfoods 鱼油、添赐力、nucat 多种维生素片等。",
    Icon: StarIcon,
    tone: "bg-sunny/45",
  },
];

function Feeding() {
  return (
    <PhoneFrame title="猫舍喂养" backTo="/discover">
      <Section className="pt-1">
        <Card className="bg-gradient-cream p-4">
          <div className="mb-1 flex items-center gap-2">
            <BowlIcon className="h-5 w-5 text-violet" />
            <p className="font-display text-[11px] uppercase tracking-[0.25em] text-warm">
              Feeding
            </p>
          </div>
          <p className="text-[13px] leading-[1.9] text-foreground">
            每天白天有 1–2 餐湿粮（罐头或熟自制），夜晚有猫粮自助，冻干以及营养品补充。我们从小猫开食起慢慢尝试多种食物，培养不挑食小猫，方便回新家后快速适应各种食物。
          </p>
        </Card>
      </Section>

      <Section className="mt-5 space-y-3">
        {MODULES.map(({ title, desc, Icon, tone }) => (
          <Card key={title} className="flex gap-3 p-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone}`}>
              <Icon className="h-6 w-6 text-heading" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold text-heading">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground">{desc}</p>
            </div>
          </Card>
        ))}
      </Section>

      <Section className="mb-10 mt-6">
        <SectionTitle cn="喂养实拍" en="Gallery" />
        <div className="grid grid-cols-2 gap-2.5">
          <Placeholder label="示例图片（猫粮 / 罐头 / 冻干照片，待替换）" />
          <Placeholder label="示例图片（熟自制照片，待替换）" />
        </div>
      </Section>
    </PhoneFrame>
  );
}
