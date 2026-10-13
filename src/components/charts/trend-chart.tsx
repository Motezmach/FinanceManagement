"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormat } from "@/components/providers/settings-provider";
import { KIND_COLORS } from "@/lib/config/palette";
import { TooltipShell } from "./chart-tooltip";
import { formatMonth } from "@/lib/format";

export function TrendChart({
  data,
  height = 220,
}: {
  data: { period: string; label: string; in: number; out: number }[];
  height?: number;
}) {
  const { money, kindLabel } = useFormat();
  const empty = data.every((d) => d.in === 0 && d.out === 0);

  return (
    <div style={{ height }} className="relative w-full">
      {empty ? (
        <p className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-3">
          Settled entries will show up here month by month.
        </p>
      ) : null}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4} barCategoryGap="28%" margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11.5, fill: "var(--ink-3)" }}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--ink-3)" }}
            tickFormatter={(v) => money(Number(v), { compact: true, maximumFractionDigits: 0 })}
            width={64}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-3)", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <TooltipShell
                  title={formatMonth(d.period)}
                  rows={[
                    { label: kindLabel("debit"), value: money(d.in), color: KIND_COLORS.debit.chart },
                    { label: kindLabel("credit"), value: money(d.out), color: KIND_COLORS.credit.chart },
                    { label: "Net", value: money(d.in - d.out, { signed: true }) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="in" fill={KIND_COLORS.debit.chart} radius={[6, 6, 2, 2]} maxBarSize={28} />
          <Bar dataKey="out" fill={KIND_COLORS.credit.chart} radius={[6, 6, 2, 2]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
