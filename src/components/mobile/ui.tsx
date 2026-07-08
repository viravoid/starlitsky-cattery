import type { ReactNode } from "react";
import { CatIcon } from "./icons";

/**
 * Light placeholder image block for missing photos.
 * Always labelled so it's obvious it must be replaced.
 */
export function Placeholder({
  label,
  className = "",
  ratio = "aspect-[4/3]",
  rounded = "rounded-2xl",
}: {
  label: string;
  className?: string;
  ratio?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`relative flex ${ratio} w-full flex-col items-center justify-center gap-2 overflow-hidden ${rounded} border border-dashed border-border bg-gradient-cream ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 12px, color-mix(in oklab, var(--warm) 18%, transparent) 12px 13px)",
        }}
      />
      <CatIcon className="h-9 w-9 text-warm" />
      <span className="relative px-4 text-center text-xs font-medium leading-relaxed text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function Section({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`px-5 ${className}`}>{children}</section>;
}

export function SectionTitle({
  cn,
  en,
  icon,
}: {
  cn: string;
  en?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon && <span className="text-violet">{icon}</span>}
      <div>
        <h2 className="text-[17px] font-semibold leading-tight text-heading">{cn}</h2>
        {en && (
          <p className="font-display text-[11px] uppercase tracking-[0.25em] text-warm">
            {en}
          </p>
        )}
      </div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`soft-card ${className}`}>{children}</div>;
}

const TONE: Record<string, string> = {
  sky: "bg-sky/25 text-[#34566a]",
  creamblue: "bg-creamblue/40 text-[#3a5568]",
  sunny: "bg-sunny/50 text-[#6b5f2f]",
  warm: "bg-warm/35 text-[#6b5644]",
  violet: "bg-violet/15 text-violet",
  wine: "bg-wine/12 text-wine",
};

export function Pill({
  children,
  tone = "sky",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof TONE | string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        TONE[tone] ?? TONE.sky
      } ${className}`}
    >
      {children}
    </span>
  );
}
