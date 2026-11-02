"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateRule } from "@/lib/actions/rules";
import { isOpen } from "@/lib/fixed/cycle";
import { currencySymbol } from "@/lib/format";
import type { FixedRow } from "@/lib/queries/rules";
import { fieldErrors, ruleSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";
import { AutoPaySwitch } from "./auto-pay-switch";
import { useBillDates } from "./use-bill-dates";

export function RuleEditDialog({ row, onClose }: { row: FixedRow | null; onClose: () => void }) {
  const t = useTranslations("fixed.edit");
  return (
    <Dialog open={row !== null} onClose={onClose} title={t("title")} description={t("subtitle")} size="sm">
      {row ? <RuleForm key={row.key} row={row} onDone={onClose} /> : null}
    </Dialog>
  );
}

function RuleForm({ row, onDone }: { row: FixedRow; onDone: () => void }) {
  const { categories, openEdit } = useEntryModal();
  const { settings, tv } = useFormat();
  const { monthName } = useBillDates();
  const t = useTranslations("fixed.edit");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { rule, instance, instancePeriod, category } = row;
  const [form, setForm] = useState({
    title: rule.title,
    amount: String(rule.amount),
    categoryId: rule.categoryId ?? "",
    dayOfMonth: String(rule.dayOfMonth),
    note: rule.note ?? "",
    autoPay: rule.autoPay,
  });

  // The picker only lists active categories, and a bill can still sit in an archived one.
  const options = categories.filter((c) => c.kind === "credit" && !c.isArchived);
  if (category && category.id === rule.categoryId && category.isArchived) options.push(category);

  const submit = () => {
    const parsed = ruleSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    start(async () => {
      const res = await updateRule(rule.id, parsed.data);
      if (!res.ok) {
        setErrors(res.fields ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(t("saved"));
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
        <Input
          data-autofocus
          placeholder={t("titlePlaceholder")}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          invalid={!!errors.title}
          maxLength={120}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("amount", { symbol: currencySymbol(settings.currency, settings.locale) })} error={tv(errors.amount)}>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            dir="ltr"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            invalid={!!errors.amount}
          />
        </Field>
        <Field label={t("day")} error={tv(errors.dayOfMonth)} hint={t("dayHint")}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            dir="ltr"
            value={form.dayOfMonth}
            onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            invalid={!!errors.dayOfMonth}
          />
        </Field>
      </div>
      <Field label={t("category")} error={tv(errors.categoryId)}>
        <Select
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          invalid={!!errors.categoryId}
        >
          <option value="">{t("chooseCategory")}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("note")} error={tv(errors.note)}>
        <Textarea
          placeholder={t("optional")}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          maxLength={500}
          className="min-h-[64px]"
        />
      </Field>
      <AutoPaySwitch checked={form.autoPay} onChange={(autoPay) => setForm({ ...form, autoPay })} />
      {instance && isOpen(instance.status) && instancePeriod ? (
        <button
          type="button"
          onClick={() => {
            onDone();
            openEdit({ ...instance, ruleDay: row.rule.dayOfMonth, applyToRule: false });
          }}
          className="text-[12.5px] text-ink-3 underline underline-offset-2 transition hover:text-ink"
        >
          {t("onlyMonth", { month: monthName(instancePeriod) })}
        </button>
      ) : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
