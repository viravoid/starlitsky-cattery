import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, Pill, Placeholder } from "@/components/mobile/ui";
import { CopyText } from "@/components/mobile/CopyText";
import { KITTENS, statusTone, type KittenStatus } from "@/lib/cattery-data";

export const Route = createFileRoute("/kittens/")({
  component: Kittens,
});

const FILTERS = ["全部", "在售", "观察中", "已预订", "已售", "咨询价格"] as const;

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className="text-card-foreground">{v}</span>
    </div>
  );
}

function Kittens() {
  const [active, setActive] = useState<(typeof FILTERS)[number]>("全部");
  const list =
    active === "全部" ? KITTENS : KITTENS.filter((k) => k.status === (active as KittenStatus));

  return (
    <PhoneFrame activeTab="kittens" showTabBar>
      <div className="px-5 pb-2 pt-3">
        <h1 className="text-[19px] font-semibold text-heading">现猫介绍</h1>
        <p className="text-[12px] text-muted-foreground">当前在售 / 观察中的小猫</p>
      </div>

      <div className="sticky top-0 z-10 bg-background/95 px-5 py-2.5 backdrop-blur">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActive(f)}
              className={`pressable shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
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

      <Section className="mb-6 mt-1 space-y-4">
        {list.length === 0 ? (
          <p className="mt-16 text-center text-[13px] text-muted-foreground">
            示例文字（暂无「{active}」小猫）
          </p>
        ) : (
          list.map((k) => (
            <div key={k.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <div className="relative">
                <Placeholder
                  label="示例图片（小猫照片，待替换）"
                  ratio="aspect-[16/10]"
                  rounded="rounded-none"
                />
                <div className="absolute left-3 top-3">
                  <Pill tone={statusTone(k.status)}>{k.status}</Pill>
                </div>
              </div>
              <div className="space-y-2.5 p-4">
                <h3 className="text-[14px] font-semibold leading-snug text-heading">{k.name}</h3>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <Row k="性别" v={k.gender} />
                  <Row k="颜色" v={k.color} />
                  <Row k="生日" v={k.birthday} />
                  <Row k="价格" v={k.price} />
                </div>
                <Row k="父母" v={k.parents} />
                <Row k="性格" v={k.personality} />
                <div className="flex gap-2.5 pt-1">
                  <Link
                    to="/kittens/$id"
                    params={{ id: k.id }}
                    className="pressable flex-1 rounded-full bg-primary py-2.5 text-center text-[13px] font-semibold text-primary-foreground shadow-card"
                  >
                    查看详情
                  </Link>
                  <div className="flex-1">
                    <button className="pressable w-full rounded-full bg-violet py-2.5 text-center text-[13px] font-semibold text-white shadow-card">
                      咨询这只
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section className="mb-8">
        <div className="rounded-2xl bg-muted p-3.5">
          <p className="mb-2 text-[12px] text-muted-foreground">
            想第一时间了解在售小猫？复制微信号咨询：
          </p>
          <CopyText label="微信号" value="xingyuemianyinmao" />
        </div>
      </Section>
    </PhoneFrame>
  );
}
