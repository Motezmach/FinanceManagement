"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/lib/db/schema";
import type { Kind } from "@/lib/config/buckets";
import { ICON_KEYS, DynamicIcon } from "@/lib/config/icons";
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
  const t = useTranslations("categories.form");
  return (
    <Dialog open={open} onClose={onClose} title={category ? t("editTitle") : t("newTitle")} description={t("subtitle")} size="md">
      {open ? <CategoryForm key={category?.id ?? `new-${kind}`} kind={kind} category={category} onDone={onClose} /> : null}
    </Dialog>
  );
}

function CategoryForm({ kind: initialKind, category, onDone }: { kind: Kind; category?: Category | null; onDone: () => void }) {
  const { kindLabel, tv } = useFormat();
  const t = useTranslations("categories.form");
  const tc = useTranslations("common");
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
      toast.success(category ? t("updated") : t("created"));
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
          <p className="truncate text-[16px] font-semibold text-ink">{form.name || t("preview")}</p>
          <p className="text-[12.5px] text-ink-3">{kindLabel(form.kind)}</p>
        </div>
      </div>

      {!category ? (
        <Field label={t("side")}>
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

      <Field label={t("name")} error={tv(errors.name)}>
        <Input data-autofocus placeholder={t("namePlaceholder")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={!!errors.name} maxLength={40} />
      </Field>

      <Field label={t("color")} error={tv(errors.color)}>
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
                className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 transition", active ? "scale-110 border-ink" : "border-transparent hover:scale-105")}
                style={{ background: sw.chart }}
              >
                {active ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t("icon")} error={tv(errors.icon)}>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
          {ICON_KEYS.map((k) => {
            const active = form.icon === k;
            const sw = swatch(form.color);
            return (
              <button
                key={k}
                type="button"
                title={k}
                onClick={() => setForm({ ...form, icon: k })}
                className={cn("flex h-9 items-center justify-center rounded-lg border transition", active ? "border-transparent" : "border-line text-ink-3 hover:border-line-strong hover:text-ink")}
                style={active ? { background: sw.bg, color: sw.ink } : undefined}
              >
                <DynamicIcon icon={k} className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={pending}>
          {category ? t("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
