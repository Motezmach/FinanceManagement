import "server-only";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, entries, recurringRules, type Category, type Entry, type RecurringRule } from "@/lib/db/schema";
import { periodRange, ruleDateInPeriod } from "@/lib/dates";

/**
 * Makes sure every active rule has its instance for the given month.
 * Idempotent thanks to the (rule_id, period) unique index.
 */
export async function ensureMaterialized(userId: string, period: string) {
  const { start, end } = periodRange(period);
  const rules = await db
    .select()
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, userId),
        eq(recurringRules.isActive, true),
        lte(recurringRules.startsOn, end),
        or(isNull(recurringRules.endsOn), gte(recurringRules.endsOn, start)),
      ),
    );
  if (!rules.length) return;

  await db
    .insert(entries)
    .values(
      rules.map((r) => ({
        userId,
        kind: "credit" as const,
        bucket: "fixed" as const,
        status: "pending" as const,
        amount: r.amount,
        title: r.title,
        note: r.note,
        date: ruleDateInPeriod(period, r.dayOfMonth),
        categoryId: r.categoryId,
        ruleId: r.id,
        period,
      })),
    )
    .onConflictDoNothing({ target: [entries.ruleId, entries.period] });
}

export type RuleWithInstance = RecurringRule & {
  category: Category | null;
  instance: Entry | null;
};

export async function listRules(userId: string, period: string): Promise<RuleWithInstance[]> {
  const rows = await db
    .select({ rule: recurringRules, category: categories })
    .from(recurringRules)
    .leftJoin(categories, eq(categories.id, recurringRules.categoryId))
    .where(eq(recurringRules.userId, userId))
    .orderBy(asc(recurringRules.dayOfMonth), asc(recurringRules.createdAt));

  const instances = await db
    .select()
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.period, period)));
  const byRule = new Map(instances.filter((e) => e.ruleId).map((e) => [e.ruleId as string, e]));

  return rows.map(({ rule, category }) => ({
    ...rule,
    category,
    instance: byRule.get(rule.id) ?? null,
  }));
}
