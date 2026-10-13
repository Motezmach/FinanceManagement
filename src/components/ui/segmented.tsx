"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = { value: T; label: ReactNode; count?: number };

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center rounded-xl border border-line bg-surface-2 p-1",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-line"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            ) : null}
            <span className="relative">{o.label}</span>
            {o.count !== undefined ? (
              <span
                className={cn(
                  "relative rounded-md px-1.5 text-[11px] tabular",
                  active ? "bg-surface-3 text-ink-2" : "text-ink-3",
                )}
              >
                {o.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
