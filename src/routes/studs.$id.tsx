import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Card, Pill } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { PaperIcon, StarIcon } from "@/components/mobile/icons";
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

      <Section className="mb-8 mt-5 space-y-3">
        <Card className="p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-heading">
            <StarIcon className="h-4 w-4 text-violet" /> 性格特点
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground">{stud.trait}</p>
        </Card>
        <Card className="p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-heading">
            <StarIcon className="h-4 w-4 text-violet" /> 结构特点
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground">
            {stud.structure}
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-heading">
            <StarIcon className="h-4 w-4 text-violet" /> 繁育方向
          </h3>
          <p className="text-[13px] leading-relaxed text-foreground">
            {stud.breeding}
          </p>
        </Card>
      </Section>
    </PhoneFrame>
  );
}
