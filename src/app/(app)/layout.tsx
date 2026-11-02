import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { todayISO } from "@/lib/dates";
import { listCategories } from "@/lib/queries/categories";
import { SettingsProvider } from "@/components/providers/settings-provider";
import { EntryModalProvider } from "@/components/providers/entry-modal-provider";
import { AppShell } from "@/components/layout/app-shell";
import { CalculatorProvider } from "@/components/calculator/calculator-provider";
import { CalculatorDock } from "@/components/calculator/calculator-dock";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const categories = await listCategories(user.id);

  return (
    <SettingsProvider settings={user.settings}>
      {/* This layout only re-renders after revalidatePath, so a new revision means the data changed. */}
      <CalculatorProvider revision={crypto.randomUUID()}>
        <EntryModalProvider categories={categories} today={todayISO()}>
          <AppShell name={user.name} email={user.email}>
            {children}
          </AppShell>
          <CalculatorDock />
        </EntryModalProvider>
      </CalculatorProvider>
    </SettingsProvider>
  );
}
