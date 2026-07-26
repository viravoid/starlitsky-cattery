import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { AboutContentPanel } from "@/components/admin/AboutContentPanel";
import { ContactContentPanel } from "@/components/admin/ContactContentPanel";
import { EnvironmentContentPanel } from "@/components/admin/EnvironmentContentPanel";
import { FeedingContentPanel } from "@/components/admin/FeedingContentPanel";
import { HomepageContentPanel } from "@/components/admin/HomepageContentPanel";
import { KittenLitterManagementPanel } from "@/components/admin/KittenLitterManagementPanel";
import { StudManagementPanel } from "@/components/admin/StudManagementPanel";
import { PhilosophyContentPanel } from "@/components/admin/PhilosophyContentPanel";
import { BreedingPlanContentPanel } from "@/components/admin/BreedingPlanContentPanel";
import { QuestionnaireContentPanel } from "@/components/admin/QuestionnaireContentPanel";
import { AftercareContentPanel } from "@/components/admin/AftercareContentPanel";
import { ProcessContentPanel } from "@/components/admin/ProcessContentPanel";
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
  QUESTIONNAIRE_SUBMISSION_STATUSES,
  KEEPER_YUEQI,
  catteryActions,
  questionnaireSubmissionStatusTone,
  selectKittenRecords,
  selectLitterRecords,
  selectQuestionnaireSubmissions,
  useCattery,
  type QuestionnaireSubmission,
  type QuestionnaireSubmissionStatus,
} from "@/lib/cattery-store";
import {
  useCommunity,
  formatTime,
  type ParentUser,
  type Post,
  type CommunityCat,
} from "@/lib/community-store";
import {
  QUESTIONNAIRE_FIELD_GROUPS,
  getQuestionnaireAnswerDisplayValue,
} from "@/lib/questionnaire-submissions";

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
  | "parents"
  | "forms"
  | "community"
  | "comments"
  | "home"
  | "about"
  | "philosophy"
  | "environment"
  | "feeding"
  | "process"
  | "breedingPlan"
  | "aftercare"
  | "questionnairePage"
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
      { key: "kittens", label: "小猫", Icon: CatIcon },
      { key: "studs", label: "种猫", Icon: PawIcon },
    ],
  },
  {
    title: "问卷管理",
    items: [{ key: "forms", label: "问卷提交", Icon: PaperIcon }],
  },
  {
    title: "猫友圈管理",
    items: [
      { key: "community", label: "动态管理", Icon: ChatBubbleIcon },
      { key: "comments", label: "评论管理", Icon: ChatBubbleIcon },
      { key: "parents", label: "家长列表", Icon: UserIcon },
    ],
  },
  {
    title: "站点内容",
    items: [
      { key: "home", label: "首页", Icon: StarIcon },
      { key: "about", label: "猫舍介绍", Icon: HouseIcon },
      { key: "philosophy", label: "繁育理念", Icon: PawIcon },
      { key: "environment", label: "猫舍环境", Icon: HouseIcon },
      { key: "feeding", label: "喂养体系", Icon: PaperIcon },
      { key: "process", label: "价格与接猫流程", Icon: RouteIcon },
      { key: "breedingPlan", label: "繁育计划", Icon: CatIcon },
      { key: "aftercare", label: "售后保障", Icon: ShieldIcon },
      { key: "questionnairePage", label: "选猫问卷页面", Icon: PaperIcon },
      { key: "contact", label: "联系方式", Icon: RouteIcon },
    ],
  },
];

