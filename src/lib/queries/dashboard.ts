import "server-only";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import type { Bucket, Kind, Status } from "@/lib/config/buckets";
import { lastPeriods, periodRange, toISODate, todayISO } from "@/lib/dates";
import { formatShortMonth } from "@/lib/format";
import type { EntryWithCategory } from "./entries";

const periodExpr = sql<string>`to_char(${entries.date}, 'YYYY-MM')`;
const totalExpr = sql<number>`coalesce(sum(${entries.amount}), 0)::float8`;

export type DayTotals = Record<string, { in: number; out: number; due: number; count: number }>;

export type Dashboard = {
  today: string;
  balance: number;
  projected: number;
  pendingIn: number;
  potentialIn: number;
  dueOut: number;
  plannedOut: number;
  period: { received: number; spent: number; due: number; planned: number; net: number };
  buckets: Record<Bucket, { total: number; count: number }>;
  series: { period: string; label: string; in: number; out: number }[];
  spendByCategory: { id: string; name: string; color: string; icon: string; total: number; pct: number }[];
  recent: EntryWithCategory[];
  todayEntries: EntryWithCategory[];
  upcoming: EntryWithCategory[];
  dayTotals: DayTotals;
};

export async function getDashboard(userId: string, period: string): Promise<Dashboard> {
  const today = todayISO();
  const { start, end } = periodRange(period);
  const seriesPeriods = lastPeriods(period, 6);
  const seriesStart = periodRange(seriesPeriods[0]).start;
  const horizon = toISODate(addDays(new Date(), 14));

  const [allRows, periodRows, seriesRows, catRows, dayRows, recent, todayEntries, upcoming] =
    await Promise.all([
      db
        .select({ kind: entries.kind, status: entries.status, total: totalExpr })
        .from(entries)
        .where(eq(entries.userId, userId))
        .groupBy(entries.kind, entries.status),
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
      db.query.entries.findMany({
        where: and(
          eq(entries.userId, userId),
          eq(entries.kind, "credit"),
          eq(entries.status, "settled"),
          gte(entries.date, start),
          lte(entries.date, end),
        ),
        with: { category: true },
        columns: { amount: true, categoryId: true },
      }),
      db
        .select({ date: entries.date, kind: entries.kind, status: entries.status, total: totalExpr, n: count() })
        .from(entries)
        .where(and(eq(entries.userId, userId), gte(entries.date, start), lte(entries.date, end)))
        .groupBy(entries.date, entries.kind, entries.status),
      db.query.entries.findMany({
        where: eq(entries.userId, userId),
        with: { category: true },
        orderBy: [desc(entries.createdAt)],
        limit: 8,
      }),
      db.query.entries.findMany({
        where: and(eq(entries.userId, userId), eq(entries.date, today)),
        with: { category: true },
        orderBy: [desc(entries.createdAt)],
      }),
      db.query.entries.findMany({
        where: and(
          eq(entries.userId, userId),
          sql`${entries.status} <> 'settled'`,
          gte(entries.date, today),
          lte(entries.date, horizon),
        ),
        with: { category: true },
        orderBy: [asc(entries.date), desc(entries.amount)],
        limit: 8,
      }),
    ]);

  const pick = (kind: Kind, status: Status) =>
    Number(allRows.find((r) => r.kind === kind && r.status === status)?.total ?? 0);

  const balance = pick("debit", "settled") - pick("credit", "settled");
  const pendingIn = pick("debit", "pending");
  const potentialIn = pick("debit", "planned");
  const dueOut = pick("credit", "pending");
  const plannedOut = pick("credit", "planned");

  const periodPick = (kind: Kind, status: Status) =>
    periodRows
      .filter((r) => r.kind === kind && r.status === status)
      .reduce((a, r) => a + Number(r.total), 0);

  const buckets = {} as Dashboard["buckets"];
  for (const b of ["wallet", "pending", "potential", "fixed", "optional", "daily"] as Bucket[]) {
    const rows = periodRows.filter((r) => r.bucket === b);
    buckets[b] = {
      total: rows.reduce((a, r) => a + Number(r.total), 0),
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

  const catMap = new Map<string, Dashboard["spendByCategory"][number]>();
  for (const row of catRows) {
    const key = row.category?.id ?? "uncategorized";
    const cur = catMap.get(key) ?? {
      id: key,
      name: row.category?.name ?? "Uncategorized",
      color: row.category?.color ?? "stone",
      icon: row.category?.icon ?? "circle-dot",
      total: 0,
      pct: 0,
    };
    cur.total += Number(row.amount);
    catMap.set(key, cur);
  }
  const spendByCategory = [...catMap.values()]
    .sort((a, b) => b.total - a.total)
    .map((c) => ({ ...c, pct: spent ? Math.round((c.total / spent) * 100) : 0 }));

  const dayTotals: DayTotals = {};
  for (const r of dayRows) {
    const d = (dayTotals[r.date] ??= { in: 0, out: 0, due: 0, count: 0 });
    d.count += Number(r.n);
    if (r.status === "settled") {
      if (r.kind === "debit") d.in += Number(r.total);
      else d.out += Number(r.total);
    } else if (r.kind === "credit" && r.status === "pending") {
      d.due += Number(r.total);
    }
  }

  return {
    today,
    balance,
    projected: balance + pendingIn - dueOut,
    pendingIn,
    potentialIn,
    dueOut,
    plannedOut,
    period: {
      received,
      spent,
      due: periodPick("credit", "pending"),
      planned: periodPick("credit", "planned"),
      net: received - spent,
    },
    buckets,
    series,
    spendByCategory,
    recent,
    todayEntries,
    upcoming,
    dayTotals,
  };
}
