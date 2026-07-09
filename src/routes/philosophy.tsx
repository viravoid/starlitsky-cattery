import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Card } from "@/components/mobile/ui";
import { MoonIcon, StarIcon } from "@/components/mobile/icons";
import {
  HeartPaw,
  CurledCat,
  Sparkles,
  MoonStars,
  CatProfile,
  ShieldHeart,
} from "@/components/mobile/illustrations";

export const Route = createFileRoute("/philosophy")({
  component: Philosophy,
});

const MODULES = [
  {
    title: "健康优先",
    desc: "体质好、抵抗力强，遗传病筛查 all n/n，从源头保障小猫健康。",
    Art: HeartPaw,
  },
  {
    title: "性格与社会化",
    desc: "乖巧亲人、大方自信，从小进行社会化训练，适应家庭生活。",
    Art: CurledCat,
  },
  {
    title: "血线与风格",
    desc: "种猫来自国内外知名猫舍，血线清晰透明，风格稳定。",
    Art: Sparkles,
  },
  {
    title: "低频率繁育",
    desc: "保证种猫身心健康，不追求数量，只为更好的小猫。",
    Art: MoonStars,
  },
  {
    title: "互相选择的小猫家长",
    desc: "希望和珍惜小猫的家长双向奔赴，一起陪伴小猫长大。",
    Art: CatProfile,
  },
  {
    title: "售后不推诿",
    desc: "小猫到新家后遇到问题，我们会一直在，认真沟通、不逃避。",
    Art: ShieldHeart,
  },
];

function Philosophy() {
  return (
    <PhoneFrame title="繁育理念" backTo="/">
      <Section className="pt-1">
        <Card className="relative overflow-hidden bg-gradient-hero p-5">
          <StarIcon className="absolute right-4 top-4 h-4 w-4 text-white/70" />
          <MoonIcon className="absolute right-10 top-8 h-6 w-6 text-white/60" />
          <p className="font-display text-[11px] uppercase tracking-[0.25em] text-[#4a5e8f]">
            Breeding Philosophy
          </p>
          <p className="mt-2 text-[14px] leading-[1.9] text-[#5b4a3a]">
            我们希望繁育体质好、抵抗力强、乖巧亲人、大方自信的小猫。从小猫出生开始记录到去新家，让家长不会缺席小猫成长的每一个阶段，做一家有温度的猫舍。
          </p>
        </Card>
      </Section>

      <Section className="mb-10 mt-5 space-y-3">
        {MODULES.map(({ title, desc, Art }, i) => (
          <Card key={title} className="flex gap-3 p-4">
            <Art className="h-10 w-10 shrink-0 text-violet/80" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-[12px] text-warm">0{i + 1}</span>
                <h3 className="text-[15px] font-semibold text-heading">{title}</h3>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground">{desc}</p>
            </div>
          </Card>
        ))}
      </Section>
    </PhoneFrame>
  );
}
