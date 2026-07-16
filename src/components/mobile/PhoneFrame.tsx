import type { ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Signal, Wifi, BatteryFull, House, PawPrint, Cat } from "lucide-react";
import { ChevronLeftIcon } from "./icons";

type TabKey = "home" | "cats" | "community";

const TABS: {
  key: TabKey;
  label: string;
  to: string;
  Icon: typeof House;
}[] = [
  { key: "home", label: "首页", to: "/", Icon: House },
  { key: "community", label: "猫友圈", to: "/community", Icon: PawPrint },
  { key: "cats", label: "我们的猫", to: "/cats", Icon: Cat },
];



function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`flex h-11 shrink-0 items-center justify-between px-6 pt-1 text-[13px] font-semibold ${
        dark ? "text-white" : "text-heading"
      }`}
    >
      <span className="tracking-tight">12:24</span>
      <div className="flex items-center gap-1.5">
        <Signal className="h-3.5 w-3.5" />
        <Wifi className="h-3.5 w-3.5" />
        <BatteryFull className="h-4 w-4" />
      </div>
    </div>
  );
}

function Capsule({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`absolute right-3 top-[46px] z-30 flex h-8 items-center gap-1 rounded-full border px-2.5 backdrop-blur ${
        dark
          ? "border-white/30 bg-white/15 text-white"
          : "border-border bg-card/80 text-heading"
      }`}
    >
      <span className="text-lg leading-none">···</span>
      <span className="mx-0.5 h-4 w-px bg-current opacity-30" />
      <span className="grid h-4 w-4 place-items-center rounded-full border border-current">
        <span className="h-1.5 w-1.5 rounded-full border border-current" />
      </span>
    </div>
  );
}

export function NavHeader({
  title,
  showBack = true,
  to,
}: {
  title: string;
  showBack?: boolean;
  to?: string;
}) {
  const router = useRouter();
  const handleBack = (e: React.MouseEvent) => {
    if (to) return;
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: "/" });
    }
  };
  return (
    <div className="relative flex h-12 shrink-0 items-center justify-center px-14">
      {showBack && (
        <Link
          to={(to ?? "/") as string}
          onClick={handleBack}
          className="pressable absolute left-3 grid h-9 w-9 place-items-center rounded-full bg-card text-heading shadow-card"
          aria-label="返回"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </Link>
      )}
      <h1 className="truncate text-[17px] font-semibold text-heading">{title}</h1>
    </div>
  );
}

export function TabBar({ active }: { active: TabKey }) {
  return (
    <nav
      className="relative z-20 shrink-0 border-t border-border px-2 pb-6 pt-1.5 backdrop-blur"
      style={{ backgroundColor: "#fffaf0" }}
    >
      <ul className="flex items-stretch">
        {TABS.map(({ key, label, to, Icon }) => {
          const on = key === active;
          return (
            <li key={key} className="flex-1">
              <Link
                to={to as string}
                className="pressable flex flex-col items-center justify-center py-1.5"
                style={{ color: on ? "#5b7fa8" : "#8c929a" }}
              >
                <span
                  className="flex items-center justify-center"
                  style={{ width: 24, height: 24 }}
                >
                  <Icon size={22} strokeWidth={1.8} />
                </span>
                <span
                  className="font-medium"
                  style={{ fontSize: 11, lineHeight: 1, marginTop: 5 }}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PhoneFrame({
  children,
  title,
  showBack = true,
  backTo,
  activeTab,
  showTabBar = false,
  bottomBar,
  darkStatus = false,
}: {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  backTo?: string;
  activeTab?: TabKey;
  showTabBar?: boolean;
  bottomBar?: ReactNode;
  darkStatus?: boolean;
}) {
  return (
    <div className="flex min-h-screen w-full items-start justify-center sm:py-8">
      <div className="relative flex h-[100dvh] w-full max-w-[402px] flex-col overflow-hidden bg-background shadow-float sm:h-[860px] sm:rounded-[2.75rem] sm:border-8 sm:border-[#e5ecf6]">
        <StatusBar dark={darkStatus} />
        <Capsule dark={darkStatus} />
        {title && <NavHeader title={title} showBack={showBack} to={backTo} />}
        <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
        {bottomBar}
        {showTabBar && activeTab && <TabBar active={activeTab} />}
      </div>
    </div>
  );
}
