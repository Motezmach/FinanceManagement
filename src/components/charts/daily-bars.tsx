"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useFormat } from "@/components/providers/settings-provider";
import { KIND_COLORS } from "@/lib/config/palette";
import { TooltipShell } from "./chart-tooltip";
import { formatDay } from "@/lib/format";

export function DailyBars({
  data,
  height = 140,
  todayDay,
}: {
  data: { date: string; day: number; in: number; out: number }[];
  height?: number;
  todayDay?: number;
}) {
  const { money, kindLabel } = useFormat();
  const empty = data.every((d) => d.in === 0 && d.out === 0);

  return (
    <div style={{ height }} className="relative w-full">
      {empty ? (
        <p className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-3">
          Daily activity appears once entries are settled.
        </p>
      ) : null}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={1} barCategoryGap="18%" margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={({ x, y, payload }) => {
              const v = Number(payload.value);
              const isToday = v === todayDay;
              return (
                <text
                  x={Number(x)}
                  y={Number(y) + 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill={isToday ? "var(--accent)" : "var(--ink-3)"}
                  fontWeight={isToday ? 600 : 400}
                >
                  {v % 2 === 1 || isToday ? v : ""}
                </text>
              );
            }}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-3)", opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <TooltipShell
                  title={formatDay(d.date)}
                  rows={[
                    { label: kindLabel("debit"), value: money(d.in), color: KIND_COLORS.debit.chart },
                    { label: kindLabel("credit"), value: money(d.out), color: KIND_COLORS.credit.chart },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="in" stackId="a" fill={KIND_COLORS.debit.chart} radius={[3, 3, 0, 0]} />
          <Bar dataKey="out" stackId="b" fill={KIND_COLORS.credit.chart} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
