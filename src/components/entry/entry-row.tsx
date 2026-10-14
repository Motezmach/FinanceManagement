"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Hourglass, Pencil, Repeat, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { EntryWithCategory } from "@/lib/queries/entries";
import type { Status } from "@/lib/config/buckets";
import { deleteEntry, setEntryStatus } from "@/lib/actions/entries";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";

export function EntryRow({
  entry,
  showDate = true,
  showBucket = false,
  compact = false,
  className,
}: {
  entry: EntryWithCategory;
  showDate?: boolean;
  showBucket?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { openEdit } = useEntryModal();
  const { bucketLabel, statusLabel, day } = useFormat();
  const t = useTranslations("entry");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const isDebit = entry.kind === "debit";

  const move = (status: Status, label: string) =>
    start(async () => {
      const res = await setEntryStatus(entry.id, status);
      if (!res.ok) toast.error(res.error);
      else toast.success(label);
    });

  const settleLabel = isDebit ? t("markReceived") : t("markPaid");
  const settleToast = isDebit ? t("movedToWallet") : t("markedPaid");
  const items: MenuItem[] = [];
  if (entry.status !== "settled") {
    items.push({ label: settleLabel, icon: <Check />, onSelect: () => move("settled", settleToast) });
  }
  if (entry.status === "planned") {
    items.push({
      label: isDebit ? t("moveToPending") : t("markDue"),
      icon: <Hourglass />,
      onSelect: () => move("pending", isDebit ? t("movedToPending") : t("markedDue")),
    });
  }
  if (entry.status === "settled" && (!isDebit || entry.bucket === "wallet")) {
    items.push({
      label: isDebit ? t("backToPending") : t("markUnpaid"),
      icon: <Undo2 />,
      onSelect: () => move("pending", isDebit ? t("movedBackPending") : t("markedUnpaid")),
    });
  }
  if (entry.status === "pending" && isDebit) {
    items.push({ label: t("backToPotential"), icon: <RotateCcw />, onSelect: () => move("planned", t("movedToPotential")) });
  }
  items.push({ label: tc("edit"), icon: <Pencil />, onSelect: () => openEdit(entry) });
  items.push({ type: "separator" });
  items.push({ label: tc("delete"), icon: <Trash2 />, tone: "danger", onSelect: () => setConfirm(true) });

  const statusTone = entry.status === "settled" ? (isDebit ? "inflow" : "neutral") : entry.status === "pending" ? "warn" : "outline";
  const meta = [
    entry.category?.name ?? tc("uncategorized"),
    showBucket ? bucketLabel(entry.bucket) : null,
    showDate ? day(entry.date) : null,
    entry.note || null,
  ]
    .filter(Boolean)
    .join(" · ");

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
            {entry.status !== "settled" ? (
              <Badge tone={statusTone} className="hidden sm:inline-flex">
                {statusLabel(entry.status, entry.kind)}
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-[12px] text-ink-3">{meta}</p>
        </div>
        <div className="flex items-center gap-1">
          {entry.status !== "settled" ? (
            <button
              type="button"
              onClick={() => move("settled", settleToast)}
              title={settleLabel}
              className="hidden h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[12px] font-medium text-ink-2 opacity-0 transition hover:border-inflow hover:text-inflow-ink group-hover:opacity-100 sm:flex"
            >
              <Check className="h-3.5 w-3.5" /> {isDebit ? t("received") : t("paid")}
            </button>
          ) : null}
          <Money
            amount={entry.amount}
            kind={entry.kind}
            signed
            muted={entry.status === "planned"}
            className={cn("font-medium", compact ? "text-[13.5px]" : "text-[14.5px]")}
          />
          <Menu items={items} />
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("deleteTitle")}
        description={t.rich("deleteBody", { title: entry.title, b: (c) => <span className="font-medium text-ink">{c}</span> })}
        onConfirm={async () => {
          const res = await deleteEntry(entry.id);
          if (!res.ok) toast.error(res.error);
          else toast.success(t("deleted"));
        }}
      />
    </>
  );
}
