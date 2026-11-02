import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import { periodRange, todayISO } from "@/lib/dates";
import { sumMoney } from "@/lib/utils";
import { ENTRY_RELATIONS, type EntryWithCategory } from "./entries";
import type { DayTotals } from "./dashboard";
import { listScheduled, type ScheduledBill } from "./rules";

export type CalendarData = {
  period: string;
  entries: EntryWithCategory[];
  days: DayTotals;
  totals: { in: number; out: number; due: number; saved: number };
  /** Projected bills of a future month: muted, read-only, and left out of `days` and `totals`. */
  scheduled: ScheduledBill[];
};

export async function getCalendar(userId: string, period: string): Promise<CalendarData> {
  const { start, end } = periodRange(period);
  const [list, scheduled] = await Promise.all([
    db.query.entries.findMany({
      where: and(eq(entries.userId, userId), gte(entries.date, start), lte(entries.date, end)),
      with: ENTRY_RELATIONS,
      orderBy: [asc(entries.date), desc(entries.amount)],
    }),
    listScheduled(userId, period, todayISO()),
  ]);

  const days: DayTotals = {};
  const totals = { in: 0, out: 0, due: 0, saved: 0 };
  for (const e of list) {
    const d = (days[e.date] ??= { in: 0, out: 0, due: 0, saved: 0, count: 0 });
    d.count += 1;
    if (e.status === "settled") {
      if (e.kind === "debit") {
        d.in = sumMoney([d.in, e.amount]);
        totals.in = sumMoney([totals.in, e.amount]);
      } else {
        d.out = sumMoney([d.out, e.amount]);
        totals.out = sumMoney([totals.out, e.amount]);
      }
    } else if (e.kind === "credit" && e.status === "pending") {
      d.due = sumMoney([d.due, e.amount]);
      totals.due = sumMoney([totals.due, e.amount]);
    } else if (e.kind === "credit" && e.status === "saved") {
      d.saved = sumMoney([d.saved, e.amount]);
      totals.saved = sumMoney([totals.saved, e.amount]);
    }
  }

  return { period, entries: list, days, totals, scheduled };
}
