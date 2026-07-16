import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pill, Placeholder } from "@/components/mobile/ui";
import {
  CatIcon,
  PaperIcon,
  HouseIcon,
  BowlIcon,
  RouteIcon,
  PawIcon,
  StarIcon,
  ShieldIcon,
  LockIcon,
  ChevronLeftIcon,
  ChatBubbleIcon,
  UserIcon,
  TrashIcon,
} from "@/components/mobile/icons";
import {
  KITTENS,
  STUDS,
  SOCIALS,
  statusTone,
  FORM_ENTRIES,
  FORM_STATUSES,
  formStatusTone,
  type FormEntry,
  type FormStatus,
} from "@/lib/cattery-data";
import {
  useCommunity,
  actions as communityActions,
  formatTime,
} from "@/lib/community-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "管理后台 — 星月缅因猫舍" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type SectionKey =
  | "overview"
  | "carousel"
  | "kittens"
  | "studs"
  | "environment"
  | "content"
  | "aftercare"
  | "forms"
  | "contact";

const NAV: { key: SectionKey; label: string; Icon: (p: { className?: string }) => React.ReactNode }[] = [
  { key: "overview", label: "数据概览", Icon: StarIcon },
  { key: "carousel", label: "首页轮播管理", Icon: StarIcon },
  { key: "kittens", label: "在售小猫 / 状态 / 价格", Icon: CatIcon },
  { key: "studs", label: "种猫资料管理", Icon: PawIcon },
  { key: "environment", label: "猫舍环境图文", Icon: HouseIcon },
  { key: "content", label: "喂养体系 / 文章", Icon: BowlIcon },
  { key: "aftercare", label: "售后说明管理", Icon: ShieldIcon },
  { key: "forms", label: "问卷查看", Icon: PaperIcon },
  { key: "contact", label: "联系方式管理", Icon: RouteIcon },
];

function Admin() {
  const [authed, setAuthed] = useState(false);
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} />;
}

/* ── Login ─────────────────────────────────────── */
function Login({ onLogin }: { onLogin: () => void }) {
  const [pwd, setPwd] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-cream px-6">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-border bg-card p-8 shadow-float">
        <div className="text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet/15">
            <LockIcon className="h-7 w-7 text-violet" />
          </span>
          <h1 className="mt-4 text-[19px] font-bold text-heading">星月缅因猫舍</h1>
          <p className="mt-1 font-display text-[11px] uppercase tracking-[0.28em] text-warm">
            Admin Console
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            管理后台仅供猫舍工作人员使用，请登录后维护内容。
          </p>
        </div>
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-heading">管理员账号</span>
            <input
              placeholder="示例文字（缺少账号）"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-[14px] outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-heading">密码</span>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="请输入密码"
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-[14px] outline-none focus:border-primary"
            />
          </label>
          <button
            onClick={onLogin}
            className="pressable mt-2 w-full rounded-full bg-violet py-3 text-[15px] font-semibold text-white shadow-card"
          >
            登录后台
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard shell ───────────────────────────── */
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<SectionKey>("overview");
  const [forms, setForms] = useState<FormEntry[]>(FORM_ENTRIES);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);

  const setStatus = (id: string, status: FormStatus) =>
    setForms((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));

  const activeLabel = NAV.find((n) => n.key === section)?.label ?? "";

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      {/* Sidebar */}
      <aside className="border-b border-border bg-card lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet/15">
            <CatIcon className="h-5 w-5 text-violet" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-heading">星月缅因猫舍</p>
            <p className="font-display text-[10px] uppercase tracking-[0.25em] text-warm">
              Admin
            </p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-3">
          {NAV.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => {
                setSection(key);
                setSelectedForm(null);
              }}
              className={`pressable flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[13px] font-medium lg:w-full ${
                section === key
                  ? "bg-violet/12 text-violet"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              {label}
            </button>
          ))}
          <button
            onClick={onLogout}
            className="pressable flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-muted-foreground hover:bg-muted lg:w-full lg:mt-2 lg:border-t lg:border-border lg:pt-3"
          >
            退出登录
          </button>
        </nav>
      </aside>

      {/* Main */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-[20px] font-bold text-heading">{activeLabel}</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            猫舍内容维护 · 普通用户端不可见
          </p>
        </header>

        {section === "overview" && <Overview />}
        {section === "carousel" && <CarouselPanel />}
        {section === "kittens" && <KittensPanel />}
        {section === "studs" && <StudsPanel />}
        {section === "environment" && <EnvironmentPanel />}
        {section === "content" && <ContentPanel />}
        {section === "aftercare" && <AftercarePanel />}
        {section === "contact" && <ContactPanel />}
        {section === "forms" &&
          (selectedForm ? (
            <FormDetail
              form={forms.find((f) => f.id === selectedForm)!}
              onBack={() => setSelectedForm(null)}
              onStatus={(s) => setStatus(selectedForm, s)}
            />
          ) : (
            <FormsList forms={forms} onOpen={setSelectedForm} />
          ))}
      </main>
    </div>
  );
}

/* ── Shared bits ───────────────────────────────── */
function PanelCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 shadow-card ${className}`}>
      {children}
    </div>
  );
}

function PrimaryBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="pressable rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground">
      {children}
    </button>
  );
}
function GhostBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="pressable rounded-full border border-border px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground">
      {children}
    </button>
  );
}

/* ── Overview ──────────────────────────────────── */
function Overview() {
  const stats = [
    { label: "小猫总数", value: KITTENS.length, tone: "bg-sky/25" },
    { label: "待找家数量", value: KITTENS.filter((k) => k.status === "待找家").length, tone: "bg-creamblue/45" },
    { label: "找家中数量", value: KITTENS.filter((k) => k.status === "找家中").length, tone: "bg-sunny/45" },
    { label: "问卷提交数量", value: FORM_ENTRIES.length, tone: "bg-warm/30" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className={`rounded-2xl p-4 ${s.tone}`}>
          <p className="text-[26px] font-bold text-heading">{s.value}</p>
          <p className="mt-1 text-[12px] text-card-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Carousel ──────────────────────────────────── */
function CarouselPanel() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <PanelCard key={i} className="space-y-2 p-3">
            <Placeholder label={`示例图片（首页轮播图 ${i}，待替换）`} ratio="aspect-[4/3]" rounded="rounded-xl" />
            <div className="flex justify-between gap-2">
              <PrimaryBtn>替换图片</PrimaryBtn>
              <GhostBtn>删除</GhostBtn>
            </div>
          </PanelCard>
        ))}
      </div>
      <PrimaryBtn>+ 新增轮播图</PrimaryBtn>
    </div>
  );
}

/* ── Kittens ───────────────────────────────────── */
function KittensPanel() {
  return (
    <div className="space-y-3">
      {KITTENS.map((k) => (
        <PanelCard key={k.id} className="flex flex-wrap items-center gap-3">
          <Placeholder label="照片" ratio="aspect-square" rounded="rounded-xl" compact className="h-16 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-heading">{k.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <Pill tone={statusTone(k.status)}>{k.status}</Pill>
              <span>{k.gender}</span>
              <span>价格：{k.price}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <PrimaryBtn>编辑</PrimaryBtn>
            <GhostBtn>改状态</GhostBtn>
            <GhostBtn>上/下架</GhostBtn>
          </div>
        </PanelCard>
      ))}
      <PrimaryBtn>+ 新增小猫</PrimaryBtn>
    </div>
  );
}

/* ── Studs ─────────────────────────────────────── */
function StudsPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {STUDS.map((s) => (
        <PanelCard key={s.name} className="flex items-center gap-3">
          <Placeholder label="照片" ratio="aspect-square" rounded="rounded-xl" compact className="h-14 w-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-heading">{s.name}</p>
            <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{s.color}</p>
            <p className="text-[11px] text-warm">{s.category}</p>
          </div>
          <PrimaryBtn>编辑</PrimaryBtn>
        </PanelCard>
      ))}
    </div>
  );
}

/* ── Environment ───────────────────────────────── */
function EnvironmentPanel() {
  return (
    <div className="space-y-3">
      <PanelCard>
        <p className="text-[13px] font-semibold text-heading">环境介绍文案</p>
        <textarea
          rows={4}
          defaultValue="猫舍室内面积 600 余平，绝大部分空间用于饲养猫咪，有科学的空间规划，保证动物福利，拒绝笼养。另有三个院子方便小猫小狗跑动。"
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
        />
        <div className="mt-2"><PrimaryBtn>保存文案</PrimaryBtn></div>
      </PanelCard>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Placeholder key={i} label={`示例图片（猫舍环境照片 ${i}，待替换）`} ratio="aspect-[4/3]" rounded="rounded-xl" />
        ))}
      </div>
      <PrimaryBtn>+ 新增环境图</PrimaryBtn>
    </div>
  );
}

/* ── Content / feeding & articles ──────────────── */
function ContentPanel() {
  const articles = [
    "接猫前需要准备什么",
    "小猫到家第一周注意事项",
    "为什么要做社会化训练",
    "为什么要 4.5 月龄以上绝育后接猫",
    "缅因猫适合什么样的家庭",
    "如何理解猫舍排队制",
  ];
  return (
    <div className="space-y-3">
      <PanelCard>
        <p className="text-[13px] font-semibold text-heading">喂养体系文案</p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          维护熟自制、猫粮、罐头、冻干、保健品等模块说明。
        </p>
        <div className="mt-2"><PrimaryBtn>编辑喂养页面</PrimaryBtn></div>
      </PanelCard>
      <PanelCard className="divide-y divide-border p-0">
        {articles.map((a) => (
          <div key={a} className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-card-foreground">{a}</span>
            <div className="flex gap-2">
              <PrimaryBtn>编辑</PrimaryBtn>
              <GhostBtn>下架</GhostBtn>
            </div>
          </div>
        ))}
      </PanelCard>
      <PrimaryBtn>+ 新增文章</PrimaryBtn>
    </div>
  );
}

