"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { UserSettings } from "@/lib/config/settings";
import { CURRENCIES } from "@/lib/config/settings";
import { updateSettings } from "@/lib/actions/settings";
import { fieldErrors, settingsSchema } from "@/lib/validation";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useTheme } from "@/components/providers/theme-provider";

export function SettingsForm({ settings }: { settings: UserSettings }) {
  const { setTheme } = useTheme();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    currency: settings.currency,
    locale: settings.locale,
    debitLabel: settings.labels.debit,
    creditLabel: settings.labels.credit,
    theme: settings.theme,
  });

  let preview = "";
  try {
    preview = formatMoney(1234.5, form.currency, form.locale);
  } catch {
    preview = "—";
  }

  const submit = () => {
    const parsed = settingsSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    start(async () => {
      const res = await updateSettings(parsed.data);
      if (!res.ok) {
        setErrors(res.fields ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      setTheme(parsed.data.theme);
      toast.success("Settings saved");
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Currency" error={errors.currency}>
          <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Number format (locale)" error={errors.locale} hint={`Preview: ${preview}`}>
          <Input value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} placeholder="en-US" invalid={!!errors.locale} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Label for money in" error={errors.debitLabel} hint='Default "Debit". Some people prefer "Income".'>
          <Input value={form.debitLabel} onChange={(e) => setForm({ ...form, debitLabel: e.target.value })} maxLength={24} invalid={!!errors.debitLabel} />
        </Field>
        <Field label="Label for money out" error={errors.creditLabel} hint='Default "Credit". Some people prefer "Expenses".'>
          <Input value={form.creditLabel} onChange={(e) => setForm({ ...form, creditLabel: e.target.value })} maxLength={24} invalid={!!errors.creditLabel} />
        </Field>
      </div>

      <Field label="Appearance">
        <Segmented
          value={form.theme}
          onChange={(v) => setForm({ ...form, theme: v })}
          options={[
            { value: "light", label: "Light" },
            { value: "system", label: "System" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save settings
        </Button>
      </div>
    </form>
  );
}
