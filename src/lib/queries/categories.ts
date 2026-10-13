import "server-only";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, entries, type Category } from "@/lib/db/schema";
import type { Bucket, Kind, Status } from "@/lib/config/buckets";
import { lastPeriods, periodRange } from "@/lib/dates";
import type { EntryWithCategory } from "./entries";

export async function listCategories(
  userId: string,
  opts: { includeArchived?: boolean; kind?: Kind } = {},
): Promise<Category[]> {
  const conds = [eq(categories.userId, userId)];
  if (!opts.includeArchived) conds.push(eq(categories.isArchived, false));
  if (opts.kind) conds.push(eq(categories.kind, opts.kind));
  return db
    .select()
    .from(categories)
    .where(and(...conds))
    .orderBy(asc(categories.kind), asc(categories.sortOrder), asc(categories.name));
}

export type CategoryStat = {
  category: Category;
  periodTotal: number; // settled in the selected month
  periodCount: number;
  openTotal: number; // pending + planned, any month
  allTimeTotal: number; // settled, any month
  allTimeCount: number;
  trend: { period: string; total: number }[]; // last 6 months, settled
};

const periodExpr = sql<string>`to_char(${entries.date}, 'YYYY-MM')`;
const totalExpr = sql<number>`coalesce(sum(${entries.amount}), 0)::float8`;

export async function categoryStats(userId: string, period: string): Promise<CategoryStat[]> {
  const cats = await listCategories(userId, { includeArchived: true });
  const { start, end } = periodRange(period);
  const trendPeriods = lastPeriods(period, 6);
  const trendStart = periodRange(trendPeriods[0]).start;

  const [periodRows, openRows, allRows, trendRows] = await Promise.all([
    db
      .select({ categoryId: entries.categoryId, total: totalExpr, n: count() })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.status, "settled"),
          gte(entries.date, start),
          lte(entries.date, end),
        ),
      )
      .groupBy(entries.categoryId),
    db
      .select({ categoryId: entries.categoryId, total: totalExpr })
      .from(entries)
      .where(and(eq(entries.userId, userId), sql`${entries.status} <> 'settled'`))
      .groupBy(entries.categoryId),
    db
      .select({ categoryId: entries.categoryId, total: totalExpr, n: count() })
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.status, "settled")))
      .groupBy(entries.categoryId),
    db
      .select({ categoryId: entries.categoryId, period: periodExpr, total: totalExpr })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.status, "settled"),
          gte(entries.date, trendStart),
          lte(entries.date, end),
        ),
      )
      .groupBy(entries.categoryId, periodExpr),
  ]);

  const byId = <T extends { categoryId: string | null }>(rows: T[]) =>
    new Map(rows.filter((r) => r.categoryId).map((r) => [r.categoryId as string, r]));
  const p = byId(periodRows);
  const o = byId(openRows);
  const a = byId(allRows);
  const trend = new Map<string, Map<string, number>>();
  for (const r of trendRows) {
    if (!r.categoryId) continue;
    if (!trend.has(r.categoryId)) trend.set(r.categoryId, new Map());
    trend.get(r.categoryId)!.set(r.period, Number(r.total));
  }

  return cats.map((category) => ({
    category,
    periodTotal: Number(p.get(category.id)?.total ?? 0),
    periodCount: Number(p.get(category.id)?.n ?? 0),
    openTotal: Number(o.get(category.id)?.total ?? 0),
    allTimeTotal: Number(a.get(category.id)?.total ?? 0),
    allTimeCount: Number(a.get(category.id)?.n ?? 0),
    trend: trendPeriods.map((tp) => ({ period: tp, total: trend.get(category.id)?.get(tp) ?? 0 })),
  }));
}

export type CategoryDetail = {
  category: Category;
  monthly: { period: string; settled: number; pending: number; planned: number; count: number }[];
  byStatus: Record<Status, { total: number; count: number }>;
  byBucket: Partial<Record<Bucket, { total: number; count: number }>>;
  periodTotal: number;
  avgMonthly: number; // over the last 6 months with activity
  largest: EntryWithCategory | null;
  entries: EntryWithCategory[];
};

export async function getCategoryDetail(
  userId: string,
  id: string,
  period: string,
): Promise<CategoryDetail | null> {
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!category) return null;

  const periods = lastPeriods(period, 12);
  const start = periodRange(periods[0]).start;
  const { end } = periodRange(period);
  const base = and(eq(entries.userId, userId), eq(entries.categoryId, id));

  const [monthRows, statusRows, bucketRows, list] = await Promise.all([
    db
      .select({ period: periodExpr, status: entries.status, total: totalExpr, n: count() })
      .from(entries)
      .where(and(base, gte(entries.date, start), lte(entries.date, end)))
      .groupBy(periodExpr, entries.status),
    db
      .select({ status: entries.status, total: totalExpr, n: count() })
      .from(entries)
      .where(base)
      .groupBy(entries.status),
    db
      .select({ bucket: entries.bucket, total: totalExpr, n: count() })
      .from(entries)
      .where(base)
      .groupBy(entries.bucket),
    db.query.entries.findMany({
      where: base,
      with: { category: true },
      orderBy: [desc(entries.date), desc(entries.createdAt)],
      limit: 100,
    }),
  ]);

  const monthly = periods.map((p) => {
    const rows = monthRows.filter((r) => r.period === p);
    const pick = (s: Status) => Number(rows.find((r) => r.status === s)?.total ?? 0);
    return {
      period: p,
      settled: pick("settled"),
      pending: pick("pending"),
      planned: pick("planned"),
      count: rows.reduce((acc, r) => acc + Number(r.n), 0),
    };
  });

  const byStatus = { settled: { total: 0, count: 0 }, pending: { total: 0, count: 0 }, planned: { total: 0, count: 0 } };
  for (const r of statusRows) byStatus[r.status] = { total: Number(r.total), count: Number(r.n) };

  const byBucket: CategoryDetail["byBucket"] = {};
  for (const r of bucketRows) byBucket[r.bucket] = { total: Number(r.total), count: Number(r.n) };

  const last6 = monthly.slice(-6).filter((m) => m.settled > 0);
  const avgMonthly = last6.length ? last6.reduce((a, m) => a + m.settled, 0) / last6.length : 0;

  const settledList = list.filter((e) => e.status === "settled");
  const largest = settledList.length
    ? settledList.reduce((a, b) => (b.amount > a.amount ? b : a))
    : null;

  return {
    category,
    monthly,
    byStatus,
    byBucket,
    periodTotal: monthly[monthly.length - 1]?.settled ?? 0,
    avgMonthly,
    largest,
    entries: list,
  };
}
