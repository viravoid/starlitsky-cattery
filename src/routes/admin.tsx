import { createFileRoute } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/mobile/PhoneFrame";
import { Section, SectionTitle, Card, Pill, Placeholder } from "@/components/mobile/ui";
import {
  CatIcon,
  PaperIcon,
  HouseIcon,
  BowlIcon,
  RouteIcon,
  PawIcon,
  StarIcon,
  UserIcon,
} from "@/components/mobile/icons";
import { KITTENS, statusTone } from "@/lib/cattery-data";

export const Route = createFileRoute("/admin")({
  component: Admin;
});

const STATS = [
  { label: "小猫数量", value: "3", tone: "bg-sky/25" },
  { label: "在售数量", value: "1", tone: "bg-creamblue/45" },
  { label: "观察中数量", value: "1", tone: "bg-sunny/45" },
  { label: "问卷提交数量", value: "12", tone: "bg-warm/30" },
];

const ENTRIES = [
  { label: "首页轮播管理", Icon: StarIcon },
  { label: "小猫信息管理", Icon: CatIcon },
  { label: "小猫状态管理", Icon: PawIcon },
  { label: "种猫信息管理", Icon: PawIcon },
  { label: "猫舍环境管理", Icon: HouseIcon },
  { label: "喂养页面管理", Icon: BowlIcon },
  { label: "价格流程管理", Icon: RouteIcon },
  { label: "文章 / 科普管理", Icon: PaperIcon },
  { label: "问卷查看", Icon: PaperIcon },
  { label: "联系方式管理", Icon: UserIcon },
];

const FORMS = [
  { name: "小橘", wechat: "xj_****", city: "西安", budget: "15000–20000", pref: "银虎斑 · 妹妹", time: "2 天前" },
  { name: "阿柚", wechat: "ayou_****", city: "成都", budget: "20000–30000", pref: "玳瑁 · 都可以", time: "5 天前" },
];

function Admin() {
  return (
    <PhoneFrame title="后台管理" backTo="/profile">
      {/* Overview */}
      <Section className="pt-1">
        <SectionTitle cn="今日概览" en="Overview" />
        <div className="grid grid-cols-2 gap-2.5">
          {STATS.map((s) => (
            <Card key={s.label} className={`p-3.5 ${s.tone}`}>
              <p className="text-[22px] font-bold text-heading">{s.value}</p>
              <p className="text-[12px] text-card-foreground">{s.label}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Feature entries */}
      <Section className="mt-6">
        <SectionTitle cn="功能入口" en="Manage" />
        <div className="grid grid-cols-2 gap-2.5">
          {ENTRIES.map(({ label, Icon }) => (
            <button
              key={label}
              className="pressable flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3 text-left shadow-card"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky/20">
                <Icon className="h-5 w-5 text-heading" />
              </span>
              <span className="text-[12px] font-medium text-card-foreground">{label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Kitten management list */}
      <Section className="mt-6">
        <SectionTitle cn="小猫管理" en="Kittens" />
        <div className="space-y-2.5">
          {KITTENS.map((k) => (
            <Card key={k.id} className="flex items-center gap-3 p-3">
              <Placeholder
                label="照片"
                ratio="aspect-square"
                rounded="rounded-xl"
                className="h-14 w-14 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-heading">{k.name}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Pill tone={statusTone(k.status)}>{k.status}</Pill>
                  <span className="text-[11px] text-muted-foreground">{k.price}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <button className="pressable rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                  编辑
                </button>
                <button className="pressable rounded-full border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                  上/下架
                </button>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* Questionnaire view */}
      <Section className="mb-10 mt-6">
        <SectionTitle cn="问卷查看" en="Forms" />
        <div className="space-y-2.5">
          {FORMS.map((f) => (
            <Card key={f.wechat} className="p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold text-heading">{f.name}</p>
                <span className="text-[11px] text-muted-foreground">{f.time}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <p className="text-muted-foreground">微信：<span className="text-card-foreground">{f.wechat}</span></p>
                <p className="text-muted-foreground">城市：<span className="text-card-foreground">{f.city}</span></p>
                <p className="text-muted-foreground">预算：<span className="text-card-foreground">{f.budget}</span></p>
                <p className="text-muted-foreground">偏好：<span className="text-card-foreground">{f.pref}</span></p>
              </div>
              <button className="pressable mt-2.5 w-full rounded-full bg-violet py-2 text-[12px] font-semibold text-white">
                查看详情
              </button>
            </Card>
          ))}
        </div>
      </Section>
    </PhoneFrame>
  );
}
