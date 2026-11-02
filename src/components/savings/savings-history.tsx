"use client";

import { useTranslations } from "next-intl";
import { Check, PiggyBank, Repeat } from "lucide-react";
import type { EntryWithCategory } from "@/lib/queries/entries";
import { periodOf } from "@/lib/fixed/cycle";
import { isoDay } from "@/lib/fixed/position";
import { sumMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Money } from "@/components/ui/money";
import { useFormat } from "@/components/providers/settings-provider";
import { useBillDates } from "@/components/fixed/use-bill-dates";

const TAGS = {
  paid: { icon: Check, tone: "neutral" },
  auto: { icon: Repeat, tone: "accent" },
  fromSavings: { icon: PiggyBank, tone: "saved" },
} as const;

/** History only holds bills that were in savings, paid by themselves, or both. */
function tagOf(entry: EntryWithCategory): keyof typeof TAGS {
  if (!entry.autoPaid) return "paid";
  return entry.savedAt ? "fromSavings" : "auto";
}

/** Newest month first, by the month the bill belongs to rather than the day it closed. */
function groupByMonth(entries: EntryWithCategory[]) {
  const months = new Map<string, EntryWithCategory[]>();
  for (const entry of entries) {
    const period = entry.period ?? periodOf(entry.date);
    months.set(period, [...(months.get(period) ?? []), entry]);
  }
  return [...months].sort(([a], [b]) => b.localeCompare(a));
}

function HistoryRow({ entry }: { entry: EntryWithCategory }) {
  const t = useTranslations("savings.history");
  const { shortDate } = useBillDates();
  const key = tagOf(entry);
  const tag = TAGS[key];

  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2">
      <CategoryIcon icon={entry.category?.icon} color={entry.category?.color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{entry.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
          <Badge tone={tag.tone}>
            <tag.icon className="h-3 w-3" />
            {t(key)}
          </Badge>
          <span>{shortDate(entry.settledAt ? isoDay(entry.settledAt) : entry.date)}</span>
        </p>
      </div>
      <Money amount={entry.amount} kind="credit" signed label={entry.title} className="text-[13.5px] font-medium" />
    </li>
  );
}

export function SavingsHistory({ entries }: { entries: EntryWithCategory[] }) {
  const t = useTranslations("savings.history");
  const { month } = useFormat();

  return (
    <Card>
      <CardHeader title={t("title")} description={t("description")} />
      <CardBody className="space-y-5 pt-4">
        {groupByMonth(entries).map(([period, rows]) => (
          <section key={period}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h4 className="text-[12px] font-medium uppercase tracking-wider text-ink-3 rtl:tracking-normal">{month(period)}</h4>
              <Money
                amount={sumMoney(rows.map((row) => row.amount))}
                kind="credit"
                signed
                label={month(period)}
                className="text-[12.5px] font-medium"
              />
            </div>
            <ul className="-mx-2">
              {rows.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </ul>
          </section>
        ))}
      </CardBody>
    </Card>
  );
}
