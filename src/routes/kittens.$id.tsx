import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Card, Pill } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { PaperIcon, CheckIcon, StarIcon } from "@/components/mobile/icons";
import { KITTENS, statusTone } from "@/lib/cattery-data";

export const Route = createFileRoute("/kittens/$id")({
  component: KittenDetail,
});

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-2.5">
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

  return (
    <PhoneFrame
      title="小猫详情"
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
          <Info label="价格" value={kitten.price} />
          <Info label="父母" value={kitten.parents} />
          {kitten.status !== "已有家" && (
            <Info label="是否已绝育" value="示例文字（待更新）" />
          )}
        </div>
      </Section>

      <Section className="mt-5 space-y-3">
        <Card className="p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-heading">
            <StarIcon className="h-4 w-4 text-violet" /> 性格介绍
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground">{kitten.personality}</p>
        </Card>
        <Card className="p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-heading">
            <StarIcon className="h-4 w-4 text-violet" /> 品相介绍
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground">
            示例文字（缺少品相介绍）
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-heading">
            <StarIcon className="h-4 w-4 text-violet" /> 成长记录
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground">
            示例文字（缺少成长记录，从出生开始持续更新）
          </p>
        </Card>
      </Section>

      <Section className="mb-8 mt-5">
        <h3 className="mb-2.5 text-[14px] font-semibold text-heading">健康进度</h3>
        <div className="space-y-2.5">
          <Progress label="疫苗进度" value="示例文字（待更新）" done={false} />
          <Progress label="驱虫进度" value="示例文字（待更新）" done={false} />
          <Progress label="体检情况" value="示例文字（待更新）" done={false} />
        </div>
      </Section>
    </PhoneFrame>
  );
}