/* ── Aftercare ─────────────────────────────────── */
function AftercarePanel() {
  return (
    <PanelCard>
      <p className="text-[13px] font-semibold text-heading">售后说明摘要</p>
      <textarea
        rows={5}
        defaultValue="种猫全部做遗传病检查，结果 all n/n。科学繁育，根据母猫状态每窝间隔 8–16 个月。窝次清晰透明。所有小猫均为猫舍自己繁育。具体内容以《合同模板 2026》为准。"
        className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] outline-none focus:border-primary"
      />
      <div className="mt-2"><PrimaryBtn>保存</PrimaryBtn></div>
    </PanelCard>
  );
}

/* ── Contact ───────────────────────────────────── */
function ContactPanel() {
  return (
    <div className="space-y-3">
      {SOCIALS.map((s) => (
        <PanelCard key={s.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[12px] text-muted-foreground">{s.label}</span>
          <input
            defaultValue={s.value}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <PrimaryBtn>保存</PrimaryBtn>
        </PanelCard>
      ))}
    </div>
  );
}

/* ── Forms list ────────────────────────────────── */
function FormsList({ forms, onOpen }: { forms: FormEntry[]; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {forms.map((f) => (
        <button
          key={f.id}
          onClick={() => onOpen(f.id)}
          className="pressable block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-card"
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-heading">{f.name}</span>
            <Pill tone={formStatusTone(f.status)}>{f.status}</Pill>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-muted-foreground sm:grid-cols-3">
            <span>电话：{f.phone}</span>
            <span>城市：{f.city}</span>
            <span>经验：{f.experience}</span>
            <span>原住民：{f.residents}</span>
            <span>预算：{f.budget}</span>
            <span>性别：{f.wantGender}</span>
            <span>颜色：{f.wantColor}</span>
            <span>绝育：{f.acceptNeuter}</span>
            <span>科学喂养：{f.scientificFeeding}</span>
          </div>
          <p className="mt-2 text-[11px] text-warm">提交时间：{f.time}</p>
        </button>
      ))}
    </div>
  );
}

/* ── Form detail ───────────────────────────────── */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-border/60 py-2 text-[13px] last:border-0">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 text-card-foreground">{value}</span>
    </div>
  );
}

function FormDetail({
  form,
  onBack,
  onStatus,
}: {
  form: FormEntry;
  onBack: () => void;
  onStatus: (s: FormStatus) => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="pressable mb-4 inline-flex items-center gap-1 text-[13px] font-semibold text-violet"
      >
        <ChevronLeftIcon className="h-4 w-4" /> 返回问卷列表
      </button>

      <PanelCard className="mb-4">
        <p className="mb-2 text-[13px] font-semibold text-heading">处理状态</p>
        <div className="flex flex-wrap gap-2">
          {FORM_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => onStatus(s)}
              className={`pressable rounded-full px-3.5 py-1.5 text-[12px] font-medium ${
                form.status === s
                  ? "bg-violet text-white shadow-card"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </PanelCard>

      <PanelCard>
        <Row label="提交时间" value={form.time} />
        <Row label="真实姓名" value={form.name} />
        <Row label="性别" value={form.gender} />
        <Row label="电话" value={form.phone} />
        <Row label="年龄" value={form.age} />
        <Row label="职业" value={form.job} />
        <Row label="现居城市" value={form.city} />
        <Row label="是否有养猫经验" value={form.experience} />
        <Row label="家里是否有原住民" value={form.residents} />
        <Row label="原住民是否绝育" value={form.residentsNeutered} />
        <Row label="是否有小孩" value={form.hasKids} />
        <Row label="租房 / 房东意见" value={form.housing} />
        <Row label="住房是否封窗" value={form.windowSealed} />
        <Row label="家庭成员是否同意" value={form.familyAgree} />
        <Row label="想要公猫 / 母猫" value={form.wantGender} />
        <Row label="想要颜色" value={form.wantColor} />
        <Row label="接受价格范围" value={form.budget} />
        <Row label="能否接受绝育" value={form.acceptNeuter} />
        <Row label="每月支出范围" value={form.monthlySpend} />
        <Row label="能否接受科学喂养" value={form.scientificFeeding} />
        <Row label="能否接受活泼行为" value={form.acceptActive} />
        <Row label="是否承诺不离不弃" value={form.commitment} />
      </PanelCard>
    </div>
  );
}
