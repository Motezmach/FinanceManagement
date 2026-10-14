"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@/lib/db/schema";
import type { RuleWithInstance } from "@/lib/queries/rules";
import { createRule, deleteRule, setRuleActive, updateRule } from "@/lib/actions/rules";
import { setEntryStatus } from "@/lib/actions/entries";
import { fieldErrors, ruleSchema } from "@/lib/validation";
import { currencySymbol } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CategoryIcon } from "@/components/ui/category-chip";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { ProgressBar } from "@/components/ui/progress";
import { useFormat } from "@/components/providers/settings-provider";

export function RulesPanel({
  rules,
  categories,
  period,
}: {
  rules: RuleWithInstance[];
  categories: Category[];
  period: string;
}) {
  const { money } = useFormat();
  const t = useTranslations("rules");
  const [editing, setEditing] = useState<RuleWithInstance | null | "new">(null);
  const active = rules.filter((r) => r.isActive);
  const monthly = active.reduce((a, r) => a + r.amount, 0);
  const paid = active.filter((r) => r.instance?.status === "settled").reduce((a, r) => a + r.amount, 0);
  const pct = monthly ? Math.round((paid / monthly) * 100) : 0;

  return (
    <div className="rounded-xl2 border border-line bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <Repeat className="h-4 w-4 text-ink-3" /> {t("title")}
          </h4>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{t("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-3.5 w-3.5" /> {t("add")}
        </Button>
      </div>

      {active.length ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
            <span className="text-ink-2">
              {t.rich("progress", {
                paid: money(paid),
                total: money(monthly),
                b: (c) => <span className="font-medium text-ink">{c}</span>,
              })}
            </span>
            <span className="tabular text-ink-3">{pct}%</span>
          </div>
          <ProgressBar value={pct} color="var(--inflow)" />
        </div>
      ) : null}

      <ul className="mt-4 divide-y divide-line">
        {rules.length === 0 ? <li className="py-6 text-center text-[13px] text-ink-3">{t("empty")}</li> : null}
        {rules.map((r) => (
          <RuleRow key={r.id} rule={r} onEdit={() => setEditing(r)} />
        ))}
      </ul>

      <RuleDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        categories={categories}
        rule={editing && editing !== "new" ? editing : undefined}
        period={period}
      />
    </div>
  );
}

function RuleRow({ rule, onEdit }: { rule: RuleWithInstance; onEdit: () => void }) {
  const t = useTranslations("rules");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const inst = rule.instance;
  const status = !rule.isActive ? "paused" : inst?.status === "settled" ? "paid" : inst ? "due" : "none";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? t("somethingWrong"));
      else toast.success(ok);
    });

  return (
    <li className={cn("flex items-center gap-3 py-2.5", pending && "opacity-60", !rule.isActive && "opacity-70")}>
      <CategoryIcon icon={rule.category?.icon} color={rule.category?.color} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13.5px] font-medium text-ink">{rule.title}</p>
          {status === "paid" ? <Badge tone="inflow">{t("paid")}</Badge> : null}
          {status === "due" ? <Badge tone="warn">{t("due")}</Badge> : null}
          {status === "paused" ? <Badge tone="outline">{t("paused")}</Badge> : null}
        </div>
        <p className="truncate text-[12px] text-ink-3">
          {rule.category?.name ?? tc("uncategorized")} · {t("every", { day: rule.dayOfMonth })}
          {rule.note ? ` · ${rule.note}` : ""}
        </p>
      </div>
      {status === "due" && inst ? (
        <button
          type="button"
          onClick={() => run(() => setEntryStatus(inst.id, "settled"), t("markedPaid"))}
          className="hidden h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2 text-[12px] font-medium text-ink-2 transition hover:border-inflow hover:text-inflow-ink sm:flex"
        >
          <Check className="h-3.5 w-3.5" /> {t("paid")}
        </button>
      ) : null}
      <Money amount={rule.amount} kind="credit" signed className="text-[13.5px] font-medium" />
      <Menu
        items={[
          ...(status === "due" && inst
            ? [{ label: t("markPaid"), icon: <Check />, onSelect: () => run(() => setEntryStatus(inst.id, "settled"), t("markedPaid")) }]
            : []),
          ...(status === "paid" && inst
            ? [{ label: t("markUnpaid"), icon: <Repeat />, onSelect: () => run(() => setEntryStatus(inst.id, "pending"), t("markedDue")) }]
            : []),
          { label: t("editRule"), icon: <Pencil />, onSelect: onEdit },
          rule.isActive
            ? { label: t("pause"), icon: <Pause />, onSelect: () => run(() => setRuleActive(rule.id, false), t("pausedToast")) }
            : { label: t("resume"), icon: <Play />, onSelect: () => run(() => setRuleActive(rule.id, true), t("resumedToast")) },
          { type: "separator" as const },
          { label: t("deleteRule"), icon: <Trash2 />, tone: "danger" as const, onSelect: () => setConfirm(true) },
        ]}
      />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        onConfirm={async () => {
          const res = await deleteRule(rule.id);
          if (!res.ok) toast.error(res.error);
          else toast.success(t("deletedToast"));
        }}
      />
    </li>
  );
}

