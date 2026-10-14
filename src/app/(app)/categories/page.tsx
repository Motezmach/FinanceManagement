import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { categoryStats } from "@/lib/queries/categories";
import { currentPeriod, isValidPeriod } from "@/lib/dates";
import { CategoriesView } from "@/components/categories/categories-view";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories");
  return { title: t("title") };
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; kind?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();
  const t = await getTranslations("categories");
  const stats = await categoryStats(user.id, period);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} actions={<MonthPicker period={period} />} />
      <CategoriesView stats={stats} initialKind={sp.kind === "debit" ? "debit" : "credit"} />
    </>
  );
}
