import type { SVGProps } from "react";

/**
 * Hand-drawn style line icons for the cattery mini-program.
 * All use currentColor, round caps/joins, thin strokes.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CatIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10.5 3.4 5.6l3.7 2.7" />
      <path d="M20 10.5l.6-4.9-3.7 2.7" />
      <path d="M5 11c0-3.3 3.1-5 7-5s7 1.7 7 5v2.5c0 3.6-3 6-7 6s-7-2.4-7-6z" />
      <path d="M9.3 12.2h.01M14.7 12.2h.01" />
      <path d="M12 14.2c-.5.7-1.6.7-2.1 0M12 14.2c.5.7 1.6.7 2.1 0" />
      <path d="M12 14.6v1.1" />
    </svg>
  );
}

export function PawIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="12" cy="16" rx="4" ry="3.2" />
      <ellipse cx="6.5" cy="11.5" rx="1.5" ry="2" />
      <ellipse cx="17.5" cy="11.5" rx="1.5" ry="2" />
      <ellipse cx="9.3" cy="8.2" rx="1.4" ry="1.9" />
      <ellipse cx="14.7" cy="8.2" rx="1.4" ry="1.9" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
      <path d="M16 5.5l.5 1.4L18 7.4l-1.2.8.3 1.5-1.1-.9-1.3.7.4-1.4L14 6.9l1.5-.1z" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5c.5 3.9 1.6 5 5.5 5.5-3.9.5-5 1.6-5.5 5.5-.5-3.9-1.6-5-5.5-5.5 3.9-.5 5-1.6 5.5-5.5z" />
    </svg>
  );
}

export function HouseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11 12 5l8 6" />
      <path d="M6 10.2V19h12v-8.8" />
      <path d="M10.5 19v-4h3v4" />
      <path d="M15 7.5V5.5h1.8V9" />
    </svg>
  );
}

export function BowlIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h16c0 3.6-3.6 6-8 6s-8-2.4-8-6z" />
      <path d="M7.5 12c.4-2 2.3-3.3 4.5-3.3S16.1 10 16.5 12" />
      <path d="M9.5 9.5c.4-.9 1.4-1.5 2.5-1.5s2.1.6 2.5 1.5" />
    </svg>
  );
}

export function KibbleIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6.5c-.6 0-1 .5-.9 1.1L8.5 19c.1.6.6 1 1.1 1h4.8c.5 0 1-.4 1.1-1l1.4-11.4c.1-.6-.3-1.1-.9-1.1z" />
      <path d="M8.2 8.8h7.6" />
      <path d="M10.8 6.5c0-1.2.8-2 1.6-2s1.4.6 1.6 1.6" />
      <path d="M11 13h2M11.4 15.5h1.2" />
    </svg>
  );
}

export function CanIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="8" width="12" height="9" rx="1.6" />
      <path d="M6 10.5h12M6 14.5h12" />
      <path d="M8.5 8V6.7h7V8" />
    </svg>
  );
}

export function BagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 8h10l-.8 11.2H7.8z" />
      <path d="M7 8c1.2-1.5 3-2.2 5-2.2S15.8 6.5 17 8" />
      <path d="M10.5 12.5h3M10 15.5h4" />
    </svg>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function PaperIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4h7l4 4v12H7z" />
      <path d="M14 4v4h4" />
      <path d="M9.5 12h5M9.5 15h5M9.5 9h2" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 19s-6.5-4-6.5-8.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 6.5 2.5C18.5 15 12 19 12 19z" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5.5 19c.6-3.4 3.3-5.2 6.5-5.2s5.9 1.8 6.5 5.2" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 18 6v5.5c0 4-2.6 7-6 8.5-3.4-1.5-6-4.5-6-8.5V6z" />
      <path d="M9.4 11.8l1.8 1.8 3.4-3.6" />
    </svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14z" />
      <path d="M8.5 15.5C11 13 13.5 11.5 16 10.5" />
    </svg>
  );
}

export function DnaIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4c0 5 8 6 8 11 0 3-2 5-4 5" />
      <path d="M16 4c0 5-8 6-8 11 0 3 2 5 4 5" />
      <path d="M8.6 7h6.8M8.6 17h6.8M10 10h4M10 14h4" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="8" width="11" height="11" rx="2.5" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function PriceTagIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12V5.5A1.5 1.5 0 0 1 5.5 4H12l8 8-6.5 6.5z" />
      <circle cx="8" cy="8" r="1.2" />
    </svg>
  );
}

export function RouteIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h6a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-4a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h6" />
    </svg>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4.5" y="9.5" width="15" height="10" rx="1.5" />
      <path d="M4.5 12.5h15M12 9.5v10" />
      <path d="M12 9.5C10.5 6 7 6.5 7 8.5c0 1 1 1 5 1zM12 9.5C13.5 6 17 6.5 17 8.5c0 1-1 1-5 1z" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <circle cx="12" cy="15" r="1.2" />
    </svg>
  );
}
