"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/config/settings";
import type { Bucket, Kind, Status } from "@/lib/config/buckets";
import type { Locale } from "@/lib/i18n/locales";
import { formatDay, formatLongDate, formatMoney, formatMonth, formatShortMonth } from "@/lib/format";
import { isMessageKey } from "@/lib/validation";

const SettingsContext = createContext<UserSettings>(DEFAULT_SETTINGS);

export function SettingsProvider({ settings, children }: { settings: UserSettings; children: ReactNode }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

/** Currency, labels and dates bound to the current user's settings and language. */
export function useFormat() {
  const s = useSettings();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  return {
    settings: s,
    locale,
    t,
    money: (amount: number, opts?: Parameters<typeof formatMoney>[3]) =>
      formatMoney(amount, s.currency, s.locale, opts),
    kindLabel: (kind: Kind) => s.labels[kind] || t(`kinds.${kind}.label`),
    kindSub: (kind: Kind) => t(`kinds.${kind}.sub`),
    bucketLabel: (bucket: Bucket) => s.labels.buckets[bucket] || t(`buckets.${bucket}.label`),
    bucketDescription: (bucket: Bucket) => t(`buckets.${bucket}.description`),
    bucketHint: (bucket: Bucket) => t(`buckets.${bucket}.hint`),
    statusLabel: (status: Status, kind: Kind) => t(`status.${status}.${kind}`),
    day: (iso: string) => formatDay(iso, locale),
    month: (period: string) => formatMonth(period, locale),
    shortMonth: (period: string) => formatShortMonth(period, locale),
    longDate: (d: Date) => formatLongDate(d, locale),
    /** Translates a validation key returned by the server; passes literal text through. */
    tv: (msg: string | undefined | null) => (isMessageKey(msg) ? t(msg) : (msg ?? undefined)),
  };
}
