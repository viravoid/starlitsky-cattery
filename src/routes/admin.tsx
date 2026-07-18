import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Placeholder } from "@/components/mobile/ui";
import {
  CatIcon,
  PaperIcon,
  HouseIcon,
  RouteIcon,
  PawIcon,
  StarIcon,
  ShieldIcon,
  LockIcon,
  ChevronLeftIcon,
  ChatBubbleIcon,
  UserIcon,
  TrashIcon,
  PlusIcon,
  XIcon,
} from "@/components/mobile/icons";
import {
  KITTENS,
  STUDS,
  SOCIALS,
  LITTERS,
  statusTone,
  FORM_ENTRIES,
  FORM_STATUSES,
  formStatusTone,
  type FormEntry,
  type FormStatus,
  type Kitten,
  type Stud,
} from "@/lib/cattery-data";
import {
  useCommunity,
  actions as communityActions,
  formatTime,
  type ParentUser,
  type Post,
  type CommunityCat,
} from "@/lib/community-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "管理后台 — 星月缅因猫舍" }, { name: "robots", content: "noindex" }],
  }),
  component: Admin,
});

type SectionKey =
  | "overview"
  | "kittens"
  | "studs"
  | "litters"
  | "parents"
  | "forms"
  | "community"
  | "comments"
  | "carousel"
  | "environment"
  | "aftercare"
  | "contact";

type NavItem = {
  key: SectionKey;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "数据概览",
    items: [{ key: "overview", label: "数据概览", Icon: StarIcon }],
  },
  {
    title: "猫咪管理",
    items: [
      { key: "kittens", label: "在售小猫", Icon: CatIcon },
      { key: "studs", label: "种猫", Icon: PawIcon },
      { key: "litters", label: "窝次管理", Icon: HouseIcon },
    ],
  },
  {
    title: "家长管理",
    items: [{ key: "parents", label: "家长列表", Icon: UserIcon }],
  },
  {
    title: "问卷管理",
    items: [{ key: "forms", label: "问卷管理", Icon: PaperIcon }],
  },
  {
    title: "猫友圈管理",
    items: [
      { key: "community", label: "动态管理", Icon: ChatBubbleIcon },
      { key: "comments", label: "评论管理", Icon: ChatBubbleIcon },
    ],
  },
  {
    title: "站点内容",
    items: [
      { key: "carousel", label: "首页轮播", Icon: StarIcon },
      { key: "environment", label: "猫舍环境", Icon: HouseIcon },
      { key: "aftercare", label: "售后说明", Icon: ShieldIcon },
      { key: "contact", label: "联系方式", Icon: RouteIcon },
    ],
  },
];

const SECTION_COPY: Record<SectionKey, { title: string; desc: string }> = {
  overview: {
    title: "数据概览",
    desc: "用最少信息判断当前 Demo 内容状态和待处理事项。",
  },
  kittens: {
    title: "在售小猫",
    desc: "维护小猫展示、状态、价格、窝次和家长关联的 Demo 表格。",
  },
  studs: {
    title: "种猫",
    desc: "管理种猫资料、类别、状态和用户端展示信息。",
  },
  litters: {
    title: "窝次管理",
    desc: "把窝次、小猫、父母和猫友圈动态串起来。",
  },
  parents: {
    title: "家长列表",
    desc: "查看家长身份、邀请码、名下猫咪和相关动态。",
  },
  forms: {
    title: "问卷管理",
    desc: "查看用户端选猫问卷示例，并做 Demo 级处理标记。",
  },
  community: {
    title: "动态管理",
    desc: "管理猫友圈动态的置顶、隐藏和删除 Demo 状态。",
  },
  comments: {
    title: "评论管理",
    desc: "查看评论并做隐藏、恢复和删除 Demo 操作。",
  },
  carousel: {
    title: "首页轮播",
    desc: "管理首页轮播位的展示顺序和占位图片。",
  },
  environment: {
    title: "猫舍环境",
    desc: "维护猫舍环境页图文占位内容。",
  },
  aftercare: {
    title: "售后说明",
    desc: "维护售后保障摘要和条目文案。",
  },
  contact: {
    title: "联系方式",
    desc: "维护用户端展示的微信、小红书、微博等渠道信息。",
  },
};

type LitterName = (typeof LITTERS)[number];

const LITTER_META: Record<LitterName, { birthday: string; status: string; note: string }> = {
  A窝: {
    birthday: "2026-04-18",
    status: "成长记录中",
    note: "重点关联猫友圈成长动态。",
  },
  B窝: {
    birthday: "2026-05-09",
    status: "观察中",
    note: "部分小猫仍在评估展示状态。",
  },
  C窝: {
    birthday: "2026-06-02",
    status: "已建档",
    note: "待补充父母和完整小猫资料。",
  },
};

