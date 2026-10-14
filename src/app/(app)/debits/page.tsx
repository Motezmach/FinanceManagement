import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { listEntries } from "@/lib/queries/entries";
import { currentPeriod, isValidPeriod, periodRange } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { kindLabel } from "@/lib/config/settings";
import type { Bucket } from "@/lib/config/buckets";
import type { Locale } from "@/lib/i18n/locales";
import { BucketBoard } from "@/components/entry/bucket-board";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("kinds");
  return { title: t("debit.label") };
}

export default async function DebitsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; bucket?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();
  const { start, end } = periodRange(period);
  const isCurrent = period === currentPeriod();
  const [t, tc, tk, locale] = await Promise.all([
    getTranslations("debits"),
    getTranslations("common"),
    getTranslations("kinds"),
    getLocale(),
  ]);

  const [wallet, pending, potential] = await Promise.all([
    listEntries(user.id, { kind: "debit", bucket: "wallet", from: start, to: end }),
    listEntries(user.id, { kind: "debit", bucket: "pending" }),
    listEntries(user.id, { kind: "debit", bucket: "potential" }),
  ]);

  const sum = (list: { amount: number }[]) => list.reduce((a, e) => a + e.amount, 0);
  const label = kindLabel(user.settings, "debit", tk("debit.label"));
  const monthLabel = isCurrent ? tc("thisMonth") : formatMonth(period, locale as Locale);
  const initialBucket = (["wallet", "pending", "potential"] as Bucket[]).includes(sp.bucket as Bucket)
    ? (sp.bucket as Bucket)
    : undefined;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={label} description={t("description")} actions={<MonthPicker period={period} />} />
      <BucketBoard
        kind="debit"
        initialBucket={initialBucket}
        summary={[
          { label: t("received", { period: monthLabel }), amount: sum(wallet), kind: "debit", sub: t("receivedSub", { count: wallet.length }) },
          { label: t("awaiting"), amount: sum(pending), sub: t("awaitingSub", { count: pending.length }) },
          { label: t("potential"), amount: sum(potential), sub: t("potentialSub", { count: potential.length }) },
        ]}
        sections={[
          { bucket: "wallet", entries: wallet, total: sum(wallet), count: wallet.length, scope: monthLabel },
          { bucket: "pending", entries: pending, total: sum(pending), count: pending.length, scope: tc("allOpen") },
          { bucket: "potential", entries: potential, total: sum(potential), count: potential.length, scope: tc("allOpen") },
        ]}
      />
    </>
  );
}
