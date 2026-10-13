import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getAnalytics } from "@/lib/queries/analytics";
import { ensureMaterialized } from "@/lib/queries/rules";
import { currentPeriod, isValidPeriod } from "@/lib/dates";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();

  await ensureMaterialized(user.id, period);
  const data = await getAnalytics(user.id, period);

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="How the month is going"
        description="Trends, category splits and the pipeline of money in and out."
        actions={<MonthPicker period={period} />}
      />
      <AnalyticsView data={data} period={period} />
    </>
  );
}
