import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { categoryStats } from "@/lib/queries/categories";
import { currentPeriod, isValidPeriod } from "@/lib/dates";
import { CategoriesView } from "@/components/categories/categories-view";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; kind?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();
  const stats = await categoryStats(user.id, period);

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Every entry belongs to a category. Open one for its own analytics."
        actions={<MonthPicker period={period} />}
      />
      <CategoriesView stats={stats} initialKind={sp.kind === "debit" ? "debit" : "credit"} />
    </>
  );
}
