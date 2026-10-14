"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useFormat } from "@/components/providers/settings-provider";
import { swatch } from "@/lib/config/palette";
import { CategoryIcon } from "@/components/ui/category-chip";
import { TooltipShell } from "./chart-tooltip";
import { cn } from "@/lib/utils";

export type DonutSlice = { id: string; name: string; color: string; icon: string; total: number; pct: number };

export function CategoryDonut({
  data,
  total,
  centerLabel,
  limit = 6,
  linkPrefix = "/categories/",
  className,
}: {
  data: DonutSlice[];
  total: number;
  centerLabel: "spent" | "received";
  limit?: number;
  linkPrefix?: string;
  className?: string;
}) {
  const { money } = useFormat();
  const t = useTranslations();
  const top = data.slice(0, limit);
  const rest = data.slice(limit);
  const slices = rest.length
    ? [
        ...top,
        {
          id: "rest",
          name: t("common.more", { count: rest.length }),
          color: "stone",
          icon: "circle-dot",
          total: rest.reduce((a, b) => a + b.total, 0),
          pct: rest.reduce((a, b) => a + b.pct, 0),
        },
      ]
    : top;

  if (!data.length) {
    return <div className={cn("flex h-[200px] items-center justify-center text-[13px] text-ink-3", className)}>{t("charts.emptyDonut")}</div>;
  }

  return (
    <div className={cn("grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center", className)}>
      <div className="relative mx-auto h-[180px] w-[180px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="total" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} cornerRadius={4} stroke="none" isAnimationActive>
              {slices.map((s) => (
                <Cell key={s.id} fill={swatch(s.color).chart} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const s = payload[0].payload as DonutSlice;
                return <TooltipShell rows={[{ label: s.name, value: `${money(s.total)} · ${s.pct}%`, color: swatch(s.color).chart }]} />;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] uppercase tracking-wider text-ink-3">{t(`charts.${centerLabel}`)}</span>
          <span className="tabular text-[17px] font-semibold text-ink">{money(total, { compact: true })}</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {slices.map((s) => {
          const name = s.id === "uncategorized" ? t("common.uncategorized") : s.name;
          const inner = (
            <>
              <CategoryIcon icon={s.icon} color={s.color} size="xs" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{name}</span>
              <span className="w-10 text-end text-[12px] tabular text-ink-3">{s.pct}%</span>
              <span className="w-20 text-end text-[13px] tabular font-medium text-ink">{money(s.total)}</span>
            </>
          );
          const cls = "flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition hover:bg-surface-2";
          return (
            <li key={s.id}>
              {s.id === "rest" || s.id === "uncategorized" ? (
                <div className={cls}>{inner}</div>
              ) : (
                <Link href={`${linkPrefix}${s.id}`} className={cls}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
