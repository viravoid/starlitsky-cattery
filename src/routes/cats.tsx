import { useMemo } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { z } from "zod";
import { CroppedImageFrame } from "@/components/CroppedImageFrame";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill, Placeholder } from "@/components/mobile/ui";
import { PaperIcon, ChevronRightIcon } from "@/components/mobile/icons";
import { CurledCat } from "@/components/mobile/illustrations";
import { statusTone, type StudCategory } from "@/lib/cattery-data";
import { getResolvedCatCoverPresentation } from "@/lib/cat-image-presentation";
import { useCatteryImageUrls } from "@/hooks/use-cattery-image-urls";
import {
  type EntryCoverSelections,
  selectKittenRecords,
  selectLitterRecords,
  selectStudRecords,
  useCattery,
  type CatCoverPresentations,
} from "@/lib/cattery-store";

const searchSchema = z
  .object({
    tab: z.enum(["kittens", "studs"]).optional(),
    kittenFilter: z.enum(["待找家", "找家中", "已有家"]).optional(),
    studFilter: z.enum(["现役公猫", "现役母猫", "预备役种猫"]).optional(),
    litter: z.string().optional(),
    litterOpen: z.boolean().optional(),
  })
  .catch({});

type CatsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/cats")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "我们的猫 — 星月缅因猫舍" },
      {
        name: "description",
        content:
          "星月缅因猫舍的小猫与种猫展示，包含在售、观察中、已预订小猫，以及现役公猫、母猫等种猫资料。",
      },
    ],
  }),
  component: Cats,
});

const KITTEN_FILTERS = ["待找家", "找家中", "已有家"] as const;
const STUD_FILTERS: StudCategory[] = ["现役公猫", "现役母猫", "预备役种猫"];

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="truncate text-card-foreground">{v}</span>
    </div>
  );
}

