import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { ensureSynced } from "@/lib/fixed/sync";
import { getCalendar } from "@/lib/queries/calendar";
import { currentPeriod, isValidPeriod, todayISO } from "@/lib/dates";
import { sumMoney } from "@/lib/utils";
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
  const [t, tc, ts] = await Promise.all([getTranslations("calendar"), getTranslations("common"), getTranslations("status")]);

  await ensureSynced(user);
  const data = await getCalendar(user.id, period);

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>
              {tc("in")} <Money amount={data.totals.in} kind="debit" label={tc("in")} className="font-medium" />
            </span>
            <span>
              {tc("out")} <Money amount={data.totals.out} kind="credit" label={tc("out")} className="font-medium" />
            </span>
            <span>
              {tc("due")} <Money amount={data.totals.due} muted={!data.totals.due} label={tc("due")} className="font-medium" />
            </span>
            {data.totals.saved > 0 ? (
              <span>
                {ts("saved.label")} <Money amount={data.totals.saved} label={ts("saved.label")} className="font-medium text-saved-ink" />
              </span>
            ) : null}
            {data.scheduled.length ? (
              <span>
                {t("scheduled")} <Money amount={sumMoney(data.scheduled.map((b) => b.amount))} muted label={t("scheduled")} className="font-medium" />
              </span>
            ) : null}
          </span>
        }
        actions={<MonthPicker period={period} />}
      />
      <MonthGrid key={period} period={period} days={data.days} entries={data.entries} scheduled={data.scheduled} today={todayISO()} initialDay={day} />
    </>
  );
}
