import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, SectionTitle, Card, Placeholder } from "@/components/mobile/ui";
import { PawIcon } from "@/components/mobile/icons";
import {
  MoonStars,
  Cottage,
  Rosette,
  HeartPaw,
  CurledCat,
  PawCheck,
} from "@/components/mobile/illustrations";

export const Route = createFileRoute("/about")({
  component: About,
});

const FACTS = [
  { label: "2019 年成立", Art: MoonStars },
  { label: "西安", Art: Cottage },
  { label: "WCF / CFA 注册", Art: Rosette },
  { label: "全职猫家长", Art: HeartPaw },
  { label: "自繁自养", Art: CurledCat },
  { label: "遗传病筛查 all n/n", Art: PawCheck },
];

function About() {
  return (
    <PhoneFrame title="关于星月" backTo="/discover">
      <Section className="pt-1">
        <Placeholder label="示例图片（猫舍介绍主图，待替换）" ratio="aspect-[16/10]" rounded="rounded-3xl" />
      </Section>

      <Section className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <PawIcon className="h-5 w-5 text-violet" />
          <p className="font-display text-[12px] uppercase tracking-[0.25em] text-warm">
            About StarlitSky
          </p>
        </div>
        <p className="text-[14px] leading-[1.9] text-foreground">
          猫舍成立于 2019 年，位于西安，注册于 WCF、CFA 协会。由主理人星下和月七全职经营。我们重视小猫的健康、喂养、生活环境与社会化训练。
        </p>
        <p className="mt-3 text-[14px] leading-[1.9] text-foreground">
          所有小猫均为自己繁育，种猫来自国内外知名猫舍，血线清晰透明，经健康筛查无先天问题，遗传病筛查 all n/n。我们注重动物福利，低频率繁育，保证种猫身心健康。
        </p>
      </Section>

      <Section className="mt-6">
        <SectionTitle cn="猫舍名片" en="At a glance" />
        <div className="grid grid-cols-2 gap-2.5">
          {FACTS.map(({ label, Art }) => (
            <Card key={label} className="flex items-center gap-2.5 p-3">
              <Art className="h-9 w-9 shrink-0 text-violet/80" />
              <span className="text-[13px] font-medium leading-snug text-card-foreground">
                {label}
              </span>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="mb-10 mt-6">
        <Card className="space-y-2 bg-gradient-cream p-4">
          <h3 className="text-[15px] font-semibold text-heading">主理人 · 星下 & 月七</h3>
          <p className="text-[13px] leading-relaxed text-foreground">
            两位全职猫家长，从小猫出生记录到去新家，希望家长不会缺席小猫成长的每一个阶段。
          </p>
        </Card>
      </Section>
    </PhoneFrame>
  );
}
