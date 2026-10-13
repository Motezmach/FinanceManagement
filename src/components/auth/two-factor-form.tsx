"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { verifyTwoFactor, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function TwoFactorForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(verifyTwoFactor, {});

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{state.error}</p>
      ) : null}
      <Field label="Code" error={state.fields?.code} htmlFor="code" hint="Codes change every 30 seconds. Recovery codes look like ABCDE-FGHJK.">
        <Input
          id="code"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={24}
          placeholder="123 456"
          className="text-center text-[18px] tracking-[0.25em] tabular"
          invalid={!!state.fields?.code}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Verify <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
