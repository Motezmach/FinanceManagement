import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { getCalendar } from "@/lib/queries/calendar";
import { ensureMaterialized } from "@/lib/queries/rules";
import { currentPeriod, isValidPeriod, todayISO } from "@/lib/dates";
import { MonthGrid } from "@/components/calendar/month-grid";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/layout/month-picker";
import { Money } from "@/components/ui/money";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("calendar") };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; day?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : undefined;
  const period = isValidPeriod(sp.period) ? sp.period : day ? day.slice(0, 7) : currentPeriod();
  const [t, tc] = await Promise.all([getTranslations("calendar"), getTranslations("common")]);

  await ensureMaterialized(user.id, period);
  const data = await getCalendar(user.id, period);

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              {tc("in")} <Money amount={data.totals.in} kind="debit" className="font-medium" />
            </span>
            <span>
              {tc("out")} <Money amount={data.totals.out} kind="credit" className="font-medium" />
            </span>
            <span>
              {tc("due")} <Money amount={data.totals.due} muted={!data.totals.due} className="font-medium" />
            </span>
          </span>
        }
        actions={<MonthPicker period={period} />}
      />
      <MonthGrid period={period} days={data.days} entries={data.entries} today={todayISO()} initialDay={day} />
    </>
  );
}
