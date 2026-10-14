"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoryDetail as Detail } from "@/lib/queries/categories";
import type { Bucket, Status } from "@/lib/config/buckets";
import { swatch } from "@/lib/config/palette";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { EntryList } from "@/components/entry/entry-list";
import { TooltipShell } from "@/components/charts/chart-tooltip";
import { CategoryDialog } from "./category-form";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";

export function CategoryDetailView({ detail, period }: { detail: Detail; period: string }) {
  const { category: c } = detail;
  const { money, kindLabel, bucketLabel, bucketDescription, statusLabel, month, shortMonth } = useFormat();
  const t = useTranslations("categories.detail");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const { openAdd } = useEntryModal();
  const [edit, setEdit] = useState(false);
  const sw = swatch(c.color);
  const total = detail.byStatus.settled.total;
  const entryCount = detail.byStatus.settled.count + detail.byStatus.pending.count + detail.byStatus.planned.count;
  const bucketRows = (Object.entries(detail.byBucket) as [Bucket, { total: number; count: number }][]).sort((a, b) => b[1].total - a[1].total);
  const bucketMax = Math.max(1, ...bucketRows.map(([, v]) => v.total));

  return (
    <div className="space-y-6">
      <Link href="/categories" className="inline-flex items-center gap-1 text-[13px] text-ink-3 transition hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t("all")}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <CategoryIcon icon={c.icon} color={c.color} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[28px] leading-tight text-ink">{c.name}</h1>
              {c.isArchived ? <Badge tone="outline">{t("archivedBadge")}</Badge> : null}
            </div>
            <p className="mt-1 text-[13.5px] text-ink-2">{t("meta", { kind: kindLabel(c.kind), count: entryCount })}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(true)}>
            <Pencil className="h-4 w-4" /> {tc("edit")}
          </Button>
          <Button onClick={() => openAdd({ kind: c.kind, categoryId: c.id })}>
            <Plus className="h-4 w-4" /> {t("addEntry")}
          </Button>
        </div>
      </div>

      <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={month(period)} amount={detail.periodTotal} kind={c.kind} />
        <Stat label={t("avgMonthly")} amount={detail.avgMonthly} sub={t("avgSub")} />
        <Stat label={t("allTime")} amount={total} sub={t("allTimeSub", { count: detail.byStatus.settled.count })} />
        <Stat label={t("open")} amount={detail.byStatus.pending.total + detail.byStatus.planned.total} sub={t("openSub", { pending: detail.byStatus.pending.count, planned: detail.byStatus.planned.count })} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title={t("last12")} description={t("last12Sub")} />
          <CardBody>
            <div className="h-[220px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detail.monthly} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickFormatter={(p) => shortMonth(String(p))} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--ink-3)" }} dy={6} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickFormatter={(v) => money(Number(v), { compact: true, maximumFractionDigits: 0 })} width={64} />
                  <Tooltip
                    cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as Detail["monthly"][number];
                      return (
                        <TooltipShell
                          title={month(d.period)}
                          rows={[
                            { label: ts("settled.label"), value: money(d.settled), color: sw.chart },
                            { label: ts("pending.label"), value: money(d.pending) },
                            { label: ts("planned.label"), value: money(d.planned) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="settled" fill={sw.chart} radius={[6, 6, 2, 2]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title={t("bySection")} description={t("bySectionSub")} />
            <CardBody className="space-y-3 pt-4">
              {bucketRows.length ? (
                bucketRows.map(([bucket, v]) => (
                  <div key={bucket}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="text-ink">{bucketLabel(bucket)}</span>
                      <span className="tabular text-ink-2">
                        {money(v.total)} <span className="text-ink-3">· {v.count}</span>
                      </span>
                    </div>
                    <ProgressBar value={(v.total / bucketMax) * 100} color={sw.chart} height={5} />
                    <p className="mt-0.5 text-[11.5px] text-ink-3">{bucketDescription(bucket)}</p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-ink-3">{t("noEntries")}</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("byStatus")} />
            <CardBody className="grid grid-cols-3 gap-2 pt-4">
              {(["settled", "pending", "planned"] as Status[]).map((s) => (
                <div key={s} className="rounded-xl bg-surface-2 p-3">
                  <p className="text-[11.5px] text-ink-3">{statusLabel(s, c.kind)}</p>
                  <Money amount={detail.byStatus[s].total} className="mt-0.5 block text-[15px] font-semibold" />
                  <p className="text-[11.5px] text-ink-3">{tc("entryCount", { count: detail.byStatus[s].count })}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          {detail.largest ? (
            <Card className="px-5 py-4">
              <p className="text-[12px] font-medium uppercase tracking-wider text-ink-3">{t("largest")}</p>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="truncate text-[14px] font-medium text-ink">{detail.largest.title}</p>
                <Money amount={detail.largest.amount} kind={c.kind} className="text-[15px] font-semibold" />
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader title={t("entries")} description={t("entriesSub")} />
        <CardBody className="pt-4">
          <EntryList
            entries={detail.entries}
            showBucket
            emptyTitle={t("emptyList")}
            emptyAction={
              <Button size="sm" onClick={() => openAdd({ kind: c.kind, categoryId: c.id })}>
                <Plus className="h-3.5 w-3.5" /> {t("addOne")}
              </Button>
            }
          />
        </CardBody>
      </Card>

      <CategoryDialog open={edit} onClose={() => setEdit(false)} kind={c.kind} category={c} />
    </div>
  );
}

function Stat({ label, amount, sub, kind }: { label: string; amount: number; sub?: string; kind?: "debit" | "credit" }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
      <Money amount={amount} kind={kind} className="font-display mt-1 block text-[24px] leading-none" />
      {sub ? <p className="mt-1.5 text-[12px] text-ink-3">{sub}</p> : null}
    </Card>
  );
}
