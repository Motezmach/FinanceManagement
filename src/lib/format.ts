import { format, parseISO } from "date-fns";

export function formatMoney(
  amount: number,
  currency = "USD",
  locale = "en-US",
  opts: { compact?: boolean; signed?: boolean; maximumFractionDigits?: number } = {},
) {
  const { compact = false, signed = false, maximumFractionDigits } = opts;
  const abs = Math.abs(amount);
  const nf = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact && abs >= 10000 ? "compact" : "standard",
    maximumFractionDigits: maximumFractionDigits ?? (compact && abs >= 10000 ? 1 : abs >= 1000 ? 0 : 2),
    minimumFractionDigits: 0,
  });
  const body = nf.format(abs);
  if (signed) {
    if (amount > 0) return `+${body}`;
    if (amount < 0) return `−${body}`;
  } else if (amount < 0) {
    return `−${body}`;
  }
  return body;
}

export function currencySymbol(currency = "USD", locale = "en-US") {
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(1);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
}

export function formatNumber(n: number, locale = "en-US", maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(n);
}

/** "Mon 13 Oct" style for compact rows. */
export function formatDay(iso: string) {
  return format(parseISO(iso), "EEE d MMM");
}

export function formatLongDate(d: Date) {
  return format(d, "EEEE, d MMMM yyyy");
}

export function formatMonth(iso: string) {
  // iso = "YYYY-MM"
  return format(parseISO(`${iso}-01`), "MMMM yyyy");
}

export function formatShortMonth(iso: string) {
  return format(parseISO(`${iso}-01`), "MMM");
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
