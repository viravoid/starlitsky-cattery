import { useState } from "react";
import { CopyIcon, CheckIcon } from "./icons";

/**
 * Copyable WeChat / social account row with click feedback.
 */
export function CopyText({
  label,
  value,
  variant = "row",
}: {
  label?: string;
  value: string;
  variant?: "row" | "button";
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard may be blocked in preview */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (variant === "button") {
    return (
      <button
        onClick={onCopy}
        className="pressable inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-card"
      >
        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        {copied ? "已复制" : "复制微信号"}
      </button>
    );
  }

  return (
    <button
      onClick={onCopy}
      className="pressable flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left"
    >
      <span className="flex flex-col">
        {label && (
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        )}
        <span className="text-sm font-semibold text-heading">{value}</span>
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          copied ? "bg-primary/30 text-[#233e5c]" : "bg-muted text-muted-foreground"
        }`}
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
        {copied ? "已复制" : "复制"}
      </span>
    </button>
  );
}
