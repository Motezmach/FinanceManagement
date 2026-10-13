import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { listEntries } from "@/lib/queries/entries";
import { ensureMaterialized, listRules } from "@/lib/queries/rules";
import { listCategories } from "@/lib/queries/categories";
import { currentPeriod, isValidPeriod, periodRange } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { kindLabel } from "@/lib/config/settings";
import type { Bucket } from "@/lib/config/buckets";
import { BucketBoard } from "@/components/entry/bucket-board";
import { RulesPanel } from "@/components/entry/rules-panel";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export const metadata: Metadata = { title: "Credits" };

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; bucket?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = isValidPeriod(sp.period) ? sp.period : currentPeriod();
  const { start, end } = periodRange(period);
  const isCurrent = period === currentPeriod();

  await ensureMaterialized(user.id, period);

  const [fixed, optionalOpen, optionalSettled, daily, rules, categories] = await Promise.all([
    listEntries(user.id, { kind: "credit", bucket: "fixed", from: start, to: end }),
    listEntries(user.id, { kind: "credit", bucket: "optional", status: "planned" }),
    listEntries(user.id, { kind: "credit", bucket: "optional", from: start, to: end }),
    listEntries(user.id, { kind: "credit", bucket: "daily", from: start, to: end }),
    listRules(user.id, period),
    listCategories(user.id),
  ]);

  const seen = new Set<string>();
  const optional = [...optionalOpen, ...optionalSettled].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  const fixedOneOff = fixed.filter((e) => !e.ruleId);

  const sum = (list: { amount: number }[]) => list.reduce((a, e) => a + e.amount, 0);
  const settled = (list: { amount: number; status: string }[]) => sum(list.filter((e) => e.status === "settled"));
  const label = kindLabel(user.settings, "credit");
  const monthLabel = isCurrent ? "this month" : formatMonth(period);
  const spent = settled(fixed) + settled(optional.filter((e) => e.date >= start && e.date <= end)) + settled(daily);
  const stillDue = sum(fixed.filter((e) => e.status === "pending"));
  const initialBucket = (["fixed", "optional", "daily"] as Bucket[]).includes(sp.bucket as Bucket)
    ? (sp.bucket as Bucket)
    : "daily";

  return (
    <>
      <PageHeader
        eyebrow="Money out"
        title={label}
        description="Fixed bills every month, optional purchases, and everyday spending."
        actions={<MonthPicker period={period} />}
      />
      <BucketBoard
        kind="credit"
        initialBucket={initialBucket}
        summary={[
          { label: `Spent · ${monthLabel}`, amount: spent, kind: "credit", sub: "settled across all sections" },
          { label: `Still due · ${monthLabel}`, amount: stillDue, sub: `${fixed.filter((e) => e.status === "pending").length} fixed payments waiting` },
          { label: "Planned purchases", amount: sum(optionalOpen), sub: `${optionalOpen.length} on the list · any month` },
        ]}
        sections={[
          {
            bucket: "fixed",
            entries: fixedOneOff,
            total: sum(fixed),
            count: fixed.length,
            scope: monthLabel,
            listTitle: `One-off · ${monthLabel}`,
            emptyTitle: "No one-off fixed payments",
            emptyDescription: "Bills that belong here but do not repeat, like a yearly insurance premium. Monthly ones go in the rules above.",
          },
          { bucket: "optional", entries: optional, total: sum(optional), count: optional.length, scope: "planned + this month" },
          { bucket: "daily", entries: daily, total: sum(daily), count: daily.length, scope: monthLabel },
        ]}
        extra={{ fixed: <RulesPanel rules={rules} categories={categories} period={period} /> }}
      />
    </>
  );
}
