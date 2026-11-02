"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/types";
import { deleteEntry } from "@/lib/actions/entries";
import { deleteRule, setRuleActive } from "@/lib/actions/rules";
import { isOpen } from "@/lib/fixed/cycle";
import type { FixedRow } from "@/lib/queries/rules";
import { sumMoney } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useFormat } from "@/components/providers/settings-provider";
import { useBillDates } from "./use-bill-dates";

export type BillConfirmKind = "skip" | "pause" | "delete";

function openRecords(rows: FixedRow[]) {
  return rows.flatMap(({ instance, phase }) =>
    instance && isOpen(instance.status) ? [{ amount: instance.amount, stays: instance.autoPayHold || phase === "late" }] : [],
  );
}

const total = (records: { amount: number }[]) => sumMoney(records.map((record) => record.amount));

export function BillRowConfirm({
  kind,
  open,
  onClose,
  row,
  siblings,
}: {
  kind: BillConfirmKind;
  open: boolean;
  onClose: () => void;
  row: FixedRow;
  /** Every row of this rule on the board, late ones included. */
  siblings: FixedRow[];
}) {
  const { money } = useFormat();
  const { monthName } = useBillDates();
  const t = useTranslations("fixed");
  const { rule, instance } = row;
  const title = instance?.title ?? rule.title;

  const finish = (res: ActionResult<unknown>, done: string) => {
    if (res.ok) toast.success(done);
    else toast.error(res.error);
  };

  if (kind === "skip") {
    const month = row.instancePeriod ? monthName(row.instancePeriod) : "";
    return (
      <ConfirmDialog
        open={open}
        onClose={onClose}
        tone="primary"
        title={t("skip.title", { month })}
        description={t.rich("skip.body", {
          title,
          month,
          b: (chunks) => <span className="font-medium text-ink">{chunks}</span>,
        })}
        confirmLabel={t("skip.label", { month })}
        onConfirm={async () => {
          if (instance) finish(await deleteEntry(instance.id, instance.status), t("skip.done", { month }));
        }}
      />
    );
  }

  const records = openRecords(siblings);

  if (kind === "pause") {
    const removed = records.filter((record) => !record.stays);
    const kept = records.length - removed.length;
    return (
      <ConfirmDialog
        open={open}
        onClose={onClose}
        tone="primary"
        title={t("pause.title", { title })}
        description={
          <div className="space-y-1.5">
            {removed.length > 0 ? <p>{t("pause.removes", { count: removed.length, amount: money(total(removed)) })}</p> : null}
            {kept > 0 ? <p>{t("pause.keeps", { count: kept })}</p> : null}
            <p>{t("pause.history")}</p>
          </div>
        }
        confirmLabel={t("pause.action")}
        onConfirm={async () => finish(await setRuleActive(rule.id, false), t("pause.done"))}
      />
    );
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      title={t("delete.title", { title })}
      description={
        rule.source === "adoption"
          ? t("delete.bodyAdopted")
          : records.length > 0
            ? t("delete.body", { count: records.length, amount: money(total(records)) })
            : t("delete.bodyNone")
      }
      confirmLabel={t("delete.action")}
      onConfirm={async () => finish(await deleteRule(rule.id), t("delete.done"))}
    />
  );
}
