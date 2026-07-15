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
  DnaHelix,
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
    <PhoneFrame title="关于星月" backTo="/">
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
          欢迎了解我们的猫舍~我们的猫舍成立于2019年位于十三朝古都西安，注册于WCF、CFA协会。由主理人星下和月七两人全职经营，作为全职“猫家长”，我们每天最重要的事就是陪伴小猫成长，我们会从小猫出生开始记录日常逐步完成各项社会化训练，会有窝次群给蹲猫家长更新这些。同时我们非常重视小猫的健康、喂养和生活环境；小猫均为别墅散养每天都会打扫消毒，目前主理人已完成繁育课g1课程和九月的行为学课程以及邓俊的响片课，仍在不断学习中。
        </p>
        <p className="mt-4 text-[14px] leading-[1.9] text-foreground">
          所有小猫均为自己繁育，种猫均来自国内外知名猫舍血线清晰透明，经健康筛查无先天问题，遗传病筛选（all n/n)，注重动物福利，低频率繁育保证种猫身心健康。
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
            两位主理人全职经营猫舍，作为全职“猫家长”，陪伴并记录小猫从出生、社会化训练到去新家的成长过程。
          </p>
        </Card>
      </Section>
    </PhoneFrame>
  );
}
