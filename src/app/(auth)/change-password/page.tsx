import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/current-user";
import { logout } from "@/lib/actions/auth";
import { PasswordForm } from "@/components/settings/password-form";

export const metadata: Metadata = { title: "Choose a password" };

export default async function ChangePasswordPage() {
  const user = await requireSession();
  if (!user.mustChangePassword) redirect("/dashboard");

  return (
    <div>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <h1 className="font-display text-[28px] leading-none tracking-tight text-ink">Choose your password</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
        Hi {user.username}. The temporary password only works once. Pick something you will remember, then you are in.
      </p>
      <div className="mt-6">
        <PasswordForm forced />
      </div>
      <form action={logout} className="mt-4 text-center">
        <button type="submit" className="text-[12.5px] text-ink-3 underline-offset-2 transition hover:text-ink hover:underline">
          Not you? Sign out
        </button>
      </form>
    </div>
  );
}
