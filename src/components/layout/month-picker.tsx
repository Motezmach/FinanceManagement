"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentPeriod, shiftPeriod } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MonthPicker({ period, className }: { period: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const isCurrent = period === currentPeriod();

  const go = (p: string) => {
    const next = new URLSearchParams(params.toString());
    if (p === currentPeriod()) next.delete("period");
    else next.set("period", p);
    next.delete("day");
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  return (
    <div
      className={cn(
        "inline-flex h-10 items-center rounded-xl border border-line bg-surface p-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        pending && "opacity-70",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => go(shiftPeriod(period, -1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => go(currentPeriod())}
        className="min-w-[132px] px-2 text-center text-[13.5px] font-medium text-ink"
        title="Jump to this month"
      >
        {formatMonth(period)}
        {!isCurrent ? <span className="ml-1.5 text-[11px] text-ink-3">· today</span> : null}
      </button>
      <button
        type="button"
        onClick={() => go(shiftPeriod(period, 1))}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
