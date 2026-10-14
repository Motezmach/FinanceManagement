"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarClock, Clock, Plus, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { Dashboard } from "@/lib/queries/dashboard";
import { currentPeriod } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Badge } from "@/components/ui/badge";
import { EntryList } from "@/components/entry/entry-list";
import { EntryRow } from "@/components/entry/entry-row";
import { TrendChart } from "@/components/charts/trend-chart";
import { CategoryDonut } from "@/components/charts/category-donut";
import { MiniCalendar } from "@/components/calendar/mini-calendar";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";

function greetingKey() {
  const h = new Date().getHours();
  if (h < 5) return "night" as const;
  if (h < 12) return "morning" as const;
  if (h < 18) return "afternoon" as const;
  return "evening" as const;
}

export function DashboardView({
  data,
  period,
  name,
  welcome,
}: {
  data: Dashboard;
  period: string;
  name: string;
  welcome?: boolean;
}) {
  const { openAdd } = useEntryModal();
  const { kindLabel, money, month, longDate } = useFormat();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const isCurrent = period === currentPeriod();
  const periodLabel = isCurrent ? tc("thisMonth") : month(period);
  const today = new Date();

  const tiles = [
    { label: t("received", { period: periodLabel }), amount: data.period.received, kind: "debit" as const, icon: ArrowDownLeft, href: "/debits" },
    { label: t("spent", { period: periodLabel }), amount: data.period.spent, kind: "credit" as const, icon: ArrowUpRight, href: "/credits" },
    {
      label: t("pendingIncome"),
      amount: data.pendingIn,
      sub: data.potentialIn ? t("potentialPlus", { amount: money(data.potentialIn, { compact: true }) }) : t("pendingIncomeSub"),
      icon: Clock,
      href: "/debits",
    },
    {
      label: t("dueAndPlanned"),
      amount: data.dueOut,
      sub: data.plannedOut ? t("plannedPlus", { amount: money(data.plannedOut, { compact: true }) }) : t("dueAndPlannedSub"),
      icon: CalendarClock,
      href: "/credits",
    },
  ];

  return (
    <div className="space-y-6">
      {welcome ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl2 border border-inflow/40 bg-inflow-soft px-4 py-3 text-[13.5px] text-inflow-ink"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            {t.rich("welcome", {
              name,
              kbd: (chunks) => <kbd className="rounded bg-white/60 px-1.5 font-sans text-[11px] text-ink">{chunks}</kbd>,
            })}
          </span>
        </motion.div>
      ) : null}

      {/* Hero */}
      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute -end-24 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
            style={{ background: "var(--accent-soft)" }}
          />
          <CardBody className="relative p-6 sm:p-7">
            <p className="text-[13px] text-ink-3">
              <span className="text-ink-2">{t("greetingLine", { greeting: t(`greeting.${greetingKey()}`), name })}</span> · {longDate(today)}
            </p>
            <p className="mt-5 text-[12.5px] font-medium uppercase tracking-[0.12em] text-ink-3">{t("balance")}</p>
            <Money
              amount={data.balance}
              kind={data.balance < 0 ? "net" : undefined}
              className="font-display mt-1 block text-[44px] leading-none sm:text-[52px]"
            />
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
              <span>
                {t("afterPending")} <Money amount={data.projected} kind="net" className="font-medium" />
              </span>
              <span className="hidden h-3 w-px bg-line-strong sm:block" />
              <span>
                {isCurrent ? t("netThisMonth") : t("netMonth", { month: month(period) })}{" "}
                <Money amount={data.period.net} kind="net" className="font-medium" />
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => openAdd({ kind: "debit" })}>
                <ArrowDownLeft className="h-4 w-4" /> {t("addDebit", { label: kindLabel("debit").toLowerCase() })}
              </Button>
              <Button variant="outline" onClick={() => openAdd({ kind: "credit" })}>
                <ArrowUpRight className="h-4 w-4" /> {t("addCredit", { label: kindLabel("credit").toLowerCase() })}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={isCurrent ? t("today") : month(period)}
            description={isCurrent ? t("todayCount", { count: data.todayEntries.length }) : t("jumpToDay")}
            action={
              <Link href={isCurrent ? "/calendar" : `/calendar?period=${period}`} className="text-[12.5px] text-ink-3 hover:text-ink">
                {t("calendarLink")} <ArrowRight className="inline h-3 w-3 rtl:-scale-x-100" />
              </Link>
            }
          />
          <CardBody className="pt-4">
            <MiniCalendar period={period} days={data.dayTotals} today={data.today} />
            {isCurrent ? (
              <div className="mt-4 border-t border-line pt-3">
                {data.todayEntries.length ? (
                  <div className="-mx-2 max-h-[150px] overflow-y-auto scrollbar-thin">
                    {data.todayEntries.slice(0, 4).map((e) => (
                      <EntryRow key={e.id} entry={e} showDate={false} compact />
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAdd()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-3 text-[13px] text-ink-3 transition hover:border-line-strong hover:text-ink"
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("nothingToday")}
                  </button>
                )}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </section>

      {/* KPI tiles */}
      <section className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="group">
            <Card className="h-full px-5 py-4 transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-ink-3">{tile.label}</p>
                <tile.icon className={cn("h-4 w-4", tile.kind === "debit" ? "text-inflow" : tile.kind === "credit" ? "text-outflow" : "text-ink-3")} />
              </div>
              <Money amount={tile.amount} kind={tile.kind} className="font-display mt-2 block text-[26px] leading-none" />
              <p className="mt-1.5 text-[12px] text-ink-3">{tile.sub ?? " "}</p>
            </Card>
          </Link>
        ))}
      </section>

      {/* Charts */}
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={t("inVsOut")} description={t("inVsOutSub")} />
          <CardBody className="pt-4">
            <TrendChart data={data.series} />
            <div className="mt-2 flex items-center gap-4 text-[12px] text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-inflow" /> {kindLabel("debit")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-outflow" /> {kindLabel("credit")}
              </span>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={t("whereItWent")}
            description={t("whereItWentSub", { label: kindLabel("credit"), period: periodLabel })}
            action={
              <Link href="/analytics" className="text-[12.5px] text-ink-3 hover:text-ink">
                {t("analyticsLink")} <ArrowRight className="inline h-3 w-3 rtl:-scale-x-100" />
              </Link>
            }
          />
          <CardBody className="pt-4">
            <CategoryDonut data={data.spendByCategory} total={data.period.spent} centerLabel="spent" />
          </CardBody>
        </Card>
      </section>

      {/* Lists */}
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={t("recent")} description={t("recentSub")} />
          <CardBody className="pt-4">
            <EntryList
              entries={data.recent}
              groupByDate={false}
              showBucket
              emptyTitle={t("emptyTitle")}
              emptyDescription={t("emptySub")}
              emptyAction={
                <Button size="sm" onClick={() => openAdd({ kind: "debit", bucket: "wallet" })}>
                  <Plus className="h-3.5 w-3.5" /> {t("addWallet")}
                </Button>
              }
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("comingUp")} description={t("comingUpSub")} />
          <CardBody className="pt-4">
            {data.upcoming.length ? (
              <div className="-mx-2">
                {data.upcoming.map((e) => (
                  <EntryRow key={e.id} entry={e} compact />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Badge tone="inflow">{t("allClear")}</Badge>
                <p className="mt-2 text-[13px] text-ink-3">{t("allClearSub")}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
