import "server-only";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { getDaysInMonth } from "date-fns";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import type { Bucket, Kind, Status } from "@/lib/config/buckets";
import { currentPeriod, lastPeriods, periodRange, periodToDate, todayISO } from "@/lib/dates";
import { formatShortMonth } from "@/lib/format";
import type { EntryWithCategory } from "./entries";

const periodExpr = sql<string>`to_char(${entries.date}, 'YYYY-MM')`;
const totalExpr = sql<number>`coalesce(sum(${entries.amount}), 0)::float8`;

export type CategoryBreak = {
  id: string;
  name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
  pct: number;
};

export type Analytics = {
  period: string;
  monthly: {
    period: string;
    label: string;
    in: number;
    out: number;
    net: number;
    pendingIn: number;
    dueOut: number;
  }[];
  daily: { date: string; day: number; in: number; out: number }[];
  buckets: Record<Bucket, { total: number; count: number; settled: number }>;
  pipeline: { wallet: number; pending: number; potential: number; due: number; planned: number };
  categories: Record<Kind, CategoryBreak[]>;
  stats: {
    received: number;
    spent: number;
    net: number;
    savingsRate: number; // 0..1
    avgDailySpend: number;
    avgMonthlySpend: number;
    avgMonthlyIncome: number;
    daysElapsed: number;
    daysInMonth: number;
    entryCount: number;
  };
  largest: EntryWithCategory[];
};

export async function getAnalytics(userId: string, period: string): Promise<Analytics> {
  const { start, end } = periodRange(period);
  const periods = lastPeriods(period, 12);
  const histStart = periodRange(periods[0]).start;
  const today = todayISO();

  const [monthRows, dayRows, bucketRows, pipeRows, catRows, largest] = await Promise.all([
    db
      .select({ period: periodExpr, kind: entries.kind, status: entries.status, total: totalExpr })
      .from(entries)
      .where(and(eq(entries.userId, userId), gte(entries.date, histStart), lte(entries.date, end)))
      .groupBy(periodExpr, entries.kind, entries.status),
    db
      .select({ date: entries.date, kind: entries.kind, total: totalExpr })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.status, "settled"),
          gte(entries.date, start),
          lte(entries.date, end),
        ),
      )
      .groupBy(entries.date, entries.kind),
    db
      .select({ bucket: entries.bucket, status: entries.status, total: totalExpr, n: count() })
      .from(entries)
      .where(and(eq(entries.userId, userId), gte(entries.date, start), lte(entries.date, end)))
      .groupBy(entries.bucket, entries.status),
    db
      .select({ kind: entries.kind, status: entries.status, total: totalExpr })
      .from(entries)
      .where(eq(entries.userId, userId))
      .groupBy(entries.kind, entries.status),
    db.query.entries.findMany({
      where: and(
        eq(entries.userId, userId),
        eq(entries.status, "settled"),
        gte(entries.date, start),
        lte(entries.date, end),
      ),
      with: { category: true },
      columns: { amount: true, kind: true, categoryId: true },
    }),
    db.query.entries.findMany({
      where: and(
        eq(entries.userId, userId),
        eq(entries.kind, "credit"),
        eq(entries.status, "settled"),
        gte(entries.date, start),
        lte(entries.date, end),
      ),
      with: { category: true },
      orderBy: [desc(entries.amount)],
      limit: 5,
    }),
  ]);

  const mp = (p: string, kind: Kind, status: Status) =>
    Number(monthRows.find((r) => r.period === p && r.kind === kind && r.status === status)?.total ?? 0);

  const monthly = periods.map((p) => {
    const inn = mp(p, "debit", "settled");
    const out = mp(p, "credit", "settled");
    return {
      period: p,
      label: formatShortMonth(p),
      in: inn,
      out,
      net: inn - out,
      pendingIn: mp(p, "debit", "pending"),
      dueOut: mp(p, "credit", "pending"),
    };
  });

  const daysInMonth = getDaysInMonth(periodToDate(period));
  const daily = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${period}-${String(i + 1).padStart(2, "0")}`;
    return {
      date,
      day: i + 1,
      in: Number(dayRows.find((r) => r.date === date && r.kind === "debit")?.total ?? 0),
      out: Number(dayRows.find((r) => r.date === date && r.kind === "credit")?.total ?? 0),
    };
  });

  const buckets = {} as Analytics["buckets"];
  for (const b of ["wallet", "pending", "potential", "fixed", "optional", "daily"] as Bucket[]) {
    const rows = bucketRows.filter((r) => r.bucket === b);
    buckets[b] = {
      total: rows.reduce((a, r) => a + Number(r.total), 0),
      count: rows.reduce((a, r) => a + Number(r.n), 0),
      settled: Number(rows.find((r) => r.status === "settled")?.total ?? 0),
    };
  }

  const pp = (kind: Kind, status: Status) =>
    Number(pipeRows.find((r) => r.kind === kind && r.status === status)?.total ?? 0);
  const pipeline = {
    wallet: pp("debit", "settled") - pp("credit", "settled"),
    pending: pp("debit", "pending"),
    potential: pp("debit", "planned"),
    due: pp("credit", "pending"),
    planned: pp("credit", "planned"),
  };

  const breakdown = (kind: Kind): CategoryBreak[] => {
    const map = new Map<string, CategoryBreak>();
    let total = 0;
    for (const r of catRows) {
      if (r.kind !== kind) continue;
      const key = r.category?.id ?? "uncategorized";
      const cur = map.get(key) ?? {
        id: key,
        name: r.category?.name ?? "Uncategorized",
        color: r.category?.color ?? "stone",
        icon: r.category?.icon ?? "circle-dot",
        total: 0,
        count: 0,
        pct: 0,
      };
      cur.total += Number(r.amount);
      cur.count += 1;
      total += Number(r.amount);
      map.set(key, cur);
    }
    return [...map.values()]
      .sort((a, b) => b.total - a.total)
      .map((c) => ({ ...c, pct: total ? Math.round((c.total / total) * 100) : 0 }));
  };

  const cur = monthly[monthly.length - 1];
  const received = cur?.in ?? 0;
  const spent = cur?.out ?? 0;
  const isCurrent = period === currentPeriod();
  const daysElapsed = isCurrent ? Math.max(1, Number(today.slice(8, 10))) : daysInMonth;
  const last6 = monthly.slice(-6);
  const activeSpend = last6.filter((m) => m.out > 0);
  const activeIncome = last6.filter((m) => m.in > 0);

  return {
    period,
    monthly,
    daily,
    buckets,
    pipeline,
    categories: { debit: breakdown("debit"), credit: breakdown("credit") },
    stats: {
      received,
      spent,
      net: received - spent,
      savingsRate: received > 0 ? Math.max(-1, (received - spent) / received) : 0,
      avgDailySpend: spent / daysElapsed,
      avgMonthlySpend: activeSpend.length ? activeSpend.reduce((a, m) => a + m.out, 0) / activeSpend.length : 0,
      avgMonthlyIncome: activeIncome.length ? activeIncome.reduce((a, m) => a + m.in, 0) / activeIncome.length : 0,
      daysElapsed,
      daysInMonth,
      entryCount: catRows.length,
    },
    largest,
  };
}
