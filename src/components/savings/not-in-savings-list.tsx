"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import { PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { moveAllToSavings } from "@/lib/actions/savings";
import { daysBetween } from "@/lib/fixed/cycle";
import { savingsShortBy, type Obligation, type Position } from "@/lib/fixed/position";
import { cn, sumMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-chip";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Money } from "@/components/ui/money";
import { useFormat } from "@/components/providers/settings-provider";
import { rowPresence } from "./motion";
import { useBillStatus } from "./use-bill-status";
import { useBillDates } from "@/components/fixed/use-bill-dates";

function NotInSavingsRow({ bill, today }: { bill: Obligation; today: string }) {
  const t = useTranslations("savings.notIn");
  const tc = useTranslations("common");
  const { shortDate } = useBillDates();
  const { pending, moveTo } = useBillStatus(bill.id, bill.title, "pending");

  const dueChip =
    bill.phase === "today"
      ? t("dueToday")
      : bill.phase === "open"
        ? t("wasDue", { date: shortDate(bill.date) })
        : t("dueIn", { count: daysBetween(today, bill.date) });

  return (
    <motion.li {...rowPresence} className="overflow-hidden">
      {/* Two lines when narrow. With room, the wrapper dissolves and `order` lines the amounts up in a column. */}
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2.5 px-5 py-3.5 transition-opacity @lg:flex-nowrap", pending && "opacity-60")}>
        <CategoryIcon icon={bill.category?.icon} color={bill.category?.color} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-ink">{bill.title}</p>
          <p className="truncate text-[12px] text-ink-3">{bill.category?.name ?? tc("uncategorized")}</p>
          {bill.willAutoPay && bill.renewsOn ? (
            <p className="mt-0.5 text-[12px] text-ink-3">{t("autoNote", { date: shortDate(bill.renewsOn) })}</p>
          ) : null}
        </div>
        <Money amount={bill.amount} label={bill.title} className="text-[15px] font-semibold @lg:order-2" />
        <div className="flex w-full items-center justify-between gap-2 @lg:contents">
          <Badge tone={bill.phase === "upcoming" ? "neutral" : "warn"} className="@lg:order-1">
            {dueChip}
          </Badge>
          <Button size="sm" variant="outline" loading={pending} onClick={() => moveTo("saved")} className="@lg:order-3">
            {pending ? null : <PiggyBank className="h-3.5 w-3.5" />} {t("save")}
          </Button>
        </div>
      </div>
    </motion.li>
  );
}

export function NotInSavingsList({
  bills,
  position,
  today,
  notice,
}: {
  bills: Obligation[];
  position: Pick<Position, "balance" | "billsSaved">;
  today: string;
  notice: ReactNode;
}) {
  const t = useTranslations("savings");
  const { money } = useFormat();
  const [confirming, setConfirming] = useState(false);

  const total = sumMoney(bills.map((bill) => bill.amount));
  const shortAfterMove = savingsShortBy(position, total);

  const moveAll = async () => {
    const result = await moveAllToSavings();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const moved = t("toast.movedAll", { count: result.data?.count ?? 0 });
    const shortBy = result.data?.shortBy ?? 0;
    if (shortBy > 0) toast.warning(t("toast.short", { amount: money(shortBy) }), { description: moved });
    else toast.success(moved);
  };

  return (
    <Card>
      <CardHeader
        className="flex-wrap"
        title={t("notIn.title")}
        description={t("summary", { count: bills.length, total: money(total) })}
        action={
          bills.length > 1 ? (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              <PiggyBank className="h-3.5 w-3.5" /> {t("notIn.moveAll")}
            </Button>
          ) : null
        }
      />
      {notice ? <div className="px-5 pt-3">{notice}</div> : null}
      <ul className="@container mt-2 divide-y divide-line pb-1">
        <AnimatePresence initial={false}>
          {bills.map((bill) => (
            <NotInSavingsRow key={bill.id} bill={bill} today={today} />
          ))}
        </AnimatePresence>
      </ul>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        tone="primary"
        title={t("notIn.confirmTitle")}
        confirmLabel={t("notIn.moveAll")}
        description={
          <div className="space-y-2">
            <p>{t("notIn.confirmBody", { count: bills.length, total: money(total) })}</p>
            {shortAfterMove > 0 ? (
              <p className="text-warn-ink">{t("notIn.confirmShort", { amount: money(shortAfterMove) })}</p>
            ) : null}
          </div>
        }
        onConfirm={moveAll}
      />
    </Card>
  );
}
