import type { Bucket, Kind } from "./buckets";
import { BUCKET_META } from "./buckets";

export type UserSettings = {
  currency: string;
  locale: string;
  labels: {
    debit: string;
    credit: string;
    buckets: Partial<Record<Bucket, string>>;
  };
  theme: "light" | "dark" | "system";
};

export const DEFAULT_SETTINGS: UserSettings = {
  currency: "USD",
  locale: "en-US",
  labels: { debit: "Debit", credit: "Credit", buckets: {} },
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

export function kindLabel(settings: UserSettings, kind: Kind) {
  return settings.labels[kind] || (kind === "debit" ? "Debit" : "Credit");
}

export function bucketLabel(settings: UserSettings, bucket: Bucket) {
  return settings.labels.buckets[bucket] || BUCKET_META[bucket].label;
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
