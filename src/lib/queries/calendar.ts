import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import { periodRange } from "@/lib/dates";
import type { EntryWithCategory } from "./entries";
import type { DayTotals } from "./dashboard";

export type CalendarData = {
  period: string;
  entries: EntryWithCategory[];
  days: DayTotals;
  totals: { in: number; out: number; due: number };
};

export async function getCalendar(userId: string, period: string): Promise<CalendarData> {
  const { start, end } = periodRange(period);
  const list = await db.query.entries.findMany({
    where: and(eq(entries.userId, userId), gte(entries.date, start), lte(entries.date, end)),
    with: { category: true },
    orderBy: [asc(entries.date), desc(entries.amount)],
  });

  const days: DayTotals = {};
  const totals = { in: 0, out: 0, due: 0 };
  for (const e of list) {
    const d = (days[e.date] ??= { in: 0, out: 0, due: 0, count: 0 });
    d.count += 1;
    if (e.status === "settled") {
      if (e.kind === "debit") {
        d.in += e.amount;
        totals.in += e.amount;
      } else {
        d.out += e.amount;
        totals.out += e.amount;
      }
    } else if (e.kind === "credit" && e.status === "pending") {
      d.due += e.amount;
      totals.due += e.amount;
    }
  }

  return { period, entries: list, days, totals };
}
