"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { changePassword, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function PasswordForm({ forced }: { forced?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(changePassword, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast.success("Password changed");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{state.error}</p>
      ) : null}
      <Field label={forced ? "Temporary password" : "Current password"} error={state.fields?.currentPassword}>
        <Input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          invalid={!!state.fields?.currentPassword}
          data-autofocus
        />
      </Field>
      <Field label="New password" error={state.fields?.newPassword} hint="At least 8 characters with letters and numbers.">
        <Input name="newPassword" type="password" autoComplete="new-password" required minLength={8} invalid={!!state.fields?.newPassword} />
      </Field>
      <Field label="Confirm new password" error={state.fields?.confirmPassword}>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} invalid={!!state.fields?.confirmPassword} />
      </Field>
      <div className={forced ? "pt-2" : "flex justify-end"}>
        <Button type="submit" loading={pending} size={forced ? "lg" : "md"} className={forced ? "w-full" : undefined}>
          {forced ? "Set password & continue" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