function Admin() {
  const [authed, setAuthed] = useState(false);
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} />;
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [pwd, setPwd] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-[380px] rounded-[12px] border border-border bg-card p-7 shadow-card">
        <div className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-[10px] bg-primary/12 text-primary">
            <LockIcon className="size-6" />
          </span>
          <h1 className="mt-4 text-[18px] font-bold text-heading">星月缅因猫舍</h1>
          <p className="mt-1 font-display text-[10px] uppercase tracking-[0.24em] text-warm">
            Admin Demo
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            当前为视觉 Demo，点击即可进入后台预览；暂不包含真实登录。
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-heading">管理员账号</span>
            <input
              placeholder="Demo 账号占位"
              className="h-10 w-full rounded-[8px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-heading">密码</span>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Demo 密码占位"
              className="h-10 w-full rounded-[8px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
            />
          </label>
          <button
            onClick={onLogin}
            className="pressable mt-1 h-10 rounded-[8px] bg-primary text-[14px] font-semibold text-primary-foreground shadow-card"
          >
            登录后台
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<SectionKey>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [forms, setForms] = useState<FormEntry[]>(FORM_ENTRIES);
  const [selectedFormId, setSelectedFormId] = useState(FORM_ENTRIES[0]?.id ?? "");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedLitter, setSelectedLitter] = useState<LitterName | "">("");

  const posts = useCommunity((s) => s.posts);
  const users = useCommunity((s) => s.users);
  const cats = useCommunity((s) => s.cats);
  const parentUsers = users.filter((u) => u.role === "parent");
  const selectedParent = parentUsers.find((u) => u.id === selectedParentId) ?? null;
  const selectedForm = forms.find((f) => f.id === selectedFormId) ?? forms[0] ?? null;

  const selectSection = (key: SectionKey) => {
    setSection(key);
    setMobileNavOpen(false);
    setNotice("");
    setSelectedParentId("");
    setSelectedLitter("");
  };

  const setFormStatus = (id: string, status: FormStatus) => {
    setForms((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    setNotice(`已将问卷状态模拟更新为「${status}」，刷新后会恢复。`);
  };

  const activeCopy = SECTION_COPY[section];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-border bg-card lg:flex">
        <SidebarHeader onLogout={onLogout} />
        <AdminNav active={section} onSelect={selectSection} />
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur lg:hidden">
        <div className="flex h-12 items-center justify-between px-3">
          <div>
            <p className="text-[13px] font-bold text-heading">{activeCopy.title}</p>
            <p className="text-[10.5px] text-muted-foreground">星月后台</p>
          </div>
          <button
            onClick={() => setMobileNavOpen((open) => !open)}
            className="pressable inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-border bg-background px-2.5 text-[12px] font-semibold text-heading"
            aria-label={mobileNavOpen ? "关闭菜单" : "打开菜单"}
          >
            <span>菜单</span>
          </button>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 bg-heading/20 lg:hidden" role="presentation">
          <div className="absolute inset-y-0 right-0 flex w-[min(340px,88vw)] flex-col border-l border-border bg-card shadow-card">
            <div className="flex h-12 items-center justify-between border-b border-border px-3">
              <div>
                <p className="text-[13px] font-bold text-heading">后台菜单</p>
                <p className="text-[10.5px] text-muted-foreground">{activeCopy.title}</p>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="pressable grid size-8 place-items-center rounded-[6px] border border-border bg-background text-heading"
                aria-label="关闭菜单"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <AdminNav active={section} onSelect={selectSection} compact />
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-[240px]">
        <DemoNotice />
      </div>

      <main className="lg:pl-[240px]">
        <div className="flex min-h-screen w-full max-w-[1600px] flex-col gap-2.5 px-3 py-2.5 sm:px-5 lg:gap-5 lg:px-8 lg:py-6 2xl:max-w-none">
          <PageHeader title={activeCopy.title} desc={activeCopy.desc} />
          {notice && <ActionNotice message={notice} />}

          {section === "overview" && (
            <OverviewPanel
              forms={forms}
              posts={posts}
              users={parentUsers}
              cats={cats}
              onJump={selectSection}
            />
          )}
          {section === "kittens" && (
            <KittensPanel onNotice={setNotice} posts={posts} users={parentUsers} />
          )}
          {section === "studs" && <StudsPanel onNotice={setNotice} />}
          {section === "litters" && (
            <LittersPanel
              selected={selectedLitter}
              onSelected={setSelectedLitter}
              posts={posts}
              onNotice={setNotice}
            />
          )}
          {section === "parents" && (
            <ParentsPanel
              users={parentUsers}
              cats={cats}
              posts={posts}
              selectedParent={selectedParent}
              onSelectedParent={(id) => setSelectedParentId(id)}
              onNotice={setNotice}
            />
          )}
          {section === "forms" && selectedForm && (
            <FormsPanel
              forms={forms}
              selected={selectedForm}
              onSelect={setSelectedFormId}
              onStatus={setFormStatus}
            />
          )}
          {section === "community" && <CommunityPanel posts={posts} onNotice={setNotice} />}
          {section === "comments" && <CommentsPanel posts={posts} onNotice={setNotice} />}
          {section === "carousel" && <CarouselPanel onNotice={setNotice} />}
          {section === "environment" && <EnvironmentPanel onNotice={setNotice} />}
          {section === "aftercare" && <AftercarePanel onNotice={setNotice} />}
          {section === "contact" && <ContactPanel onNotice={setNotice} />}
        </div>
      </main>
    </div>
  );
}

function SidebarHeader({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-[7px] bg-primary/12 text-primary">
          <CatIcon className="size-5" />
        </span>
        <div>
          <p className="text-[14px] font-bold text-heading">星月缅因猫舍</p>
          <p className="font-display text-[10px] uppercase tracking-[0.22em] text-warm">
            Admin Demo
          </p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="pressable mt-4 h-8 w-full rounded-[7px] border border-border bg-background text-[13px] font-semibold text-muted-foreground"
      >
        退出登录
      </button>
    </div>
  );
}

