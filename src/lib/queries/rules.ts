import "server-only";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, recurringRules, ruleSkips } from "@/lib/db/schema";
import { periodRange } from "@/lib/dates";
import { buildFixedBoard, scheduledBills, type FixedBoard, type ScheduledBill } from "@/lib/fixed/board";
import { periodOf } from "@/lib/fixed/cycle";
import { listCategories } from "./categories";
import { listEntries } from "./entries";
import { getPosition, listAutoPaidUnseen, type AutoPaidItem } from "./savings";

export type { AdoptedRule, FixedRow, FixedRowState, FixedTotals, ScheduledBill } from "@/lib/fixed/board";

export type FixedBoardData = FixedBoard & { autoPaidUnseen: AutoPaidItem[]; autoPaidTotal: number };

export async function listFixedBoard(userId: string, period: string, today: string): Promise<FixedBoardData> {
  const { start, end } = periodRange(period);
  const [rules, records, skips, categories, position, history, autoPaid] = await Promise.all([
    db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.userId, userId))
      .orderBy(asc(recurringRules.dayOfMonth), asc(recurringRules.createdAt)),
    db
      .select()
      .from(entries)
      .where(and(eq(entries.userId, userId), isNotNull(entries.ruleId))),
    db.select({ ruleId: ruleSkips.ruleId, period: ruleSkips.period }).from(ruleSkips).where(eq(ruleSkips.userId, userId)),
    listCategories(userId, { includeArchived: true }),
    getPosition(userId),
    listEntries(userId, { kind: "credit", bucket: "fixed", from: start, to: end, nonRule: true }),
    listAutoPaidUnseen(userId),
  ]);

  return {
    ...buildFixedBoard({ rules, records, skips, categories, position }, history, period, today),
    autoPaidUnseen: autoPaid.items,
    autoPaidTotal: autoPaid.total,
  };
}

/** Projected bills of a future month, which are never materialized by browsing. Empty for any other month. */
export async function listScheduled(userId: string, period: string, today: string): Promise<ScheduledBill[]> {
  if (period <= periodOf(today)) return [];
  const board = await listFixedBoard(userId, period, today);
  return scheduledBills(board.rows);
}
