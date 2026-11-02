"use client";

import { useTranslations } from "next-intl";
import { CalendarClock, Sparkles } from "lucide-react";
import type { Savings } from "@/lib/queries/savings";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { useFormat } from "@/components/providers/settings-provider";
import { SavingsRing } from "./savings-ring";
import { useBillDates } from "@/components/fixed/use-bill-dates";

const CHIP = "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-medium [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0";

export function SavingsHero({ data }: { data: Savings }) {
  const t = useTranslations("savings.hero");
  const { money } = useFormat();
  const { shortDate } = useBillDates();
  const { billsSaved, freeToSpend, ring, nextAutoPay, incomeShare, fixedMonthlyTotal } = data;

  const insight =
    incomeShare !== null
      ? t("incomeShare", { pct: incomeShare })
      : fixedMonthlyTotal > 0
        ? t("monthlyTotal", { amount: money(fixedMonthlyTotal) })
        : null;

  return (
    <Card className="@container relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 -top-28 h-80 w-80 rounded-full opacity-70 blur-3xl"
        style={{ background: "var(--saved-soft)" }}
      />
      <CardBody className="relative flex flex-col gap-7 p-6 @xl:flex-row @xl:items-center @xl:justify-between sm:p-7">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-ink-3 rtl:tracking-normal">{t("inSavings")}</p>
          <Money
            amount={billsSaved}
            label={t("inSavings")}
            className="font-display mt-1 block text-[44px] leading-none text-saved-ink sm:text-[52px]"
          />

          <p className="mt-6 text-[13px] font-medium text-ink-2">{t("freeToSpend")}</p>
          <Money
            amount={freeToSpend}
            kind={freeToSpend < 0 ? "net" : undefined}
            label={t("freeToSpend")}
            className="font-display mt-1 block text-[24px] leading-none"
          />
          <p className="mt-1.5 text-[12px] text-ink-3">{t("freeToSpendNote")}</p>

          {nextAutoPay || insight ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {nextAutoPay ? (
                <span className={cn(CHIP, "bg-saved-soft text-saved-ink")}>
                  <CalendarClock />
                  {t("nextAutoPay", {
                    count: nextAutoPay.count,
                    amount: money(nextAutoPay.amount),
                    date: shortDate(nextAutoPay.date),
                  })}
                </span>
              ) : null}
              {insight ? (
                <span className={cn(CHIP, "bg-surface-2 text-ink-2")}>
                  <Sparkles />
                  {insight}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-4 @xl:flex-col @xl:gap-3 @xl:text-center">
          <SavingsRing part={ring.inSavings} total={ring.total} />
          <p className="min-w-0 text-[13px] font-medium text-ink-2 @xl:max-w-[180px]">
            {ring.total > 0 ? t("ring", { amount: money(ring.inSavings), total: money(ring.total) }) : t("ringClear")}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
