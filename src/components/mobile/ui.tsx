import type { ReactNode } from "react";
import catMotif from "@/assets/placeholder-cat.png";

/**
 * Minimal placeholder image block for missing photos.
 * Calm cream tint + a single hand-drawn sleeping cat motif.
 * No busy patterns — plenty of breathing room.
 */
export function Placeholder({
  label,
  className = "",
  ratio = "aspect-[4/3]",
  rounded = "rounded-2xl",
  compact = false,
}: {
  label: string;
  className?: string;
  ratio?: string;
  rounded?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative flex ${ratio} w-full flex-col items-center justify-center gap-2.5 overflow-hidden ${rounded} bg-gradient-cream ${className}`}
    >
      <img
        src={catMotif}
        alt=""
        aria-hidden
        loading="lazy"
        className={`${compact ? "w-1/2" : "w-[36%]"} max-w-[128px] opacity-40 mix-blend-multiply`}
      />
      {!compact && (
        <span className="px-6 text-center text-[11px] font-medium leading-relaxed text-warm">
          {label}
        </span>
      )}
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
  sky: "bg-sky/22 text-[#456d9a]",
  creamblue: "bg-creamblue/35 text-[#456d9a]",
  mint: "bg-mint/40 text-[#456d9a]",
  sunny: "bg-sunny/55 text-[#b48725]",
  warm: "bg-warm/35 text-[#b48725]",
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
