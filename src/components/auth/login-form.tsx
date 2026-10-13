"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { login, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{state.error}</p>
      ) : null}
      <Field label="Username" error={state.fields?.username}>
        <Input name="username" autoComplete="username" autoFocus required invalid={!!state.fields?.username} placeholder="admin" />
      </Field>
      <Field label="Password" error={state.fields?.password}>
        <Input name="password" type="password" autoComplete="current-password" required invalid={!!state.fields?.password} placeholder="••••••••" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
