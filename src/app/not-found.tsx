import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3">404</p>
      <h1 className="font-display mt-2 text-[30px] leading-tight text-ink">{t("title")}</h1>
      <p className="mt-3 max-w-sm text-[14px] text-ink-2">{t("body")}</p>
      <Link href="/dashboard" className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-fg hover:opacity-90">
        {t("back")}
      </Link>
    </div>
  );
}