const SECTION_COPY: Record<SectionKey, { title: string; desc: string }> = {
  overview: {
    title: "数据概览",
    desc: "用最少信息判断当前 browser-local Demo 的内容状态和待处理事项。",
  },
  kittens: {
    title: "小猫",
    desc: "统一管理小猫与窝次，保存后会同步写入本地 cattery-store。",
  },
  studs: {
    title: "种猫",
    desc: "管理种猫资料、类别、状态和用户端展示信息。",
  },
  parents: {
    title: "家长列表",
    desc: "猫友圈家长身份、邀请码、名下猫咪和相关动态。",
  },
  forms: {
    title: "问卷提交",
    desc: "查看真实保存到 browser-local cattery-store 的选猫问卷，并管理处理状态与后台备注。",
  },
  community: {
    title: "动态管理",
    desc: "管理猫友圈动态的置顶、隐藏和删除；结果会写入当前浏览器本地并同步到用户端。",
  },
  comments: {
    title: "评论管理",
    desc: "查看评论并做隐藏、恢复和删除；结果会写入当前浏览器本地并同步到用户端。",
  },
  home: {
    title: "首页",
    desc: "管理用户端首页的表面框架、轮播、分组入口和预览文案。",
  },
  about: {
    title: "猫舍介绍",
    desc: "管理 /about 页面正文内容；首页上的入口文案归首页管理。",
  },
  philosophy: {
    title: "繁育理念",
    desc: "管理 /philosophy 页面正文内容；不影响首页入口文案。",
  },
  environment: {
    title: "猫舍环境",
    desc: "管理 /environment 页面正文内容、图片和说明占位。",
  },
  feeding: {
    title: "喂养体系",
    desc: "管理 /feeding 单页内容，不恢复文章列表或发布系统。",
  },
  process: {
    title: "价格与接猫流程",
    desc: "管理 /process 页面价格、繁育权、老家长福利、流程和礼包内容。",
  },
  breedingPlan: {
    title: "繁育计划",
    desc: "管理 /breeding-plan 页面计划周期、分组、繁育组合、预计时间和可能花色。",
  },
  aftercare: {
    title: "售后保障",
    desc: "管理 /aftercare 页面承诺、去新家前项目和底部合同提示。",
  },
  questionnairePage: {
    title: "选猫问卷页面",
    desc: "管理 /questionnaire 页面标题、说明和提示文案；问卷答案在问卷提交中查看。",
  },
  contact: {
    title: "联系方式",
    desc: "管理 /contact 页面的介绍、联系方式账号和底部提示；页面标题与视觉结构固定。",
  },
};

const ADMIN_PARENT_CONTEXT = {
  role: "keeper" as const,
  currentUserId: KEEPER_YUEQI,
};

