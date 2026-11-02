"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { parseISO } from "date-fns";
import { AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, Clock, Plus, Scale, Sparkles, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { Dashboard } from "@/lib/queries/dashboard";
import type { Kind } from "@/lib/config/buckets";
import { periodOf } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { EntryList } from "@/components/entry/entry-list";
import { EntryRow } from "@/components/entry/entry-row";
import { TrendChart } from "@/components/charts/trend-chart";
import { MiniCalendar } from "@/components/calendar/mini-calendar";
import { AutoPayBanner } from "@/components/fixed/autopay-banner";
import { useEntryModal } from "@/components/providers/entry-modal-provider";
import { useFormat } from "@/components/providers/settings-provider";
import { DuePlannedCard } from "./due-planned-card";

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
  const isCurrent = period === periodOf(data.today);
  const periodLabel = isCurrent ? tc("thisMonth") : month(period);
  const hasBills = data.dueOut > 0 || data.billsSaved > 0;

  const tiles: { label: string; amount: number; kind?: Kind | "net"; sub?: string; icon: LucideIcon; href: string }[] = [
    { label: t("received", { period: periodLabel }), amount: data.period.received, kind: "debit", icon: ArrowDownLeft, href: "/debits" },
    { label: t("spent", { period: periodLabel }), amount: data.period.spent, kind: "credit", icon: ArrowUpRight, href: "/credits" },
    {
      label: t("pendingIncome"),
      amount: data.pendingIn,
      sub: data.potentialIn ? t("potentialPlus", { amount: money(data.potentialIn, { compact: true }) }) : t("pendingIncomeSub"),
      icon: Clock,
      href: "/debits",
    },
    {
      label: isCurrent ? t("netThisMonth") : t("netMonth", { month: month(period) }),
      amount: data.period.net,
      kind: "net",
      sub: t("netSub"),
      icon: Scale,
      href: "/analytics",
    },
  ];

  return (
    <div className="space-y-6">
      <AutoPayBanner items={data.autoPaidUnseen} total={data.autoPaidTotal} />

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
              <span className="text-ink-2">{t("greetingLine", { greeting: t(`greeting.${greetingKey()}`), name })}</span> ·{" "}
              {longDate(parseISO(data.today))}
            </p>
            <p className="mt-5 text-[12.5px] font-medium uppercase tracking-[0.12em] text-ink-3 rtl:tracking-normal">{t("balance")}</p>
            <Money
              amount={data.balance}
              kind={data.balance < 0 ? "net" : undefined}
              label={t("balance")}
              className="font-display mt-1 block text-[44px] leading-none sm:text-[52px]"
            />
            <div className="mt-5 grid max-w-md grid-cols-2 gap-2.5">
              <div className="min-w-0 rounded-xl bg-surface-2 px-3.5 py-3">
                <p className="truncate text-[12px] font-medium text-ink-3">{t("freeToSpend")}</p>
                <Money
                  amount={data.freeToSpend}
                  kind={data.freeToSpend < 0 ? "net" : undefined}
                  label={t("freeToSpend")}
                  className="font-display mt-1 block truncate text-[20px] leading-none sm:text-[22px]"
                />
              </div>
              <Link href="/credits/savings" className="min-w-0 rounded-xl bg-saved-soft px-3.5 py-3 transition hover:brightness-95">
                <p className="flex items-center justify-between gap-2 text-[12px] font-medium text-saved-ink">
                  <span className="truncate">{t("inSavings")}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 rtl:-scale-x-100" />
                </p>
                <Money
                  amount={data.billsSaved}
                  label={t("inSavings")}
                  className="font-display mt-1 block truncate text-[20px] leading-none text-saved-ink sm:text-[22px]"
                />
              </Link>
            </div>
            {data.shortfall > 0 && hasBills ? (
              <p className="mt-3 flex max-w-md items-center gap-2 rounded-xl bg-warn-soft px-3.5 py-2 text-[13px] font-medium text-warn-ink">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {t("heroShortfall", { amount: money(data.shortfall) })}
              </p>
            ) : null}
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
              <Money amount={tile.amount} kind={tile.kind} label={tile.label} className="font-display mt-2 block text-[26px] leading-none" />
              <p className="mt-1.5 text-[12px] text-ink-3">{tile.sub ?? " "}</p>
            </Card>
          </Link>
        ))}
      </section>

      {/* What is owed, next to where the money has been going and what is on its way */}
      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <DuePlannedCard data={data} period={period} />
        <div className="flex min-w-0 flex-col gap-5">
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
          <Card className="flex-1">
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
                  <p className="text-[14px] font-medium text-ink">{t("allClear")}</p>
                  <p className="mt-1 text-[13px] text-ink-3">{t("allClearSub")}</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      {/* Recent */}
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
    </div>
  );
}
