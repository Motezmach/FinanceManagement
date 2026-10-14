"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { changePassword, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useFormat } from "@/components/providers/settings-provider";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(changePassword, {});
  const t = useTranslations("settings.password");
  const { tv } = useFormat();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success(t("changed"));
      formRef.current?.reset();
    }
  }, [state, t]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state.error ? <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{state.error}</p> : null}
      <Field label={t("current")} error={tv(state.fields?.currentPassword)} htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required invalid={!!state.fields?.currentPassword} />
      </Field>
      <Field label={t("new")} error={tv(state.fields?.newPassword)} htmlFor="newPassword" hint={t("newHint")}>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} invalid={!!state.fields?.newPassword} />
      </Field>
      <Field label={t("confirm")} error={tv(state.fields?.confirmPassword)} htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} invalid={!!state.fields?.confirmPassword} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {t("update")}
        </Button>
      </div>
    </form>
  );
}
