"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  color,
  className,
  track,
  height = 6,
}: {
  value: number; // 0..100
  color?: string;
  track?: string;
  className?: string;
  height?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", className)}
      style={{ height, background: track }}
    >
      <motion.div
        className="h-full rounded-full bg-accent"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 24 }}
      />
    </div>
  );
}
