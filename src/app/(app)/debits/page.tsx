import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { listEntries } from "@/lib/queries/entries";
import { currentPeriod, isValidPeriod, periodRange } from "@/lib/dates";
import { formatMonth } from "@/lib/format";
import { kindLabel } from "@/lib/config/settings";
import type { Bucket } from "@/lib/config/buckets";
import { BucketBoard } from "@/components/entry/bucket-board";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";

export const metadata: Metadata = { title: "Debits" };

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

  const [wallet, pending, potential] = await Promise.all([
    listEntries(user.id, { kind: "debit", bucket: "wallet", from: start, to: end }),
    listEntries(user.id, { kind: "debit", bucket: "pending" }),
    listEntries(user.id, { kind: "debit", bucket: "potential" }),
  ]);

  const sum = (list: { amount: number }[]) => list.reduce((a, e) => a + e.amount, 0);
  const label = kindLabel(user.settings, "debit");
  const monthLabel = isCurrent ? "this month" : formatMonth(period);
  const initialBucket = (["wallet", "pending", "potential"] as Bucket[]).includes(sp.bucket as Bucket)
    ? (sp.bucket as Bucket)
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Money in"
        title={label}
        description="What you have, what you are owed, and what might come in."
        actions={<MonthPicker period={period} />}
      />
      <BucketBoard
        kind="debit"
        initialBucket={initialBucket}
        summary={[
          { label: `Received · ${monthLabel}`, amount: sum(wallet), kind: "debit", sub: `${wallet.length} entries in the wallet` },
          { label: "Awaiting payment", amount: sum(pending), sub: `${pending.length} open · any month` },
          { label: "Potential", amount: sum(potential), sub: `${potential.length} opportunities · any month` },
        ]}
        sections={[
          { bucket: "wallet", entries: wallet, total: sum(wallet), count: wallet.length, scope: monthLabel },
          { bucket: "pending", entries: pending, total: sum(pending), count: pending.length, scope: "all open" },
          { bucket: "potential", entries: potential, total: sum(potential), count: potential.length, scope: "all open" },
        ]}
      />
    </>
  );
}
