"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useId } from "react";

export function Sparkline({
  data,
  color = "var(--accent)",
  height = 36,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const points = data.map((v, i) => ({ i, v }));
  const flat = data.every((v) => v === 0);
  return (
    <div style={{ height }} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={flat ? "var(--line-strong)" : color}
            strokeWidth={1.75}
            fill={`url(#spark-${id})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
