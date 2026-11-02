"use client";

import { useFormat } from "@/components/providers/settings-provider";
import { formatNumber } from "@/lib/format";
import { round2 } from "@/lib/utils";

const MAX_CONSTANT_DECIMALS = 6;

export function decimalSeparatorOf(locale: string) {
  return new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === "decimal")?.value ?? ".";
}

/** The calculator's one way to show numbers: to the cent, never rounded to whole units. */
export function useCalculatorFormat() {
  const { money, settings } = useFormat();

  return {
    exact: (value: number, opts?: { signed?: boolean }) => {
      const rounded = round2(value);
      return money(rounded, {
        signed: opts?.signed,
        maximumFractionDigits: 2,
        minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
      });
    },
    /** A number the user typed, such as the 12 in `× 12`. It is not money. */
    constant: (value: number) => formatNumber(value, settings.locale, MAX_CONSTANT_DECIMALS),
    /** A number still being typed: "12." has to keep its separator. */
    draft: (raw: string) => {
      const [whole, decimals] = raw.split(".");
      const wholeText = formatNumber(Number(whole), settings.locale);
      return decimals === undefined ? wholeText : `${wholeText}${decimalSeparatorOf(settings.locale)}${decimals}`;
    },
  };
}
