"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/lib/db/schema";
import type { Kind } from "@/lib/config/buckets";
import { ICON_KEYS, iconFor } from "@/lib/config/icons";
import { PALETTE, PALETTE_KEYS, swatch } from "@/lib/config/palette";
import { categorySchema, fieldErrors } from "@/lib/validation";
import { createCategory, updateCategory } from "@/lib/actions/categories";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { CategoryIcon } from "@/components/ui/category-chip";
import { useFormat } from "@/components/providers/settings-provider";

export function CategoryDialog({
  open,
  onClose,
  kind,
  category,
}: {
  open: boolean;
  onClose: () => void;
  kind: Kind;
  category?: Category | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      description="Pick a name, a color and an icon."
      size="md"
    >
      {open ? <CategoryForm key={category?.id ?? `new-${kind}`} kind={kind} category={category} onDone={onClose} /> : null}
    </Dialog>
  );
}

function CategoryForm({ kind: initialKind, category, onDone }: { kind: Kind; category?: Category | null; onDone: () => void }) {
  const { kindLabel } = useFormat();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    kind: category?.kind ?? initialKind,
    name: category?.name ?? "",
    color: category?.color ?? "clay",
    icon: category?.icon ?? "circle-dot",
  });

  const submit = () => {
    const parsed = categorySchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    start(async () => {
      const res = category ? await updateCategory(category.id, parsed.data) : await createCategory(parsed.data);
      if (!res.ok) {
        setErrors(res.fields ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(category ? "Category updated" : "Category created");
      onDone();
    });
  };

  return (
    <form
      className="space-y-5 px-6 pb-6 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-4 rounded-xl2 border border-line bg-surface-2 p-4">
        <CategoryIcon icon={form.icon} color={form.color} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[16px] font-semibold text-ink">{form.name || "Category name"}</p>
          <p className="text-[12.5px] text-ink-3">{kindLabel(form.kind)}</p>
        </div>
      </div>

      {!category ? (
        <Field label="Side of the ledger">
          <Segmented
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={[
              { value: "debit", label: kindLabel("debit") },
              { value: "credit", label: kindLabel("credit") },
            ]}
          />
        </Field>
      ) : null}

      <Field label="Name" error={errors.name}>
        <Input
          data-autofocus
          placeholder="e.g. Groceries"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          invalid={!!errors.name}
          maxLength={40}
        />
      </Field>

      <Field label="Color" error={errors.color}>
        <div className="flex flex-wrap gap-2">
          {PALETTE_KEYS.map((k) => {
            const sw = PALETTE[k];
            const active = form.color === k;
            return (
              <button
                key={k}
                type="button"
                title={sw.label}
                onClick={() => setForm({ ...form, color: k })}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition",
                  active ? "border-ink scale-110" : "border-transparent hover:scale-105",
                )}
                style={{ background: sw.chart }}
              >
                {active ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Icon" error={errors.icon}>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {ICON_KEYS.map((k) => {
            const Icon = iconFor(k);
            const active = form.icon === k;
            const sw = swatch(form.color);
            return (
              <button
                key={k}
                type="button"
                title={k}
                onClick={() => setForm({ ...form, icon: k })}
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg border transition",
                  active ? "border-transparent" : "border-line text-ink-3 hover:border-line-strong hover:text-ink",
                )}
                style={active ? { background: sw.bg, color: sw.ink } : undefined}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {category ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  );
}
