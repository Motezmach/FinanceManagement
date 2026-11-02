"use client";

import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check, Undo2 } from "lucide-react";
import type { SavingsRow } from "@/lib/queries/savings";
import { daysBetween } from "@/lib/fixed/cycle";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Money } from "@/components/ui/money";
import { useFormat } from "@/components/providers/settings-provider";
import { EASE_OUT, rowPresence } from "./motion";
import { useBillStatus } from "./use-bill-status";
import { useBillDates } from "@/components/fixed/use-bill-dates";

/** From the day money went in savings to the day it pays. The dates under it say the same in words. */
function CountdownBar({ progress, funded }: { progress: number; funded: boolean }) {
  const reduce = useReducedMotion();
  const fill = funded ? "bg-saved" : "bg-warn";
  return (
    <div aria-hidden className="relative h-1.5 rounded-full bg-surface-3">
      <motion.div
        className={cn("absolute inset-y-0 start-0 rounded-full", fill)}
        initial={{ width: 0 }}
        animate={{ width: `${progress * 100}%` }}
        transition={{ duration: reduce ? 0 : 0.9, ease: EASE_OUT }}
      >
        <span className={cn("absolute -end-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-surface", fill)} />
      </motion.div>
    </div>
  );
}

function InSavingsRow({ row, today }: { row: SavingsRow; today: string }) {
  const { entry, category, renewsOn, savedAt, progress, willAutoPay, funded } = row;
  const t = useTranslations("savings.inSavings");
  const tc = useTranslations("common");
  const { statusLabel } = useFormat();
  const { shortDate } = useBillDates();
  const { pending, moveTo } = useBillStatus(entry.id, entry.title, "saved");

  return (
    <motion.li {...rowPresence} className="overflow-hidden">
      <div className={cn("px-5 py-4 transition-opacity", pending && "opacity-60")}>
        <div className="flex items-center gap-3">
          <CategoryIcon icon={category?.icon} color={category?.color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium text-ink">{entry.title}</p>
            <p className="truncate text-[12px] text-ink-3">{category?.name ?? tc("uncategorized")}</p>
          </div>
          <Money amount={entry.amount} label={entry.title} className="text-[15px] font-semibold" />
        </div>

        <div className="mt-3.5">
          <CountdownBar progress={progress} funded={funded} />
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[12px]">
            <span className="text-ink-3">{savedAt ? t("since", { date: shortDate(savedAt) }) : null}</span>
            {willAutoPay ? <span className="font-medium text-ink-2">{t("paysOn", { date: shortDate(renewsOn) })}</span> : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="saved">{t("left", { count: Math.max(0, daysBetween(today, renewsOn)) })}</Badge>
            {funded ? null : (
              <Badge tone="warn">
                <AlertTriangle className="h-3 w-3" />
                {t("notFunded")}
              </Badge>
            )}
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => moveTo("pending")}>
              <Undo2 className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t("backToDue")}
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => moveTo("settled")}>
              <Check className="h-3.5 w-3.5" /> {statusLabel("settled", "credit")}
            </Button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

export function InSavingsList({ rows, total, today }: { rows: SavingsRow[]; total: number; today: string }) {
  const t = useTranslations("savings");
  const { money } = useFormat();

  return (
    <Card>
      <CardHeader title={t("inSavings.title")} description={t("summary", { count: rows.length, total: money(total) })} />
      <ul className="mt-2 divide-y divide-line pb-1">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <InSavingsRow key={row.entry.id} row={row} today={today} />
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}
