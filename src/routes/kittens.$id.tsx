import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { PaperIcon, CheckIcon } from "@/components/mobile/icons";
import { KITTENS, statusTone } from "@/lib/cattery-data";

export const Route = createFileRoute("/kittens/$id")({
  component: KittenDetail,
});

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-2xl bg-muted px-3 py-2.5 ${className || ""}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-card-foreground">{value}</p>
    </div>
  );
}

function Progress({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <span className="text-[13px] font-medium text-card-foreground">{label}</span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          done ? "bg-sky/30 text-[#34566a]" : "bg-sunny/50 text-[#6b5f2f]"
        }`}
      >
        {done && <CheckIcon className="h-3.5 w-3.5" />}
        {value}
      </span>
    </div>
  );
}

function KittenDetail() {
  const { id } = useParams({ from: "/kittens/$id" });
  const kitten = KITTENS.find((k) => k.id === id) ?? KITTENS[0];
  const paragraphs =
    kitten.story && kitten.story.length > 0
      ? kitten.story
      : [kitten.personality || "（示例文字：主理人的完整介绍待补充）"];

  return (
    <PhoneFrame
      title="小猫详情"

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
            { label: "示例图片（小猫照片 1，待替换）" },
            { label: "示例图片（小猫照片 2，待替换）" },
          ]}
          ratio="aspect-square"
        />
      </Section>

      <Section className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[16px] font-semibold leading-snug text-heading">{kitten.name}</h1>
          <Pill tone={statusTone(kitten.status)}>{kitten.status}</Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Info label="性别" value={kitten.gender} />
          <Info label="颜色" value={kitten.color} />
          <Info label="出生日期 / 月龄" value={kitten.birthday} />
          {kitten.status !== "已有家" && (
            <Info label="是否已绝育" value="示例文字（待更新）" />
          )}
          <Info label="父亲" value={kitten.father} />
          <Info label="母亲" value={kitten.mother} />
          <Info label="价格" value={kitten.price} className="col-span-2" />
        </div>
      </Section>

      {/* 「关于这只小猫」完整介绍 */}
      <Section className="mb-10 mt-8">
        <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet/30 to-transparent" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-violet/70">About</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet/30 to-transparent" />
          </div>

          <h2 className="text-[17px] font-semibold leading-snug text-heading">关于{kitten.name}</h2>
          <p className="mt-1 text-[11px] tracking-wider text-muted-foreground/80">
            主理人手记 · Keeper's Note
          </p>

          <div className="relative mt-5 rounded-[22px] bg-gradient-to-b from-cream/60 to-transparent px-1 py-2">
            <div className="space-y-4 px-4 py-3">
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="text-[14.5px] leading-[1.95] tracking-[0.01em] text-foreground/90"
                >
                  {i === 0 && <span className="mr-1 align-baseline text-violet/60">「</span>}
                  {p}
                  {i === paragraphs.length - 1 && (
                    <span className="ml-0.5 align-baseline text-violet/60">」</span>
                  )}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 text-[11px] text-muted-foreground/80">
            <span className="h-px w-8 bg-muted-foreground/30" />
            <span>— 星月 · 主理人</span>
          </div>
        </div>
      </Section>

      <Section className="mb-8 mt-5">
        <h3 className="mb-2.5 text-[14px] font-semibold text-heading">健康进度</h3>
        <div className="space-y-2.5">
          <Progress label="疫苗进度" value="示例文字（待更新）" done={false} />
          <Progress label="驱虫进度" value="示例文字（待更新）" done={false} />
        </div>
      </Section>
    </PhoneFrame>
  );
}