function RuleDialog({
  open,
  onClose,
  categories,
  rule,
  period,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  rule?: RuleWithInstance;
  period: string;
}) {
  const t = useTranslations("rules");
  return (
    <Dialog open={open} onClose={onClose} title={rule ? t("dialogEdit") : t("dialogNew")} description={t("dialogSub")} size="sm">
      {open ? <RuleForm key={rule?.id ?? "new"} rule={rule} categories={categories} period={period} onDone={onClose} /> : null}
    </Dialog>
  );
}

function RuleForm({
  rule,
  categories,
  onDone,
}: {
  rule?: RuleWithInstance;
  categories: Category[];
  period: string;
  onDone: () => void;
}) {
  const { settings, tv } = useFormat();
  const t = useTranslations("rules");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: rule?.title ?? "",
    amount: rule ? String(rule.amount) : "",
    categoryId: rule?.categoryId ?? "",
    dayOfMonth: String(rule?.dayOfMonth ?? 1),
    note: rule?.note ?? "",
  });
  const credits = categories.filter((c) => c.kind === "credit" && !c.isArchived);
  const symbol = currencySymbol(settings.currency, settings.locale);

  const submit = () => {
    const parsed = ruleSchema.safeParse({ ...form, note: form.note || undefined });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    start(async () => {
      const res = rule ? await updateRule(rule.id, parsed.data) : await createRule(parsed.data);
      if (!res.ok) {
        setErrors(res.fields ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(rule ? t("updatedToast") : t("createdToast"));
      onDone();
    });
  };

  return (
    <form
      className="space-y-4 px-6 pb-6 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label={t("titleField")} error={tv(errors.title)}>
        <Input data-autofocus placeholder={t("titlePlaceholder")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} invalid={!!errors.title} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("amountField", { symbol })} error={tv(errors.amount)}>
          <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" dir="ltr" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} invalid={!!errors.amount} />
        </Field>
        <Field label={t("dayField")} error={tv(errors.dayOfMonth)} hint={t("dayHint")}>
          <Input type="number" min={1} max={31} dir="ltr" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })} invalid={!!errors.dayOfMonth} />
        </Field>
      </div>
      <Field label={t("categoryField")} error={tv(errors.categoryId)}>
        <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} invalid={!!errors.categoryId}>
          <option value="">{t("chooseCategory")}</option>
          {credits.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("noteField")} error={tv(errors.note)}>
        <Textarea placeholder={t("optional")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="min-h-[64px]" />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={pending}>
          {rule ? t("saveRule") : t("createRule")}
        </Button>
      </div>
    </form>
  );
}
