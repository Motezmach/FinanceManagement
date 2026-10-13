import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { listCategories } from "@/lib/queries/categories";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { EntryModalProvider } from "@/components/providers/entry-modal-provider";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const categories = await listCategories(user.id);

  return (
    <SettingsProvider settings={user.settings}>
      <EntryModalProvider categories={categories}>
        <AppShell name={user.name} email={user.email}>
          {children}
        </AppShell>
      </EntryModalProvider>
    </SettingsProvider>
  );
}
