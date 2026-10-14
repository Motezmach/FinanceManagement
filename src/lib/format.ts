import { format, parseISO, type Locale as DateFnsLocale } from "date-fns";
import { ar, enUS, fr } from "date-fns/locale";
import type { Locale } from "@/lib/i18n/locales";

const DATE_LOCALES: Record<Locale, DateFnsLocale> = { en: enUS, fr, ar };

export function dateLocale(locale: Locale | string | undefined): DateFnsLocale {
  return DATE_LOCALES[(locale as Locale) ?? "en"] ?? enUS;
}

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
export function formatDay(iso: string, locale: Locale = "en") {
  return format(parseISO(iso), "EEE d MMM", { locale: dateLocale(locale) });
}

export function formatLongDate(d: Date, locale: Locale = "en") {
  return format(d, "EEEE, d MMMM yyyy", { locale: dateLocale(locale) });
}

export function formatMonth(iso: string, locale: Locale = "en") {
  // iso = "YYYY-MM"
  return format(parseISO(`${iso}-01`), "MMMM yyyy", { locale: dateLocale(locale) });
}

export function formatShortMonth(iso: string, locale: Locale = "en") {
  return format(parseISO(`${iso}-01`), "MMM", { locale: dateLocale(locale) });
}

/** Localised weekday names, Monday first. `width` = "short" (Mon) or "narrow" (M). */
export function weekdayNames(locale: Locale = "en", width: "short" | "narrow" = "short") {
  const l = dateLocale(locale);
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    format(new Date(2024, 0, 1 + i), width === "short" ? "EEE" : "EEEEE", { locale: l }),
  );
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
