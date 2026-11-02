"use client";

import { useTranslations } from "next-intl";
import { motion, MotionConfig, useReducedMotion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import type { Savings } from "@/lib/queries/savings";
import { cn } from "@/lib/utils";
import { AutoPayBanner } from "@/components/fixed/autopay-banner";
import { useFormat } from "@/components/providers/settings-provider";
import { InSavingsList } from "./in-savings-list";
import { EASE_OUT } from "./motion";
import { NotInSavingsList } from "./not-in-savings-list";
import { SavingsFlow } from "./savings-flow";
import { SavingsHero } from "./savings-hero";
import { SavingsHistory } from "./savings-history";

const enter = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } } as const;

export function SavingsView({ data, today }: { data: Savings; today: string }) {
  const t = useTranslations("savings");
  const { money } = useFormat();
  const reduce = useReducedMotion();

  const hasInSavings = data.inSavings.length > 0;
  const hasNotInSavings = data.notInSavings.length > 0;
  const hasHistory = data.history.length > 0;

  const shortfall =
    data.shortfall > 0 ? (
      <p className="flex items-start gap-2.5 rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn-ink">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {t("shortfall", { amount: money(data.shortfall) })}
      </p>
    ) : null;

  return (
    <MotionConfig reducedMotion="user" transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE_OUT }}>
      <div className="space-y-6">
        <AutoPayBanner items={data.autoPaidUnseen} total={data.autoPaidTotal} />

        {!hasInSavings && !hasNotInSavings && !hasHistory ? (
          <motion.div {...enter}>
            <SavingsFlow canAdd />
          </motion.div>
        ) : (
          <>
            <motion.div {...enter} className="space-y-3">
              <SavingsHero data={data} />
              {hasNotInSavings ? null : shortfall}
            </motion.div>

            <motion.div {...enter} className={cn("grid items-start gap-6", hasHistory && "xl:grid-cols-[1.5fr_1fr]")}>
              <div className="min-w-0 space-y-6">
                {hasInSavings ? <InSavingsList rows={data.inSavings} total={data.billsSaved} today={today} /> : null}
                {hasNotInSavings ? (
                  <NotInSavingsList bills={data.notInSavings} position={data} today={today} notice={shortfall} />
                ) : null}
                {hasInSavings ? null : <SavingsFlow canAdd={!hasNotInSavings} />}
              </div>
              {hasHistory ? (
                <div className="min-w-0">
                  <SavingsHistory entries={data.history} />
                </div>
              ) : null}
            </motion.div>
          </>
        )}
      </div>
    </MotionConfig>
  );
}
