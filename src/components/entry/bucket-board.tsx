"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import type { EntryWithCategory } from "@/lib/queries/entries";
import { BUCKET_META, BUCKETS_BY_KIND, type Bucket, type Kind } from "@/lib/config/buckets";
import { iconFor } from "@/lib/config/icons";
import { KIND_COLORS } from "@/lib/config/palette";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { EntryList } from "./entry-list";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";

export type BoardSection = {
  bucket: Bucket;
  entries: EntryWithCategory[];
  total: number;
  count: number;
  scope: string; // e.g. "this month" or "all open"
  listTitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export type SummaryTile = { label: string; amount: number; kind?: Kind | "net"; sub?: string };

export function BucketBoard({
  kind,
  sections,
  summary,
  initialBucket,
  extra,
}: {
  kind: Kind;
  sections: BoardSection[];
  summary: SummaryTile[];
  initialBucket?: Bucket;
  extra?: Partial<Record<Bucket, ReactNode>>;
}) {
  const { openAdd } = useEntryModal();
  const { bucketLabel } = useFormat();
  const [active, setActive] = useState<Bucket>(initialBucket ?? BUCKETS_BY_KIND[kind][0]);
  const section = sections.find((s) => s.bucket === active) ?? sections[0];
  const colors = KIND_COLORS[kind];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="stagger grid gap-3 sm:grid-cols-3">
        {summary.map((t) => (
          <Card key={t.label} className="px-5 py-4">
            <p className="text-[12.5px] font-medium text-ink-3">{t.label}</p>
            <Money amount={t.amount} kind={t.kind} className="font-display mt-1 block text-[26px] tracking-tight" />
            {t.sub ? <p className="mt-0.5 text-[12px] text-ink-3">{t.sub}</p> : null}
          </Card>
        ))}
      </div>

      {/* Bucket tabs */}
      <div className="grid gap-3 sm:grid-cols-3">
        {sections.map((s) => {
          const meta = BUCKET_META[s.bucket];
          const Icon = iconFor(meta.icon);
          const isActive = s.bucket === active;
          return (
            <button
              key={s.bucket}
              type="button"
              onClick={() => setActive(s.bucket)}
              className={cn(
                "relative flex items-center gap-3 rounded-xl2 border p-4 text-left transition",
                isActive ? "border-line-strong bg-surface shadow-card" : "border-line bg-surface/60 hover:bg-surface",
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId={`bucket-active-${kind}`}
                  className="absolute inset-x-4 -bottom-px h-0.5 rounded-full"
                  style={{ background: colors.chart }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: colors.bg, color: colors.ink }}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold text-ink">{bucketLabel(s.bucket)}</span>
                  <span className="rounded-md bg-surface-3 px-1.5 text-[11px] tabular text-ink-2">{s.count}</span>
                </span>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] text-ink-3">{s.scope}</span>
                  <Money amount={s.total} className="text-[13px] font-medium" />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Section content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section.bucket}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >
          <Card>
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">{bucketLabel(section.bucket)}</h3>
                <p className="mt-0.5 text-[13px] text-ink-3">{BUCKET_META[section.bucket].hint}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openAdd({ kind, bucket: section.bucket })}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {extra?.[section.bucket] ? <div className="px-5 pt-4">{extra[section.bucket]}</div> : null}
            <CardBody className="pt-4">
              {section.listTitle ? (
                <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-ink-3">{section.listTitle}</p>
              ) : null}
              <EntryList
                entries={section.entries}
                emptyTitle={section.emptyTitle ?? `No ${bucketLabel(section.bucket).toLowerCase()} entries`}
                emptyDescription={section.emptyDescription ?? BUCKET_META[section.bucket].description}
                emptyAction={
                  <Button size="sm" onClick={() => openAdd({ kind, bucket: section.bucket })}>
                    <Plus className="h-3.5 w-3.5" /> Add the first one
                  </Button>
                }
              />
            </CardBody>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
