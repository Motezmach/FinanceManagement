import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("submit") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  return (
    <div>
      <h1 className="font-display text-[26px] leading-tight text-ink">{t("title")}</h1>
      <p className="mt-2 text-[13.5px] text-ink-2">{t("subtitle")}</p>
      <div className="mt-6">
        <LoginForm />
      </div>
      <p className="mt-5 text-center text-[13px] text-ink-3">
        {t("newHere")}{" "}
        <Link href="/register" className="font-medium text-ink underline-offset-2 hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
