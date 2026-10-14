"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import type { EntryWithCategory } from "@/lib/queries/entries";
import { todayISO } from "@/lib/dates";
import { EntryRow } from "./entry-row";
import { EmptyState } from "@/components/ui/empty";
import { Money } from "@/components/ui/money";
import { useFormat } from "@/components/providers/settings-provider";

export function EntryList({
  entries,
  groupByDate = true,
  compact,
  showBucket,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  entries: EntryWithCategory[];
  groupByDate?: boolean;
  compact?: boolean;
  showBucket?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  const t = useTranslations();
  const { day } = useFormat();

  if (!entries.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-5 w-5" />}
        title={emptyTitle ?? t("entry.listEmpty")}
        description={emptyDescription}
        action={emptyAction}
        compact
      />
    );
  }

  if (!groupByDate) {
    return (
      <div className="-mx-2">
        {entries.map((e) => (
          <EntryRow key={e.id} entry={e} compact={compact} showBucket={showBucket} />
        ))}
      </div>
    );
  }

  const today = todayISO();
  const groups = new Map<string, EntryWithCategory[]>();
  for (const e of entries) {
    if (!groups.has(e.date)) groups.set(e.date, []);
    groups.get(e.date)!.push(e);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([date, list]) => {
        const net = list.reduce(
          (a, e) => (e.status === "settled" ? a + (e.kind === "debit" ? e.amount : -e.amount) : a),
          0,
        );
        return (
          <section key={date}>
            <header className="mb-1 flex items-center justify-between px-2">
              <h4 className="text-[12px] font-medium uppercase tracking-wider text-ink-3">
                {date === today ? t("common.today") : day(date)}
              </h4>
              {net !== 0 ? <Money amount={net} kind="net" className="text-[12px]" /> : null}
            </header>
            <div className="-mx-2">
              {list.map((e) => (
                <EntryRow key={e.id} entry={e} showDate={false} compact={compact} showBucket={showBucket} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
