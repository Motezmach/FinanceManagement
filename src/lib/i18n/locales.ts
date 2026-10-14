/** Supported UI languages. English is the default. */
export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that remembers the language for visitors who are not signed in. */
export const LOCALE_COOKIE = "ledger_lang";

export const LOCALE_META: Record<Locale, { label: string; dir: "ltr" | "rtl"; numberLocale: string }> = {
  en: { label: "English", dir: "ltr", numberLocale: "en-US" },
  fr: { label: "Français", dir: "ltr", numberLocale: "fr-FR" },
  ar: { label: "العربية", dir: "rtl", numberLocale: "ar-MA" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: Locale) {
  return LOCALE_META[locale].dir;
}

/** Picks the best supported language from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, i) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1, i };
    })
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
