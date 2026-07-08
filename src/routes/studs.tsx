import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill, Placeholder } from "@/components/mobile/ui";
import { ChevronRightIcon, PawIcon } from "@/components/mobile/icons";
import { STUDS, type StudCategory } from "@/lib/cattery-data";

export const Route = createFileRoute("/studs")({
  component: Studs,
});

const FILTERS: StudCategory[] = ["现役公猫", "预备役公猫", "现役母猫", "退役种猫"];

function Studs() {
  const [active, setActive] = useState<StudCategory>("现役公猫");
  const list = STUDS.filter((s) => s.category === active);

  return (
    <PhoneFrame title="种猫介绍" backTo="/">
      <div className="sticky top-0 z-10 bg-background/95 px-5 py-3 backdrop-blur">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActive(f)}
              className={`pressable shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                active === f
                  ? "bg-violet text-white shadow-card"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Section className="mb-10 mt-1">
        {list.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <PawIcon className="h-10 w-10 text-warm" />
            <p className="text-[13px] text-muted-foreground">
              示例文字（缺少「{active}」资料）
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {list.map((s) => (
              <button
                key={s.name}
                className="pressable overflow-hidden rounded-3xl border border-border bg-card text-left shadow-card"
              >
                <Placeholder
                  label="示例图片（种猫照片，待替换）"
                  ratio="aspect-square"
                  rounded="rounded-none"
                />
                <div className="space-y-1 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-semibold text-heading">{s.name}</h3>
                    <ChevronRightIcon className="h-4 w-4 text-warm" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{s.color}</p>
                  <Pill tone={s.category.includes("母") ? "creamblue" : "sky"}>{s.role}</Pill>
                  <p className="pt-0.5 text-[11px] leading-snug text-foreground">{s.trait}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>
    </PhoneFrame>
  );
}
