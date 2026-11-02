import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { bucketLabel } from "@/lib/config/settings";
import { todayISO } from "@/lib/dates";
import { ensureSynced } from "@/lib/fixed/sync";
import { getSavings } from "@/lib/queries/savings";
import { PageHeader } from "@/components/layout/page-header";
import { SavingsView } from "@/components/savings/savings-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("savings") };
}

export default async function SavingsPage() {
  const user = await requireUser();
  await ensureSynced(user);

  const today = todayISO();
  const [data, t, tn, tc, tb] = await Promise.all([
    getSavings(user.id, today),
    getTranslations("savings"),
    getTranslations("nav"),
    getTranslations("credits"),
    getTranslations("buckets"),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={tc("eyebrow")}
        title={tn("savings")}
        description={t("description")}
        actions={
          <Link
            href="/credits?bucket=fixed"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition hover:border-line-strong hover:bg-surface-2"
          >
            {bucketLabel(user.settings, "fixed", tb("fixed.label"))}
            <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
          </Link>
        }
      />
      <SavingsView data={data} today={today} />
    </>
  );
}
