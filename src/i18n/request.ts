import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "@/lib/i18n/locales";

/** Language for this request: explicit cookie first, then the browser's preference. */
export async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language");
  return negotiateLocale(accept) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: undefined,
    // Missing keys fall back to English rather than crashing the page.
    getMessageFallback: ({ key, namespace }) => `${namespace ? `${namespace}.` : ""}${key}`,
    onError: (err) => {
      if (process.env.NODE_ENV === "development") console.warn("[i18n]", err.message);
    },
  };
});
