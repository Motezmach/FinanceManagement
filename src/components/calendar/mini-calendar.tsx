"use client";

import Link from "next/link";
import { getDay, getDaysInMonth } from "date-fns";
import type { DayTotals } from "@/lib/queries/dashboard";
import { currentPeriod, periodToDate } from "@/lib/dates";
import { weekdayNames } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFormat } from "@/components/providers/settings-provider";

export function MiniCalendar({ period, days, today }: { period: string; days: DayTotals; today: string }) {
  const { locale } = useFormat();
  const base = periodToDate(period);
  const total = getDaysInMonth(base);
  const lead = (getDay(base) + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= total; d++) cells.push(`${period}-${String(d).padStart(2, "0")}`);
  const qs = period === currentPeriod() ? "" : `period=${period}&`;
  const weekdays = weekdayNames(locale, "narrow");

  return (
    <div>
      <div className="grid grid-cols-7 text-center text-[10.5px] font-medium text-ink-3">
        {weekdays.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((iso, i) => {
          if (!iso) return <span key={`b${i}`} />;
          const d = days[iso];
          const isToday = iso === today;
          return (
            <Link
              key={iso}
              href={`/calendar?${qs}day=${iso}`}
              className={cn(
                "mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-lg text-[12px] tabular transition hover:bg-surface-2",
                isToday ? "bg-primary font-semibold text-primary-fg hover:bg-primary" : "text-ink-2",
              )}
            >
              <span className="leading-none">{Number(iso.slice(8, 10))}</span>
              <span className="mt-0.5 flex h-1 items-center gap-0.5">
                {d?.in ? <span className="h-1 w-1 rounded-full bg-inflow" /> : null}
                {d?.out ? <span className="h-1 w-1 rounded-full bg-outflow" /> : null}
                {d?.due ? <span className="h-1 w-1 rounded-full bg-warn" /> : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
