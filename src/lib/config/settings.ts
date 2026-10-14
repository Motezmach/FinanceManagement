import type { Bucket, Kind } from "./buckets";
import { BUCKET_META } from "./buckets";
import type { Locale } from "@/lib/i18n/locales";

export type UserSettings = {
  currency: string;
  locale: string; // number/date formatting locale, e.g. "en-US"
  language?: Locale; // UI language; falls back to the browser cookie when unset
  labels: {
    /** Custom names for the two sides. Empty means "use the translated default". */
    debit: string;
    credit: string;
    buckets: Partial<Record<Bucket, string>>;
  };
  theme: "light" | "dark" | "system";
};

export const DEFAULT_SETTINGS: UserSettings = {
  currency: "USD",
  locale: "en-US",
  labels: { debit: "", credit: "", buckets: {} },
  theme: "system",
};

export function mergeSettings(partial: Partial<UserSettings> | null | undefined): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(partial ?? {}),
    labels: {
      ...DEFAULT_SETTINGS.labels,
      ...(partial?.labels ?? {}),
      buckets: { ...(partial?.labels?.buckets ?? {}) },
    },
  };
}

/** Custom label if the user set one, otherwise the caller's translated default. */
export function kindLabel(settings: UserSettings, kind: Kind, fallback?: string) {
  return settings.labels[kind] || fallback || (kind === "debit" ? "Debit" : "Credit");
}

export function bucketLabel(settings: UserSettings, bucket: Bucket, fallback?: string) {
  return settings.labels.buckets[bucket] || fallback || BUCKET_META[bucket].label;
}

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "MAD",
  "TND",
  "DZD",
  "EGP",
  "SAR",
  "AED",
  "CAD",
  "CHF",
  "JPY",
  "INR",
  "TRY",
] as const;
