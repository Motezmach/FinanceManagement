"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { Check, Pause, Pencil, PiggyBank, Play, RotateCcw, SkipForward, Trash2, Undo2 } from "lucide-react";
import { setRuleActive, unskipRulePeriod } from "@/lib/actions/rules";
import { daysBetween, isOpen, occurrence, periodOf } from "@/lib/fixed/cycle";
import type { FixedRow } from "@/lib/queries/rules";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Money } from "@/components/ui/money";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";
import { BillRowConfirm, type BillConfirmKind } from "./bill-row-confirm";
import { useBillActions } from "./use-bill-actions";
import { useBillDates } from "./use-bill-dates";

/**
 * One bill on the Fixed tab, in two lines: icon, title and amount, then chip, buttons and
 * menu. It only becomes a single line at `lg`, because the sidebar arriving at `md` leaves
 * less room than a phone in landscape has.
 */
export function BillRow({
  row,
  period,
  today,
  siblings,
  onEditRule,
}: {
  row: FixedRow;
  /** The month being viewed. */
  period: string;
  today: string;
  /** Every row of this rule on the board, late ones included. */
  siblings: FixedRow[];
  onEditRule: (row: FixedRow) => void;
}) {
  const { openEdit } = useEntryModal();
  const { statusLabel } = useFormat();
  const { shortDate, monthName } = useBillDates();
  const { pending, run, moveBill } = useBillActions();
  const t = useTranslations("fixed");
  const tc = useTranslations("common");
  const [confirm, setConfirm] = useState<{ kind: BillConfirmKind; open: boolean }>({ kind: "skip", open: false });

  const { rule, instance, state, phase, instancePeriod, renewsOn, nextDate, dueDate, unseenAutoPaid } = row;
  const title = instance?.title ?? rule.title;
  const amount = instance?.amount ?? rule.amount;
  const late = phase === "late";
  const recordMonth = instancePeriod ? monthName(instancePeriod) : "";
  const open = instance !== null && isOpen(instance.status);
  // In the first days of a cycle the row still shows last month's bill.
  const fromOtherMonth = open && !late && instancePeriod !== period;
  const inert = state === "skipped" || state === "paused" || state === "scheduled";

  const ask = (kind: BillConfirmKind) => setConfirm({ kind, open: true });

  const chip = ((): { label: string; tone: BadgeTone } => {
    switch (state) {
      case "due":
        if (late && renewsOn) return { label: t("lateSince", { date: shortDate(renewsOn) }), tone: "danger" };
        if (phase === "today") return { label: t("dueToday"), tone: "warn" };
        if (phase === "open" && dueDate) return { label: t("wasDue", { date: shortDate(dueDate) }), tone: "warn" };
        return {
          label: t("inDays", { count: instancePeriod ? daysBetween(today, occurrence(instancePeriod, rule.dayOfMonth)) : 0 }),
          tone: "neutral",
        };
      case "saved":
        return { label: statusLabel("saved", "credit"), tone: "saved" };
      case "paid":
        return { label: t("paid"), tone: "inflow" };
      case "autopaid":
        return { label: t("paidAuto"), tone: "inflow" };
      case "skipped":
        return { label: t("skipped"), tone: "outline" };
      case "paused":
        return { label: t("paused"), tone: "outline" };
      case "scheduled":
        return { label: t("scheduled"), tone: "outline" };
    }
  })();

  const note =
    state === "due" && row.willAutoPay && renewsOn
      ? t("paidIfNothing", { date: shortDate(renewsOn) })
      : state === "saved" && renewsOn
        ? t("paysOn", { date: shortDate(renewsOn) })
        : (state === "paid" || state === "autopaid") && nextDate
          ? t("nextOn", { date: shortDate(nextDate) })
          : state === "scheduled" && dueDate
            ? t("scheduledOn", { date: shortDate(dueDate) })
            : null;

  const meta = [
    row.category?.name ?? tc("uncategorized"),
    t("every", { day: rule.dayOfMonth }),
    late ? t("billOfMonth", { month: recordMonth }) : null,
    instance?.note ?? rule.note,
  ]
    .filter(Boolean)
    .join(" · ");

  const editRecord = () => {
    if (!instance) return;
    const latest = siblings.every((other) => (other.instancePeriod ?? "") <= (instancePeriod ?? ""));
    openEdit({ ...instance, ruleDay: rule.dayOfMonth, applyToRule: open && !late && latest });
  };

  const items: MenuItem[] = [];
  if (instance?.status === "settled") {
    items.push({ label: t("markUnpaid"), icon: <Undo2 className="rtl:-scale-x-100" />, onSelect: () => moveBill(instance, "pending", t("markedUnpaid")) });
  }
  if (instance?.status === "saved") {
    items.push({ label: t("backToDue"), icon: <RotateCcw />, onSelect: () => moveBill(instance, "pending", t("movedBackToDue")) });
  }
  if (row.canManageRule && !late) {
    items.push({ label: tc("edit"), icon: <Pencil />, onSelect: () => onEditRule(row) });
  } else if (instance) {
    items.push({ label: tc("edit"), icon: <Pencil />, onSelect: editRecord });
  }
  if (row.canSkip && !late) {
    items.push({ label: t("skip.label", { month: recordMonth }), icon: <SkipForward className="rtl:-scale-x-100" />, onSelect: () => ask("skip") });
  }
  if (row.canManageRule) {
    if (items.length > 0) items.push({ type: "separator" });
    if (rule.isActive) {
      items.push({ label: t("pause.action"), icon: <Pause />, onSelect: () => ask("pause") });
    } else if (state !== "paused") {
      items.push({ label: t("resume"), icon: <Play />, onSelect: () => run(() => setRuleActive(rule.id, true), t("resumed")) });
    }
    items.push({ label: t("delete.action"), icon: <Trash2 />, tone: "danger", onSelect: () => ask("delete") });
  }

  return (
    <>
      <motion.li
        layout="position"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: pending ? 0.6 : 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl px-2 py-3 transition-colors hover:bg-surface-2 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]"
      >
        <CategoryIcon
          icon={row.category?.icon}
          color={row.category?.color}
          className={cn("col-start-1 row-start-1 self-start", inert && "opacity-70")}
        />

        <div className="col-start-2 row-start-1 min-w-0">
          <p className={cn("truncate text-[14px] font-medium", inert ? "text-ink-2" : "text-ink")}>{title}</p>
          <p className="truncate text-[12px] text-ink-3">{meta}</p>
          {fromOtherMonth && renewsOn ? (
            <p className="mt-0.5 text-[12px] text-ink-2">{t("closes", { month: recordMonth, date: shortDate(renewsOn) })}</p>
          ) : null}
          {fromOtherMonth && nextDate ? (
            <p className="text-[12px] text-ink-3">{t("arrives", { month: monthName(periodOf(nextDate)), date: shortDate(nextDate) })}</p>
          ) : null}
          {note ? <p className="mt-0.5 text-[12px] text-ink-2">{note}</p> : null}
          {unseenAutoPaid ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-2">
              {t("autoPaidLine", { month: monthName(unseenAutoPaid.period), date: shortDate(unseenAutoPaid.settledOn) })}
              <button
                type="button"
                disabled={pending}
                onClick={() => moveBill({ id: unseenAutoPaid.entryId, status: "settled" }, "pending", t("markedUnpaid"))}
                className="font-medium text-ink underline underline-offset-2 transition hover:text-ink-2"
              >
                {t("undo")}
              </button>
            </p>
          ) : null}
        </div>

        <Money
          amount={amount}
          kind="credit"
          signed
          muted={inert}
          label={title}
          className="col-start-3 row-start-1 self-start text-[14.5px] font-medium lg:col-start-4 lg:self-center"
        />

        <div className="col-span-2 col-start-1 row-start-2 flex flex-wrap items-center gap-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:justify-end">
          <Badge tone={chip.tone}>{chip.label}</Badge>
          {state === "saved" && !row.funded ? <Badge tone="warn">{t("notFunded")}</Badge> : null}
          <div className="ms-auto flex items-center gap-1.5 lg:ms-0">
            {row.canSave && instance ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                className="hover:border-saved hover:text-saved-ink"
                onClick={() => moveBill(instance, "saved", t("movedToSavings"))}
              >
                <PiggyBank className="h-3.5 w-3.5" /> {t("savings")}
              </Button>
            ) : null}
            {row.canAct && instance ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                className="hover:border-inflow hover:text-inflow-ink"
                onClick={() => moveBill(instance, "settled", t("markedPaid"))}
              >
                <Check className="h-3.5 w-3.5" /> {t("paid")}
              </Button>
            ) : null}
            {late && row.canSkip ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => ask("skip")}>
                {t("skip.label", { month: recordMonth })}
              </Button>
            ) : null}
            {state === "skipped" && instancePeriod ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => unskipRulePeriod(rule.id, instancePeriod), t("broughtBack", { month: recordMonth }))}
              >
                {t("bringBack")}
              </Button>
            ) : null}
            {state === "paused" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => setRuleActive(rule.id, true), t("resumed"))}
              >
                <Play className="h-3.5 w-3.5" /> {t("resume")}
              </Button>
            ) : null}
          </div>
        </div>

        {items.length > 0 ? (
          <div className="col-start-3 row-start-2 justify-self-end lg:col-start-5 lg:row-start-1">
            <Menu items={items} />
          </div>
        ) : null}
      </motion.li>
      <BillRowConfirm
        kind={confirm.kind}
        open={confirm.open}
        onClose={() => setConfirm((current) => ({ ...current, open: false }))}
        row={row}
        siblings={siblings}
      />
    </>
  );
}
