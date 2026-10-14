import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { getCategoryDetail } from "@/lib/queries/categories";
import { currentPeriod, isValidPeriod } from "@/lib/dates";
import { CategoryDetailView } from "@/components/categories/category-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories");
  return { title: t("title") };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getCategoryDetail(user.id, id, period);
  if (!detail) notFound();

  return <CategoryDetailView detail={detail} period={period} />;
}