function applyAdminCommunityMutation(
  mutate: () => boolean,
  onNotice: (message: string) => void,
  successMessage: string,
  failureMessage: string,
) {
  const ok = mutate();
  onNotice(ok ? successMessage : failureMessage);
}

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
            当前为 browser-local 功能 Demo；此入口仅用于展示后台界面，暂不包含真实登录。
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
  const [homeDirty, setHomeDirty] = useState(false);
  const [aboutDirty, setAboutDirty] = useState(false);
  const [philosophyDirty, setPhilosophyDirty] = useState(false);
  const [environmentDirty, setEnvironmentDirty] = useState(false);
  const [feedingDirty, setFeedingDirty] = useState(false);
  const [processDirty, setProcessDirty] = useState(false);
  const [breedingPlanDirty, setBreedingPlanDirty] = useState(false);
  const [aftercareDirty, setAftercareDirty] = useState(false);
  const [questionnaireDirty, setQuestionnaireDirty] = useState(false);
  const [contactDirty, setContactDirty] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");

  const posts = useCommunity((s) => s.posts);
  const users = useCommunity((s) => s.users);
  const cats = useCommunity((s) => s.cats);
  const catteryState = useCattery((snapshot) => snapshot);
  const kittenRecords = selectKittenRecords(catteryState, "all");
  const litterRecords = selectLitterRecords(catteryState, "all");
  const forms = selectQuestionnaireSubmissions(catteryState);
  const studCount = catteryState.cats.filter((cat) => cat.kind === "stud").length;
  const parentUsers = users.filter((u) => u.role === "parent");
  const selectedParent = parentUsers.find((u) => u.id === selectedParentId) ?? null;
  const selectedForm = forms.find((f) => f.id === selectedFormId) ?? forms[0] ?? null;

  useEffect(() => {
    if (forms.length === 0) {
      if (selectedFormId) setSelectedFormId("");
      return;
    }
    if (!forms.some((form) => form.id === selectedFormId)) {
      setSelectedFormId(forms[0]?.id ?? "");
    }
  }, [forms, selectedFormId]);
  const activeDirty =
    section === "home"
      ? homeDirty
      : section === "about"
        ? aboutDirty
        : section === "philosophy"
          ? philosophyDirty
          : section === "environment"
            ? environmentDirty
            : section === "feeding"
              ? feedingDirty
              : section === "process"
                ? processDirty
                : section === "breedingPlan"
                  ? breedingPlanDirty
                  : section === "aftercare"
                    ? aftercareDirty
                    : section === "questionnairePage"
                      ? questionnaireDirty
                      : section === "contact"
                        ? contactDirty
                        : false;
  const activeDirtyLabel =
    section === "home"
      ? "首页"
      : section === "about"
        ? "猫舍介绍"
        : section === "philosophy"
          ? "繁育理念"
          : section === "environment"
            ? "猫舍环境"
            : section === "feeding"
              ? "喂养体系"
              : section === "process"
                ? "价格与接猫流程"
                : section === "breedingPlan"
                  ? "繁育计划"
                  : section === "aftercare"
                    ? "售后保障"
                    : section === "questionnairePage"
                      ? "选猫问卷页面"
                      : section === "contact"
                        ? "联系方式"
                        : "";

  const selectSection = (key: SectionKey) => {
    if (
      key !== section &&
      activeDirty &&
      !window.confirm(`${activeDirtyLabel}存在未保存修改，确定要离开当前模块吗？`)
    ) {
      return;
    }
    setSection(key);
    setMobileNavOpen(false);
    setNotice("");
    setSelectedParentId("");
    if (section === "home" && key !== "home") setHomeDirty(false);
    if (section === "about" && key !== "about") setAboutDirty(false);
    if (section === "philosophy" && key !== "philosophy") setPhilosophyDirty(false);
    if (section === "environment" && key !== "environment") setEnvironmentDirty(false);
    if (section === "feeding" && key !== "feeding") setFeedingDirty(false);
    if (section === "process" && key !== "process") setProcessDirty(false);
    if (section === "breedingPlan" && key !== "breedingPlan") setBreedingPlanDirty(false);
    if (section === "aftercare" && key !== "aftercare") setAftercareDirty(false);
    if (section === "questionnairePage" && key !== "questionnairePage") {
      setQuestionnaireDirty(false);
    }
    if (section === "contact" && key !== "contact") setContactDirty(false);
  };

  const handleLogout = () => {
    if (activeDirty && !window.confirm(`${activeDirtyLabel}存在未保存修改，确定要退出后台吗？`)) {
      return;
    }
    setHomeDirty(false);
    setAboutDirty(false);
    setPhilosophyDirty(false);
    setEnvironmentDirty(false);
    setFeedingDirty(false);
    setProcessDirty(false);
    setBreedingPlanDirty(false);
    setAftercareDirty(false);
    setQuestionnaireDirty(false);
    setContactDirty(false);
    onLogout();
  };

  const handleHomeDirtyChange = useCallback((dirty: boolean) => {
    setHomeDirty(dirty);
  }, []);

  const handleAboutDirtyChange = useCallback((dirty: boolean) => {
    setAboutDirty(dirty);
  }, []);

  const handlePhilosophyDirtyChange = useCallback((dirty: boolean) => {
    setPhilosophyDirty(dirty);
  }, []);

  const handleEnvironmentDirtyChange = useCallback((dirty: boolean) => {
    setEnvironmentDirty(dirty);
  }, []);

  const handleFeedingDirtyChange = useCallback((dirty: boolean) => {
    setFeedingDirty(dirty);
  }, []);

  const handleProcessDirtyChange = useCallback((dirty: boolean) => {
    setProcessDirty(dirty);
  }, []);

  const handleBreedingPlanDirtyChange = useCallback((dirty: boolean) => {
    setBreedingPlanDirty(dirty);
  }, []);

  const handleAftercareDirtyChange = useCallback((dirty: boolean) => {
    setAftercareDirty(dirty);
  }, []);

  const handleQuestionnaireDirtyChange = useCallback((dirty: boolean) => {
    setQuestionnaireDirty(dirty);
  }, []);

  const handleContactDirtyChange = useCallback((dirty: boolean) => {
    setContactDirty(dirty);
  }, []);

  const setFormStatus = (id: string, status: QuestionnaireSubmissionStatus) => {
    if (!catteryActions.updateQuestionnaireSubmissionStatus(id, status)) return;
    setNotice(`已将问卷状态更新为「${status}」。`);
  };

  const setFormAdminNote = (id: string, adminNote: string) => {
    catteryActions.updateQuestionnaireSubmissionAdminNote(id, adminNote);
  };

  const activeCopy = SECTION_COPY[section];

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-border bg-card lg:flex">
        <SidebarHeader onLogout={handleLogout} />
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
              kittenRecords={kittenRecords}
              litterRecords={litterRecords}
              studCount={studCount}
              onJump={selectSection}
            />
          )}
          {section === "kittens" && <KittenLitterManagementPanel onNotice={setNotice} />}
          {section === "studs" && <StudManagementPanel onNotice={setNotice} />}
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
          {section === "forms" && (
            <FormsPanel
              forms={forms}
              selected={selectedForm}
              onSelect={setSelectedFormId}
              onStatus={setFormStatus}
              onAdminNote={setFormAdminNote}
            />
          )}
          {section === "community" && <CommunityPanel posts={posts} onNotice={setNotice} />}
          {section === "comments" && <CommentsPanel posts={posts} onNotice={setNotice} />}
          {section === "home" && (
            <HomepageContentPanel onNotice={setNotice} onDirtyChange={handleHomeDirtyChange} />
          )}
          {section === "about" && (
            <AboutContentPanel onNotice={setNotice} onDirtyChange={handleAboutDirtyChange} />
          )}
          {section === "philosophy" && (
            <PhilosophyContentPanel
              onNotice={setNotice}
              onDirtyChange={handlePhilosophyDirtyChange}
            />
          )}
          {section === "environment" && (
            <EnvironmentContentPanel
              onNotice={setNotice}
              onDirtyChange={handleEnvironmentDirtyChange}
            />
          )}
          {section === "feeding" && (
            <FeedingContentPanel onNotice={setNotice} onDirtyChange={handleFeedingDirtyChange} />
          )}
          {section === "process" && (
            <ProcessContentPanel onNotice={setNotice} onDirtyChange={handleProcessDirtyChange} />
          )}
          {section === "breedingPlan" && (
            <BreedingPlanContentPanel
              onNotice={setNotice}
              onDirtyChange={handleBreedingPlanDirtyChange}
            />
          )}
          {section === "aftercare" && (
            <AftercareContentPanel
              onNotice={setNotice}
              onDirtyChange={handleAftercareDirtyChange}
            />
          )}
          {section === "questionnairePage" && (
            <QuestionnaireContentPanel
              onNotice={setNotice}
              onDirtyChange={handleQuestionnaireDirtyChange}
            />
          )}
          {section === "contact" && (
            <ContactContentPanel onNotice={setNotice} onDirtyChange={handleContactDirtyChange} />
          )}
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
      当前为 browser-local 功能 Demo，数据保存在当前浏览器本地；暂无真实登录、云端同步和数据库。
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
  kittenRecords,
  litterRecords,
  studCount,
  onJump,
}: {
  forms: QuestionnaireSubmission[];
  posts: Post[];
  users: ParentUser[];
  cats: CommunityCat[];
  kittenRecords: ReturnType<typeof selectKittenRecords>;
  litterRecords: ReturnType<typeof selectLitterRecords>;
  studCount: number;
  onJump: (key: SectionKey) => void;
}) {
  const stats = [
    { label: "小猫总数", value: kittenRecords.length, target: "kittens" as const },
    {
      label: "待找家",
      value: kittenRecords.filter((kitten) => kitten.status === "待找家").length,
      target: "kittens" as const,
    },
    { label: "种猫数量", value: studCount, target: "studs" as const },
    { label: "窝次数", value: litterRecords.length, target: "kittens" as const },
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
          <PanelTitle
            title="待处理事项"
            desc="汇总当前 browser-local 数据，便于快速进入对应模块。"
          />
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
              action={() => onJump("kittens")}
            />
          </div>
        </Panel>
        <Panel>
          <PanelTitle title="后台范围提醒" />
          <div className="flex flex-col gap-2 px-4 py-3 text-[13px] leading-relaxed text-card-foreground lg:text-[13.5px]">
            <p>
              当前是 browser-local 功能 Demo；数据只保存在当前浏览器，本轮不接数据库和云端同步。
            </p>
            <p>后台登录入口仅用于展示管理界面，不代表真实登录或正式管理员权限系统。</p>
            <p>图片与页面内容会写入当前浏览器本地，刷新后仍保留，但不会同步到其他设备。</p>
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
  const [draft, setDraft] = useState(() => createParentDraft());
  const [showAdd, setShowAdd] = useState(false);

  const addParent = () => {
    const name = draft.name.trim();
    const inviteCode = draft.inviteCode.trim();
    if (!name || !inviteCode) {
      onNotice("请填写家长昵称和邀请码。");
      return;
    }
    if (users.some((user) => (user.inviteCode ?? "").trim() === inviteCode)) {
      onNotice("邀请码已存在，请改成未使用的邀请码。");
      return;
    }
    const parentId = catteryActions.createParent(
      {
        name,
        inviteCode,
        note: draft.note,
      },
      ADMIN_PARENT_CONTEXT,
    );
    if (!parentId) {
      onNotice("新增家长失败，请检查输入后重试。");
      return;
    }
    setDraft(createParentDraft());
    setShowAdd(false);
    onSelectedParent(parentId);
    onNotice("已新增家长，并写入统一 cattery-store。");
  };

  const toggleParentActive = (user: ParentUser) => {
    const actionLabel = getParentToggleLabel(user);
    const ok = catteryActions.toggleParentActive(user.id, ADMIN_PARENT_CONTEXT);
    if (!ok) {
      onNotice("家长状态更新失败，请重试。");
      return;
    }
    onNotice(`已${actionLabel} ${user.name}，现有关联已保留。`);
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)]">
      <Panel className={cn(selectedParent ? "hidden md:block" : "")}>
        <PanelTitle
          title="家长列表"
          desc="直接管理统一 cattery-store 中的家长资料；家长与猫咪仍通过 ownerId 保持关联。"
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
                  <StatusBadge
                    tone={user.activatedAt && user.active !== false ? "creamblue" : "muted"}
                  >
                    {user.activatedAt ? (user.active === false ? "已停用" : "已启用") : "未开通"}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2.5">{user.activatedAt ?? "未开通"}</td>
                <td className="px-3 py-2.5">{ownedCats.length}</td>
                <td className="px-3 py-2.5">
                  <RowActions
                    actions={[
                      ["详情", () => onSelectedParent(user.id)],
                      [
                        user.activatedAt && user.active !== false ? "停用" : "启用",
                        () => toggleParentActive(user),
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
                meta={`${user.inviteCode ?? "未设置邀请码"} · ${user.activatedAt ? (user.active === false ? "已停用" : "已启用") : "未开通"}`}
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
            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="家长昵称"
                className="h-8 rounded-[6px] border border-border bg-background px-2.5 text-[12px] outline-none focus:border-primary"
              />
              <input
                value={draft.inviteCode}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, inviteCode: event.target.value }))
                }
                placeholder="邀请码"
                className="h-8 rounded-[6px] border border-border bg-background px-2.5 text-[12px] outline-none focus:border-primary"
              />
              <textarea
                value={draft.note}
                onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                rows={3}
                placeholder="后台备注（可选）"
                className="rounded-[6px] border border-border bg-background px-2.5 py-2 text-[12px] outline-none focus:border-primary md:col-span-2"
              />
              <div className="flex justify-end md:col-span-2">
                <ActionButton onClick={addParent}>保存家长</ActionButton>
              </div>
            </div>
          </DemoAddBox>
        )}
      </Panel>

      <ParentDetail
        parent={selectedParent}
        users={users}
        cats={cats}
        posts={posts}
        onNotice={onNotice}
        onToggleActive={toggleParentActive}
        onBack={() => onSelectedParent("")}
      />
    </div>
  );
}

