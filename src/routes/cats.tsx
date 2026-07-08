import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill, Placeholder } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { PaperIcon, ChevronRightIcon } from "@/components/mobile/icons";
import { CurledCat } from "@/components/mobile/illustrations";
import {
  KITTENS,
  STUDS,
  statusTone,
  WECHAT_ID,
  type KittenStatus,
  type StudCategory,
} from "@/lib/cattery-data";

export const Route = createFileRoute("/cats")({
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

const KITTEN_FILTERS = ["全部", "在售", "观察中", "已预订", "已售"] as const;
const STUD_FILTERS: StudCategory[] = [
  "现役公猫",
  "预备役公猫",
  "现役母猫",
  "退役种猫",
];

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="truncate text-card-foreground">{v}</span>
    </div>
  );
}

/** One shared card layout used for both kittens and studs. */
function CatCard({
  imageLabel,
  pill,
  name,
  meta,
  intro,
  to,
  params,
}: {
  imageLabel: string;
  pill: { text: string; tone: string };
  name: string;
  meta: { k: string; v: string }[];
  intro: string;
  to: string;
  params: Record<string, string>;
}) {
  return (
    <Link
      to={to}
      params={params}
      className="pressable block overflow-hidden rounded-3xl border border-border bg-card shadow-card"
    >
      <div className="relative">
        <Placeholder label={imageLabel} ratio="aspect-[16/10]" rounded="rounded-none" />
        <div className="absolute left-3 top-3">
          <Pill tone={pill.tone}>{pill.text}</Pill>
        </div>
      </div>
      <div className="space-y-2.5 p-4">
        <h3 className="text-[15px] font-semibold leading-snug text-heading">
          {name}
        </h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {meta.map((m) => (
            <Meta key={m.k} k={m.k} v={m.v} />
          ))}
        </div>
        <p className="text-[12px] leading-relaxed text-foreground">{intro}</p>
        <span className="mt-1 flex items-center justify-center gap-1 rounded-full bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground shadow-card">
          了解详情 <ChevronRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function Cats() {
  const [tab, setTab] = useState<"kittens" | "studs">("kittens");
  const [kFilter, setKFilter] =
    useState<(typeof KITTEN_FILTERS)[number]>("全部");
  const [sFilter, setSFilter] = useState<StudCategory>("现役公猫");

  const kittenList =
    kFilter === "全部"
      ? KITTENS
      : KITTENS.filter((k) => k.status === (kFilter as KittenStatus));
  const studList = STUDS.filter((s) => s.category === sFilter);

  return (
    <PhoneFrame
      activeTab="cats"
      showTabBar
      bottomBar={
        <div className="border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
          <Link
            to="/questionnaire"
            className="pressable flex w-full items-center justify-center gap-2 rounded-full bg-violet py-3.5 text-[15px] font-semibold text-white shadow-card"
          >
            <PaperIcon className="h-5 w-5" /> 填写选猫问卷
          </Link>
        </div>
      }
    >
      {/* Header */}
      <div className="px-5 pb-1 pt-4">
        <p className="font-display text-[11px] uppercase tracking-[0.3em] text-warm">
          Our Cats
        </p>
        <h1 className="mt-1 text-[22px] font-bold text-heading">我们的猫</h1>
      </div>

      {/* Category switch: 小猫 / 种猫 */}
      <div className="sticky top-0 z-10 bg-background/95 px-5 pb-2 pt-2.5 backdrop-blur">
        <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["kittens", "studs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pressable rounded-full py-2 text-[13px] font-semibold ${
                tab === t
                  ? "bg-card text-heading shadow-card"
                  : "text-muted-foreground"
              }`}
            >
              {t === "kittens" ? "小猫" : "种猫"}
            </button>
          ))}
        </div>

        {/* Sub-filters */}
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto">
          {(tab === "kittens" ? KITTEN_FILTERS : STUD_FILTERS).map((f) => {
            const on = tab === "kittens" ? kFilter === f : sFilter === f;
            return (
              <button
                key={f}
                onClick={() =>
                  tab === "kittens"
                    ? setKFilter(f as (typeof KITTEN_FILTERS)[number])
                    : setSFilter(f as StudCategory)
                }
                className={`pressable shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  on
                    ? "bg-violet text-white shadow-card"
                    : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Kittens ─────────────────────────────── */}
      {tab === "kittens" && (
        <Section className="mb-6 mt-2 space-y-4">
          {kittenList.length === 0 ? (
            <p className="mt-16 text-center text-[13px] text-muted-foreground">
              示例文字（暂无「{kFilter}」小猫）
            </p>
          ) : (
            kittenList.map((k) => (
              <CatCard
                key={k.id}
                imageLabel="示例图片（小猫照片，待替换）"
                pill={{ text: k.status, tone: statusTone(k.status) }}
                name={k.name}
                meta={[
                  { k: "性别", v: k.gender },
                  { k: "颜色", v: k.color },
                  { k: "生日", v: k.birthday },
                  { k: "价格", v: k.price },
                ]}
                intro={k.personality}
                to="/kittens/$id"
                params={{ id: k.id }}
              />
            ))
          )}
        </Section>
      )}

      {/* ── Studs (same layout) ─────────────────── */}
      {tab === "studs" && (
        <Section className="mb-6 mt-2 space-y-4">
          {studList.length === 0 ? (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <CurledCat className="h-14 w-14 text-warm" />
              <p className="text-[13px] text-muted-foreground">
                示例文字（缺少「{sFilter}」资料）
              </p>
            </div>
          ) : (
            studList.map((s) => (
              <CatCard
                key={s.id}
                imageLabel="示例图片（种猫照片，待替换）"
                pill={{
                  text: s.status,
                  tone: s.category.includes("母") ? "creamblue" : "sky",
                }}
                name={s.name}
                meta={[
                  { k: "身份", v: s.role },
                  { k: "颜色", v: s.color },
                ]}
                intro={s.trait}
                to="/studs/$id"
                params={{ id: s.id }}
              />
            ))
          )}
        </Section>
      )}
    </PhoneFrame>
  );
}
