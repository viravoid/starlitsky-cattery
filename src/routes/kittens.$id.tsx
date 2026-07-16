import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { PaperIcon, CheckIcon } from "@/components/mobile/icons";
import { KITTENS, statusTone, type StructureRating } from "@/lib/cattery-data";

function StarRow({ label, value }: { label: string; value?: number }) {
  const filled = Math.max(0, Math.min(6, value ?? 0));
  const showSix = filled === 6;
  const baseCount = 5;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 whitespace-nowrap">
      <span className="shrink-0 text-[13px] text-foreground/80">{label}</span>
      {value === undefined ? (
        <span className="shrink-0 text-[11px] text-muted-foreground/70">待评估</span>
      ) : (
        <span className="flex shrink-0 items-center gap-[3px]">
          {showSix && <Star active highlight />}
          {Array.from({ length: baseCount }).map((_, i) => (
            <Star key={i} active={i < filled} />
          ))}
        </span>
      )}
    </div>
  );
}

function Star({ active, highlight }: { active: boolean; highlight?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${
        active
          ? highlight
            ? "text-[#f1b84b] drop-shadow-[0_0_2.5px_rgba(241,184,75,0.45)]"
            : "text-[#e7c15d]"
          : "text-[#dce3ed]"
      }`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.6l2.76 5.92 6.44.78-4.78 4.44 1.28 6.36L12 16.98l-5.7 3.12 1.28-6.36L2.8 9.3l6.44-.78L12 2.6z" />
    </svg>
  );
}

function StructureBlock({ rating }: { rating: StructureRating }) {
  const face = rating.face || {};
  const body = rating.body || {};
  const faceEmpty = ![face.eyes, face.ears, face.muzzle, face.profile].some((v) => v !== undefined);
  const bodyEmpty = ![body.length, body.build, body.overall].some((v) => v !== undefined);
  if (faceEmpty && bodyEmpty) {
    return (
      <div className="rounded-[22px] border border-border/70 bg-cream/40 px-5 py-4 text-center text-[12px] text-muted-foreground">
        结构评分待补充
      </div>
    );
  }
  return (
    <div className="rounded-[22px] border border-border/60 bg-sunny/35 px-5 py-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] tracking-[0.24em] text-muted-foreground/80">面部结构</p>
          <StarRow label="眼睛" value={face.eyes} />
          <StarRow label="耳朵" value={face.ears} />
          <StarRow label="嘴套" value={face.muzzle} />
          <StarRow label="侧脸" value={face.profile} />
        </div>
        <div className="mt-4 border-t border-border/50 pt-3 sm:mt-0 sm:border-t-0 sm:pt-0">
          <p className="mb-2 text-[11px] tracking-[0.24em] text-muted-foreground/80">身体结构</p>
          <StarRow label="身长" value={body.length} />
          <StarRow label="体格" value={body.build} />
          <StarRow label="整体" value={body.overall} />
        </div>
      </div>
    </div>
  );
}


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
          done ? "bg-sky/30 text-[#6b8db3]" : "bg-sunny/50 text-[#b48725]"
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
      title={kitten.name}

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
        <div className="mt-3 flex gap-2">
          <Link
            to="/community/cat/$id"
            params={{ id: kitten.id }}
            className="pressable inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-violet/40 bg-card px-3 py-2 text-[12.5px] font-medium text-violet"
          >
            TA 的猫友圈动态
          </Link>
          {kitten.litter && (
            <Link
              to="/community/litter/$id"
              params={{ id: kitten.litter }}
              className="pressable inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-violet/40 bg-card px-3 py-2 text-[12.5px] font-medium text-violet"
            >
              {kitten.litter}的动态
            </Link>
          )}
        </div>
      </Section>

      <Section className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-[16px] font-semibold leading-snug text-heading">{kitten.name}</h1>
          <Pill tone={statusTone(kitten.status)}>{kitten.status}</Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Info label="性别" value={kitten.gender} />
          <Info label="颜色" value={kitten.color} />
          <Info label="出生日期" value={kitten.birthday} />
          {kitten.status !== "已有家" && (
            <Info label="是否已绝育" value="示例文字（待更新）" />
          )}
          <Info label="父亲" value={kitten.father} />
          <Info label="母亲" value={kitten.mother} />
          <Info label="窝次" value={kitten.litter ?? "示例文字（待更新）"} />
          <Info label="价格" value={kitten.price} />

        </div>
      </Section>

      {kitten.structureRating && (
        <Section className="mt-6">
          <div className="mb-4 flex items-baseline gap-3">
            <h3 className="text-[15px] font-semibold text-heading">结构评分</h3>
            <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/70">
              Structure Review
            </span>
          </div>
          <StructureBlock rating={kitten.structureRating} />
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/70">
            由猫舍主理人根据实际观察给出的专业评价，仅供参考。
          </p>
        </Section>
      )}

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

    </PhoneFrame>
  );
}
