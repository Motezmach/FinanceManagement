import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "inflow" | "outflow" | "warn" | "danger" | "accent" | "outline";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  inflow: "bg-inflow-soft text-inflow-ink",
  outflow: "bg-outflow-soft text-outflow-ink",
  warn: "bg-warn-soft text-warn-ink",
  danger: "bg-danger-soft text-danger-ink",
  accent: "bg-accent-soft text-accent-ink",
  outline: "border border-line text-ink-2 bg-transparent",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
