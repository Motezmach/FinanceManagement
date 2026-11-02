"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { CheckCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import type { AutoPaidItem } from "@/lib/queries/savings";
import { setEntryStatus } from "@/lib/actions/entries";
import { acknowledgeAutoPaid } from "@/lib/actions/savings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Dialog } from "@/components/ui/dialog";
import { Money } from "@/components/ui/money";
import { useFormat } from "@/components/providers/settings-provider";
import { useBillDates } from "./use-bill-dates";

function AutoPaidRow({ item, onUndone }: { item: AutoPaidItem; onUndone: () => void }) {
  const t = useTranslations("fixed.autoPayBanner");
  const { shortDate } = useBillDates();
  const [busy, start] = useTransition();

  const undo = () =>
    start(async () => {
      const res = await setEntryStatus(item.id, "pending", "settled");
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("undone"));
      onUndone();
    });

  return (
    <li className={cn("flex items-center gap-3 py-3 transition-opacity", busy && "opacity-60")}>
      <CategoryIcon icon={item.category?.icon} color={item.category?.color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{item.title}</p>
        <p className="truncate text-[12px] text-ink-3">
          {t("paidOn", { date: shortDate(item.settledAt) })}
          {item.fromSavings ? ` · ${t("fromSavings")}` : null}
        </p>
      </div>
      <Money amount={item.amount} label={item.title} className="shrink-0 text-[14px] font-medium" />
      <Button size="sm" variant="ghost" disabled={busy} onClick={undo}>
        <Undo2 className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t("undo")}
      </Button>
    </li>
  );
}

/** Tells the user money left their balance without them doing anything, and lets them take it back. */
export function AutoPayBanner({ items, total }: { items: AutoPaidItem[]; total: number }) {
  const t = useTranslations("fixed.autoPayBanner");
  const { money } = useFormat();
  const [reviewing, setReviewing] = useState(false);
  const [dismissing, startDismiss] = useTransition();

  const dismiss = () =>
    startDismiss(async () => {
      const res = await acknowledgeAutoPaid();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setReviewing(false);
    });

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false}>
        {items.length > 0 ? (
          <motion.div
            key="autopay-banner"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl2 border border-saved/40 bg-saved-soft px-4 py-3 text-[13.5px] text-saved-ink"
          >
            <CheckCheck className="h-4 w-4 shrink-0" />
            <p className="min-w-0 flex-1 basis-56">{t("summary", { count: items.length, amount: money(total) })}</p>
            <div className="ms-auto flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setReviewing(true)}>
                {t("review")}
              </Button>
              <Button size="sm" variant="ghost" loading={dismissing} onClick={dismiss}>
                {t("gotIt")}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Dialog
        open={reviewing && items.length > 0}
        onClose={() => setReviewing(false)}
        title={t("reviewTitle")}
        description={t("reviewSub")}
      >
        <ul className="divide-y divide-line px-6 py-2">
          {items.map((item) => (
            <AutoPaidRow
              key={item.id}
              item={item}
              onUndone={() => {
                if (items.length === 1) setReviewing(false);
              }}
            />
          ))}
        </ul>
        <div className="flex justify-end border-t border-line px-6 py-4">
          {/* Takes the initial focus so that Enter never undoes a payment. */}
          <Button data-autofocus loading={dismissing} onClick={dismiss}>
            {t("gotIt")}
          </Button>
        </div>
      </Dialog>
    </MotionConfig>
  );
}
