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

/** Cat sitting beneath a crescent moon — clean, minimal column illustration for "了解星月". */
export function CatProfile(props: P) {
  return (
    <svg {...base} strokeWidth={1.5} {...props}>
      {/* Crescent moon */}
      <path d="M58 16c-12 0-20 10-20 23s8 23 20 23c-6 0-12-9-12-23s6-23 12-23z" />
      {/* Cat body */}
      <path d="M24 62c-4 0-6-6-4-11s8-9 14-7" />
      {/* Chest and front legs */}
      <path d="M34 48c5 1 10 6 10 12" />
      <path d="M38 60v6" />
      <path d="M44 60v6" />
      {/* Head in profile, looking up */}
      <path d="M28 46c0-6 5-11 12-11s12 5 12 11" />
      {/* Tufted ears */}
      <path d="M30 38l-3-7 7 5" />
      <path d="M42 38l3-7-7 5" />
    </svg>
  );
}

/** Adult cat lying with a small kitten nestled close — clean, minimal column illustration for "我们的猫". */
export function CurledCat(props: P) {
  return (
    <svg {...base} strokeWidth={1.5} {...props}>
      {/* Adult cat back */}
      <path d="M14 46c4-8 12-14 22-14s18 6 22 14" />
      {/* Adult head */}
      <path d="M14 46c-4 0-7-3-7-8s3-9 8-9" />
      {/* Adult ears */}
      <path d="M7 31l-2-6 6 5" />
      <path d="M21 31l2-6-6 5" />
      {/* Tail wrapping the nest */}
      <path d="M58 46c6 4 8 11 4 16s-12 6-18 2" />
      {/* Kitten body */}
      <path d="M28 58c-3 0-5-3-4-7s5-6 9-5" />
      <path d="M34 46c5-1 10 2 11 7" />
      {/* Kitten head */}
      <path d="M28 58c-4 0-7-2-7-6s3-6 7-6" />
      {/* Kitten ears */}
      <path d="M23 48l-2-5 5 3" />
      <path d="M31 48l2-5-5 3" />
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

/** Award rosette with ribbon tails and a star — registration / certification. */
export function Rosette(props: P) {
  return (
    <svg {...base} {...props}>
      <circle cx="40" cy="30" r="15" />
      <path d="M31 43l-5 21 14-9 14 9-5-21" />
      <path d="M40 22c.7 4.8 1.8 5.9 6.6 6.6-4.8.7-5.9 1.8-6.6 6.6-.7-4.8-1.8-5.9-6.6-6.6 4.8-.7 5.9-1.8 6.6-6.6z" />
    </svg>
  );
}

/** Paw print with a small check — health screening all n/n. */
export function PawCheck(props: P) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="40" cy="47" rx="12" ry="9" />
      <ellipse cx="25" cy="35" rx="4" ry="5.5" />
      <ellipse cx="55" cy="35" rx="4" ry="5.5" />
      <ellipse cx="32.5" cy="25" rx="3.6" ry="4.8" />
      <ellipse cx="47.5" cy="25" rx="3.6" ry="4.8" />
      <path d="M35 47.5l4 4 8-9" />
    </svg>
  );
}

/** A single flowing cat tail that curls into an arc — decorative accent. */
export function TailArc(props: P) {
  return (
    <svg {...base} {...props}>
      <path d="M14 60c18 4 30-2 36-14s2-24-8-27c-8-2-13 4-11 11 1 5 6 7 10 4" />
      <path d="M52 22l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
    </svg>
  );
}

/** A small window with curtains — a glimpse into the cattery. */
export function Window(props: P) {
  return (
    <svg {...base} {...props}>
      <rect x="20" y="16" width="40" height="48" rx="3" />
      <path d="M40 16v48M20 40h40" />
      <path d="M20 16c5 6 5 14 0 20M60 16c-5 6-5 14 0 20" />
      <path d="M12 64h56" />
    </svg>
  );
}

/** A trail of three paw prints — walking through the content. */
export function PawTrail({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 text-warm/45 ${className}`}>
      {[0, 1, 2].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`h-3 w-3 ${i === 1 ? "translate-y-1.5" : ""}`}
        >
          <ellipse cx="12" cy="15" rx="5" ry="4" />
          <ellipse cx="6" cy="9" rx="1.8" ry="2.4" />
          <ellipse cx="18" cy="9" rx="1.8" ry="2.4" />
          <ellipse cx="9" cy="5.5" rx="1.6" ry="2.1" />
          <ellipse cx="15" cy="5.5" rx="1.6" ry="2.1" />
        </svg>
      ))}
    </div>
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