function ParentDetail({
  parent,
  users,
  cats,
  posts,
  onNotice,
  onToggleActive,
  onBack,
}: {
  parent: ParentUser | null;
  users: ParentUser[];
  cats: CommunityCat[];
  posts: Post[];
  onNotice: (message: string) => void;
  onToggleActive: (user: ParentUser) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(() => createParentDraft(parent));

  useEffect(() => {
    setDraft(createParentDraft(parent));
  }, [parent]);

  if (!parent) {
    return (
      <Panel className="hidden xl:block">
        <PanelTitle title="家长详情" desc="桌面端选择左侧家长后查看并编辑资料。" />
        <p className="px-4 py-6 text-[13px] text-muted-foreground">请选择一位家长。</p>
      </Panel>
    );
  }

  const ownedCats = cats.filter((cat) => cat.ownerId === parent.id);
  const ownedCatIds = new Set(ownedCats.map((cat) => cat.id));
  const authoredPosts = posts.filter((post) => post.authorId === parent.id);
  const linkedCatPosts = posts.filter(
    (post) => post.authorId !== parent.id && post.catIds.some((catId) => ownedCatIds.has(catId)),
  );
  const status = getParentActivationStatus(parent);

  const saveParent = () => {
    const name = draft.name.trim();
    const inviteCode = draft.inviteCode.trim();
    if (!name || !inviteCode) {
      onNotice("请填写家长昵称和邀请码。");
      return;
    }
    if (
      users.some((user) => user.id !== parent.id && (user.inviteCode ?? "").trim() === inviteCode)
    ) {
      onNotice("邀请码已存在，请改成未使用的邀请码。");
      return;
    }
    const ok = catteryActions.updateParent(
      parent.id,
      {
        name,
        inviteCode,
        note: draft.note,
      },
      ADMIN_PARENT_CONTEXT,
    );
    if (!ok) {
      onNotice("保存家长资料失败，请重试。");
      return;
    }
    onNotice("已保存家长资料，列表、详情和关联显示已同步。");
  };

  return (
    <Panel>
      <PanelTitle
        title="家长详情"
        desc="支持直接编辑昵称、邀请码和后台备注；不会改动原有家长 ID。"
        action={<BackToListButton onClick={onBack} />}
      />
      <div className="px-3 py-2 lg:px-4 lg:py-3">
        <FieldLine label="昵称" value={parent.name} />
        <FieldLine label="邀请码" value={parent.inviteCode ?? "未设置"} />
        <FieldLine
          label="启用状态"
          value={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        />
        <FieldLine label="开通时间" value={parent.activatedAt ?? "未开通"} />
        <FieldLine label="后台备注" value={parent.note ?? "暂无备注"} />

        <div className="mt-4 grid gap-2">
          <input
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="家长昵称"
            className="h-9 rounded-[8px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          />
          <input
            value={draft.inviteCode}
            onChange={(event) => setDraft((prev) => ({ ...prev, inviteCode: event.target.value }))}
            placeholder="邀请码"
            className="h-9 rounded-[8px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
          />
          <textarea
            value={draft.note}
            onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
            rows={3}
            placeholder="后台备注（可选）"
            className="rounded-[8px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={saveParent}>保存资料</ActionButton>
            <ActionButton onClick={() => onToggleActive(parent)} tone="quiet">
              {getParentToggleLabel(parent)}家长
            </ActionButton>
          </div>
        </div>

        <ParentDetailList
          title={`名下猫咪 · ${ownedCats.length}`}
          empty="暂无名下猫咪"
          items={ownedCats.map((cat) => `${cat.name}${cat.gender ? ` · ${cat.gender}` : ""}`)}
        />
        <ParentDetailList
          title={`该家长发布的动态 · ${authoredPosts.length}`}
          empty="暂无家长发布动态"
          items={authoredPosts.map(
            (post) => `${post.category} · ${post.content.slice(0, 28) || "未填写内容"}`,
          )}
        />
        <ParentDetailList
          title={`与名下猫咪关联的动态 · ${linkedCatPosts.length}`}
          empty="暂无猫咪关联动态"
          items={linkedCatPosts.map(
            (post) => `${post.authorName} · ${post.content.slice(0, 28) || "未填写内容"}`,
          )}
        />
      </div>
    </Panel>
  );
}

function ParentDetailList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="mt-4 rounded-[10px] border border-border/70 bg-background px-3 py-3">
      <p className="text-[12px] font-semibold text-heading">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2 text-[12px] text-card-foreground">
          {items.map((item) => (
            <span key={`${title}-${item}`}>{item}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function getParentActivationStatus(user: ParentUser) {
  if (!user.activatedAt) {
    return { label: "未开通", tone: "muted" as const };
  }
  if (user.active === false) {
    return { label: "已停用", tone: "muted" as const };
  }
  return { label: "已启用", tone: "creamblue" as const };
}

function getParentToggleLabel(user: ParentUser) {
  return user.activatedAt && user.active !== false ? "停用" : "启用";
}

function formatSubmittedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function createParentDraft(parent?: ParentUser | null) {
  return {
    name: parent?.name ?? "",
    inviteCode: parent?.inviteCode ?? "",
    note: parent?.note ?? "",
  };
}

function FormsPanel({
  forms,
  selected,
  onSelect,
  onStatus,
  onAdminNote,
}: {
  forms: QuestionnaireSubmission[];
  selected: QuestionnaireSubmission | null;
  onSelect: (id: string) => void;
  onStatus: (id: string, status: QuestionnaireSubmissionStatus) => void;
  onAdminNote: (id: string, adminNote: string) => void;
}) {
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuestionnaireSubmissionStatus>("all");
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    setNoteDraft(selected?.adminNote ?? "");
  }, [selected?.adminNote, selected?.id]);

  const filteredForms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return forms.filter((form) => {
      if (statusFilter !== "all" && form.status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      const haystack = [form.answers.name.value, form.answers.phone.value, form.answers.city.value]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [forms, query, statusFilter]);

  const selectForm = (id: string) => {
    onSelect(id);
    setMobileDetailOpen(true);
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(400px,1fr)]">
      <Panel className={cn(mobileDetailOpen ? "hidden md:block" : "")}>
        <PanelTitle
          title="问卷列表"
          desc="真实读取并保存到当前浏览器的 cattery-store；默认按最新提交在前。"
        />
        <div className="grid gap-2 border-b border-border/70 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_180px] lg:px-4">
          <label className="grid gap-1">
            <span className="text-[11.5px] font-medium text-muted-foreground">
              按姓名 / 电话 / 城市搜索
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入姓名、电话或城市"
              className="h-9 rounded-[7px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11.5px] font-medium text-muted-foreground">处理状态</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | QuestionnaireSubmissionStatus)
              }
              className="h-9 rounded-[7px] border border-border bg-background px-3 text-[13px] outline-none focus:border-primary"
            >
              <option value="all">全部状态</option>
              {QUESTIONNAIRE_SUBMISSION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
        {filteredForms.length > 0 ? (
          <TableShell
            columns={["提交时间", "姓名", "电话", "城市", "预算", "偏好", "状态", "操作"]}
          >
            {filteredForms.map((form) => (
              <tr key={form.id} className="text-card-foreground">
                <td className="px-3 py-2.5">{formatSubmittedAt(form.submittedAt)}</td>
                <td className="px-3 py-2.5 font-semibold text-heading">
                  {form.answers.name.value}
                </td>
                <td className="px-3 py-2.5">{form.answers.phone.value}</td>
                <td className="px-3 py-2.5">{form.answers.city.value}</td>
                <td className="px-3 py-2.5">
                  {getQuestionnaireAnswerDisplayValue(form.answers.budget)}
                </td>
                <td className="px-3 py-2.5">
                  {getQuestionnaireAnswerDisplayValue(form.answers.wantGender)} /{" "}
                  {getQuestionnaireAnswerDisplayValue(form.answers.wantColor)}
                </td>
                <td className="px-3 py-2.5">
                  <StatusBadge tone={questionnaireSubmissionStatusTone(form.status)}>
                    {form.status}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2.5">
                  <ActionButton onClick={() => selectForm(form.id)} tone="quiet">
                    详情
                  </ActionButton>
                </td>
              </tr>
            ))}
          </TableShell>
        ) : (
          <div className="px-4 py-8 text-[13px] text-muted-foreground">
            {forms.length === 0 ? "当前还没有问卷提交。" : "没有符合当前搜索或筛选条件的问卷。"}
          </div>
        )}
        <div className="md:hidden">
          {filteredForms.map((form) => (
            <MobileRecord
              key={form.id}
              title={form.answers.name.value || "未填写姓名"}
              meta={`${getQuestionnaireAnswerDisplayValue(form.answers.city)} · ${form.answers.phone.value} · ${form.status}`}
              actions={
                <ActionButton onClick={() => selectForm(form.id)} tone="quiet">
                  详情
                </ActionButton>
              }
            >
              <span>提交时间：{formatSubmittedAt(form.submittedAt)}</span>
              <span>预算：{getQuestionnaireAnswerDisplayValue(form.answers.budget)}</span>
              <span>
                偏好：{getQuestionnaireAnswerDisplayValue(form.answers.wantGender)} /{" "}
                {getQuestionnaireAnswerDisplayValue(form.answers.wantColor)}
              </span>
            </MobileRecord>
          ))}
        </div>
      </Panel>

      <Panel className={cn(!mobileDetailOpen ? "hidden md:block" : "")}>
        <PanelTitle
          title="问卷详情"
          desc="处理状态和后台备注会保存在当前浏览器的本地 cattery-store。"
          action={<BackToListButton onClick={() => setMobileDetailOpen(false)} />}
        />
        {!selected ? (
          <div className="px-4 py-8 text-[13px] text-muted-foreground">
            请选择一份问卷查看详情。
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-border/70 px-3 py-2 lg:px-4 lg:py-3">
              {QUESTIONNAIRE_SUBMISSION_STATUSES.map((status) => (
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
              <FieldLine label="提交时间" value={formatSubmittedAt(selected.submittedAt)} />
              <FieldLine
                label="处理状态"
                value={
                  <StatusBadge tone={questionnaireSubmissionStatusTone(selected.status)}>
                    {selected.status}
                  </StatusBadge>
                }
              />
              <div className="border-b border-border/60 py-2.5">
                <span className="mb-1.5 block text-[12px] text-muted-foreground lg:text-[13px]">
                  后台备注
                </span>
                <textarea
                  value={noteDraft}
                  onChange={(event) => {
                    const next = event.target.value;
                    setNoteDraft(next);
                    onAdminNote(selected.id, next);
                  }}
                  rows={4}
                  placeholder="记录联系情况、补充说明或跟进结果"
                  className="w-full rounded-[7px] border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  输入后会自动保存在当前浏览器。
                </p>
              </div>

              {QUESTIONNAIRE_FIELD_GROUPS.map((group) => (
                <div key={group.id} className="pt-3">
                  <p className="mb-1.5 text-[12px] font-semibold text-heading lg:text-[13px]">
                    {group.title}
                  </p>
                  {group.fields.map((fieldKey) => (
                    <FieldLine
                      key={fieldKey}
                      label={selected.answers[fieldKey].questionLabel}
                      value={getQuestionnaireAnswerDisplayValue(selected.answers[fieldKey])}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
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
  const togglePin = (post: Post) =>
    applyAdminCommunityMutation(
      () => catteryActions.togglePin(post.id, ADMIN_PARENT_CONTEXT),
      onNotice,
      post.pinned ? "已取消置顶动态，用户端已同步更新。" : "已置顶动态，用户端已同步更新。",
      "动态置顶状态更新失败，请重试。",
    );

  const toggleVisibility = (post: Post) =>
    applyAdminCommunityMutation(
      () => catteryActions.toggleHidePost(post.id, ADMIN_PARENT_CONTEXT),
      onNotice,
      post.hidden ? "已恢复动态显示，用户端已同步更新。" : "已隐藏动态，用户端已同步更新。",
      "动态显示状态更新失败，请重试。",
    );

  const deletePost = (post: Post) =>
    applyAdminCommunityMutation(
      () => catteryActions.deletePost(post.id, ADMIN_PARENT_CONTEXT),
      onNotice,
      "已删除动态，当前浏览器本地数据已同步更新。",
      "动态删除失败，请重试。",
    );

  return (
    <Panel>
      <PanelTitle
        title="猫友圈动态"
        desc="直接管理当前浏览器本地 cattery-store 中的动态；修改后用户端会立即同步，刷新后仍保留。"
      />
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
                  [post.pinned ? "取消置顶" : "置顶", () => togglePin(post)],
                  [post.hidden ? "恢复" : "隐藏", () => toggleVisibility(post)],
                  ["删除", () => deletePost(post), "danger"],
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
              <ActionButton onClick={() => toggleVisibility(post)} tone="quiet">
                {post.hidden ? "恢复" : "隐藏"}
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

  const toggleCommentVisibility = (postId: string, commentId: string, hidden: boolean) =>
    applyAdminCommunityMutation(
      () => catteryActions.toggleHideComment(postId, commentId, ADMIN_PARENT_CONTEXT),
      onNotice,
      hidden ? "已恢复评论显示，用户端已同步更新。" : "已隐藏评论，用户端已同步更新。",
      "评论显示状态更新失败，请重试。",
    );

  const deleteComment = (postId: string, commentId: string) =>
    applyAdminCommunityMutation(
      () => catteryActions.deleteComment(postId, commentId, ADMIN_PARENT_CONTEXT),
      onNotice,
      "已删除评论，当前浏览器本地数据已同步更新。",
      "评论删除失败，请重试。",
    );

  return (
    <Panel>
      <PanelTitle
        title="评论管理"
        desc="直接管理当前浏览器本地 cattery-store 中的评论；隐藏、恢复和删除会立即同步到用户端。"
      />
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
                        () => toggleCommentVisibility(post.id, comment.id, comment.hidden ?? false),
                      ],
                      ["删除", () => deleteComment(post.id, comment.id), "danger"],
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
                    onClick={() =>
                      toggleCommentVisibility(post.id, comment.id, comment.hidden ?? false)
                    }
                    tone="quiet"
                  >
                    {comment.hidden ? "恢复" : "隐藏"}
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
