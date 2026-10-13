"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type UserSettings } from "@/lib/config/settings";
import { BUCKET_META, type Bucket, type Kind } from "@/lib/config/buckets";
import { formatMoney } from "@/lib/format";

const SettingsContext = createContext<UserSettings>(DEFAULT_SETTINGS);

export function SettingsProvider({ settings, children }: { settings: UserSettings; children: ReactNode }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

/** Currency + label helpers bound to the current user's settings. */
export function useFormat() {
  const s = useSettings();
  return {
    settings: s,
    money: (amount: number, opts?: Parameters<typeof formatMoney>[3]) =>
      formatMoney(amount, s.currency, s.locale, opts),
    kindLabel: (kind: Kind) => s.labels[kind] || (kind === "debit" ? "Debit" : "Credit"),
    bucketLabel: (bucket: Bucket) => s.labels.buckets[bucket] || BUCKET_META[bucket].label,
  };
}
