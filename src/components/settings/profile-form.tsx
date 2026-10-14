"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { updateProfile, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useFormat } from "@/components/providers/settings-provider";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updateProfile, {});
  const t = useTranslations("settings.profile");
  const { tv } = useFormat();
  const [draftEmail, setDraftEmail] = useState(email);
  const emailChanged = draftEmail.trim().toLowerCase() !== email;

  useEffect(() => {
    if (state.success) toast.success(t("saved"));
  }, [state, t]);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{state.error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("name")} error={tv(state.fields?.name)} htmlFor="profile-name" hint={t("nameHint")}>
          <Input id="profile-name" name="name" defaultValue={name} autoComplete="name" required maxLength={60} invalid={!!state.fields?.name} />
        </Field>
        <Field label={t("email")} error={tv(state.fields?.email)} htmlFor="profile-email" hint={t("emailHint")}>
          <Input
            id="profile-email"
            name="email"
            type="email"
            dir="ltr"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            autoComplete="email"
            required
            maxLength={120}
            invalid={!!state.fields?.email}
          />
        </Field>
      </div>
      {emailChanged ? (
        <Field label={t("currentPassword")} error={tv(state.fields?.currentPassword)} htmlFor="profile-password" hint={t("currentPasswordHint")}>
          <Input id="profile-password" name="currentPassword" type="password" autoComplete="current-password" required invalid={!!state.fields?.currentPassword} />
        </Field>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
