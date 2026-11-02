import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { listEntries } from "@/lib/queries/entries";
import { listFixedBoard } from "@/lib/queries/rules";
import { ensureSynced } from "@/lib/fixed/sync";
import { isValidPeriod, periodOf, periodRange, todayISO } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { kindLabel } from "@/lib/config/settings";
import type { Bucket } from "@/lib/config/buckets";
import type { Locale } from "@/lib/i18n/locales";
import { BucketBoard } from "@/components/entry/bucket-board";
import { FixedPanel } from "@/components/fixed/fixed-panel";
import { SavingsLinkCard } from "@/components/fixed/savings-link-card";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("kinds");
  return { title: t("credit.label") };
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; bucket?: string }>;
}) {
  const user = await requireUser();
  await ensureSynced(user);
  const sp = await searchParams;
  const today = todayISO();
  const period = isValidPeriod(sp.period) ? sp.period : periodOf(today);
  const { start, end } = periodRange(period);
  const isCurrent = period === periodOf(today);
  const [t, tc, tk, locale] = await Promise.all([
    getTranslations("credits"),
    getTranslations("common"),
    getTranslations("kinds"),
    getLocale(),
  ]);

  const [fixed, optionalOpen, optionalSettled, daily, board] = await Promise.all([
    listEntries(user.id, { kind: "credit", bucket: "fixed", from: start, to: end }),
    listEntries(user.id, { kind: "credit", bucket: "optional", status: "planned" }),
    listEntries(user.id, { kind: "credit", bucket: "optional", from: start, to: end }),
    listEntries(user.id, { kind: "credit", bucket: "daily", from: start, to: end }),
    listFixedBoard(user.id, period, today),
  ]);

  const seen = new Set<string>();
  const optional = [...optionalOpen, ...optionalSettled].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));

  const sum = (list: { amount: number }[]) => list.reduce((a, e) => a + e.amount, 0);
  const settled = (list: { amount: number; status: string }[]) => sum(list.filter((e) => e.status === "settled"));
  const label = kindLabel(user.settings, "credit", tk("credit.label"));
  const monthLabel = isCurrent ? tc("thisMonth") : formatMonth(period, locale as Locale);
  const spent = settled(fixed) + settled(optional.filter((e) => e.date >= start && e.date <= end)) + settled(daily);
  const initialBucket = (["fixed", "optional", "daily"] as Bucket[]).includes(sp.bucket as Bucket) ? (sp.bucket as Bucket) : "daily";

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={label} description={t("description")} actions={<MonthPicker period={period} />} />
      <BucketBoard
        kind="credit"
        initialBucket={initialBucket}
        summary={[
          { label: t("spent", { period: monthLabel }), amount: spent, kind: "credit", sub: t("spentSub") },
          {
            label: t("stillDue", { period: monthLabel }),
            amount: board.totals.due,
            sub: t("stillDueSub", { count: board.totals.dueCount }),
          },
          {
            label: t("inSavings", { period: monthLabel }),
            amount: board.totals.saved,
            sub: t("inSavingsSub", { count: board.totals.savedCount }),
          },
          { label: t("plannedPurchases"), amount: sum(optionalOpen), sub: t("plannedSub", { count: optionalOpen.length }) },
        ]}
        sections={[
          {
            bucket: "fixed",
            total: board.totals.total,
            count: board.totals.count,
            scope: monthLabel,
            panel: <FixedPanel board={board} period={period} today={today} />,
          },
          { bucket: "optional", entries: optional, total: sum(optional), count: optional.length, scope: t("plannedScope") },
          { bucket: "daily", entries: daily, total: sum(daily), count: daily.length, scope: monthLabel },
        ]}
        linkCards={<SavingsLinkCard key="savings" amount={board.position.billsSaved} />}
      />
    </>
  );
}
