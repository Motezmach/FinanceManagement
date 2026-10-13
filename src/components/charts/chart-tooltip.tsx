"use client";

import type { ReactNode } from "react";

/** Minimal tooltip shell shared by all charts. */
export function TooltipShell({ title, rows }: { title?: ReactNode; rows: { label: ReactNode; value: ReactNode; color?: string }[] }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-line bg-surface px-3 py-2.5 text-[12.5px] shadow-pop">
      {title ? <p className="mb-1.5 font-medium text-ink">{title}</p> : null}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-2">
              {r.color ? <span className="h-2 w-2 rounded-full" style={{ background: r.color }} /> : null}
              {r.label}
            </span>
            <span className="tabular font-medium text-ink">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
