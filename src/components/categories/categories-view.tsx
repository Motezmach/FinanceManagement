"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Shapes, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/lib/db/schema";
import type { CategoryStat } from "@/lib/queries/categories";
import type { Kind } from "@/lib/config/buckets";
import { swatch } from "@/lib/config/palette";
import { deleteCategory, setCategoryArchived } from "@/lib/actions/categories";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Money } from "@/components/ui/money";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty";
import { Sparkline } from "@/components/charts/sparkline";
import { CategoryDialog } from "./category-form";
import { useFormat } from "@/components/providers/settings-provider";

export function CategoriesView({ stats, initialKind = "credit" }: { stats: CategoryStat[]; initialKind?: Kind }) {
  const { kindLabel } = useFormat();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [dialog, setDialog] = useState<{ open: boolean; category?: Category | null }>({ open: false });

  const list = stats.filter((s) => s.category.kind === kind);
  const active = list.filter((s) => !s.category.isArchived);
  const archived = list.filter((s) => s.category.isArchived);
  const monthTotal = active.reduce((a, s) => a + s.periodTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "debit", label: kindLabel("debit"), count: stats.filter((s) => s.category.kind === "debit" && !s.category.isArchived).length },
            { value: "credit", label: kindLabel("credit"), count: stats.filter((s) => s.category.kind === "credit" && !s.category.isArchived).length },
          ]}
        />
        <Button onClick={() => setDialog({ open: true, category: null })}>
          <Plus className="h-4 w-4" /> New category
        </Button>
      </div>

      {active.length ? (
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((s) => (
            <CategoryCard
              key={s.category.id}
              stat={s}
              share={monthTotal ? s.periodTotal / monthTotal : 0}
              onEdit={() => setDialog({ open: true, category: s.category })}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Shapes className="h-5 w-5" />}
            title={`No ${kindLabel(kind).toLowerCase()} categories`}
            description="Categories help you see where money comes from and where it goes."
            action={
              <Button size="sm" onClick={() => setDialog({ open: true, category: null })}>
                <Plus className="h-3.5 w-3.5" /> Create one
              </Button>
            }
          />
        </Card>
      )}

      {archived.length ? (
        <details className="group">
          <summary className="cursor-pointer select-none text-[13px] font-medium text-ink-3 hover:text-ink">
            Archived ({archived.length})
          </summary>
          <div className="mt-3 grid gap-3 opacity-75 sm:grid-cols-2 xl:grid-cols-3">
            {archived.map((s) => (
              <CategoryCard key={s.category.id} stat={s} share={0} onEdit={() => setDialog({ open: true, category: s.category })} />
            ))}
          </div>
        </details>
      ) : null}

      <CategoryDialog open={dialog.open} onClose={() => setDialog({ open: false })} kind={kind} category={dialog.category} />
    </div>
  );
}

function CategoryCard({ stat, share, onEdit }: { stat: CategoryStat; share: number; onEdit: () => void }) {
  const { category: c } = stat;
  const [confirm, setConfirm] = useState(false);
  const sw = swatch(c.color);

  return (
    <Card className={cn("group relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop", c.isArchived && "border-dashed")}>
      <Link href={`/categories/${c.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <CategoryIcon icon={c.icon} color={c.color} />
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-semibold text-ink">{c.name}</p>
              <p className="text-[12px] text-ink-3">
                {stat.allTimeCount} {stat.allTimeCount === 1 ? "entry" : "entries"}
                {stat.openTotal > 0 ? " · open " : ""}
                {stat.openTotal > 0 ? <Money amount={stat.openTotal} muted className="text-[12px]" /> : null}
              </p>
            </div>
          </div>
          <div className="w-8" />
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11.5px] uppercase tracking-wider text-ink-3">This month</p>
            <Money amount={stat.periodTotal} className="font-display text-[24px] leading-none tracking-tight" />
            {share > 0 ? <p className="mt-1 text-[12px] text-ink-3">{Math.round(share * 100)}% of the month</p> : null}
          </div>
          <Sparkline data={stat.trend.map((t) => t.total)} color={sw.chart} height={40} className="w-[110px]" />
        </div>
      </Link>
      <div className="absolute right-3 top-3">
        <Menu
          items={[
            { label: "Edit", icon: <Pencil />, onSelect: onEdit },
            c.isArchived
              ? {
                  label: "Restore",
                  icon: <ArchiveRestore />,
                  onSelect: async () => {
                    const r = await setCategoryArchived(c.id, false);
                    if (r.ok) toast.success("Category restored");
                    else toast.error(r.error);
                  },
                }
              : {
                  label: "Archive",
                  icon: <Archive />,
                  onSelect: async () => {
                    const r = await setCategoryArchived(c.id, true);
                    if (r.ok) toast.success("Category archived");
                    else toast.error(r.error);
                  },
                },
            { type: "separator" },
            { label: "Delete", icon: <Trash2 />, tone: "danger", onSelect: () => setConfirm(true) },
          ]}
        />
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete "${c.name}"?`}
        description="Entries in this category are kept but become uncategorized. Archiving hides it instead, without losing anything."
        onConfirm={async () => {
          const r = await deleteCategory(c.id);
          if (r.ok) toast.success(`Deleted · ${r.data?.orphaned ?? 0} entries now uncategorized`);
          else toast.error(r.error);
        }}
      />
    </Card>
  );
}
