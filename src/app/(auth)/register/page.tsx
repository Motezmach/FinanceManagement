import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isRegistrationOpen } from "@/lib/security/policy";
import { RegisterForm } from "@/components/auth/register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.register");
  return { title: t("title") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register");
  const open = isRegistrationOpen();

  return (
    <div>
      <h1 className="font-display text-[26px] leading-tight text-ink">{t("title")}</h1>
      <p className="mt-2 text-[13.5px] text-ink-2">{t("subtitle")}</p>
      <div className="mt-6">
        {open ? (
          <RegisterForm />
        ) : (
          <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-ink-2">{t("closed")}</p>
        )}
      </div>
      <p className="mt-5 text-center text-[13px] text-ink-3">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-2 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
