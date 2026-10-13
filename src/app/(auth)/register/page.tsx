import type { Metadata } from "next";
import Link from "next/link";
import { isRegistrationOpen } from "@/lib/actions/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const open = await isRegistrationOpen();

  return (
    <div>
      <h1 className="font-display text-[28px] leading-none tracking-tight text-ink">Create your ledger</h1>
      <p className="mt-2 text-[13.5px] text-ink-2">
        A private space for your money in and money out. Takes a few seconds.
      </p>
      <div className="mt-6">
        {open ? (
          <RegisterForm />
        ) : (
          <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-ink-2">
            Registration is closed on this instance. Ask the owner for an account.
          </p>
        )}
      </div>
      <p className="mt-5 text-center text-[13px] text-ink-3">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
