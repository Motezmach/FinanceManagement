import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, recurringRules, type Category, type Entry } from "@/lib/db/schema";
import { periodRange } from "@/lib/dates";
import { renewsOn, periodOf } from "@/lib/fixed/cycle";
import {
  allocateFunding,
  buildObligations,
  computePosition,
  isoDay,
  nextAutoPayment,
  pickForSavings,
  savingsProgress,
  type CategoryLook,
  type Obligation,
  type ObligationSource,
  type Position,
} from "@/lib/fixed/position";
import { fromCents, sumMoney, toCents } from "@/lib/utils";
import type { EntryWithCategory } from "./entries";

const totalExpr = sql<number>`coalesce(sum(${entries.amount}), 0)::float8`;

export async function getPosition(userId: string): Promise<Position> {
  const rows = await db
    .select({ kind: entries.kind, status: entries.status, total: totalExpr })
    .from(entries)
    .where(eq(entries.userId, userId))
    .groupBy(entries.kind, entries.status);
  return computePosition(rows);
}

export async function listObligationSources(userId: string): Promise<ObligationSource[]> {
  return db.query.entries.findMany({
    where: and(
      eq(entries.userId, userId),
      eq(entries.kind, "credit"),
      inArray(entries.status, ["pending", "saved", "planned"]),
    ),
    columns: {
      id: true,
      title: true,
      amount: true,
      date: true,
      status: true,
      bucket: true,
      ruleId: true,
      period: true,
      autoPayHold: true,
    },
    with: {
      category: { columns: { name: true, icon: true, color: true } },
      rule: { columns: { dayOfMonth: true, autoPay: true, isActive: true } },
    },
  });
}

export async function listObligations(userId: string, today: string): Promise<Obligation[]> {
  return buildObligations(await listObligationSources(userId), today);
}

export type AutoPaidItem = {
  id: string;
  title: string;
  amount: number;
  /** "YYYY-MM-DD" */
  settledAt: string;
  category: CategoryLook | null;
  fromSavings: boolean;
};

/** Auto-payments the user has not acknowledged yet, for the banner. */
export async function listAutoPaidUnseen(userId: string): Promise<{ items: AutoPaidItem[]; total: number }> {
  const rows = await db.query.entries.findMany({
    where: and(
      eq(entries.userId, userId),
      eq(entries.status, "settled"),
      eq(entries.autoPaid, true),
      eq(entries.autoPaidSeen, false),
    ),
    columns: { id: true, title: true, amount: true, date: true, settledAt: true, savedAt: true },
    with: { category: { columns: { name: true, icon: true, color: true } } },
    orderBy: [desc(entries.settledAt)],
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      amount: row.amount,
      settledAt: row.settledAt ? isoDay(row.settledAt) : row.date,
      category: row.category,
      fromSavings: row.savedAt !== null,
    })),
    total: sumMoney(rows.map((row) => row.amount)),
  };
}

export type SavingsRow = {
  entry: Entry;
  category: Category | null;
  renewsOn: string;
  /** "YYYY-MM-DD" */
  savedAt: string | null;
  /** From 0 on the day it went in savings to 1 on renewal. 0 when `savedAt` is null. */
  progress: number;
  willAutoPay: boolean;
  /** The balance, poured in renewal order, fully covers this bill. */
  funded: boolean;
};

export type Savings = Position & {
  inSavings: SavingsRow[];
  /** Exactly what "Move all to savings" moves. */
  notInSavings: Obligation[];
  nextAutoPay: { date: string; amount: number; count: number } | null;
  /** Money amounts for "X of Y in savings". Unfunded bills count in `total` only. */
  ring: { inSavings: number; total: number };
  fixedMonthlyTotal: number;
  /** Fixed bills as a whole percent of this month's income. Null without income. */
  incomeShare: number | null;
  history: EntryWithCategory[];
  autoPaidUnseen: AutoPaidItem[];
  autoPaidTotal: number;
};

export async function getSavings(userId: string, today: string): Promise<Savings> {
  const { start, end } = periodRange(periodOf(today));

  const [position, savedRows, obligations, fixedRows, incomeRows, history, autoPaid] = await Promise.all([
    getPosition(userId),
    db.query.entries.findMany({
      where: and(eq(entries.userId, userId), eq(entries.kind, "credit"), eq(entries.status, "saved")),
      with: { category: true, rule: { columns: { dayOfMonth: true } } },
    }),
    listObligations(userId, today),
    db
      .select({ total: sql<number>`coalesce(sum(${recurringRules.amount}), 0)::float8` })
      .from(recurringRules)
      .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true))),
    db
      .select({ total: totalExpr })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.kind, "debit"),
          eq(entries.status, "settled"),
          gte(entries.date, start),
          lte(entries.date, end),
        ),
      ),
    db.query.entries.findMany({
      where: and(
        eq(entries.userId, userId),
        eq(entries.kind, "credit"),
        eq(entries.bucket, "fixed"),
        eq(entries.status, "settled"),
        or(isNotNull(entries.savedAt), eq(entries.autoPaid, true)),
      ),
      with: { category: true },
      orderBy: [desc(sql`coalesce(${entries.settledAt}, ${entries.createdAt})`)],
      limit: 24,
    }),
    listAutoPaidUnseen(userId),
  ]);

  const saved = savedRows.flatMap(({ category, rule, ...entry }) => {
    if (!rule) return [];
    return [{ entry, category, renewsOn: renewsOn(entry.period ?? periodOf(entry.date), rule.dayOfMonth) }];
  });
  const funded = allocateFunding(
    position.balance,
    saved.map(({ entry, renewsOn: renewal }) => ({ id: entry.id, amount: entry.amount, renewsOn: renewal })),
  );

  const inSavings: SavingsRow[] = saved
    .sort((a, b) => a.renewsOn.localeCompare(b.renewsOn))
    .map(({ entry, category, renewsOn: renewal }) => {
      const savedOn = entry.savedAt ? isoDay(entry.savedAt) : null;
      return {
        entry,
        category,
        renewsOn: renewal,
        savedAt: savedOn,
        progress: savingsProgress(savedOn, renewal, today),
        willAutoPay: !entry.autoPayHold,
        funded: funded.has(entry.id),
      };
    });

  const notInSavings = pickForSavings(obligations);
  const fundedCents = inSavings.reduce((total, row) => total + (row.funded ? toCents(row.entry.amount) : 0), 0);

  const fixedMonthlyTotal = Number(fixedRows[0]?.total ?? 0);
  const income = Number(incomeRows[0]?.total ?? 0);

  return {
    ...position,
    inSavings,
    notInSavings,
    nextAutoPay: nextAutoPayment(obligations),
    ring: {
      inSavings: fromCents(fundedCents),
      total: sumMoney([...inSavings.map((row) => row.entry.amount), ...notInSavings.map((item) => item.amount)]),
    },
    fixedMonthlyTotal,
    incomeShare: income > 0 ? Math.round((fixedMonthlyTotal / income) * 100) : null,
    history,
    autoPaidUnseen: autoPaid.items,
    autoPaidTotal: autoPaid.total,
  };
}
