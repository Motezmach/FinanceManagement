"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function AutoPaySwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const t = useTranslations("fixed.autoPay");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 rounded-xl border border-line bg-surface px-3.5 py-3 text-start transition hover:border-line-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
    >
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{t("label")}</span>
        <span className="mt-0.5 block text-[12px] text-ink-3">{t("hint")}</span>
      </span>
      <span className={cn("mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors", checked ? "bg-primary" : "bg-surface-3")}>
        <span
          className={cn(
            "block h-4 w-4 rounded-full transition-transform motion-reduce:transition-none",
            checked ? "translate-x-4 bg-primary-fg rtl:-translate-x-4" : "bg-ink-3",
          )}
        />
      </span>
    </button>
  );
}
