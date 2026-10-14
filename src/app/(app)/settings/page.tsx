import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { logout } from "@/lib/actions/auth";
import { listAuthEvents } from "@/lib/security/audit";
import { parseAgent } from "@/lib/security/request";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { LabelsForm } from "@/components/settings/labels-form";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { TwoFactorCard } from "@/components/settings/two-factor-card";
import { ActivityCard, SessionsCard } from "@/components/settings/security-cards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("settings") };
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ recovery?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const t = await getTranslations("settings");
  const events = await listAuthEvents(user.id, 12);
  const activity = events.map((e) => {
    const agent = parseAgent(e.userAgent);
    return {
      id: e.id,
      type: e.type,
      ipMasked: e.ipMasked,
      browser: agent.browser,
      os: agent.os,
      createdAt: e.createdAt.toISOString(),
    };
  });

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      {sp.recovery === "1" ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl2 border border-warn/50 bg-warn-soft px-4 py-3 text-[13.5px] text-warn-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("recoveryBanner")}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={t("profile.title")}
              description={t("profile.subtitle")}
              action={
                <form action={logout}>
                  <Button type="submit" variant="outline" size="sm">
                    <LogOut className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t("profile.signOut")}
                  </Button>
                </form>
              }
            />
            <CardBody className="pt-4">
              <ProfileForm name={user.name} email={user.email} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("preferences.title")} description={t("preferences.subtitle")} />
            <CardBody className="pt-4">
              <SettingsForm settings={user.settings} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("sections.title")} description={t("sections.subtitle")} />
            <CardBody className="pt-4">
              <LabelsForm settings={user.settings} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("how.title")} />
            <CardBody className="space-y-3 pt-4 text-[13.5px] leading-relaxed text-ink-2">
              {(["p1", "p2", "p3"] as const).map((k) => (
                <p key={k}>{t.rich(`how.${k}`, { b: (c) => <span className="font-medium text-ink">{c}</span> })}</p>
              ))}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-5">
          <TwoFactorCard enabled={user.totpEnabled} />
          <Card>
            <CardHeader title={t("password.title")} description={t("password.subtitle")} />
            <CardBody className="pt-4">
              <PasswordForm />
            </CardBody>
          </Card>
          <SessionsCard />
          <ActivityCard items={activity} />
        </div>
      </div>
    </>
  );
}
