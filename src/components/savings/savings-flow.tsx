"use client";

import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { CalendarClock, ChevronRight, CircleCheck, PiggyBank, Plus, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useEntryModal } from "@/components/providers/entry-modal-provider";

const STEPS = [
  { key: "due", icon: CalendarClock, tile: "bg-warn-soft text-warn-ink" },
  { key: "saved", icon: PiggyBank, tile: "bg-saved-soft text-saved-ink" },
  { key: "auto", icon: CircleCheck, tile: "bg-inflow-soft text-inflow-ink" },
  { key: "back", icon: Repeat, tile: "bg-accent-soft text-accent-ink" },
] as const;

const sequence = { hidden: {}, shown: { transition: { staggerChildren: 0.12 } } };
const reveal = { hidden: { opacity: 0, y: 10 }, shown: { opacity: 1, y: 0 } };

/** Teaches the lifecycle for as long as nothing is in savings. */
export function SavingsFlow({ canAdd }: { canAdd: boolean }) {
  const t = useTranslations("savings.flow");
  const { openAdd } = useEntryModal();

  return (
    <Card>
      <CardHeader title={t("title")} description={t("description")} />
      <CardBody className="@container pt-6">
        <motion.div variants={sequence} initial="hidden" animate="shown">
          <ol className="grid gap-5 @lg:grid-cols-4 @lg:gap-3">
            {STEPS.map((step, index) => (
              <motion.li
                key={step.key}
                variants={reveal}
                className="relative flex items-start gap-3 @lg:flex-col @lg:items-center @lg:text-center"
              >
                {index < STEPS.length - 1 ? (
                  // Runs from this tile's edge to the next tile's edge, 6px clear of both.
                  <span
                    aria-hidden
                    className="absolute start-6 top-14 -bottom-4 w-px bg-line-strong @lg:start-[calc(50%+30px)] @lg:end-[calc(18px-50%)] @lg:top-6 @lg:bottom-auto @lg:h-px @lg:w-auto"
                  >
                    <ChevronRight className="absolute -end-1 top-1/2 hidden h-3 w-3 -translate-y-1/2 text-line-strong @lg:block rtl:-scale-x-100" />
                  </span>
                ) : null}
                <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", step.tile)}>
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink">{t(`${step.key}.title`)}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{t(`${step.key}.body`)}</span>
                </span>
              </motion.li>
            ))}
          </ol>

          {/* The way back from the last step to the first, when the steps sit in a row. */}
          <motion.div
            aria-hidden
            variants={reveal}
            className="relative mx-[12.5%] mt-3 hidden h-6 rounded-b-2xl border-x border-b border-dashed border-line-strong @lg:block"
          >
            <span className="absolute inset-x-0 -bottom-2.5 mx-auto flex w-fit items-center gap-1 bg-surface px-2 text-[11px] font-medium text-ink-3">
              <Repeat className="h-3 w-3" />
              {t("loop")}
            </span>
          </motion.div>
        </motion.div>

        {canAdd ? (
          <div className="mt-7 flex justify-center">
            <Button size="sm" onClick={() => openAdd({ kind: "credit", bucket: "fixed" })}>
              <Plus className="h-3.5 w-3.5" /> {t("add")}
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
