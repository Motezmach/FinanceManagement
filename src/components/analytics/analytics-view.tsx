"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Hourglass, Sparkles, Wallet } from "lucide-react";
import type { Analytics } from "@/lib/queries/analytics";
import { BUCKET_META, type Bucket } from "@/lib/config/buckets";
import { DynamicIcon } from "@/lib/config/icons";
import { KIND_COLORS } from "@/lib/config/palette";
import { currentPeriod } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { ProgressBar } from "@/components/ui/progress";
import { CategoryIcon } from "@/components/ui/category-chip";
import { TrendChart } from "@/components/charts/trend-chart";
import { DailyBars } from "@/components/charts/daily-bars";
import { CategoryDonut } from "@/components/charts/category-donut";
import { useFormat } from "@/components/providers/settings-provider";

export function AnalyticsView({ data, period }: { data: Analytics; period: string }) {
  const { money, kindLabel, bucketLabel, month } = useFormat();
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const isCurrent = period === currentPeriod();
  const periodLabel = isCurrent ? tc("thisMonth") : month(period);
  const s = data.stats;
  const rate = Math.round(s.savingsRate * 100);
  const todayDay = isCurrent ? new Date().getDate() : undefined;

  const pipeline = [
    { key: "wallet", label: t("balance"), amount: data.pipeline.wallet, icon: Wallet, kind: "net" as const, note: t("balanceNote") },
    { key: "pending", label: bucketLabel("pending"), amount: data.pipeline.pending, icon: Hourglass, kind: "debit" as const, note: t("pendingNote") },
    { key: "potential", label: bucketLabel("potential"), amount: data.pipeline.potential, icon: Sparkles, kind: undefined, note: t("potentialNote") },
  ];

  return (
    <div className="space-y-6">
      {/* Headline stats */}
      <section className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="px-5 py-4">
          <p className="text-[12.5px] font-medium text-ink-3">{t("received", { period: periodLabel })}</p>
          <Money amount={s.received} kind="debit" className="font-display mt-1 block text-[26px] leading-none" />
          <p className="mt-1.5 text-[12px] text-ink-3">{t("avgPerMonth", { amount: money(s.avgMonthlyIncome, { compact: true }) })}</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-[12.5px] font-medium text-ink-3">{t("spent", { period: periodLabel })}</p>
          <Money amount={s.spent} kind="credit" className="font-display mt-1 block text-[26px] leading-none" />
          <p className="mt-1.5 text-[12px] text-ink-3">{t("avgPerMonth", { amount: money(s.avgMonthlySpend, { compact: true }) })}</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-[12.5px] font-medium text-ink-3">{t("net", { period: periodLabel })}</p>
          <Money amount={s.net} kind="net" className="font-display mt-1 block text-[26px] leading-none" />
          <p className="mt-1.5 text-[12px] text-ink-3">{t("settledEntries", { count: s.entryCount })}</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-[12.5px] font-medium text-ink-3">{t("kept", { period: periodLabel })}</p>
          <p className={cn("font-display mt-1 text-[26px] leading-none tabular", rate < 0 ? "text-outflow-ink" : "text-ink")}>{s.received > 0 ? `${rate}%` : "—"}</p>
          <div className="mt-2.5">
            <ProgressBar value={Math.max(0, rate)} color={rate >= 20 ? "var(--inflow)" : "var(--warn)"} height={5} />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">{t("keptSub")}</p>
        </Card>
      </section>

      {/* Trend + daily */}
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={t("twelveMonths")} description={t("twelveMonthsSub")} />
          <CardBody className="pt-4">
            <TrendChart data={data.monthly} height={240} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dayByDay")} description={t("dayByDaySub", { month: month(period), amount: money(s.avgDailySpend) })} />
          <CardBody className="pt-4">
            <DailyBars data={data.daily} height={200} todayDay={todayDay} />
          </CardBody>
        </Card>
      </section>

      {/* Category breakdowns */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("byCategory", { kind: kindLabel("credit") })}
            description={t("settledPeriod", { period: periodLabel })}
            action={
              <Link href="/categories" className="text-[12.5px] text-ink-3 hover:text-ink">
                {t("catalog")} <ArrowRight className="inline h-3 w-3 rtl:-scale-x-100" />
              </Link>
            }
          />
          <CardBody className="pt-4">
            <CategoryDonut data={data.categories.credit} total={s.spent} centerLabel="spent" limit={7} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("byCategory", { kind: kindLabel("debit") })} description={t("settledPeriod", { period: periodLabel })} />
          <CardBody className="pt-4">
            <CategoryDonut data={data.categories.debit} total={s.received} centerLabel="received" limit={7} />
          </CardBody>
        </Card>
      </section>

      {/* Pipeline + buckets */}
      <section className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title={t("pipeline")} description={t("pipelineSub")} />
          <CardBody className="space-y-2 pt-4">
            {pipeline.map((p) => (
              <div key={p.key} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-ink-2">
                  <p.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-ink">{p.label}</p>
                  <p className="text-[12px] text-ink-3">{p.note}</p>
                </div>
                <Money amount={p.amount} kind={p.kind} className="text-[15px] font-semibold" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-xl border border-line px-3 py-2.5">
                <p className="text-[12px] text-ink-3">{t("dueLabel", { kind: kindLabel("credit").toLowerCase() })}</p>
                <Money amount={data.pipeline.due} kind="credit" className="text-[15px] font-semibold" />
              </div>
              <div className="rounded-xl border border-line px-3 py-2.5">
                <p className="text-[12px] text-ink-3">{t("plannedLabel")}</p>
                <Money amount={data.pipeline.planned} muted className="text-[15px] font-semibold" />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("bySection")} description={t("bySectionSub", { period: periodLabel })} />
          <CardBody className="grid gap-2 pt-4 sm:grid-cols-2">
            {(Object.keys(BUCKET_META) as Bucket[]).map((b) => {
              const meta = BUCKET_META[b];
              const v = data.buckets[b];
              const c = KIND_COLORS[meta.kind];
              return (
                <Link key={b} href={meta.kind === "debit" ? "/debits" : "/credits"} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition hover:bg-surface-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: c.bg, color: c.ink }}>
                    <DynamicIcon icon={meta.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{bucketLabel(b)}</p>
                    <p className="text-[12px] text-ink-3">
                      {tc("entryCount", { count: v.count })}
                      {v.settled !== v.total ? ` ${t("settledSuffix", { amount: money(v.settled, { compact: true }) })}` : ""}
                    </p>
                  </div>
                  <Money amount={v.total} className="text-[14px] font-semibold" />
                </Link>
              );
            })}
          </CardBody>
        </Card>
      </section>

      {/* Largest */}
      <Card>
        <CardHeader title={t("largest", { kind: kindLabel("credit").toLowerCase() })} description={t("settledPeriod", { period: periodLabel })} />
        <CardBody className="pt-4">
          {data.largest.length ? (
            <ol className="divide-y divide-line">
              {data.largest.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 text-center text-[12px] tabular text-ink-3">{i + 1}</span>
                  <CategoryIcon icon={e.category?.icon} color={e.category?.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{e.title}</p>
                    <p className="text-[12px] text-ink-3">
                      {e.category?.name ?? tc("uncategorized")} · {bucketLabel(e.bucket)}
                    </p>
                  </div>
                  <Money amount={e.amount} kind="credit" signed className="text-[14px] font-medium" />
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-4 text-center text-[13px] text-ink-3">{t("noneSettled", { kind: kindLabel("credit").toLowerCase(), period: periodLabel })}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
