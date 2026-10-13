import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";
import { LabelsForm } from "@/components/settings/labels-form";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader eyebrow="Settings" title="Make it yours" description="Profile, currency, wording, appearance and your password." />
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
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Password" description="Pick something only you know." />
            <CardBody className="pt-4">
              <PasswordForm />
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
              <p>
                Your data is private to your account. Default categories, section behaviours and the color palette live in{" "}
                <code className="rounded bg-surface-2 px-1 py-0.5 text-[12px]">src/lib/config</code> if you want to go further.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
