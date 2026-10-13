"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoryDetail as Detail } from "@/lib/queries/categories";
import { BUCKET_META, statusLabel, type Bucket, type Status } from "@/lib/config/buckets";
import { swatch } from "@/lib/config/palette";
import { formatMonth, formatShortMonth } from "@/lib/format";
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
  const { money, kindLabel, bucketLabel } = useFormat();
  const { openAdd } = useEntryModal();
  const [edit, setEdit] = useState(false);
  const sw = swatch(c.color);
  const total = detail.byStatus.settled.total;
  const bucketRows = (Object.entries(detail.byBucket) as [Bucket, { total: number; count: number }][]).sort(
    (a, b) => b[1].total - a[1].total,
  );
  const bucketMax = Math.max(1, ...bucketRows.map(([, v]) => v.total));

  return (
    <div className="space-y-6">
      <Link href="/categories" className="inline-flex items-center gap-1 text-[13px] text-ink-3 transition hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> All categories
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <CategoryIcon icon={c.icon} color={c.color} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[32px] leading-none tracking-tight text-ink">{c.name}</h1>
              {c.isArchived ? <Badge tone="outline">Archived</Badge> : null}
            </div>
            <p className="mt-1.5 text-[13.5px] text-ink-2">
              {kindLabel(c.kind)} category · {plural(detail.byStatus.settled.count + detail.byStatus.pending.count + detail.byStatus.planned.count, "entry", "entries")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button onClick={() => openAdd({ kind: c.kind, categoryId: c.id })}>
            <Plus className="h-4 w-4" /> Add entry
          </Button>
        </div>
      </div>

      <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={formatMonth(period)} amount={detail.periodTotal} kind={c.kind} />
        <Stat label="Average per month" amount={detail.avgMonthly} sub="last 6 active months" />
        <Stat label="All time" amount={total} sub={`${detail.byStatus.settled.count} settled`} />
        <Stat
          label="Open"
          amount={detail.byStatus.pending.total + detail.byStatus.planned.total}
          sub={`${detail.byStatus.pending.count} pending · ${detail.byStatus.planned.count} planned`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Last 12 months" description="Settled amounts, month by month." />
          <CardBody>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detail.monthly} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickFormatter={formatShortMonth} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--ink-3)" }} dy={6} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickFormatter={(v) => money(Number(v), { compact: true, maximumFractionDigits: 0 })} width={64} />
                  <Tooltip
                    cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as Detail["monthly"][number];
                      return (
                        <TooltipShell
                          title={formatMonth(d.period)}
                          rows={[
                            { label: "Settled", value: money(d.settled), color: sw.chart },
                            { label: "Pending", value: money(d.pending) },
                            { label: "Planned", value: money(d.planned) },
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
            <CardHeader title="By section" description="Where this category shows up." />
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
                    <p className="mt-0.5 text-[11.5px] text-ink-3">{BUCKET_META[bucket].description}</p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-ink-3">No entries yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="By status" />
            <CardBody className="grid grid-cols-3 gap-2 pt-4">
              {(["settled", "pending", "planned"] as Status[]).map((s) => (
                <div key={s} className="rounded-xl bg-surface-2 p-3">
                  <p className="text-[11.5px] text-ink-3">{statusLabel(s, c.kind)}</p>
                  <Money amount={detail.byStatus[s].total} className="mt-0.5 block text-[15px] font-semibold" />
                  <p className="text-[11.5px] text-ink-3">{plural(detail.byStatus[s].count, "entry", "entries")}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          {detail.largest ? (
            <Card className="px-5 py-4">
              <p className="text-[12px] font-medium uppercase tracking-wider text-ink-3">Largest settled entry</p>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <p className="truncate text-[14px] font-medium text-ink">{detail.largest.title}</p>
                <Money amount={detail.largest.amount} kind={c.kind} className="text-[15px] font-semibold" />
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader title="Entries" description="Most recent first." />
        <CardBody className="pt-4">
          <EntryList
            entries={detail.entries}
            showBucket
            emptyTitle="No entries in this category"
            emptyAction={
              <Button size="sm" onClick={() => openAdd({ kind: c.kind, categoryId: c.id })}>
                <Plus className="h-3.5 w-3.5" /> Add one
              </Button>
            }
          />
        </CardBody>
      </Card>

      <CategoryDialog open={edit} onClose={() => setEdit(false)} kind={c.kind} category={c} />
    </div>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function Stat({ label, amount, sub, kind }: { label: string; amount: number; sub?: string; kind?: "debit" | "credit" }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-[12.5px] font-medium text-ink-3">{label}</p>
      <Money amount={amount} kind={kind} className="font-display mt-1 block text-[26px] tracking-tight" />
      {sub ? <p className="mt-0.5 text-[12px] text-ink-3">{sub}</p> : null}
    </Card>
  );
}
