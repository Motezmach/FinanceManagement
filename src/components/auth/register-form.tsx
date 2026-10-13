"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { register, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "Contains a letter", test: (v: string) => /[a-zA-Z]/.test(v) },
  { label: "Contains a number", test: (v: string) => /\d/.test(v) },
];

export function RegisterForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, {});
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{state.error}</p>
      ) : null}
      <Field label="Your name" error={state.fields?.name} htmlFor="name">
        <Input
          id="name"
          name="name"
          autoComplete="name"
          autoFocus
          required
          maxLength={60}
          placeholder="e.g. Seif"
          defaultValue={state.values?.name}
          invalid={!!state.fields?.name}
        />
      </Field>
      <Field label="Email" error={state.fields?.email} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={120}
          placeholder="you@example.com"
          defaultValue={state.values?.email}
          invalid={!!state.fields?.email}
        />
      </Field>
      <Field label="Password" error={state.fields?.password} htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          invalid={!!state.fields?.password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.label} className={cn("flex items-center gap-1 text-[12px] transition-colors", ok ? "text-inflow-ink" : "text-ink-3")}>
                <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-full border", ok ? "border-inflow bg-inflow text-white" : "border-line-strong")}>
                  {ok ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                </span>
                {r.label}
              </li>
            );
          })}
        </ul>
      </Field>
      <Field label="Confirm password" error={state.fields?.confirmPassword} htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} invalid={!!state.fields?.confirmPassword} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create my ledger <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
