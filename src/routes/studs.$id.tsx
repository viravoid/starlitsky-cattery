import { useMemo } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill } from "@/components/mobile/ui";
import { Carousel } from "@/components/mobile/Carousel";
import { PaperIcon } from "@/components/mobile/icons";
import { useCatteryImageUrls } from "@/hooks/use-cattery-image-urls";
import { hasHydratedCatteryData, selectStudRecords, useCattery } from "@/lib/cattery-store";

export const Route = createFileRoute("/studs/$id")({
  component: StudDetail,
});

function Info({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-muted px-3 py-2.5 ${className}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium text-card-foreground">{value}</p>
    </div>
  );
}

function StudDetail() {
  const { id } = useParams({ from: "/studs/$id" });
  const catteryState = useCattery((snapshot) => snapshot);
  const studs = useMemo(() => selectStudRecords(catteryState), [catteryState]);
  const stud = studs.find((item) => item.id === id);
  const imageIds = [stud?.coverImageId, ...(stud?.galleryImageIds ?? [])].filter(
    (imageId): imageId is string => Boolean(imageId),
  );
  const imageUrls = useCatteryImageUrls(imageIds);

  if (!stud && !hasHydratedCatteryData()) {
    return (
      <PhoneFrame title="种猫详情" showBack>
        <Section className="py-10 text-center text-[13px] text-muted-foreground">
          正在加载种猫资料…
        </Section>
      </PhoneFrame>
    );
  }
  if (!stud) {
    return (
      <PhoneFrame title="种猫详情" showBack>
        <Section className="space-y-3 py-10 text-center">
          <h1 className="text-[16px] font-semibold text-heading">未找到这只种猫</h1>
          <p className="text-[13px] leading-6 text-muted-foreground">
            这条记录可能已被隐藏、归档，或暂时不对用户端展示。
          </p>
        </Section>
      </PhoneFrame>
    );
  }

  const paragraphs =
    stud.story && stud.story.length > 0
      ? stud.story
      : [stud.personality || stud.trait || "（示例文字：主理人的完整介绍待补充）"];
  const gallerySlides =
    imageIds.length > 0
      ? imageIds.map((imageId, index) => ({
          label: `种猫图片 ${index + 1}`,
          imageUrl: imageUrls[imageId],
        }))
      : [{ label: "示例图片（种猫照片 1，待替换）" }, { label: "示例图片（种猫照片 2，待替换）" }];

  return (
    <PhoneFrame
      title={stud.name}
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
        <Carousel slides={gallerySlides} ratio="aspect-square" />
        <div className="mt-3">
          <Link
            to="/community/cat/$id"
            params={{ id: stud.id }}
            className="pressable inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-violet/40 bg-card px-3 py-2 text-[12.5px] font-medium text-violet"
          >
            TA 的猫友圈动态
          </Link>
        </div>
      </Section>

      <Section className="mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold leading-snug text-heading">{stud.name}</h1>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{stud.color}</p>
          </div>
          <Pill tone="sunny">{stud.status || "资料待补充"}</Pill>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Info label="身份" value={stud.role || "待补充"} />
          <Info label="颜色" value={stud.color || "待补充"} />
          <Info label="繁育状态" value={reproductiveStateLabel(stud.reproductiveState)} />
          <Info label="性别 / 生日" value={formatMeta(stud.gender, stud.birthday)} />
          <Info label="来源 / 血线" value={stud.source || "待补充"} className="col-span-2" />
        </div>
      </Section>

      <Section className="mb-10 mt-8">
        <div className="relative">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet/30 to-transparent" />
            <span className="text-[10px] uppercase tracking-[0.3em] text-violet/70">About</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet/30 to-transparent" />
          </div>

          <h2 className="text-[17px] font-semibold leading-snug text-heading">关于{stud.name}</h2>
          <p className="mt-1 text-[11px] tracking-wider text-muted-foreground/80">
            主理人手记 · Keeper&apos;s Note
          </p>

          <div className="relative mt-5 rounded-[22px] bg-gradient-to-b from-cream/60 to-transparent px-1 py-2">
            <div className="space-y-4 px-4 py-3">
              {paragraphs.map((paragraph, index) => (
                <p
                  key={`${index}-${paragraph}`}
                  className="text-[14.5px] leading-[1.95] tracking-[0.01em] text-foreground/90"
                >
                  {index === 0 && <span className="mr-1 align-baseline text-violet/60">「</span>}
                  {paragraph}
                  {index === paragraphs.length - 1 && (
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

function formatMeta(gender: string, birthday: string) {
  if (gender && birthday) return `${gender} / ${birthday}`;
  return gender || birthday || "待补充";
}

function reproductiveStateLabel(value: string) {
  switch (value) {
    case "preparing":
      return "准备中";
    case "semiRetired":
      return "半退役";
    case "retired":
      return "退役";
    case "archived":
      return "已归档";
    default:
      return "现役";
  }
}
