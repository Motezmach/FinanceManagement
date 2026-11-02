"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { getDay, getDaysInMonth } from "date-fns";
import type { EntryWithCategory } from "@/lib/queries/entries";
import type { DayTotals } from "@/lib/queries/dashboard";
import type { ScheduledBill } from "@/lib/queries/rules";
import { periodToDate } from "@/lib/dates";
import { weekdayNames } from "@/lib/format";
import { cn, sumMoney } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Money } from "@/components/ui/money";
import { EntryList } from "@/components/entry/entry-list";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";

export function MonthGrid({
  period,
  days,
  entries,
  scheduled,
  today,
  initialDay,
}: {
  period: string;
  days: DayTotals;
  entries: EntryWithCategory[];
  scheduled: ScheduledBill[];
  today: string;
  initialDay?: string;
}) {
  const { openAdd } = useEntryModal();
  const { money, locale, longDate, day, statusLabel } = useFormat();
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const base = periodToDate(period);
  const total = getDaysInMonth(base);
  const lead = (getDay(base) + 6) % 7; // Monday first
  const weekdays = weekdayNames(locale, "short");
  const savedLabel = statusLabel("saved", "credit");
  const [selected, setSelected] = useState<string>(
    initialDay && initialDay.startsWith(period) ? initialDay : today.startsWith(period) ? today : `${period}-01`,
  );

  const cells = useMemo(() => {
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= total; d++) out.push(`${period}-${String(d).padStart(2, "0")}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [lead, total, period]);

  const billsByDay = useMemo(() => {
    const out = new Map<string, ScheduledBill[]>();
    for (const bill of scheduled) out.set(bill.date, [...(out.get(bill.date) ?? []), bill]);
    return out;
  }, [scheduled]);

  const dayEntries = entries.filter((e) => e.date === selected);
  const dayBills = billsByDay.get(selected) ?? [];
  const dayTotals = days[selected];
  const maxOut = Math.max(1, ...Object.values(days).map((d) => d.out));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-surface-2/60 text-center text-[11.5px] font-medium uppercase tracking-wider text-ink-3">
          {weekdays.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b${i}`} className="min-h-14 border-b border-e border-line/60 bg-surface-2/30 sm:aspect-[5/4]" />;
            const d = days[iso];
            const bills = billsByDay.get(iso);
            const billsTotal = bills ? sumMoney(bills.map((b) => b.amount)) : 0;
            const isToday = iso === today;
            const isSel = iso === selected;
            const intensity = d ? Math.min(1, d.out / maxOut) : 0;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelected(iso)}
                className={cn(
                  "relative flex min-h-14 min-w-0 flex-col items-start border-b border-e border-line/60 p-1.5 text-start transition sm:aspect-[5/4] sm:p-2",
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
                {d || bills ? (
                  <span className="mt-auto flex w-full flex-col gap-0.5">
                    {d?.in ? <Money amount={d.in} kind="debit" signed compact label={`${tc("in")} · ${day(iso)}`} className="max-w-full self-start truncate text-[10.5px] font-medium" /> : null}
                    {d?.out ? <Money amount={d.out} kind="credit" signed compact label={`${tc("out")} · ${day(iso)}`} className="max-w-full self-start truncate text-[10.5px] font-medium" /> : null}
                    {d?.due ? (
                      <span data-calc-amount={d.due} data-calc-label={`${tc("due")} · ${day(iso)}`} className="flex max-w-full items-center gap-1 text-[10.5px] tabular text-warn-ink">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                        <span className="sr-only">{tc("due")}</span>
                        <span className="truncate">{money(d.due, { compact: true })}</span>
                      </span>
                    ) : null}
                    {d?.saved ? (
                      <span data-calc-amount={d.saved} data-calc-label={`${savedLabel} · ${day(iso)}`} className="flex max-w-full items-center gap-1 text-[10.5px] tabular text-saved-ink">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-saved" />
                        <span className="sr-only">{savedLabel}</span>
                        <span className="truncate">{money(d.saved, { compact: true })}</span>
                      </span>
                    ) : null}
                    {bills ? (
                      <span data-calc-amount={billsTotal} data-calc-label={`${t("scheduled")} · ${day(iso)}`} className="flex items-center gap-1 text-[10.5px] tabular text-ink-3">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-ink-3" />
                        <span className="sr-only">{t("scheduled")}</span>
                        <span className="truncate">{money(billsTotal, { compact: true })}</span>
                      </span>
                    ) : null}
                  </span>
                ) : null}
                {d && d.out > 0 ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-outflow" style={{ opacity: 0.25 + intensity * 0.75 }} /> : null}
              </button>
            );
          })}
        </div>
      </Card>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={selected} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.16 }}>
          <Card className="lg:sticky lg:top-8">
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wider text-ink-3">{selected === today ? tc("today") : t("selectedDay")}</p>
                <h3 className="font-display mt-0.5 text-[19px] leading-tight text-ink">{longDate(periodToDateSafe(selected))}</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => openAdd({ date: selected })}>
                <Plus className="h-3.5 w-3.5" /> {tc("add")}
              </Button>
            </div>
            {dayTotals ? (
              <div className="mx-5 mt-4 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-surface-2 p-3 text-[12.5px]">
                <div>
                  <p className="text-ink-3">{tc("in")}</p>
                  <Money amount={dayTotals.in} kind="debit" label={`${tc("in")} · ${day(selected)}`} className="font-medium" />
                </div>
                <div>
                  <p className="text-ink-3">{tc("out")}</p>
                  <Money amount={dayTotals.out} kind="credit" label={`${tc("out")} · ${day(selected)}`} className="font-medium" />
                </div>
                <div>
                  <p className="text-ink-3">{tc("due")}</p>
                  <Money amount={dayTotals.due} muted={!dayTotals.due} label={`${tc("due")} · ${day(selected)}`} className="font-medium" />
                </div>
                <div>
                  <p className="text-ink-3">{savedLabel}</p>
                  <Money
                    amount={dayTotals.saved}
                    muted={!dayTotals.saved}
                    label={`${savedLabel} · ${day(selected)}`}
                    className={cn("font-medium", dayTotals.saved > 0 && "text-saved-ink")}
                  />
                </div>
              </div>
            ) : null}
            <CardBody className="space-y-4 pt-4">
              {dayEntries.length || !dayBills.length ? (
                <EntryList entries={dayEntries} groupByDate={false} compact showBucket emptyTitle={t("nothing")} emptyDescription={t("nothingSub")} />
              ) : null}
              {dayBills.length ? <ScheduledList bills={dayBills} /> : null}
            </CardBody>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ScheduledList({ bills }: { bills: ScheduledBill[] }) {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");

  return (
    <section>
      <h4 className="text-[12px] font-medium text-ink-3">{t("scheduled")}</h4>
      <ul className="mt-1 divide-y divide-line">
        {bills.map((bill) => (
          <li key={bill.ruleId} className="flex items-center gap-3 py-2.5">
            <CategoryIcon icon={bill.category?.icon} color={bill.category?.color} size="sm" className="opacity-60" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] text-ink-2">{bill.title}</p>
              <p className="truncate text-[12px] text-ink-3">{bill.category?.name ?? tc("uncategorized")}</p>
            </div>
            <Money amount={bill.amount} muted label={bill.title} className="text-[13.5px] font-medium" />
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-3">{t("scheduledNote")}</p>
    </section>
  );
}

function periodToDateSafe(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
