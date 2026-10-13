"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarClock, Clock, Plus, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { Dashboard } from "@/lib/queries/dashboard";
import { formatLongDate, formatMonth } from "@/lib/format";
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

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardView({
  data,
  period,
  username,
  welcome,
}: {
  data: Dashboard;
  period: string;
  username: string;
  welcome?: boolean;
}) {
  const { openAdd } = useEntryModal();
  const { kindLabel, money } = useFormat();
  const isCurrent = period === currentPeriod();
  const monthLabel = formatMonth(period);
  const today = new Date();

  const tiles = [
    {
      label: `Received · ${isCurrent ? "this month" : monthLabel}`,
      amount: data.period.received,
      kind: "debit" as const,
      icon: ArrowDownLeft,
      href: "/debits",
    },
    {
      label: `Spent · ${isCurrent ? "this month" : monthLabel}`,
      amount: data.period.spent,
      kind: "credit" as const,
      icon: ArrowUpRight,
      href: "/credits",
    },
    {
      label: "Pending income",
      amount: data.pendingIn,
      sub: data.potentialIn ? `+ ${money(data.potentialIn, { compact: true })} potential` : "Work done, not paid yet",
      icon: Clock,
      href: "/debits",
    },
    {
      label: "Due & planned",
      amount: data.dueOut,
      sub: data.plannedOut ? `+ ${money(data.plannedOut, { compact: true })} planned` : "Bills waiting to be paid",
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
          <Sparkles className="h-4 w-4" />
          Password updated. You are all set. Press <kbd className="rounded bg-white/60 px-1.5 font-sans text-[11px] text-ink">N</kbd> anytime to add an entry.
        </motion.div>
      ) : null}

      {/* Hero */}
      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
            style={{ background: "var(--accent-soft)" }}
          />
          <CardBody className="relative p-6 sm:p-7">
            <p className="text-[13px] text-ink-3">
              {greeting()}, <span className="font-medium text-ink-2">{username}</span> · {formatLongDate(today)}
            </p>
            <p className="mt-5 text-[12.5px] font-medium uppercase tracking-[0.12em] text-ink-3">Balance</p>
            <Money
              amount={data.balance}
              kind={data.balance < 0 ? "net" : undefined}
              className="font-display mt-1 block text-[48px] leading-none tracking-tight sm:text-[56px]"
            />
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-2">
              <span>
                After pending & due:{" "}
                <Money amount={data.projected} kind="net" className="font-medium" />
              </span>
              <span className="hidden h-3 w-px bg-line-strong sm:block" />
              <span>
                Net {isCurrent ? "this month" : monthLabel}:{" "}
                <Money amount={data.period.net} kind="net" className="font-medium" />
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={() => openAdd({ kind: "debit" })}>
                <ArrowDownLeft className="h-4 w-4" /> Add {kindLabel("debit").toLowerCase()}
              </Button>
              <Button variant="outline" onClick={() => openAdd({ kind: "credit" })}>
                <ArrowUpRight className="h-4 w-4" /> Add {kindLabel("credit").toLowerCase()}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={isCurrent ? "Today" : formatMonth(period)}
            description={isCurrent ? `${data.todayEntries.length} ${data.todayEntries.length === 1 ? "entry" : "entries"} so far` : "Jump to a day"}
            action={
              <Link href={isCurrent ? "/calendar" : `/calendar?period=${period}`} className="text-[12.5px] text-ink-3 hover:text-ink">
                Calendar <ArrowRight className="inline h-3 w-3" />
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
                    <Plus className="h-3.5 w-3.5" /> Nothing logged today. Add something
                  </button>
                )}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </section>

      {/* KPI tiles */}
      <section className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group">
            <Card className="h-full px-5 py-4 transition group-hover:-translate-y-0.5 group-hover:shadow-pop">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-ink-3">{t.label}</p>
                <t.icon className={cn("h-4 w-4", t.kind === "debit" ? "text-inflow" : t.kind === "credit" ? "text-outflow" : "text-ink-3")} />
              </div>
              <Money amount={t.amount} kind={t.kind} className="font-display mt-2 block text-[28px] leading-none tracking-tight" />
              {t.sub ? <p className="mt-1.5 text-[12px] text-ink-3">{t.sub}</p> : <p className="mt-1.5 text-[12px] text-ink-3">&nbsp;</p>}
            </Card>
          </Link>
        ))}
      </section>

      {/* Charts */}
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="In vs out" description="Settled amounts over the last six months." />
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
            title="Where it went"
            description={`${kindLabel("credit")} by category · ${isCurrent ? "this month" : monthLabel}`}
            action={
              <Link href="/analytics" className="text-[12.5px] text-ink-3 hover:text-ink">
                Analytics <ArrowRight className="inline h-3 w-3" />
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
          <CardHeader title="Recent entries" description="Latest additions across the ledger." />
          <CardBody className="pt-4">
            <EntryList
              entries={data.recent}
              groupByDate={false}
              showBucket
              emptyTitle="Your ledger is empty"
              emptyDescription="Start by adding what is in your wallet, then log spending as it happens."
              emptyAction={
                <Button size="sm" onClick={() => openAdd({ kind: "debit", bucket: "wallet" })}>
                  <Plus className="h-3.5 w-3.5" /> Add wallet balance
                </Button>
              }
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Coming up" description="Pending items in the next two weeks." />
          <CardBody className="pt-4">
            {data.upcoming.length ? (
              <div className="-mx-2">
                {data.upcoming.map((e) => (
                  <EntryRow key={e.id} entry={e} compact />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Badge tone="inflow">All clear</Badge>
                <p className="mt-2 text-[13px] text-ink-3">Nothing due or expected in the next 14 days.</p>
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
