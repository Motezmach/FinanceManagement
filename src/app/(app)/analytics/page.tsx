import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { getAnalytics } from "@/lib/queries/analytics";
import { ensureMaterialized } from "@/lib/queries/rules";
import { currentPeriod, isValidPeriod } from "@/lib/dates";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("analytics") };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();
  const t = await getTranslations("analytics");

  await ensureMaterialized(user.id, period);
  const data = await getAnalytics(user.id, period);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} actions={<MonthPicker period={period} />} />
      <AnalyticsView data={data} period={period} />
    </>
  );
}
