"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateProfile, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(updateProfile, {});
  const [draftEmail, setDraftEmail] = useState(email);
  const emailChanged = draftEmail.trim().toLowerCase() !== email;

  useEffect(() => {
    if (state.success) toast.success("Profile saved");
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">{state.error}</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={state.fields?.name} htmlFor="profile-name" hint="Used in greetings.">
          <Input id="profile-name" name="name" defaultValue={name} autoComplete="name" required maxLength={60} invalid={!!state.fields?.name} />
        </Field>
        <Field label="Email" error={state.fields?.email} htmlFor="profile-email" hint="You sign in with this.">
          <Input
            id="profile-email"
            name="email"
            type="email"
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
        <Field
          label="Current password"
          error={state.fields?.currentPassword}
          htmlFor="profile-password"
          hint="Needed to change the email. Other devices will be signed out."
        >
          <Input id="profile-password" name="currentPassword" type="password" autoComplete="current-password" required invalid={!!state.fields?.currentPassword} />
        </Field>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
