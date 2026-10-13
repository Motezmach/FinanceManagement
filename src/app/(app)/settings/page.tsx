import type { Metadata } from "next";
import { AlertTriangle, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { logout } from "@/lib/actions/auth";
import { listAuthEvents } from "@/lib/security/audit";
import { describeAgent } from "@/lib/security/request";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { LabelsForm } from "@/components/settings/labels-form";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { TwoFactorCard } from "@/components/settings/two-factor-card";
import { ActivityCard, SessionsCard } from "@/components/settings/security-cards";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ recovery?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const events = await listAuthEvents(user.id, 12);
  const activity = events.map((e) => ({
    id: e.id,
    type: e.type,
    ipMasked: e.ipMasked,
    agent: describeAgent(e.userAgent),
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader eyebrow="Settings" title="Make it yours" description="Profile, security, currency, wording and appearance." />

      {sp.recovery === "1" ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl2 border border-warn/50 bg-warn-soft px-4 py-3 text-[13.5px] text-warn-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You signed in with a recovery code. That code is now used up. If you lost your authenticator, turn two-factor off and set it
            up again on your new device, then generate fresh recovery codes.
          </span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Profile"
              description="How we greet you and how you sign in."
              action={
                <form action={logout}>
                  <Button type="submit" variant="outline" size="sm">
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </Button>
                </form>
              }
            />
            <CardBody className="pt-4">
              <ProfileForm name={user.name} email={user.email} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Preferences" description="How amounts and the two sides of the ledger are shown." />
            <CardBody className="pt-4">
              <SettingsForm settings={user.settings} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Section names" description="Rename the six sections to match how you think. Leave blank for the default." />
            <CardBody className="pt-4">
              <LabelsForm settings={user.settings} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="How it works" />
            <CardBody className="space-y-3 pt-4 text-[13.5px] leading-relaxed text-ink-2">
              <p>
                <span className="font-medium text-ink">Balance</span> is everything settled in minus everything settled out, across all
                months. Pending and planned entries never touch it until you mark them settled.
              </p>
              <p>
                <span className="font-medium text-ink">Debits</span> move along a pipeline: potential → pending → wallet. Marking one as
                received stamps today&apos;s date so it lands in the right month.
              </p>
              <p>
                <span className="font-medium text-ink">Fixed monthly rules</span> create a due entry each month. Pausing a rule removes the
                unpaid instance; paid history always stays.
              </p>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-5">
          <TwoFactorCard enabled={user.totpEnabled} />
          <Card>
            <CardHeader title="Password" description="Changing it signs out every other device." />
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
