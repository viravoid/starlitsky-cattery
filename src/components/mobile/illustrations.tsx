import type { SVGProps } from "react";

/**
 * Hand-drawn line ILLUSTRATIONS for StarlitSky cattery.
 * These are loose, gestural line drawings meant to sit inside content
 * (not uniform round-background system icons). Thin strokes, currentColor.
 */

type P = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 80 80",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Maine coon side profile — tufted ears, ruff, gentle face. */
export function CatProfile(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M15 46c-3-10-1-19 6-25l-3-11 11 8c4-2 9-2 13 0l11-8-3 11c7 6 9 15 6 25" />
      <path d="M15 46c1 12 12 19 25 19s24-7 25-19" />
      <path d="M27 40c1.6-2 4.6-2 6 0" />
      <path d="M47 40c1.6-2 4.6-2 6 0" />
      <path d="M39 47l1.6 3h-3.2z" />
      <path d="M40 50v3" />
      <path d="M40 53c-1.4 1.6-4 1.6-5.4 0" />
      <path d="M40 53c1.4 1.6 4 1.6 5.4 0" />
    </svg>
  );
}

/** Curled sleeping cat — one continuous spiral body, tiny ears. */
export function CurledCat(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M13 44C10 28 26 17 43 20c13 2 22 13 17 25-4 11-20 15-31 11" />
      <path d="M29 56c7-2 11-8 10-15-1-6 3-11 9-12" />
      <path d="M46 15l2 5 5-1-3 5" />
      <path d="M20 33c-3 0-5-2-5-5" />
      <path d="M24 30l-1-4 4 2" />
      <path d="M30 28l-1-4 4 2" />
    </svg>
  );
}

/** Crescent moon with a couple of sparkles. */
export function MoonStars(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M55 16a27 27 0 1 0 10 50 21 21 0 1 1-10-50z" />
      <path d="M20 26l1.7 3.6 3.6 1.7-3.6 1.7L20 38l-1.7-3.3L14.7 33l3.6-1.7z" />
      <path d="M16 52l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
    </svg>
  );
}

/** Heart cradling a small paw — for breeding philosophy. */
export function HeartPaw(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M40 63C20 50 12 39 12 29a13 13 0 0 1 28-6 13 13 0 0 1 28 6c0 10-8 21-28 34z" />
      <ellipse cx="40" cy="40" rx="6" ry="5" />
      <ellipse cx="31" cy="32" rx="2.3" ry="3" />
      <ellipse cx="49" cy="32" rx="2.3" ry="3" />
      <ellipse cx="37" cy="27.5" rx="2" ry="2.6" />
      <ellipse cx="43" cy="27.5" rx="2" ry="2.6" />
    </svg>
  );
}

/** Little cottage with a window and a garden line — cattery environment. */
export function Cottage(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M14 38 40 17l26 21" />
      <path d="M20 34v27h40V34" />
      <rect x="34" y="45" width="12" height="16" rx="1" />
      <path d="M40 45v16M34 53h12" />
      <path d="M25 40h6v6h-6z" />
      <path d="M10 66h60" />
      <path d="M18 66c0-3 1-5 3-5M62 66c0-3-1-5-3-5" />
    </svg>
  );
}

/** Food bowl + can — feeding system. */
export function FoodStation(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M8 44h36c0 9-8 15-18 15S8 53 8 44z" />
      <path d="M15 44c1-4 5-7 11-7s10 3 11 7" />
      <path d="M20 38c1-2 3.5-3.5 6-3.5s5 1.5 6 3.5" />
      <rect x="50" y="34" width="20" height="25" rx="2" />
      <path d="M50 41h20M50 52h20" />
      <path d="M54 34v-3h12v3" />
    </svg>
  );
}

/** Winding path with dots — the adoption journey. */
export function WindingPath(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M18 62c8 0 8-12 16-12s8-12 16-12 8-12 12-12" strokeDasharray="1 6" />
      <circle cx="18" cy="62" r="3.5" />
      <circle cx="62" cy="26" r="3.5" />
      <path d="M62 12l1.6 3.4 3.6.4-2.7 2.5.7 3.6-3.2-1.8-3.2 1.8.7-3.6-2.7-2.5 3.6-.4z" />
    </svg>
  );
}

/** Shield with a small heart — aftercare / guarantee. */
export function ShieldHeart(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M40 12 62 20v16c0 14-9 24-22 30-13-6-22-16-22-30V20z" />
      <path d="M40 48c-8-5-11-9-11-13a5 5 0 0 1 11-2 5 5 0 0 1 11 2c0 4-3 8-11 13z" />
    </svg>
  );
}

/** A few sprinkled sparkles — pure decoration. */
export function Sparkles(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M40 20c1 9 4 12 13 13-9 1-12 4-13 13-1-9-4-12-13-13 9-1 12-4 13-13z" />
      <path d="M22 52l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
      <path d="M60 44l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8z" />
    </svg>
  );
}

/** Ball of yarn — playful accent. */
export function YarnBall(props: P) {
  return (
    <svg {...base} {...props}>
      <circle cx="38" cy="40" r="22" />
      <path d="M22 30c8 6 16 14 22 26" />
      <path d="M18 42c10 3 20 10 26 18" />
      <path d="M30 20c4 12 12 22 26 26" />
      <path d="M58 44c-4 2-6 6-5 11l6 8" />
    </svg>
  );
}

/**
 * Decorative divider: a soft hand-drawn line with a small star at center.
 * Use to separate content sections without a hard rule.
 */
export function StarDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-warm ${className}`}>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-border" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 text-violet/70"
      >
        <path d="M12 3.5c.5 3.9 1.6 5 5.5 5.5-3.9.5-5 1.6-5.5 5.5-.5-3.9-1.6-5-5.5-5.5 3.9-.5 5-1.6 5.5-5.5z" />
      </svg>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-border" />
    </div>
  );
}
