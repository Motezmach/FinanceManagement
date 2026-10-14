"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { login, type AuthState } from "@/lib/actions/auth";
import { isMessageKey } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});
  const t = useTranslations("auth.login");
  const tAll = useTranslations();
  const tv = (m?: string) => (isMessageKey(m) ? tAll(m) : m);

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{state.error}</p>
      ) : null}
      <Field label={t("email")} error={tv(state.fields?.email)} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          dir="ltr"
          defaultValue={state.values?.email}
          invalid={!!state.fields?.email}
          placeholder="you@example.com"
        />
      </Field>
      <Field label={t("password")} error={tv(state.fields?.password)} htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required invalid={!!state.fields?.password} placeholder="••••••••" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("submit")} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
      </Button>
    </form>
  );
}
