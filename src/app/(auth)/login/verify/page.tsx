import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { decryptTwoFactorChallenge, TWO_FACTOR_COOKIE } from "@/lib/auth/session";
import { cancelTwoFactorLogin } from "@/lib/actions/auth";
import { TwoFactorForm } from "@/components/auth/two-factor-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verify");
  return { title: t("title") };
}

export default async function VerifyPage() {
  const challenge = await decryptTwoFactorChallenge((await cookies()).get(TWO_FACTOR_COOKIE)?.value);
  if (!challenge) redirect("/login");
  const t = await getTranslations("auth.verify");

  return (
    <div>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <h1 className="font-display text-[26px] leading-tight text-ink">{t("title")}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{t("subtitle")}</p>
      <div className="mt-6">
        <TwoFactorForm />
      </div>
      <form action={cancelTwoFactorLogin} className="mt-4 text-center">
        <button type="submit" className="text-[12.5px] text-ink-3 underline-offset-2 transition hover:text-ink hover:underline">
          {t("cancel")}
        </button>
      </form>
    </div>
  );
}
