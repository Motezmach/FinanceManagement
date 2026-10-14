"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** Friendly boundary: never shows stack traces or internals to the visitor. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");

  useEffect(() => {
    // Keep diagnostics server/console-side only.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">{t("eyebrow")}</p>
      <h1 className="font-display mt-2 text-[30px] leading-tight text-ink">{t("title")}</h1>
      <p className="mt-3 max-w-sm text-[14px] text-ink-2">{t("body")}</p>
      {error.digest ? <p className="mt-2 text-[11.5px] text-ink-3">{t("reference", { id: error.digest })}</p> : null}
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90">
          {tc("tryAgain")}
        </button>
        <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-2">
          {t("overview")}
        </Link>
      </div>
    </div>
  );
}
