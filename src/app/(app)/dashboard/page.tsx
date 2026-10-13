import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getDashboard } from "@/lib/queries/dashboard";
import { ensureMaterialized } from "@/lib/queries/rules";
import { currentPeriod, isValidPeriod } from "@/lib/dates";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; welcome?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();

  await ensureMaterialized(user.id, period);
  const data = await getDashboard(user.id, period);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Your ledger at a glance"
        actions={<MonthPicker period={period} />}
        className="mb-5"
      />
      <DashboardView data={data} period={period} username={user.username} welcome={sp.welcome === "1"} />
    </>
  );
}
