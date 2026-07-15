import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Placeholder } from "@/components/mobile/ui";
import { BowlIcon } from "@/components/mobile/icons";

export const Route = createFileRoute("/feeding")({
  component: Feeding,
});

const MODULES = [
  {
    title: "熟自制",
    desc: "考虑到小猫饮食多样营养均衡，我们会采购各种不同种类的白肉红肉及内脏，按照正确的配比添加营养补剂。\n红肉（不同部位牛肉鹿肉，偶尔鸵鸟）\n内脏（牛，兔，鸡内脏）\n白肉（鸡胸鸡腿，鸭胸）",
  },
  {
    title: "猫粮",
    desc: "目前猫粮为百利高蛋白、百利无谷鸡、NG 猪肉、NG 紫鸡等配方良好的进口粮为主，不定期更换。",
  },
  {
    title: "罐头",
    desc: "macs、mja、ven、小李子等德罐为主。\n奶猫开食皇家奶糕。",
  },
  {
    title: "冻干",
    desc: "sc、pr、ve、爱立方、丸味等。",
  },
  {
    title: "保健品",
    desc: "布拉迪益生菌、jarrow 乳铁蛋白、nowfoods 鱼油、添赐力、nucat 多种维生素片等。",
  },
];

function Feeding() {
  return (
    <PhoneFrame title="猫舍喂养" backTo="/">
      <Section className="pt-2">
        <div className="mb-2 flex items-center gap-2">
          <BowlIcon className="h-5 w-5 text-violet" />
          <p className="font-display text-[11px] uppercase tracking-[0.25em] text-warm">
            Feeding
          </p>
        </div>
        <p className="text-[14px] leading-[2] text-foreground">
          每天白天有 1–2 餐湿粮（罐头或熟自制），夜晚有猫粮自助，冻干以及营养品补充。我们从小猫开食起慢慢尝试多种食物，培养不挑食小猫，方便回新家后快速适应各种食物。
        </p>
      </Section>

      <div className="mt-7 space-y-9">
        {MODULES.map(({ title, desc }, i) => (
          <Section key={title}>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="font-display text-[13px] text-warm/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-[16px] font-semibold leading-tight text-heading">
                  {title}
                </h3>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">
                  {desc}
                </p>
              </div>
            </div>

            {/* 真实图片轮播位（待替换） */}
            <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex snap-x snap-mandatory gap-3">
                {[0, 1, 2].map((n) => (
                  <Placeholder
                    key={n}
                    label={`示例图片（${title}轮播图，待替换）`}
                    ratio="aspect-[4/3]"
                    className="w-[78%] shrink-0 snap-start"
                  />
                ))}
              </div>
            </div>
          </Section>
        ))}
      </div>

      <div className="h-10" />
    </PhoneFrame>
  );
}
