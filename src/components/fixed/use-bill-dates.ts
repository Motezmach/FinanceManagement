import { format, parseISO } from "date-fns";
import { useLocale } from "next-intl";
import { dateLocale } from "@/lib/format";
import type { Locale } from "@/lib/i18n/locales";

/** Bill dates short enough to sit inside a sentence. */
export function useBillDates() {
  const locale = useLocale() as Locale;
  const options = { locale: dateLocale(locale) };
  const dayPattern = (iso: string) => {
    if (locale === "en") return "MMM d";
    return locale === "fr" && iso.endsWith("-01") ? "d'er' MMM" : "d MMM";
  };
  return {
    /** "Dec 5" in English, "5 déc." and "1er déc." in French. */
    shortDate: (iso: string) => format(parseISO(iso), dayPattern(iso), options),
    /** "December", from a "YYYY-MM" period. */
    monthName: (period: string) => format(parseISO(`${period}-01`), "MMMM", options),
  };
}