function AdminNav({
  active,
  onSelect,
  compact = false,
}: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  compact?: boolean;
}) {
  return (
    <nav className={cn("flex flex-col gap-4 overflow-y-auto", compact ? "" : "px-3 py-4")}>
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <p className="px-2 text-[11.5px] font-semibold text-muted-foreground">{group.title}</p>
          <div className="flex flex-col gap-1">
            {group.items.map(({ key, label, Icon }) => {
              const on = active === key;
              return (
                <button
                  key={key}
                  onClick={() => onSelect(key)}
                  className={cn(
                    "pressable flex h-9 items-center gap-2 rounded-[7px] px-2.5 text-left text-[13px] font-medium lg:text-[13.5px]",
                    on ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function PageHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b border-border pb-2.5 lg:pb-4">
      <div>
        <h1 className="text-[17px] font-bold text-heading lg:text-[26px]">{title}</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground lg:mt-1.5 lg:text-[14px]">{desc}</p>
      </div>
    </div>
  );
}

function DemoNotice() {
  return (
    <div className="border-b border-sunflower/35 bg-sunny/25 px-3 py-1.5 text-[12px] font-medium text-[#9b7927] sm:px-5 lg:px-8 lg:text-[13px]">
      当前为视觉 Demo，数据修改不会真实保存。
    </div>
  );
}

function ActionNotice({ message }: { message: string }) {
  return (
    <div className="rounded-[6px] border border-creamblue/60 bg-creamblue/15 px-3 py-1.5 text-[12px] text-muted-foreground lg:text-[13px]">
      {message}
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-[6px] border border-border/80 bg-card", className)}>
      {children}
    </section>
  );
}

function PanelTitle({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-row items-start justify-between gap-2 border-b border-border/80 px-3 py-2.5 lg:px-4 lg:py-3">
      <div>
        <h2 className="text-[14px] font-semibold text-heading lg:text-[16px]">{title}</h2>
        {desc && (
          <p className="mt-0.5 text-[11.5px] text-muted-foreground lg:text-[13px]">{desc}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "quiet" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "pressable inline-flex h-7 items-center justify-center rounded-[6px] px-2.5 text-[11.5px] font-semibold lg:h-8 lg:px-3 lg:text-[13px]",
        tone === "default" && "bg-primary text-primary-foreground",
        tone === "quiet" && "border border-border bg-background text-muted-foreground",
        tone === "danger" && "border border-wine/35 bg-wine/10 text-wine",
      )}
    >
      {children}
    </button>
  );
}

function StatusBadge({ children, tone = "sky" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    sky: "bg-sky/14 text-[#6b8db3]",
    creamblue: "bg-creamblue/22 text-[#6b8db3]",
    sunny: "bg-sunny/70 text-[#9b7927]",
    warm: "bg-warm/18 text-[#6b8db3]",
    violet: "bg-violet/14 text-violet",
    wine: "bg-wine/10 text-wine",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[5px] px-1.5 py-0.5 text-[11.5px] font-semibold lg:px-2 lg:text-[12.5px]",
        tones[tone] ?? tones.sky,
      )}
    >
      {children}
    </span>
  );
}

function FieldLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] gap-3 border-b border-border/60 py-1.5 text-[12px] last:border-0 lg:grid-cols-[100px_minmax(0,1fr)] lg:py-2.5 lg:text-[13.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 text-card-foreground">{value}</span>
    </div>
  );
}

function TableShell({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[920px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-border bg-muted/45 text-[12.5px] font-semibold text-muted-foreground">
            {columns.map((column) => (
              <th key={column} className="px-3 py-2.5">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">{children}</tbody>
      </table>
    </div>
  );
}

function MobileRecord({
  title,
  meta,
  children,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-border/70 bg-card px-3 py-2 last:border-b-0 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-semibold text-heading">{title}</p>
          {meta && <div className="mt-0.5 text-[11px] text-muted-foreground">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
      </div>
      {children && <div className="mt-1.5 flex flex-col gap-0.5 text-[11.5px]">{children}</div>}
    </div>
  );
}

function BackToListButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="pressable inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-border bg-background px-2.5 text-[12px] font-semibold text-muted-foreground md:hidden"
    >
      <ChevronLeftIcon className="size-3.5" />
      返回列表
    </button>
  );
}

function DemoAddBox({ children }: { children: ReactNode }) {
  return <div className="border-t border-border/70 bg-muted/20 px-3 py-3 lg:px-4">{children}</div>;
}

function OverviewPanel({
  forms,
  posts,
  users,
  cats,
  onJump,
}: {
  forms: FormEntry[];
  posts: Post[];
  users: ParentUser[];
  cats: CommunityCat[];
  onJump: (key: SectionKey) => void;
}) {
  const stats = [
    { label: "小猫总数", value: KITTENS.length, target: "kittens" as const },
    {
      label: "待找家",
      value: KITTENS.filter((k) => k.status === "待找家").length,
      target: "kittens" as const,
    },
    { label: "种猫数量", value: STUDS.length, target: "studs" as const },
    { label: "窝次数", value: LITTERS.length, target: "litters" as const },
    { label: "家长数", value: users.length, target: "parents" as const },
    { label: "家长猫咪", value: cats.length, target: "parents" as const },
    { label: "问卷数", value: forms.length, target: "forms" as const },
    { label: "猫友圈动态", value: posts.length, target: "community" as const },
  ];
  const pendingForms = forms.filter((f) => f.status === "未查看");
  const commentCount = posts.reduce((sum, post) => sum + post.comments.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {stats.map((stat) => (
          <button
            key={stat.label}
            onClick={() => onJump(stat.target)}
            className="pressable rounded-[6px] border border-border/80 bg-card px-3 py-2.5 text-left lg:px-4 lg:py-3"
          >
            <p className="text-[20px] font-bold text-heading lg:text-[24px]">{stat.value}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground lg:text-[13px]">
              {stat.label}
            </p>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.45fr)]">
        <Panel>
          <PanelTitle title="待处理事项" desc="Demo 中仅做入口和状态提示。" />
          <div className="grid gap-0 divide-y divide-border/70 px-4 py-1 text-[12.5px] lg:text-[13.5px]">
            <OverviewTodo
              title="未查看问卷"
              value={`${pendingForms.length} 条`}
              action={() => onJump("forms")}
            />
            <OverviewTodo
              title="评论总数"
              value={`${commentCount} 条`}
              action={() => onJump("comments")}
            />
            <OverviewTodo
              title="已有关联窝次动态"
              value={`${posts.filter((p) => (p.litterIds ?? []).length > 0).length} 条`}
              action={() => onJump("litters")}
            />
          </div>
        </Panel>
        <Panel>
          <PanelTitle title="后台范围提醒" />
          <div className="flex flex-col gap-2 px-4 py-3 text-[13px] leading-relaxed text-card-foreground lg:text-[13.5px]">
            <p>本轮保留视觉 Demo，不接数据库、不做真实鉴权、不做图片上传。</p>
            <p>“喂养体系 / 文章”已从导航和页面中删除。</p>
            <p>窝次、家长详情、猫咪关联仅作为页面结构和操作路径演示。</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function OverviewTodo({
  title,
  value,
  action,
}: {
  title: string;
  value: string;
  action: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="font-semibold text-heading">{title}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{value}</p>
      </div>
      <ActionButton onClick={action} tone="quiet">
        查看
      </ActionButton>
    </div>
  );
}

function KittensPanel({
  onNotice,
  posts,
  users,
}: {
  onNotice: (message: string) => void;
  posts: Post[];
  users: ParentUser[];
}) {
  const [selectedKittenId, setSelectedKittenId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const selectedKitten = KITTENS.find((kitten) => kitten.id === selectedKittenId) ?? null;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
      <Panel className={cn(selectedKitten ? "hidden md:block" : "")}>
        <PanelTitle
          title="在售小猫列表"
          desc="字段重点展示状态、价格、窝次和家长关联；操作仅为 Demo 反馈。"
          action={
            <ActionButton onClick={() => setShowAdd((open) => !open)}>
              {showAdd ? "收起" : "新增小猫"}
            </ActionButton>
          }
        />
        {showAdd && (
          <DemoAddBox>
            <div className="grid gap-2 md:grid-cols-4">
              {["小猫名字", "颜色", "价格", "窝次"].map((placeholder) => (
                <input
                  key={placeholder}
                  placeholder={placeholder}
                  className="h-8 rounded-[6px] border border-border bg-background px-2.5 text-[12px] outline-none focus:border-primary"
                />
              ))}
            </div>
            <div className="mt-2">
              <ActionButton onClick={() => onNotice("已模拟提交新增小猫，刷新后恢复。")}>
                保存 Demo
              </ActionButton>
            </div>
          </DemoAddBox>
        )}
        <TableShell
          columns={["名字", "性别", "颜色", "状态", "价格", "父母", "窝次", "家长", "展示", "操作"]}
        >
          {KITTENS.map((kitten) => (
            <tr key={kitten.id} className="align-top text-card-foreground">
              <td className="px-3 py-2.5 font-semibold text-heading">{kitten.name}</td>
              <td className="px-3 py-2.5">{kitten.gender}</td>
              <td className="px-3 py-2.5">{kitten.color}</td>
              <td className="px-3 py-2.5">
                <StatusBadge tone={statusTone(kitten.status)}>{kitten.status}</StatusBadge>
              </td>
              <td className="px-3 py-2.5">{kitten.price}</td>
              <td className="px-3 py-2.5">
                {kitten.father} × {kitten.mother}
              </td>
              <td className="px-3 py-2.5">{kitten.litter ?? "未分配"}</td>
              <td className="px-3 py-2.5">{kittenParentName(kitten, users)}</td>
              <td className="px-3 py-2.5">
                <StatusBadge tone="creamblue">已展示</StatusBadge>
              </td>
              <td className="px-3 py-2.5">
                <RowActions
                  actions={[
                    ["详情", () => setSelectedKittenId(kitten.id)],
                    ["编辑", () => onNotice(`已打开 ${kitten.name} 的编辑 Demo。`)],
                    ["关联", () => onNotice(`猫咪与家长关联入口位于 ${kitten.name} 详情中。`)],
                  ]}
                />
              </td>
            </tr>
          ))}
        </TableShell>
        <div className="md:hidden">
          {KITTENS.map((kitten) => (
            <MobileRecord
              key={kitten.id}
              title={kitten.name}
              meta={`${kitten.gender} · ${kitten.color} · ${kitten.status}`}
              actions={
                <ActionButton onClick={() => setSelectedKittenId(kitten.id)} tone="quiet">
                  详情
                </ActionButton>
              }
            >
              <span>
                {kitten.price} / {kitten.litter ?? "未分配"}
              </span>
              <span>
                {kitten.father} × {kitten.mother}
              </span>
              <span>{kittenParentName(kitten, users)}</span>
            </MobileRecord>
          ))}
        </div>
      </Panel>

      <KittenDetail
        kitten={selectedKitten}
        users={users}
        posts={posts}
        onBack={() => setSelectedKittenId("")}
      />
    </div>
  );
}

function KittenDetail({
  kitten,
  users,
  posts,
  onBack,
}: {
  kitten: Kitten | null;
  users: ParentUser[];
  posts: Post[];
  onBack: () => void;
}) {
  if (!kitten) {
    return (
      <Panel className="hidden xl:block">
        <PanelTitle title="小猫详情" desc="桌面端选择左侧小猫后查看关联信息。" />
        <p className="px-4 py-6 text-[13px] text-muted-foreground">请选择一只小猫。</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelTitle
        title={`${kitten.name} 详情`}
        desc="展示窝次、父母、家长和猫友圈关联。"
        action={<BackToListButton onClick={onBack} />}
      />
      <div className="px-3 py-2 lg:px-4 lg:py-3">
        <FieldLine
          label="状态"
          value={<StatusBadge tone={statusTone(kitten.status)}>{kitten.status}</StatusBadge>}
        />
        <FieldLine label="性别 / 颜色" value={`${kitten.gender} / ${kitten.color}`} />
        <FieldLine label="价格" value={kitten.price} />
        <FieldLine label="窝次" value={kitten.litter ?? "未分配"} />
        <FieldLine label="父母" value={`${kitten.father} × ${kitten.mother}`} />
        <FieldLine label="家长" value={kittenParentName(kitten, users)} />
        <FieldLine label="关联动态" value={`${linkedPostCount(posts, kitten.id)} 条`} />
      </div>
    </Panel>
  );
}

function StudsPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const grouped = useMemo(() => STUDS, []);
  return (
    <Panel>
      <PanelTitle title="种猫资料" desc="保留用户端当前种猫字段，改为后台密集列表。" />
      <TableShell columns={["名字", "类别", "颜色", "状态", "来源/血线", "简介", "展示", "操作"]}>
        {grouped.map((stud) => (
          <tr key={stud.id} className="text-card-foreground">
            <td className="px-3 py-2.5 font-semibold text-heading">{stud.name}</td>
            <td className="px-3 py-2.5">{stud.category}</td>
            <td className="px-3 py-2.5">{stud.color}</td>
            <td className="px-3 py-2.5">
              <StatusBadge tone="sky">{stud.status}</StatusBadge>
            </td>
            <td className="px-3 py-2.5">{stud.source}</td>
            <td className="max-w-[220px] px-3 py-2.5">{stud.trait}</td>
            <td className="px-3 py-2.5">
              <StatusBadge tone="creamblue">已展示</StatusBadge>
            </td>
            <td className="px-3 py-2.5">
              <RowActions
                actions={[
                  ["查看", () => onNotice(`正在查看种猫 ${stud.name}。`)],
                  ["编辑", () => onNotice(`已打开 ${stud.name} 的编辑 Demo。`)],
                ]}
              />
            </td>
          </tr>
        ))}
      </TableShell>
      <div className="md:hidden">
        {grouped.map((stud) => (
          <StudMobile key={stud.id} stud={stud} onNotice={onNotice} />
        ))}
      </div>
    </Panel>
  );
}

function StudMobile({ stud, onNotice }: { stud: Stud; onNotice: (message: string) => void }) {
  return (
    <MobileRecord
      title={stud.name}
      meta={`${stud.category} · ${stud.color}`}
      actions={
        <ActionButton onClick={() => onNotice(`正在查看 ${stud.name}。`)} tone="quiet">
          查看
        </ActionButton>
      }
    >
      <span>状态：{stud.status}</span>
      <span>来源：{stud.source}</span>
      <span>{stud.trait}</span>
    </MobileRecord>
  );
}

function LittersPanel({
  selected,
  onSelected,
  posts,
  onNotice,
}: {
  selected: LitterName | "";
  onSelected: (name: LitterName | "") => void;
  posts: Post[];
  onNotice: (message: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
      <Panel className={cn(selected ? "hidden md:block" : "")}>
        <PanelTitle
          title="窝次列表"
          desc="新增 Demo 模块：以窝次为中心关联父母、小猫和猫友圈动态。"
          action={
            <ActionButton onClick={() => setShowAdd((open) => !open)}>
              {showAdd ? "收起" : "新增窝次"}
            </ActionButton>
          }
        />
        {showAdd && (
          <DemoAddBox>
            <div className="grid gap-2 md:grid-cols-4">
              {["窝次名称", "出生日期", "父亲", "母亲"].map((placeholder) => (
                <input
                  key={placeholder}
                  placeholder={placeholder}
                  className="h-8 rounded-[6px] border border-border bg-background px-2.5 text-[12px] outline-none focus:border-primary"
                />
              ))}
            </div>
            <div className="mt-2">
              <ActionButton onClick={() => onNotice("已模拟提交新增窝次，刷新后恢复。")}>
                保存 Demo
              </ActionButton>
            </div>
          </DemoAddBox>
        )}
        <TableShell
          columns={[
            "窝次名称",
            "出生日期",
            "父亲",
            "母亲",
            "小猫数量",
            "当前状态",
            "关联小猫",
            "动态",
            "操作",
          ]}
        >
          {LITTERS.map((litter) => {
            const kittens = KITTENS.filter((kitten) => kitten.litter === litter);
            const postCount = posts.filter((post) =>
              (post.litterIds ?? []).includes(litter),
            ).length;
            const first = kittens[0];
            return (
              <tr key={litter} className="text-card-foreground">
                <td className="px-3 py-2.5 font-semibold text-heading">{litter}</td>
                <td className="px-3 py-2.5">{LITTER_META[litter].birthday}</td>
                <td className="px-3 py-2.5">{first?.father ?? "待补充"}</td>
                <td className="px-3 py-2.5">{first?.mother ?? "待补充"}</td>
                <td className="px-3 py-2.5">{kittens.length}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge tone="sunny">{LITTER_META[litter].status}</StatusBadge>
                </td>
                <td className="max-w-[220px] px-3 py-2.5">
                  {kittens.map((kitten) => kitten.name).join("、") || "暂无"}
                </td>
                <td className="px-3 py-2.5">{postCount}</td>
                <td className="px-3 py-2.5">
                  <RowActions
                    actions={[
                      ["详情", () => onSelected(litter)],
                      ["编辑", () => onNotice(`已打开 ${litter} 编辑 Demo。`)],
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </TableShell>
        <div className="md:hidden">
          {LITTERS.map((litter) => {
            const kittens = KITTENS.filter((kitten) => kitten.litter === litter);
            const postCount = posts.filter((post) =>
              (post.litterIds ?? []).includes(litter),
            ).length;
            return (
              <MobileRecord
                key={litter}
                title={litter}
                meta={`${LITTER_META[litter].birthday} · ${LITTER_META[litter].status}`}
                actions={
                  <ActionButton onClick={() => onSelected(litter)} tone="quiet">
                    详情
                  </ActionButton>
                }
              >
                <span>
                  小猫 {kittens.length} / 动态 {postCount}
                </span>
                <span>关联小猫：{kittens.map((kitten) => kitten.name).join("、") || "暂无"}</span>
              </MobileRecord>
            );
          })}
        </div>
      </Panel>

      <LitterDetail selected={selected} posts={posts} onBack={() => onSelected("")} />
    </div>
  );
}

function LitterDetail({
  selected,
  posts,
  onBack,
}: {
  selected: LitterName | "";
  posts: Post[];
  onBack: () => void;
}) {
  if (!selected) {
    return (
      <Panel className="hidden xl:block">
        <PanelTitle title="窝次详情" desc="桌面端选择左侧窝次后查看关联信息。" />
        <p className="px-4 py-6 text-[13px] text-muted-foreground">请选择一个窝次。</p>
      </Panel>
    );
  }

  const selectedKittens = KITTENS.filter((kitten) => kitten.litter === selected);
  const selectedPosts = posts.filter((post) => (post.litterIds ?? []).includes(selected));

  return (
    <Panel>
      <PanelTitle
        title={`${selected} 详情`}
        desc={LITTER_META[selected].note}
        action={<BackToListButton onClick={onBack} />}
      />
      <div className="px-3 py-2 lg:px-4 lg:py-3">
        <FieldLine label="出生日期" value={LITTER_META[selected].birthday} />
        <FieldLine
          label="当前状态"
          value={<StatusBadge tone="sunny">{LITTER_META[selected].status}</StatusBadge>}
        />
        <FieldLine label="父亲" value={selectedKittens[0]?.father ?? "待补充"} />
        <FieldLine label="母亲" value={selectedKittens[0]?.mother ?? "待补充"} />
        <FieldLine
          label="关联小猫"
          value={selectedKittens.map((kitten) => kitten.name).join("、") || "暂无"}
        />
        <FieldLine label="关联动态" value={`${selectedPosts.length} 条`} />
      </div>
    </Panel>
  );
}

function ParentsPanel({
  users,
  cats,
  posts,
  selectedParent,
  onSelectedParent,
  onNotice,
}: {
  users: ParentUser[];
  cats: CommunityCat[];
  posts: Post[];
  selectedParent: ParentUser | null;
  onSelectedParent: (id: string) => void;
  onNotice: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const addParent = () => {
    if (!name.trim() || !code.trim()) {
      onNotice("请输入家长昵称和邀请码。");
      return;
    }
    communityActions.addParent(name.trim(), code.trim());
    setName("");
    setCode("");
    setShowAdd(false);
    onNotice("已新增家长 Demo 记录，刷新后会恢复。");
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
      <Panel className={cn(selectedParent ? "hidden md:block" : "")}>
        <PanelTitle
          title="家长列表"
          desc="猫咪与家长关联入口放在家长详情中，不单独建导航。"
          action={
            <ActionButton onClick={() => setShowAdd((open) => !open)}>
              {showAdd ? "收起" : "添加家长"}
            </ActionButton>
          }
        />
        <TableShell columns={["昵称", "邀请码", "启用状态", "开通时间", "名下猫咪", "操作"]}>
          {users.map((user) => {
            const ownedCats = cats.filter((cat) => cat.ownerId === user.id);
            return (
              <tr key={user.id} className="text-card-foreground">
                <td className="px-3 py-2.5 font-semibold text-heading">{user.name}</td>
                <td className="px-3 py-2.5">{user.inviteCode ?? "未设置"}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge tone={user.activatedAt ? "creamblue" : "muted"}>
                    {user.activatedAt ? "已启用" : "未启用"}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2.5">{user.activatedAt ?? "未开通"}</td>
                <td className="px-3 py-2.5">{ownedCats.length}</td>
                <td className="px-3 py-2.5">
                  <RowActions
                    actions={[
                      ["详情", () => onSelectedParent(user.id)],
                      [
                        user.activatedAt ? "停用" : "启用",
                        () => {
                          communityActions.toggleParentActive(user.id);
                          onNotice(`已模拟${user.activatedAt ? "停用" : "启用"} ${user.name}。`);
                        },
                      ],
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </TableShell>
        <div className="md:hidden">
          {users.map((user) => {
            const ownedCats = cats.filter((cat) => cat.ownerId === user.id);
            return (
              <MobileRecord
                key={user.id}
                title={user.name}
                meta={`${user.inviteCode ?? "未设置邀请码"} · ${user.activatedAt ? "已启用" : "未启用"}`}
                actions={
                  <ActionButton onClick={() => onSelectedParent(user.id)} tone="quiet">
                    详情
                  </ActionButton>
                }
              >
                <span>开通时间：{user.activatedAt ?? "未开通"}</span>
                <span>名下猫咪：{ownedCats.length} 只</span>
              </MobileRecord>
            );
          })}
        </div>
        {showAdd && (
          <DemoAddBox>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="家长昵称"
                className="h-8 rounded-[6px] border border-border bg-background px-2.5 text-[12px] outline-none focus:border-primary"
              />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="邀请码"
                className="h-8 rounded-[6px] border border-border bg-background px-2.5 text-[12px] outline-none focus:border-primary"
              />
              <ActionButton onClick={addParent}>保存 Demo</ActionButton>
            </div>
          </DemoAddBox>
        )}
      </Panel>

      <ParentDetail
        parent={selectedParent}
        cats={cats}
        posts={posts}
        onBack={() => onSelectedParent("")}
      />
    </div>
  );
}

function ParentDetail({
  parent,
  cats,
  posts,
  onBack,
}: {
  parent: ParentUser | null;
  cats: CommunityCat[];
  posts: Post[];
  onBack: () => void;
}) {
  if (!parent) {
    return (
      <Panel className="hidden xl:block">
        <PanelTitle title="家长详情" desc="桌面端选择左侧家长后查看关联信息。" />
        <p className="px-4 py-6 text-[13px] text-muted-foreground">请选择一位家长。</p>
      </Panel>
    );
  }
  const ownedCats = cats.filter((cat) => cat.ownerId === parent.id);
  const relatedPosts = posts.filter(
    (post) =>
      post.authorId === parent.id ||
      post.catIds.some((catId) => ownedCats.some((cat) => cat.id === catId)),
  );

  return (
    <Panel>
      <PanelTitle
        title="家长详情"
        desc="包含基础信息、名下猫咪、相关动态和备注。"
        action={<BackToListButton onClick={onBack} />}
      />
      <div className="px-3 py-2 lg:px-4 lg:py-3">
        <FieldLine label="昵称" value={parent.name} />
        <FieldLine label="邀请码" value={parent.inviteCode ?? "未设置"} />
        <FieldLine
          label="启用状态"
          value={
            <StatusBadge tone={parent.activatedAt ? "creamblue" : "muted"}>
              {parent.activatedAt ? "已启用" : "未启用"}
            </StatusBadge>
          }
        />
        <FieldLine label="开通时间" value={parent.activatedAt ?? "未开通"} />
        <FieldLine label="名下猫咪" value={ownedCats.map((cat) => cat.name).join("、") || "暂无"} />
        <FieldLine
          label="相关动态"
          value={relatedPosts.map((post) => post.content.slice(0, 18)).join("；") || "暂无"}
        />
        <FieldLine label="备注" value={parent.note ?? "暂无备注"} />
      </div>
    </Panel>
  );
}

function FormsPanel({
  forms,
  selected,
  onSelect,
  onStatus,
}: {
  forms: FormEntry[];
  selected: FormEntry;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: FormStatus) => void;
}) {
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const selectForm = (id: string) => {
    onSelect(id);
    setMobileDetailOpen(true);
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(400px,1fr)]">
      <Panel className={cn(mobileDetailOpen ? "hidden md:block" : "")}>
        <PanelTitle title="问卷列表" desc="用户端提交尚未真实入库；此处仍为示例数据。" />
        <TableShell columns={["提交时间", "姓名", "电话", "城市", "预算", "偏好", "状态", "操作"]}>
          {forms.map((form) => (
            <tr key={form.id} className="text-card-foreground">
              <td className="px-3 py-2.5">{form.time}</td>
              <td className="px-3 py-2.5 font-semibold text-heading">{form.name}</td>
              <td className="px-3 py-2.5">{form.phone}</td>
              <td className="px-3 py-2.5">{form.city}</td>
              <td className="px-3 py-2.5">{form.budget}</td>
              <td className="px-3 py-2.5">
                {form.wantGender} / {form.wantColor}
              </td>
              <td className="px-3 py-2.5">
                <StatusBadge tone={formStatusTone(form.status)}>{form.status}</StatusBadge>
              </td>
              <td className="px-3 py-2.5">
                <ActionButton onClick={() => selectForm(form.id)} tone="quiet">
                  详情
                </ActionButton>
              </td>
            </tr>
          ))}
        </TableShell>
        <div className="md:hidden">
          {forms.map((form) => (
            <MobileRecord
              key={form.id}
              title={form.name}
              meta={`${form.city} · ${form.phone} · ${form.status}`}
              actions={
                <ActionButton onClick={() => selectForm(form.id)} tone="quiet">
                  详情
                </ActionButton>
              }
            >
              <span>预算：{form.budget}</span>
              <span>
                偏好：{form.wantGender} / {form.wantColor}
              </span>
              <span>状态：{form.status}</span>
            </MobileRecord>
          ))}
        </div>
      </Panel>

      <Panel className={cn(!mobileDetailOpen ? "hidden md:block" : "")}>
        <PanelTitle
          title="问卷详情"
          desc="处理状态只保存在当前 React 会话。"
          action={<BackToListButton onClick={() => setMobileDetailOpen(false)} />}
        />
        <div className="flex flex-wrap gap-2 border-b border-border/70 px-3 py-2 lg:px-4 lg:py-3">
          {FORM_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => onStatus(selected.id, status)}
              className={cn(
                "pressable h-7 rounded-[7px] px-2.5 text-[11.5px] font-semibold",
                selected.status === status
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground",
              )}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="px-3 py-2 lg:px-4 lg:py-3">
          <FieldLine label="提交时间" value={selected.time} />
          <FieldLine label="姓名" value={selected.name} />
          <FieldLine label="电话" value={selected.phone} />
          <FieldLine label="城市" value={selected.city} />
          <FieldLine label="养猫经验" value={selected.experience} />
          <FieldLine label="原住民" value={selected.residents} />
          <FieldLine label="封窗" value={selected.windowSealed} />
          <FieldLine label="预算" value={selected.budget} />
          <FieldLine label="偏好" value={`${selected.wantGender} / ${selected.wantColor}`} />
          <FieldLine label="科学喂养" value={selected.scientificFeeding} />
        </div>
      </Panel>
    </div>
  );
}

function CommunityPanel({
  posts,
  onNotice,
}: {
  posts: Post[];
  onNotice: (message: string) => void;
}) {
  return (
    <Panel>
      <PanelTitle title="猫友圈动态" desc="保留置顶、隐藏、删除的轻量 Demo 操作。" />
      <TableShell
        columns={["作者", "身份", "分类", "内容", "图片", "点赞", "评论", "状态", "操作"]}
      >
        {posts.map((post) => (
          <tr key={post.id} className="text-card-foreground">
            <td className="px-3 py-2.5 font-semibold text-heading">{post.authorName}</td>
            <td className="px-3 py-2.5">{post.authorRole}</td>
            <td className="px-3 py-2.5">
              <StatusBadge tone="sky">{post.category}</StatusBadge>
            </td>
            <td className="max-w-[260px] px-3 py-2.5">{post.content}</td>
            <td className="px-3 py-2.5">{post.imageCount}</td>
            <td className="px-3 py-2.5">{post.likes}</td>
            <td className="px-3 py-2.5">{post.comments.length}</td>
            <td className="px-3 py-2.5">
              <div className="flex flex-wrap gap-1">
                {post.pinned && <StatusBadge tone="sunny">置顶</StatusBadge>}
                {post.hidden && <StatusBadge tone="wine">隐藏</StatusBadge>}
                {!post.pinned && !post.hidden && <StatusBadge tone="muted">普通</StatusBadge>}
              </div>
            </td>
            <td className="px-3 py-2.5">
              <RowActions
                actions={[
                  [
                    post.pinned ? "取消置顶" : "置顶",
                    () => {
                      communityActions.togglePin(post.id);
                      onNotice("已模拟更新动态置顶状态。");
                    },
                  ],
                  [
                    post.hidden ? "恢复" : "隐藏",
                    () => {
                      communityActions.toggleHidePost(post.id);
                      onNotice("已模拟更新动态隐藏状态。");
                    },
                  ],
                  [
                    "删除",
                    () => {
                      communityActions.deletePost(post.id);
                      onNotice("已模拟删除动态，刷新后恢复。");
                    },
                    "danger",
                  ],
                ]}
              />
            </td>
          </tr>
        ))}
      </TableShell>
      <div className="md:hidden">
        {posts.map((post) => (
          <MobileRecord
            key={post.id}
            title={post.authorName}
            meta={`${post.category} · ${formatTime(post.createdAt)}`}
            actions={
              <ActionButton onClick={() => communityActions.toggleHidePost(post.id)} tone="quiet">
                隐藏
              </ActionButton>
            }
          >
            <span>{post.content}</span>
            <span>
              图片 {post.imageCount} / 爪印 {post.likes} / 评论 {post.comments.length}
            </span>
          </MobileRecord>
        ))}
      </div>
    </Panel>
  );
}

function CommentsPanel({
  posts,
  onNotice,
}: {
  posts: Post[];
  onNotice: (message: string) => void;
}) {
  const allComments = posts.flatMap((post) => post.comments.map((comment) => ({ post, comment })));

  return (
    <Panel>
      <PanelTitle title="评论管理" desc="不做复杂审核流，仅保留隐藏、恢复、删除。" />
      {allComments.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">暂无评论</p>
      ) : (
        <>
          <TableShell columns={["评论人", "身份", "评论内容", "所属动态", "时间", "状态", "操作"]}>
            {allComments.map(({ post, comment }) => (
              <tr key={comment.id} className="text-card-foreground">
                <td className="px-3 py-2.5 font-semibold text-heading">{comment.authorName}</td>
                <td className="px-3 py-2.5">{comment.authorRole}</td>
                <td className="max-w-[260px] px-3 py-2.5">{comment.content}</td>
                <td className="max-w-[180px] px-3 py-2.5">{post.authorName} 的动态</td>
                <td className="px-3 py-2.5">{formatTime(comment.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <StatusBadge tone={comment.hidden ? "wine" : "creamblue"}>
                    {comment.hidden ? "已隐藏" : "显示中"}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2.5">
                  <RowActions
                    actions={[
                      [
                        comment.hidden ? "恢复" : "隐藏",
                        () => {
                          communityActions.toggleHideComment(post.id, comment.id);
                          onNotice("已模拟更新评论显示状态。");
                        },
                      ],
                      [
                        "删除",
                        () => {
                          communityActions.deleteComment(post.id, comment.id);
                          onNotice("已模拟删除评论，刷新后恢复。");
                        },
                        "danger",
                      ],
                    ]}
                  />
                </td>
              </tr>
            ))}
          </TableShell>
          <div className="md:hidden">
            {allComments.map(({ post, comment }) => (
              <MobileRecord
                key={comment.id}
                title={comment.authorName}
                meta={`${comment.authorRole} · ${formatTime(comment.createdAt)}`}
                actions={
                  <ActionButton
                    onClick={() => communityActions.toggleHideComment(post.id, comment.id)}
                    tone="quiet"
                  >
                    隐藏
                  </ActionButton>
                }
              >
                <span>{comment.content}</span>
                <span>所属动态：{post.authorName}</span>
              </MobileRecord>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function CarouselPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const items = [1, 2, 3].map((sort) => ({
    id: `hero-${sort}`,
    sort,
    title: `首页轮播图 ${sort}`,
    status: "展示中",
    link: sort === 1 ? "首页" : sort === 2 ? "在售小猫" : "猫舍环境",
  }));

  return (
    <Panel>
      <PanelTitle
        title="首页轮播"
        desc="图片为占位；本轮不做真实上传和媒体库。"
        action={
          <ActionButton onClick={() => onNotice("已打开新增轮播 Demo。")}>新增轮播</ActionButton>
        }
      />
      <TableShell columns={["排序", "标题", "图片", "关联页面", "状态", "操作"]}>
        {items.map((item) => (
          <tr key={item.id} className="text-card-foreground">
            <td className="px-3 py-2.5">{item.sort}</td>
            <td className="px-3 py-2.5 font-semibold text-heading">{item.title}</td>
            <td className="px-3 py-2.5">
              <div className="w-24">
                <Placeholder
                  label="轮播占位"
                  ratio="aspect-[4/3]"
                  rounded="rounded-[8px]"
                  compact
                />
              </div>
            </td>
            <td className="px-3 py-2.5">{item.link}</td>
            <td className="px-3 py-2.5">
              <StatusBadge tone="creamblue">{item.status}</StatusBadge>
            </td>
            <td className="px-3 py-2.5">
              <RowActions
                actions={[
                  ["编辑", () => onNotice("已打开轮播编辑 Demo。")],
                  ["停用", () => onNotice("已模拟停用轮播。")],
                ]}
              />
            </td>
          </tr>
        ))}
      </TableShell>
      <div className="md:hidden">
        {items.map((item) => (
          <MobileRecord key={item.id} title={item.title} meta={`排序 ${item.sort} · ${item.link}`}>
            <span>状态：{item.status}</span>
          </MobileRecord>
        ))}
      </div>
    </Panel>
  );
}

function EnvironmentPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const rows = ["公区", "猫房", "院子"].map((name, index) => ({
    name,
    sort: index + 1,
    status: "展示中",
    desc: index === 0 ? "600 余平室内空间，别墅散养。" : "示例图文区域，待补充真实资料。",
  }));

  return (
    <Panel>
      <PanelTitle
        title="猫舍环境图文"
        desc="维护环境页图文结构，不做真实图片上传。"
        action={
          <ActionButton onClick={() => onNotice("已打开新增环境图文 Demo。")}>
            新增图文
          </ActionButton>
        }
      />
      <TableShell columns={["排序", "板块", "说明", "图片", "状态", "操作"]}>
        {rows.map((row) => (
          <tr key={row.name} className="text-card-foreground">
            <td className="px-3 py-2.5">{row.sort}</td>
            <td className="px-3 py-2.5 font-semibold text-heading">{row.name}</td>
            <td className="max-w-[360px] px-3 py-2.5">{row.desc}</td>
            <td className="px-3 py-2.5">
              <div className="w-24">
                <Placeholder
                  label="环境占位"
                  ratio="aspect-[4/3]"
                  rounded="rounded-[8px]"
                  compact
                />
              </div>
            </td>
            <td className="px-3 py-2.5">
              <StatusBadge tone="creamblue">{row.status}</StatusBadge>
            </td>
            <td className="px-3 py-2.5">
              <RowActions
                actions={[
                  ["编辑", () => onNotice(`已打开 ${row.name} 编辑 Demo。`)],
                  ["排序", () => onNotice("已模拟排序操作。")],
                ]}
              />
            </td>
          </tr>
        ))}
      </TableShell>
      <div className="md:hidden">
        {rows.map((row) => (
          <MobileRecord key={row.name} title={row.name} meta={`排序 ${row.sort} · ${row.status}`}>
            <span>{row.desc}</span>
          </MobileRecord>
        ))}
      </div>
    </Panel>
  );
}

function AftercarePanel({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <Panel>
      <PanelTitle title="售后说明" desc="使用更接近后台编辑的分组表单，不接持久化。" />
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-heading">售后说明摘要</span>
          <textarea
            rows={8}
            defaultValue="种猫全部做遗传病检查，结果 all n/n。科学繁育，根据母猫状态每窝间隔 8–16 个月。窝次清晰透明。所有小猫均为猫舍自己繁育。具体内容以《合同模板 2026》为准。"
            className="w-full resize-none rounded-[8px] border border-border bg-background px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-col gap-2">
          {["遗传病筛查", "疫苗与体检", "绝育后接猫", "合同说明"].map((item) => (
            <div key={item} className="rounded-[8px] border border-border bg-background px-3 py-2">
              <p className="text-[12.5px] font-semibold text-heading">{item}</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">条目文案 Demo</p>
            </div>
          ))}
          <ActionButton onClick={() => onNotice("已模拟保存售后说明。")}>保存 Demo</ActionButton>
        </div>
      </div>
    </Panel>
  );
}

function ContactPanel({ onNotice }: { onNotice: (message: string) => void }) {
  return (
    <Panel>
      <PanelTitle title="联系方式" desc="与用户端联系方式展示共用当前静态数据源。" />
      <TableShell columns={["渠道", "账号 / 链接", "展示状态", "操作"]}>
        {SOCIALS.map((social) => (
          <tr key={social.label} className="text-card-foreground">
            <td className="px-3 py-2.5 font-semibold text-heading">{social.label}</td>
            <td className="px-3 py-2.5">
              <input
                defaultValue={social.value}
                className="h-8 w-full rounded-[8px] border border-border bg-background px-2.5 text-[12.5px] outline-none focus:border-primary"
              />
            </td>
            <td className="px-3 py-2.5">
              <StatusBadge tone="creamblue">显示中</StatusBadge>
            </td>
            <td className="px-3 py-2.5">
              <RowActions
                actions={[
                  ["保存", () => onNotice(`已模拟保存 ${social.label}。`)],
                  ["隐藏", () => onNotice(`已模拟隐藏 ${social.label}。`)],
                ]}
              />
            </td>
          </tr>
        ))}
      </TableShell>
      <div className="md:hidden">
        {SOCIALS.map((social) => (
          <MobileRecord key={social.label} title={social.label} meta={social.value}>
            <span>展示状态：显示中</span>
          </MobileRecord>
        ))}
      </div>
    </Panel>
  );
}

type RowAction = [string, () => void, ("default" | "quiet" | "danger")?];

function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map(([label, action, tone]) => (
        <ActionButton key={label} onClick={action} tone={tone ?? "quiet"}>
          {tone === "danger" && <TrashIcon className="mr-1 size-3" />}
          {label}
        </ActionButton>
      ))}
    </div>
  );
}

function kittenParentName(kitten: Kitten, users: ParentUser[]) {
  if (kitten.status !== "已有家") return "未关联";
  return users[0]?.name ?? "已有关联家长";
}

function linkedPostCount(posts: Post[], kittenId: string) {
  return posts.filter((post) => post.catIds.includes(kittenId)).length;
}
