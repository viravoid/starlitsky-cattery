import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { PaperIcon } from "@/components/mobile/icons";
import { STUDS } from "@/lib/cattery-data";

export const Route = createFileRoute("/studs/$id")({
  component: StudDetail,
});

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-card-foreground">{value}</p>
    </div>
  );
}

function StudDetail() {
  const { id } = useParams({ from: "/studs/$id" });
  const stud = STUDS.find((s) => s.id === id) ?? STUDS[0];
  const paragraphs =
    stud.story && stud.story.length > 0
      ? stud.story
      : [`${stud.trait}。（示例文字：主理人的完整介绍待补充）`];

  return (
    <PhoneFrame
      title="种猫详情"
      backTo="/cats"
      bottomBar={
        <div className="flex gap-2.5 border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
          <Link
            to="/questionnaire"
            className="pressable inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-violet px-4 py-3 text-sm font-semibold text-white shadow-card"
          >
            <PaperIcon className="h-4 w-4" /> 选猫问卷
          </Link>
        </div>
      }
    >
      <Section className="pt-1">
        <Carousel
          slides={[
            { label: "示例图片（种猫照片 1，待替换）" },
            { label: "示例图片（种猫照片 2，待替换）" },
          ]}
          ratio="aspect-square"
        />
      </Section>

      <Section className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold leading-snug text-heading">
              {stud.name}
            </h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{stud.color}</p>
          </div>
          <Pill tone={stud.category.includes("母") ? "creamblue" : "sky"}>
            {stud.status}
          </Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Info label="身份" value={stud.role} />
          <Info label="颜色" value={stud.color} />
          <Info label="当前状态" value={stud.status} />
          <Info label="来源 / 血线" value={stud.source} />
        </div>
      </Section>

      {/* 「关于这只猫」完整介绍 */}
      <Section className="mb-10 mt-8">
        <div className="relative">
          {/* 顶部小装饰：细线 + 星点 */}
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet/30 to-transparent" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-violet/70">
              About
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet/30 to-transparent" />
          </div>

          <h2 className="text-[17px] font-semibold leading-snug text-heading">
            关于{stud.name}
          </h2>
          <p className="mt-1 text-[11px] tracking-wider text-muted-foreground/80">
            主理人手记 · Keeper's Note
          </p>

          {/* 极淡背景层次 */}
          <div className="relative mt-5 rounded-[22px] bg-gradient-to-b from-cream/60 to-transparent px-1 py-2">
            <div className="space-y-4 px-4 py-3">
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-[14.5px] leading-[1.95] tracking-[0.01em] text-foreground/90"
                >
                  {i === 0 && (
                    <span className="mr-1 align-baseline text-violet/60">「</span>
                  )}
                  {p}
                  {i === paragraphs.length - 1 && (
                    <span className="ml-0.5 align-baseline text-violet/60">」</span>
                  )}
                </p>
              ))}
            </div>
          </div>

          {/* 落款 */}
          <div className="mt-6 flex items-center justify-end gap-2 text-[11px] text-muted-foreground/80">
            <span className="h-px w-8 bg-muted-foreground/30" />
            <span>— 星月 · 主理人</span>
          </div>
        </div>
      </Section>
    </PhoneFrame>
  );
}

