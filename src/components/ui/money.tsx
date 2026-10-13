"use client";

import { useFormat } from "@/components/providers/settings-provider";
import { cn } from "@/lib/utils";
import type { Kind } from "@/lib/config/buckets";

/**
 * Formats an amount with the user's currency. Pass `kind` to color it
 * (debit = inflow green, credit = outflow clay) and `signed` to prefix +/−.
 */
export function Money({
  amount,
  kind,
  signed,
  compact,
  muted,
  className,
}: {
  amount: number;
  kind?: Kind | "net";
  signed?: boolean;
  compact?: boolean;
  muted?: boolean;
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

  return (
    <span className={cn("tabular", tone, className)}>
      {money(value, { signed: signed || kind === "net", compact })}
    </span>
  );
}
