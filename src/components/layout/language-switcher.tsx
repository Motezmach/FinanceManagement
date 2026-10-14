"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";
import { setLanguage } from "@/lib/actions/locale";
import { LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

/** Compact language picker. `variant="select"` for forms, `"pills"` for the sidebar. */
export function LanguageSwitcher({ variant = "pills", className }: { variant?: "pills" | "select"; className?: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, start] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    start(async () => {
      await setLanguage(next);
      router.refresh();
    });
  };

  if (variant === "select") {
    return (
      <div className={cn("relative", className)}>
        <Languages className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <select
          aria-label="Language"
          value={locale}
          disabled={pending}
          onChange={(e) => change(e.target.value as Locale)}
          className="h-10 w-full appearance-none rounded-xl border border-line bg-surface pe-3 ps-9 text-sm text-ink focus:border-accent focus:outline-none focus:ring-4 focus:ring-ring disabled:opacity-60"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_META[l].label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center rounded-lg border border-line bg-surface p-0.5", pending && "opacity-60", className)} role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          aria-pressed={locale === l}
          title={LOCALE_META[l].label}
          className={cn(
            "h-7 rounded-md px-2 text-[11.5px] font-medium uppercase transition",
            locale === l ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
