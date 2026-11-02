"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, PiggyBank } from "lucide-react";
import { Money } from "@/components/ui/money";

/** Sits beside the bucket tabs on Credits, but goes to its own page. */
export function SavingsLinkCard({ amount }: { amount: number }) {
  const t = useTranslations("fixed.savingsLink");
  return (
    <Link
      href="/credits/savings"
      className="group flex items-center gap-3 rounded-xl2 border border-line bg-surface/60 p-4 text-start transition hover:bg-surface"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saved-soft text-saved-ink">
        <PiggyBank className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[14px] font-semibold text-ink">{t("title")}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] text-ink-3">{t("sub")}</span>
          <Money amount={amount} label={t("sub")} className="text-[13px] font-medium" />
        </span>
      </span>
    </Link>
  );
}
