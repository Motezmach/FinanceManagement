"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { UserSettings } from "@/lib/config/settings";
import { CURRENCIES } from "@/lib/config/settings";
import { LOCALE_META, LOCALES, type Locale } from "@/lib/i18n/locales";
import { updateSettings } from "@/lib/actions/settings";
import { fieldErrors, settingsSchema } from "@/lib/validation";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useTheme } from "@/components/providers/theme-provider";
import { useFormat } from "@/components/providers/settings-provider";

export function SettingsForm({ settings }: { settings: UserSettings }) {
  const { setTheme } = useTheme();
  const { locale, tv } = useFormat();
  const t = useTranslations("settings.preferences");
  const tn = useTranslations("nav.theme");
  const tk = useTranslations("kinds");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    currency: settings.currency,
    locale: settings.locale,
    language: (settings.language ?? locale) as Locale,
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
      toast.success(t("saved"));
      if (parsed.data.language !== locale) router.refresh();
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
        <Field label={t("language")} error={tv(errors.language)} hint={t("languageHint")}>
          <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value as Locale })}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_META[l].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("currency")} error={tv(errors.currency)}>
          <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={t("locale")} error={tv(errors.locale)} hint={t("preview", { sample: preview })}>
        <Input value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} placeholder="en-US" dir="ltr" invalid={!!errors.locale} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("debitLabel")} error={tv(errors.debitLabel)} hint={t("debitHint", { default: tk("debit.label") })}>
          <Input value={form.debitLabel} placeholder={tk("debit.label")} onChange={(e) => setForm({ ...form, debitLabel: e.target.value })} maxLength={24} invalid={!!errors.debitLabel} />
        </Field>
        <Field label={t("creditLabel")} error={tv(errors.creditLabel)} hint={t("creditHint", { default: tk("credit.label") })}>
          <Input value={form.creditLabel} placeholder={tk("credit.label")} onChange={(e) => setForm({ ...form, creditLabel: e.target.value })} maxLength={24} invalid={!!errors.creditLabel} />
        </Field>
      </div>

      <Field label={t("appearance")}>
        <Segmented
          value={form.theme}
          onChange={(v) => setForm({ ...form, theme: v })}
          options={[
            { value: "light", label: tn("light") },
            { value: "system", label: tn("system") },
            { value: "dark", label: tn("dark") },
          ]}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
