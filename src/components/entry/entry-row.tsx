"use client";

import { useState, type MouseEventHandler, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Hourglass, Pencil, PiggyBank, Repeat, RotateCcw, SkipForward, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { EntryWithCategory } from "@/lib/queries/entries";
import { deleteEntry } from "@/lib/actions/entries";
import { makeMonthly } from "@/lib/actions/rules";
import { dayOfDate, isOpen, periodOf, renewsOn } from "@/lib/fixed/cycle";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useBillActions } from "@/components/fixed/use-bill-actions";
import { useBillDates } from "@/components/fixed/use-bill-dates";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";

function RowButton({
  icon,
  label,
  compact,
  hoverTone,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  compact: boolean;
  hoverTone: string;
  disabled: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[12px] font-medium text-ink-2 transition disabled:pointer-events-none [&>svg]:h-3.5 [&>svg]:w-3.5",
        hoverTone,
      )}
    >
      {icon}
      {compact ? null : label}
    </button>
  );
}

export function EntryRow({
  entry,
  showDate = true,
  showBucket = false,
  compact = false,
  offerMonthly = false,
  className,
}: {
  entry: EntryWithCategory;
  showDate?: boolean;
  showBucket?: boolean;
  compact?: boolean;
  /** Keeps "Make this monthly" on the row instead of only in its menu. */
  offerMonthly?: boolean;
  className?: string;
}) {
  const { openEdit, today } = useEntryModal();
  const { bucketLabel, statusLabel, day } = useFormat();
  const { monthName } = useBillDates();
  const { pending, run, moveBill } = useBillActions();
  const t = useTranslations("entry");
  const tf = useTranslations("fixed");
  const tc = useTranslations("common");
  const [confirm, setConfirm] = useState(false);

  const isDebit = entry.kind === "debit";
  const isFixed = !isDebit && entry.bucket === "fixed";
  const isBill = isFixed && entry.ruleId !== null;
  const openBill = isBill && isOpen(entry.status);
  const recordPeriod = entry.period ?? periodOf(entry.date);
  const recordMonth = monthName(recordPeriod);
  const ruleDay = entry.rule?.dayOfMonth ?? dayOfDate(entry.date);
  const late = openBill && renewsOn(recordPeriod, ruleDay) <= today;
  const canSave = isBill && entry.status === "pending" && !late;
  const autoPaid = entry.status === "settled" && entry.autoPaid;
  const canMakeMonthly = isFixed && entry.ruleId === null;

  const settleLabel = isDebit ? t("markReceived") : t("markPaid");
  const settleToast = isDebit ? t("movedToWallet") : t("markedPaid");
  const settle = () => moveBill(entry, "settled", settleToast);
  const moveToSavings = () => moveBill(entry, "saved", tf("movedToSavings"));
  const makeThisMonthly = () => run(() => makeMonthly(entry.id), tf("madeMonthly"));

  const items: MenuItem[] = [];
  if (entry.status !== "settled") {
    items.push({ label: settleLabel, icon: <Check />, onSelect: settle });
  }
  if (canSave) {
    items.push({ label: tf("savings"), icon: <PiggyBank />, onSelect: moveToSavings });
  }
  if (entry.status === "saved") {
    items.push({ label: tf("backToDue"), icon: <RotateCcw />, onSelect: () => moveBill(entry, "pending", tf("movedBackToDue")) });
  }
  if (entry.status === "planned") {
    items.push({
      label: isDebit ? t("moveToPending") : t("markDue"),
      icon: <Hourglass />,
      onSelect: () => moveBill(entry, "pending", isDebit ? t("movedToPending") : t("markedDue")),
    });
  }
  if (entry.status === "settled" && (!isDebit || entry.bucket === "wallet")) {
    items.push({
      label: isDebit ? t("backToPending") : t("markUnpaid"),
      icon: <Undo2 className="rtl:-scale-x-100" />,
      onSelect: () => moveBill(entry, "pending", isDebit ? t("movedBackPending") : t("markedUnpaid")),
    });
  }
  if (entry.status === "pending" && isDebit) {
    items.push({ label: t("backToPotential"), icon: <RotateCcw />, onSelect: () => moveBill(entry, "planned", t("movedToPotential")) });
  }
  if (canMakeMonthly) {
    items.push({ label: tf("makeMonthly"), icon: <Repeat />, onSelect: makeThisMonthly });
  }
  items.push({
    label: tc("edit"),
    icon: <Pencil />,
    onSelect: () => openEdit({ ...entry, ruleDay, applyToRule: openBill && !late && recordPeriod >= periodOf(today) }),
  });
  items.push({ type: "separator" });
  items.push(
    openBill
      ? { label: tf("skip.label", { month: recordMonth }), icon: <SkipForward className="rtl:-scale-x-100" />, onSelect: () => setConfirm(true) }
      : { label: tc("delete"), icon: <Trash2 />, tone: "danger", onSelect: () => setConfirm(true) },
  );

  const statusTone: BadgeTone =
    entry.status === "settled"
      ? isDebit
        ? "inflow"
        : "neutral"
      : entry.status === "saved"
        ? "saved"
        : late
          ? "danger"
          : entry.status === "pending"
            ? "warn"
            : "outline";
  const statusText = autoPaid ? tf("paidAuto") : late ? tf("late") : statusLabel(entry.status, entry.kind);
  // Badges do not fit on a phone, so what changes how a bill reads goes on the meta line.
  const phoneStatus = autoPaid || late || entry.status === "saved" ? statusText : null;
  const meta = [
    entry.category?.name ?? tc("uncategorized"),
    showBucket ? bucketLabel(entry.bucket) : null,
    showDate ? day(entry.date) : null,
    entry.note || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const boldTitle = (chunks: ReactNode) => <span className="font-medium text-ink">{chunks}</span>;

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-3 rounded-xl px-2 transition hover:bg-surface-2",
          compact ? "py-1.5" : "py-2.5",
          pending && "opacity-60",
          className,
        )}
      >
        <CategoryIcon icon={entry.category?.icon} color={entry.category?.color} size={compact ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn("truncate font-medium text-ink", compact ? "text-[13px]" : "text-[14px]")}>{entry.title}</p>
            {entry.ruleId ? <Repeat className="h-3 w-3 shrink-0 text-ink-3" aria-label={tc("recurring")} /> : null}
            {entry.status !== "settled" || autoPaid ? (
              <Badge tone={statusTone} className="hidden sm:inline-flex">
                {statusText}
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-[12px] text-ink-3">
            {phoneStatus ? <span className="sm:hidden">{phoneStatus} · </span> : null}
            {meta}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {entry.status !== "settled" ? (
            <div className="hidden items-center gap-1 sm:group-focus-within:flex sm:group-hover:flex">
              {canSave ? (
                <RowButton
                  icon={<PiggyBank />}
                  label={tf("savings")}
                  compact={compact}
                  hoverTone="hover:border-saved hover:text-saved-ink"
                  disabled={pending}
                  onClick={moveToSavings}
                />
              ) : null}
              <RowButton
                icon={<Check />}
                label={isDebit ? t("received") : t("paid")}
                compact={compact}
                hoverTone="hover:border-inflow hover:text-inflow-ink"
                disabled={pending}
                onClick={settle}
              />
            </div>
          ) : null}
          {offerMonthly && canMakeMonthly ? (
            <div className="hidden sm:block">
              <RowButton
                icon={<Repeat />}
                label={tf("makeMonthly")}
                compact={compact}
                hoverTone="hover:border-line-strong hover:text-ink"
                disabled={pending}
                onClick={makeThisMonthly}
              />
            </div>
          ) : null}
          <Money
            amount={entry.amount}
            kind={entry.kind}
            signed
            muted={entry.status === "planned"}
            label={entry.title}
            className={cn("font-medium", compact ? "text-[13.5px]" : "text-[14.5px]")}
          />
          <Menu items={items} />
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone={openBill ? "primary" : "danger"}
        title={openBill ? tf("skip.title", { month: recordMonth }) : t("deleteTitle")}
        description={
          openBill
            ? tf.rich("skip.body", { title: entry.title, month: recordMonth, b: boldTitle })
            : t.rich("deleteBody", { title: entry.title, b: boldTitle })
        }
        confirmLabel={openBill ? tf("skip.label", { month: recordMonth }) : undefined}
        onConfirm={async () => {
          const res = await deleteEntry(entry.id, entry.status);
          if (!res.ok) toast.error(res.error);
          else toast.success(openBill ? tf("skip.done", { month: recordMonth }) : t("deleted"));
        }}
      />
    </>
  );
}
