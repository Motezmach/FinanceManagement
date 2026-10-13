"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { getDay, getDaysInMonth } from "date-fns";
import type { EntryWithCategory } from "@/lib/queries/entries";
import type { DayTotals } from "@/lib/queries/dashboard";
import { periodToDate } from "@/lib/dates";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { EntryList } from "@/components/entry/entry-list";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({
  period,
  days,
  entries,
  today,
  initialDay,
}: {
  period: string;
  days: DayTotals;
  entries: EntryWithCategory[];
  today: string;
  initialDay?: string;
}) {
  const { openAdd } = useEntryModal();
  const { money } = useFormat();
  const base = periodToDate(period);
  const total = getDaysInMonth(base);
  const lead = (getDay(base) + 6) % 7; // Monday first
  const [selected, setSelected] = useState<string>(
    initialDay && initialDay.startsWith(period) ? initialDay : today.startsWith(period) ? today : `${period}-01`,
  );

  const cells = useMemo(() => {
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d++) out.push(`${period}-${String(d).padStart(2, "0")}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [lead, total, period]);

  const dayEntries = entries.filter((e) => e.date === selected);
  const maxOut = Math.max(1, ...Object.values(days).map((d) => d.out));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-surface-2/60 text-center text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b${i}`} className="aspect-square border-b border-r border-line/60 bg-surface-2/30 sm:aspect-[5/4]" />;
            const d = days[iso];
            const isToday = iso === today;
            const isSel = iso === selected;
            const intensity = d ? Math.min(1, d.out / maxOut) : 0;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={cn(
                  "relative flex aspect-square flex-col items-start border-b border-r border-line/60 p-1.5 text-left transition sm:aspect-[5/4] sm:p-2",
                  isSel ? "bg-accent-soft/50" : "hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] tabular",
                    isToday ? "bg-primary font-semibold text-primary-fg" : "text-ink-2",
                    isSel && !isToday && "font-semibold text-ink",
                  )}
                >
                  {Number(iso.slice(8, 10))}
                </span>
                {d ? (
                  <span className="mt-auto flex w-full flex-col gap-0.5">
                    {d.in > 0 ? (
                      <span className="truncate text-[10.5px] font-medium tabular text-inflow-ink">+{money(d.in, { compact: true })}</span>
                    ) : null}
                    {d.out > 0 ? (
                      <span className="truncate text-[10.5px] font-medium tabular text-outflow-ink">−{money(d.out, { compact: true })}</span>
                    ) : null}
                    {d.due > 0 ? (
                      <span className="truncate text-[10.5px] tabular text-warn-ink">due {money(d.due, { compact: true })}</span>
                    ) : null}
                  </span>
                ) : null}
                {d && d.out > 0 ? (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-outflow"
                    style={{ opacity: 0.25 + intensity * 0.75 }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selected}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.16 }}
        >
          <Card className="lg:sticky lg:top-8">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wider text-ink-3">
                  {selected === today ? "Today" : "Selected day"}
                </p>
                <h3 className="font-display mt-0.5 text-[20px] leading-tight text-ink">
                  {formatLongDate(periodToDateSafe(selected))}
                </h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => openAdd({ date: selected })}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {days[selected] ? (
              <div className="mx-5 mt-4 grid grid-cols-3 gap-2 rounded-xl bg-surface-2 p-3 text-[12.5px]">
                <div>
                  <p className="text-ink-3">In</p>
                  <Money amount={days[selected].in} kind="debit" className="font-medium" />
                </div>
                <div>
                  <p className="text-ink-3">Out</p>
                  <Money amount={days[selected].out} kind="credit" className="font-medium" />
                </div>
                <div>
                  <p className="text-ink-3">Due</p>
                  <Money amount={days[selected].due} muted={!days[selected].due} className="font-medium" />
                </div>
              </div>
            ) : null}
            <CardBody className="pt-4">
              <EntryList
                entries={dayEntries}
                groupByDate={false}
                compact
                showBucket
                emptyTitle="Nothing on this day"
                emptyDescription="Add a debit or credit for this date."
              />
            </CardBody>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function periodToDateSafe(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
