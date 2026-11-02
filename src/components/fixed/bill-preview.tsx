"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CalendarClock } from "lucide-react";
import type { Status } from "@/lib/config/buckets";
import { daysBetween, periodOf, renewsOn, willAutoPay } from "@/lib/fixed/cycle";
import { Button } from "@/components/ui/button";
import { useBillDates } from "./use-bill-dates";

const SOON_DAYS = 7;

/** The wizard's review of a new monthly bill: what happens next, and when it pays by itself. */
export function BillPreview({
  status,
  autoPay,
  date,
  moved,
  day,
  today,
  onStartNextMonth,
}: {
  status: Status;
  autoPay: boolean;
  /** The date the first record lands on. */
  date: string;
  /** `date` differs from what was typed, because that date had passed. */
  moved: boolean;
  day: number;
  today: string;
  onStartNextMonth?: () => void;
}) {
  const t = useTranslations("fixed");
  const tp = useTranslations("fixed.preview");
  const te = useTranslations("entry");
  const { shortDate } = useBillDates();

  const renewal = renewsOn(periodOf(date), day);
  const paysItself = willAutoPay(status, autoPay, false);
  const daysLeft = daysBetween(today, renewal);

  const lines = [
    moved ? tp("moved", { date: shortDate(date) }) : null,
    status === "settled"
      ? tp("paidNow")
      : status === "saved"
        ? tp("savedNow")
        : periodOf(date) > periodOf(today)
          ? tp("scheduled", { date: shortDate(date) })
          : tp("dueOn", { date: shortDate(date) }),
    status === "saved"
      ? t("paysOn", { date: shortDate(renewal) })
      : paysItself
        ? t("paidIfNothing", { date: shortDate(renewal) })
        : status === "pending"
          ? tp("staysDue")
          : null,
    te("comesBack", { day }),
  ].filter((line) => line !== null);

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5 rounded-xl2 border border-line p-4 text-[13px] text-ink-2">
        {lines.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ul>
      {paysItself && daysLeft < SOON_DAYS && onStartNextMonth ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl2 bg-warn-soft px-4 py-3 text-[13px] text-warn-ink">
          <span className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {tp("soon", { count: daysLeft })}
          </span>
          <Button size="sm" variant="outline" onClick={onStartNextMonth}>
            {tp("startNextMonth")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
