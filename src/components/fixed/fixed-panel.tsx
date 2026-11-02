"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MotionConfig } from "motion/react";
import { Plus, Repeat } from "lucide-react";
import type { FixedBoardData, FixedRow } from "@/lib/queries/rules";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { EntryRow } from "@/components/entry/entry-row";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";
import { AdoptionNotice } from "./adoption-notice";
import { AutoPayBanner } from "./autopay-banner";
import { BillRow } from "./bill-row";
import { FixedProgress } from "./fixed-progress";
import { RuleEditDialog } from "./rule-edit-dialog";

/** The Fixed monthly tab: every monthly bill of the viewed month, and what can be done with each. */
export function FixedPanel({ board, period, today }: { board: FixedBoardData; period: string; today: string }) {
  const { openAdd } = useEntryModal();
  const { month } = useFormat();
  const t = useTranslations("fixed");
  const [editing, setEditing] = useState<FixedRow | null>(null);

  const bills = [...board.late, ...board.rows];

  const billRow = (row: FixedRow) => (
    <BillRow
      key={row.key}
      row={row}
      period={period}
      today={today}
      siblings={bills.filter((other) => other.rule.id === row.rule.id)}
      onEditRule={setEditing}
    />
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-5">
        {board.autoPaidUnseen.length > 0 ? <AutoPayBanner items={board.autoPaidUnseen} total={board.autoPaidTotal} /> : null}
        {board.adopted.length > 0 ? <AdoptionNotice rules={board.adopted} /> : null}
        {board.isCurrent && board.totals.total > 0 ? <FixedProgress totals={board.totals} moveAll={board.moveAll} /> : null}

        {board.late.length > 0 ? (
          <section className="rounded-xl2 border border-danger/25 bg-danger-soft/40 p-3">
            <h4 className="px-2 text-[13px] font-semibold text-danger-ink">{t("lateTitle")}</h4>
            <p className="px-2 text-[12px] text-ink-2">{t("lateHint")}</p>
            <ul className="mt-1 divide-y divide-line">{board.late.map(billRow)}</ul>
          </section>
        ) : null}

        {board.rows.length > 0 ? <ul className="-mx-2 divide-y divide-line">{board.rows.map(billRow)}</ul> : null}

        {board.history.length > 0 ? (
          <section>
            <h4 className="text-[12px] font-medium uppercase tracking-wider text-ink-3 rtl:tracking-normal">{t("notRepeating")}</h4>
            <p className="mt-0.5 text-[12px] text-ink-3">{t("notRepeatingHint")}</p>
            <div className="-mx-2 mt-1">
              {board.history.map((entry) => (
                <EntryRow key={entry.id} entry={entry} offerMonthly />
              ))}
            </div>
          </section>
        ) : null}

        {bills.length === 0 && board.history.length === 0 ? (
          board.isCurrent ? (
            <EmptyState
              compact
              icon={<Repeat className="h-5 w-5" />}
              title={t("empty.title")}
              description={t("empty.body")}
              action={
                <Button size="sm" onClick={() => openAdd({ kind: "credit", bucket: "fixed" })}>
                  <Plus className="h-3.5 w-3.5" /> {t("empty.action")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              compact
              icon={<Repeat className="h-5 w-5" />}
              title={t("empty.monthTitle", { month: month(period) })}
              description={t("empty.monthBody")}
            />
          )
        ) : null}
      </div>
      <RuleEditDialog row={editing} onClose={() => setEditing(null)} />
    </MotionConfig>
  );
}