function CatCard({
  catId,
  coverImageId,
  galleryImageIds,
  imageLabel,
  entryCoverSelections,
  coverPresentations,
  pill,
  litter,
  name,
  meta,
  to,
  params,
}: {
  catId: string;
  coverImageId?: string;
  galleryImageIds: string[];
  imageLabel: string;
  entryCoverSelections?: EntryCoverSelections;
  coverPresentations?: CatCoverPresentations;
  pill: { text: string; tone: string };
  litter?: string;
  name: string;
  meta: { k: string; v: string }[];
  to: string;
  params: Record<string, string>;
}) {
  const imageUrls = useCatteryImageUrls([coverImageId, ...galleryImageIds]);
  const presentation = getResolvedCatCoverPresentation({
    catId,
    entry: "listCard",
    coverImageId,
    galleryImageIds,
    manualSelections: entryCoverSelections,
    legacyPresentations: coverPresentations,
  });
  const imageUrl = presentation.imageId ? imageUrls[presentation.imageId] : undefined;

  return (
    <Link
      to={to}
      params={params}
      className="pressable block overflow-hidden rounded-3xl border border-border bg-card shadow-card"
    >
      <div className="relative">
        {imageUrl ? (
          <div className="aspect-[16/10] overflow-hidden rounded-none bg-card">
            <CroppedImageFrame
              imageUrl={imageUrl}
              aspectRatio={presentation.aspectRatio}
              cropRect={presentation.mode === "crop" ? presentation.cropRect : undefined}
              legacyPresentation={presentation.mode === "legacy" ? presentation.legacy : undefined}
              mode={presentation.mode}
              className="h-full w-full"
            />
          </div>
        ) : (
          <Placeholder label={imageLabel} ratio="aspect-[16/10]" rounded="rounded-none" />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Pill tone={pill.tone}>{pill.text}</Pill>
          {litter && <Pill tone="sunny">{litter}</Pill>}
        </div>
      </div>
      <div className="space-y-2.5 p-4">
        <h3 className="text-[15px] font-semibold leading-snug text-heading">{name}</h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {meta.map((item) => (
            <Meta key={item.k} k={item.k} v={item.v} />
          ))}
        </div>
        <span className="mt-1 flex items-center justify-center gap-1 rounded-full border border-primary bg-card py-2.5 text-[13px] font-semibold text-primary shadow-card">
          了解详情 <ChevronRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function Cats() {
  const search = useSearch({ from: "/cats" });
  const navigate = useNavigate({ from: "/cats" });
  const catteryState = useCattery((snapshot) => snapshot);
  const kittenRecords = useMemo(() => selectKittenRecords(catteryState), [catteryState]);
  const litterRecords = useMemo(() => selectLitterRecords(catteryState), [catteryState]);
  const studRecords = useMemo(() => selectStudRecords(catteryState), [catteryState]);

  const tab = search.tab ?? "kittens";
  const kittenFilter = search.kittenFilter ?? "待找家";
  const studFilter = search.studFilter ?? "现役公猫";
  const litter = search.litter ?? "全部";
  const litterOpen = search.litterOpen ?? false;
  const litterOptions = useMemo(
    () => litterRecords.map((item) => ({ value: item.id, label: item.name })),
    [litterRecords],
  );
  const activeLitterLabel =
    litter === "全部"
      ? "全部"
      : (litterOptions.find((item) => item.value === litter)?.label ?? "全部");

  const setTab = (nextTab: "kittens" | "studs") =>
    navigate({ search: (prev: CatsSearch) => ({ ...prev, tab: nextTab }) });
  const setKittenFilter = (value: (typeof KITTEN_FILTERS)[number]) =>
    navigate({ search: (prev: CatsSearch) => ({ ...prev, kittenFilter: value }) });
  const setStudFilter = (value: StudCategory) =>
    navigate({ search: (prev: CatsSearch) => ({ ...prev, studFilter: value }) });
  const setLitter = (value: string | "全部") =>
    navigate({
      search: (prev: CatsSearch) => ({
        ...prev,
        litter: value === "全部" ? undefined : value,
        litterOpen: false,
      }),
    });
  const setLitterOpen = (open: boolean) =>
    navigate({ search: (prev: CatsSearch) => ({ ...prev, litterOpen: open }) });

  const kittenList = kittenRecords.filter(
    (kitten) => kitten.status === kittenFilter && (litter === "全部" || kitten.litterId === litter),
  );
  const filteredStuds = studRecords.filter((stud) => stud.category === studFilter);

  return (
    <PhoneFrame
      activeTab="cats"
      showTabBar
      bottomBar={
        <div className="border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
          <Link
            to="/questionnaire"
            className="pressable flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground"
          >
            <PaperIcon className="h-5 w-5" /> 填写选猫问卷
          </Link>
        </div>
      }
    >
      <div className="px-5 pb-1 pt-4">
        <p className="font-display text-[11px] uppercase tracking-[0.3em] text-warm">Our Cats</p>
        <h1 className="mt-1 text-[22px] font-bold text-heading">我们的猫</h1>
      </div>

      <div
        className="sticky top-0 z-10 px-5 pt-2 backdrop-blur"
        style={{ backgroundColor: "rgba(255, 250, 242, 0.95)" }}
      >
        <div className="grid grid-cols-2 border-b border-border/70">
          {(["kittens", "studs"] as const).map((item) => {
            const active = tab === item;
            return (
              <button
                key={item}
                onClick={() => setTab(item)}
                className="pressable relative py-2.5 text-[15px]"
                style={{
                  color: active ? "#7a9ac0" : "#8c929a",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {item === "kittens" ? "小猫" : "种猫"}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-px mx-auto h-[3px] w-8 rounded-full"
                    style={{ backgroundColor: "#e7c15d" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-2">
          {(tab === "kittens" ? KITTEN_FILTERS : STUD_FILTERS).map((item) => {
            const active = tab === "kittens" ? kittenFilter === item : studFilter === item;
            return (
              <button
                key={item}
                onClick={() =>
                  tab === "kittens"
                    ? setKittenFilter(item as (typeof KITTEN_FILTERS)[number])
                    : setStudFilter(item as StudCategory)
                }
                className="pressable shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
                style={
                  active
                    ? {
                        backgroundColor: "#f9f0d4",
                        color: "#b48725",
                        border: "1px solid #e7c15d",
                      }
                    : {
                        backgroundColor: "#fffdf8",
                        color: "#6b8db3",
                        border: "1px solid #e8dfcf",
                      }
                }
              >
                {item}
              </button>
            );
          })}
          {tab === "kittens" && (
            <button
              onClick={() => setLitterOpen(!litterOpen)}
              className="pressable flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold"
              style={{
                backgroundColor: litter === "全部" ? "#fffdf8" : "#f9f0d4",
                color: litter === "全部" ? "#6b8db3" : "#b48725",
                border: litter === "全部" ? "1px solid #e8dfcf" : "1px solid #e7c15d",
              }}
              aria-expanded={litterOpen}
            >
              窝次{litter === "全部" ? "" : `：${activeLitterLabel}`}
              <ChevronDown
                className="h-3.5 w-3.5 transition-transform"
                style={{
                  transform: litterOpen ? "rotate(180deg)" : "none",
                  color: litter === "全部" ? "#6b8db3" : "#b48725",
                }}
              />
            </button>
          )}
        </div>
      </div>

      {tab === "kittens" && (
        <Section className="mb-6 mt-2 space-y-4">
          {litterOpen && (
            <div className="flex flex-wrap gap-2">
              {(["全部", ...litterOptions.map((item) => item.value)] as const).map((item) => {
                const label =
                  item === "全部"
                    ? item
                    : (litterOptions.find((option) => option.value === item)?.label ?? item);
                const active = litter === item;
                return (
                  <button
                    key={item}
                    onClick={() => setLitter(item)}
                    className="pressable shrink-0 rounded-full px-3 py-1 text-[12px]"
                    style={
                      active
                        ? {
                            backgroundColor: "#f9f0d4",
                            color: "#b48725",
                            border: "1px solid #e7c15d",
                          }
                        : {
                            backgroundColor: "#fffdf8",
                            color: "#6b8db3",
                            border: "1px solid #e8dfcf",
                          }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {kittenList.length === 0 ? (
            <p className="mt-16 text-center text-[13px] text-muted-foreground">
              示例文字（暂无「{kittenFilter}」小猫）
            </p>
          ) : (
            kittenList.map((kitten) => (
              <CatCard
                key={kitten.id}
                catId={kitten.id}
                coverImageId={kitten.coverImageId}
                galleryImageIds={kitten.galleryImageIds}
                imageLabel="示例图片（小猫照片，待替换）"
                entryCoverSelections={kitten.entryCoverSelections}
                coverPresentations={kitten.coverPresentations}
                pill={{ text: kitten.status, tone: statusTone(kitten.status) }}
                litter={kitten.litterName}
                name={kitten.name}
                meta={[
                  { k: "性别", v: kitten.gender },
                  { k: "颜色", v: kitten.color },
                  { k: "生日", v: kitten.birthday },
                  { k: "价格", v: kitten.price },
                ]}
                to="/kittens/$id"
                params={{ id: kitten.id }}
              />
            ))
          )}
        </Section>
      )}

      {tab === "studs" && (
        <Section className="mb-6 mt-2 space-y-4">
          {filteredStuds.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <CurledCat className="h-14 w-14 text-warm" />
              <p className="text-[13px] text-muted-foreground">
                示例文字（缺少「{studFilter}」资料）
              </p>
            </div>
          ) : (
            filteredStuds.map((stud) => (
              <CatCard
                key={stud.id}
                catId={stud.id}
                coverImageId={stud.coverImageId}
                galleryImageIds={stud.galleryImageIds}
                imageLabel="示例图片（种猫照片，待替换）"
                entryCoverSelections={stud.entryCoverSelections}
                coverPresentations={stud.coverPresentations}
                pill={{ text: stud.status, tone: "sunny" }}
                name={stud.name}
                meta={[
                  { k: "身份", v: stud.role },
                  { k: "颜色", v: stud.color },
                ]}
                to="/studs/$id"
                params={{ id: stud.id }}
              />
            ))
          )}
        </Section>
      )}
    </PhoneFrame>
  );
}
