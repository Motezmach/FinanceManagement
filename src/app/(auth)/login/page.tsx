import type { Metadata } from "next";
import Link from "next/link";
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
      <p className="mt-5 text-center text-[13px] text-ink-3">
        New here?{" "}
        <Link href="/register" className="font-medium text-ink underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
