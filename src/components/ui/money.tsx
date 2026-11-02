"use client";

import { useFormat } from "@/components/providers/settings-provider";
import { cn } from "@/lib/utils";
import type { Kind } from "@/lib/config/buckets";

/**
 * Formats an amount with the user's currency. Pass `kind` to color it
 * (debit = inflow green, credit = outflow clay) and `signed` to prefix +/−.
 * The `data-calc-*` attributes let the calculator pick the exact amount off the page,
 * even when the display is rounded or compact; `label` names it on the calculator's tape.
 */
export function Money({
  amount,
  kind,
  signed,
  compact,
  muted,
  label,
  className,
}: {
  amount: number;
  kind?: Kind | "net";
  signed?: boolean;
  compact?: boolean;
  muted?: boolean;
  label?: string;
  className?: string;
}) {
  const { money } = useFormat();
  let value = amount;
  if (signed && kind === "credit") value = -Math.abs(amount);
  if (signed && kind === "debit") value = Math.abs(amount);

  const tone =
    muted
      ? "text-ink-3"
      : kind === "debit"
        ? "text-inflow-ink"
        : kind === "credit"
          ? "text-outflow-ink"
          : kind === "net"
            ? value < 0
              ? "text-outflow-ink"
              : "text-ink"
            : "text-ink";

  // A credit's minus sign is only how money out is displayed. A net or an overdrawn balance really is negative.
  const keepsSign = kind === "net" || (kind === undefined && value < 0);

  return (
    <span
      dir="ltr"
      data-calc-amount={value}
      data-calc-label={label}
      data-calc-net={keepsSign ? "" : undefined}
      // Digits read left to right, but a block amount still lines up with its label in Arabic.
      className={cn("tabular rtl:text-right", tone, className)}
    >
      {money(value, { signed: signed || kind === "net", compact })}
    </span>
  );
}
