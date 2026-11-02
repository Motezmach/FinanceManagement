import "server-only";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, entries, recurringRules } from "@/lib/db/schema";
import { periodRange } from "@/lib/dates";
import { nextPeriod, occurrence, periodOf } from "@/lib/fixed/cycle";
import { subtractMoney } from "@/lib/utils";
import { getPosition } from "./savings";

export type CalculatorOverviewKey =
  | "balance"
  | "freeToSpend"
  | "billsSaved"
  | "due"
  | "planned"
  | "pendingIn"
  | "potentialIn"
  | "receivedMonth"
  | "spentMonth"
  | "netMonth";

export type CalculatorItem = {
  id: string;
  /** Overview items only: the client builds the label, so custom kind and bucket names apply. */
  labelKey?: CalculatorOverviewKey;
  label?: string;
  /** Always positive, except `netMonth`, which keeps its sign. */
  amount: number;
  /**
   * fixed: the bill's next date, "YYYY-MM-DD". recent: the entry's date, "YYYY-MM-DD".
   * categories: the side, "debit" or "credit".
   */
  hint?: string;
};

export type CalculatorGroup = {
  key: "overview" | "fixed" | "categories" | "recent";
  items: CalculatorItem[];
};

export type CalculatorData = { groups: CalculatorGroup[] };

const MAX_CATEGORIES = 12;
const MAX_RECENT = 10;

const totalExpr = sql<number>`coalesce(sum(${entries.amount}), 0)::float8`;

/** Amounts the calculator can pick. Explicit columns only: no notes and no category ids leave the server. */
export async function getCalculatorData(userId: string, today: string): Promise<CalculatorData> {
  const todayP = periodOf(today);
  const { start, end } = periodRange(todayP);
  const inThisMonth = and(
    eq(entries.userId, userId),
    eq(entries.status, "settled"),
    gte(entries.date, start),
    lte(entries.date, end),
  );

  const [position, monthRows, rules, categoryRows, recent] = await Promise.all([
    getPosition(userId),
    db.select({ kind: entries.kind, total: totalExpr }).from(entries).where(inThisMonth).groupBy(entries.kind),
    db
      .select({
        id: recurringRules.id,
        title: recurringRules.title,
        amount: recurringRules.amount,
        dayOfMonth: recurringRules.dayOfMonth,
        startsOn: recurringRules.startsOn,
      })
      .from(recurringRules)
      .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)))
      .orderBy(asc(recurringRules.dayOfMonth), asc(recurringRules.createdAt)),
    db
      .select({ name: categories.name, kind: entries.kind, total: totalExpr })
      .from(entries)
      .innerJoin(categories, eq(categories.id, entries.categoryId))
      .where(inThisMonth)
      .groupBy(categories.id, categories.name, entries.kind)
      .orderBy(desc(totalExpr))
      .limit(MAX_CATEGORIES),
    db
      .select({ id: entries.id, title: entries.title, amount: entries.amount, date: entries.date })
      .from(entries)
      .where(eq(entries.userId, userId))
      .orderBy(desc(sql`coalesce(${entries.settledAt}, ${entries.createdAt})`))
      .limit(MAX_RECENT),
  ]);

  const monthTotal = (kind: "debit" | "credit") => Number(monthRows.find((row) => row.kind === kind)?.total ?? 0);
  const received = monthTotal("debit");
  const spent = monthTotal("credit");

  const overview: [CalculatorOverviewKey, number][] = [
    ["balance", position.balance],
    ["freeToSpend", position.freeToSpend],
    ["billsSaved", position.billsSaved],
    ["due", position.dueOut],
    ["planned", position.plannedOut],
    ["pendingIn", position.pendingIn],
    ["potentialIn", position.potentialIn],
    ["receivedMonth", received],
    ["spentMonth", spent],
    ["netMonth", subtractMoney(received, spent)],
  ];

  return {
    groups: [
      {
        key: "overview",
        items: overview.map(([key, amount]) => ({ id: key, labelKey: key, amount })),
      },
      {
        key: "fixed",
        items: rules.map((rule) => {
          const thisMonth = occurrence(todayP, rule.dayOfMonth);
          const next = thisMonth >= today ? thisMonth : occurrence(nextPeriod(todayP), rule.dayOfMonth);
          const first = occurrence(periodOf(rule.startsOn), rule.dayOfMonth);
          return {
            id: `rule:${rule.id}`,
            label: rule.title,
            amount: rule.amount,
            hint: first > next ? first : next,
          };
        }),
      },
      {
        key: "categories",
        items: categoryRows.map((row, index) => ({
          id: `category:${index}`,
          label: row.name,
          amount: Number(row.total),
          hint: row.kind,
        })),
      },
      {
        key: "recent",
        items: recent.map((row) => ({ id: `entry:${row.id}`, label: row.title, amount: row.amount, hint: row.date })),
      },
    ],
  };
}
