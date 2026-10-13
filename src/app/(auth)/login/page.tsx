import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="font-display text-[28px] leading-none tracking-tight text-ink">Welcome back</h1>
      <p className="mt-2 text-[13.5px] text-ink-2">Sign in to your ledger.</p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-5 text-[12px] leading-relaxed text-ink-3">
        First time here? Use the initial username and password from your environment settings. You will be asked to
        choose a new password right after.
      </p>
    </div>
  );
}
