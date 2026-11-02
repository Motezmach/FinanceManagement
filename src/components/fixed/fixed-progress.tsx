"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { moveAllToSavings } from "@/lib/actions/savings";
import type { FixedTotals } from "@/lib/queries/rules";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Money } from "@/components/ui/money";
import { useFormat } from "@/components/providers/settings-provider";

export function FixedProgress({
  totals,
  moveAll,
}: {
  totals: FixedTotals;
  moveAll: { count: number; total: number; shortBy: number };
}) {
  const { money, statusLabel } = useFormat();
  const t = useTranslations("fixed");
  const [confirm, setConfirm] = useState(false);

  const segments = [
    { key: "paid", label: statusLabel("settled", "credit"), amount: totals.paid, color: "var(--inflow)" },
    { key: "saved", label: statusLabel("saved", "credit"), amount: totals.saved, color: "var(--saved)" },
    { key: "due", label: statusLabel("pending", "credit"), amount: totals.due, color: "var(--warn)" },
  ];
  const width = (amount: number) => (totals.total > 0 ? (amount / totals.total) * 100 : 0);

  return (
    <div className="rounded-xl2 border border-line bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-ink-2">
          {t.rich("progress", {
            paid: money(totals.paid),
            total: money(totals.total),
            b: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
          })}
        </p>
        {moveAll.count > 0 ? (
          <Button size="sm" variant="outline" className="hover:border-saved hover:text-saved-ink" onClick={() => setConfirm(true)}>
            <PiggyBank className="h-3.5 w-3.5" /> {t("moveAll.button")}
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        {segments
          .filter((segment) => segment.amount > 0)
          .map((segment) => (
            <span
              key={segment.key}
              className="h-full transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${width(segment.amount)}%`, background: segment.color }}
            />
          ))}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
        {segments.map((segment) => (
          <div key={segment.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-ink-3">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: segment.color }} />
              <span className="truncate">{segment.label}</span>
            </dt>
            <dd className="mt-0.5">
              <Money amount={segment.amount} label={segment.label} className="text-[13px] font-medium" />
            </dd>
          </div>
        ))}
      </dl>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="primary"
        title={t("moveAll.button")}
        description={
          <div className="space-y-1.5">
            <p>{t("moveAll.body", { count: moveAll.count, amount: money(moveAll.total) })}</p>
            {moveAll.shortBy > 0 ? (
              <p className="font-medium text-warn-ink">{t("moveAll.short", { amount: money(moveAll.shortBy) })}</p>
            ) : null}
          </div>
        }
        confirmLabel={t("moveAll.button")}
        onConfirm={async () => {
          const res = await moveAllToSavings();
          if (!res.ok) toast.error(res.error);
          else if (res.data?.shortBy) toast.warning(t("shortBy", { amount: money(res.data.shortBy) }));
          else toast.success(t("moveAll.done", { count: res.data?.count ?? 0 }));
        }}
      />
    </div>
  );
}
