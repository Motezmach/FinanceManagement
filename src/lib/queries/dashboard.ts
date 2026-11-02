import "server-only";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import type { Bucket, Kind, Status } from "@/lib/config/buckets";
import { lastPeriods, periodRange, todayISO } from "@/lib/dates";
import { periodOf } from "@/lib/fixed/cycle";
import type { Obligation } from "@/lib/fixed/position";
import { formatShortMonth } from "@/lib/format";
import { subtractMoney, sumMoney } from "@/lib/utils";
import { ENTRY_RELATIONS, type EntryWithCategory } from "./entries";
import { listFixedBoard, listScheduled, type FixedTotals, type ScheduledBill } from "./rules";
import { listObligations, type AutoPaidItem } from "./savings";

export type { Obligation };

const periodExpr = sql<string>`to_char(${entries.date}, 'YYYY-MM')`;
const totalExpr = sql<number>`coalesce(sum(${entries.amount}), 0)::float8`;

export type DayTotals = Record<string, { in: number; out: number; due: number; saved: number; count: number }>;

export type Dashboard = {
  today: string;
  balance: number;
  pendingIn: number;
  potentialIn: number;
  dueOut: number;
  plannedOut: number;
  billsSaved: number;
  freeToSpend: number;
  shortfall: number;
  period: { received: number; spent: number; due: number; planned: number; net: number };
  buckets: Record<Bucket, { total: number; count: number }>;
  series: { period: string; label: string; in: number; out: number }[];
  /** Everything unpaid as of today, whichever month is viewed. Late first, then by date. */
  obligations: Obligation[];
  /** The current month's Fixed tab totals, whichever month is viewed. */
  fixedMonth: FixedTotals;
  autoPaidUnseen: AutoPaidItem[];
  autoPaidTotal: number;
  /** Only when the viewed month is in the future. */
  scheduled: ScheduledBill[];
  recent: EntryWithCategory[];
  todayEntries: EntryWithCategory[];
  /** Income still expected. */
  upcoming: EntryWithCategory[];
  dayTotals: DayTotals;
};

export async function getDashboard(userId: string, period: string): Promise<Dashboard> {
  const today = todayISO();
  const { start, end } = periodRange(period);
  const seriesPeriods = lastPeriods(period, 6);
  const seriesStart = periodRange(seriesPeriods[0]).start;

  const [board, scheduled, obligations, periodRows, seriesRows, dayRows, recent, todayEntries, upcoming] =
    await Promise.all([
      listFixedBoard(userId, periodOf(today), today),
      listScheduled(userId, period, today),
      listObligations(userId, today),
      db
        .select({ kind: entries.kind, bucket: entries.bucket, status: entries.status, total: totalExpr, n: count() })
        .from(entries)
        .where(and(eq(entries.userId, userId), gte(entries.date, start), lte(entries.date, end)))
        .groupBy(entries.kind, entries.bucket, entries.status),
      db
        .select({ period: periodExpr, kind: entries.kind, total: totalExpr })
        .from(entries)
        .where(
          and(
            eq(entries.userId, userId),
            eq(entries.status, "settled"),
            gte(entries.date, seriesStart),
            lte(entries.date, end),
          ),
        )
        .groupBy(periodExpr, entries.kind),
      db
        .select({ date: entries.date, kind: entries.kind, status: entries.status, total: totalExpr, n: count() })
        .from(entries)
        .where(and(eq(entries.userId, userId), gte(entries.date, start), lte(entries.date, end)))
        .groupBy(entries.date, entries.kind, entries.status),
      db.query.entries.findMany({
        where: eq(entries.userId, userId),
        with: ENTRY_RELATIONS,
        orderBy: [desc(sql`coalesce(${entries.settledAt}, ${entries.createdAt})`)],
        limit: 8,
      }),
      db.query.entries.findMany({
        where: and(eq(entries.userId, userId), eq(entries.date, today)),
        with: ENTRY_RELATIONS,
        orderBy: [desc(entries.createdAt)],
      }),
      db.query.entries.findMany({
        where: and(eq(entries.userId, userId), eq(entries.kind, "debit"), eq(entries.status, "pending")),
        with: ENTRY_RELATIONS,
        orderBy: [asc(entries.date), desc(entries.amount)],
        limit: 8,
      }),
    ]);

  const periodPick = (kind: Kind, status: Status) =>
    sumMoney(periodRows.filter((r) => r.kind === kind && r.status === status).map((r) => Number(r.total)));

  const buckets = {} as Dashboard["buckets"];
  for (const b of ["wallet", "pending", "potential", "fixed", "optional", "daily"] as Bucket[]) {
    const rows = periodRows.filter((r) => r.bucket === b);
    buckets[b] = {
      total: sumMoney(rows.map((r) => Number(r.total))),
      count: rows.reduce((a, r) => a + Number(r.n), 0),
    };
  }

  const received = periodPick("debit", "settled");
  const spent = periodPick("credit", "settled");

  const series = seriesPeriods.map((p) => ({
    period: p,
    label: formatShortMonth(p),
    in: Number(seriesRows.find((r) => r.period === p && r.kind === "debit")?.total ?? 0),
    out: Number(seriesRows.find((r) => r.period === p && r.kind === "credit")?.total ?? 0),
  }));

  const dayTotals: DayTotals = {};
  for (const r of dayRows) {
    const d = (dayTotals[r.date] ??= { in: 0, out: 0, due: 0, saved: 0, count: 0 });
    d.count += Number(r.n);
    if (r.status === "settled") {
      if (r.kind === "debit") d.in = sumMoney([d.in, Number(r.total)]);
      else d.out = sumMoney([d.out, Number(r.total)]);
    } else if (r.kind === "credit" && r.status === "pending") {
      d.due = sumMoney([d.due, Number(r.total)]);
    } else if (r.kind === "credit" && r.status === "saved") {
      d.saved = sumMoney([d.saved, Number(r.total)]);
    }
  }

  const { balance, pendingIn, potentialIn, dueOut, plannedOut, billsSaved, freeToSpend, shortfall } = board.position;

  return {
    today,
    balance,
    pendingIn,
    potentialIn,
    dueOut,
    plannedOut,
    billsSaved,
    freeToSpend,
    shortfall,
    period: {
      received,
      spent,
      due: periodPick("credit", "pending"),
      planned: periodPick("credit", "planned"),
      net: subtractMoney(received, spent),
    },
    buckets,
    series,
    obligations,
    fixedMonth: board.totals,
    autoPaidUnseen: board.autoPaidUnseen,
    autoPaidTotal: board.autoPaidTotal,
    scheduled,
    recent,
    todayEntries,
    upcoming,
    dayTotals,
  };
}
