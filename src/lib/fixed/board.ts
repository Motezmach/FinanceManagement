import type { Category, Entry, RecurringRule } from "../db/schema";
import type { EntryWithCategory } from "../queries/entries";
import { fromCents, toCents } from "../utils";
import {
  billPhase,
  isOpen,
  nextPeriod,
  occurrence,
  periodOf,
  renewsOn,
  willAutoPay,
  type BillPhase,
} from "./cycle";
import { allocateFunding, isoDay, pickForSavings, savingsShortBy, type CategoryLook, type Position } from "./position";

export type FixedRowState = "due" | "saved" | "paid" | "autopaid" | "skipped" | "paused" | "scheduled";

export type FixedRow = {
  key: string;
  rule: RecurringRule;
  category: Category | null;
  /** The record this row shows. Read the amount and title from it first: it can differ from the rule. */
  instance: Entry | null;
  /** Can differ from the viewed month: in the first days of a cycle the row shows last month's bill. */
  instancePeriod: string | null;
  state: FixedRowState;
  phase: BillPhase | null;
  dueDate: string | null;
  renewsOn: string | null;
  /** When the next bill arrives. Only set on the current month. */
  nextDate: string | null;
  willAutoPay: boolean;
  canAct: boolean;
  canSave: boolean;
  canSkip: boolean;
  canManageRule: boolean;
  /** False on an In savings row the balance cannot fully cover: "Not fully in savings". */
  funded: boolean;
  /** An auto-payment of this rule the user has not seen, for "October paid automatically on Nov 5, Undo". */
  unseenAutoPaid: { entryId: string; period: string; settledOn: string } | null;
};

export type FixedTotals = {
  /** paid + saved + due, plus Scheduled bills when viewing a future month. */
  total: number;
  paid: number;
  saved: number;
  due: number;
  count: number;
  paidCount: number;
  savedCount: number;
  dueCount: number;
};

export type AdoptedRule = { ruleId: string; title: string; amount: number; dayOfMonth: number };

export type ScheduledBill = {
  ruleId: string;
  title: string;
  amount: number;
  date: string;
  category: CategoryLook | null;
};

export type FixedBoard = {
  rows: FixedRow[];
  late: FixedRow[];
  history: EntryWithCategory[];
  isCurrent: boolean;
  totals: FixedTotals;
  adopted: AdoptedRule[];
  /** What "Move all to savings" would move, and how far that would exceed the balance. Empty off the current month. */
  moveAll: { count: number; total: number; shortBy: number };
  position: Position;
};

export type FixedState = {
  rules: RecurringRule[];
  records: Entry[];
  skips: { ruleId: string; period: string }[];
  categories: Category[];
  position: Position;
};

type View = "past" | "current" | "future";

type Context = {
  period: string;
  today: string;
  view: View;
  categories: Map<string, Category>;
  funded: Set<string>;
};

type RuleData = {
  rule: RecurringRule;
  records: Entry[];
  skipped: Set<string>;
  hasSaved: boolean;
  unseenAutoPaid: FixedRow["unseenAutoPaid"];
};

const recordPeriod = (record: Entry) => record.period ?? periodOf(record.date);

function categoryOf(categoryId: string | null, context: Context) {
  return categoryId ? (context.categories.get(categoryId) ?? null) : null;
}

function recordState(record: Entry): FixedRowState {
  if (record.status === "settled") return record.autoPaid ? "autopaid" : "paid";
  return record.status === "saved" ? "saved" : "due";
}

/** The first date after `afterPeriod` that a new bill of this rule can land on. */
function nextBillDate(rule: RecurringRule, afterPeriod: string, today: string) {
  if (!rule.isActive) return null;
  const todayP = periodOf(today);
  let period = nextPeriod(afterPeriod);
  if (period < todayP) period = todayP;
  if (occurrence(period, rule.dayOfMonth) < today) period = nextPeriod(period);
  if (rule.endsOn && period > periodOf(rule.endsOn)) return null;
  return occurrence(period, rule.dayOfMonth);
}

function recordRow(data: RuleData, record: Entry, context: Context): FixedRow {
  const { rule } = data;
  const period = recordPeriod(record);
  const open = isOpen(record.status);
  const phase = open ? billPhase(period, rule.dayOfMonth, context.today) : null;
  return {
    key: record.id,
    rule,
    category: categoryOf(record.categoryId, context),
    instance: record,
    instancePeriod: period,
    state: recordState(record),
    phase,
    dueDate: record.date,
    renewsOn: open ? renewsOn(period, rule.dayOfMonth) : null,
    nextDate: context.view === "current" ? nextBillDate(rule, period, context.today) : null,
    willAutoPay: open && willAutoPay(record.status, rule.autoPay && rule.isActive, record.autoPayHold),
    canAct: open,
    canSave: record.status === "pending" && phase !== "late" && !data.hasSaved,
    canSkip: open,
    canManageRule: context.view === "current",
    funded: record.status !== "saved" || context.funded.has(record.id),
    unseenAutoPaid: open ? data.unseenAutoPaid : null,
  };
}

function emptyRow(
  rule: RecurringRule,
  state: "skipped" | "paused" | "scheduled",
  context: Context,
  fields: Partial<FixedRow>,
): FixedRow {
  return {
    key: `${rule.id}:${state}:${context.period}`,
    rule,
    category: categoryOf(rule.categoryId, context),
    instance: null,
    instancePeriod: null,
    state,
    phase: null,
    dueDate: null,
    renewsOn: null,
    nextDate: null,
    willAutoPay: false,
    canAct: false,
    canSave: false,
    canSkip: false,
    canManageRule: context.view === "current",
    funded: true,
    unseenAutoPaid: null,
    ...fields,
  };
}

function skippedRow(rule: RecurringRule, context: Context) {
  return emptyRow(rule, "skipped", context, {
    instancePeriod: context.period,
    dueDate: occurrence(context.period, rule.dayOfMonth),
  });
}

function currentMonthRows(data: RuleData, context: Context, rows: FixedRow[], late: FixedRow[]) {
  const { rule, records } = data;
  const { today, period } = context;
  const isLate = (record: Entry) => renewsOn(recordPeriod(record), rule.dayOfMonth) <= today;

  const open = records.filter((record) => isOpen(record.status));
  const lateRecords = open.filter(isLate);
  const running = open.filter((record) => !isLate(record));
  late.push(...lateRecords.map((record) => recordRow(data, record, context)));

  const thisMonth = records.find((record) => recordPeriod(record) === period);
  const closed = thisMonth?.status === "settled" ? thisMonth : null;

  if (!rule.isActive && running.length === 0) {
    rows.push(
      emptyRow(rule, "paused", context, {
        instance: closed,
        instancePeriod: closed ? period : null,
        dueDate: closed?.date ?? null,
      }),
    );
    return;
  }

  const main = running.map((record) => recordRow(data, record, context));
  if (closed) main.push(recordRow(data, closed, context));
  if (!thisMonth && data.skipped.has(period)) main.push(skippedRow(rule, context));
  if (main.length > 0) {
    rows.push(...main);
    return;
  }

  if (rule.startsOn > today) {
    const firstDate = occurrence(periodOf(rule.startsOn), rule.dayOfMonth);
    rows.push(emptyRow(rule, "scheduled", context, { dueDate: firstDate, nextDate: firstDate }));
    return;
  }

  const latestClosed = records
    .filter((record) => record.status === "settled")
    .reduce<Entry | null>((best, record) => (!best || recordPeriod(record) > recordPeriod(best) ? record : best), null);
  if (latestClosed) {
    rows.push(recordRow(data, latestClosed, context));
    return;
  }

  // Nothing placed yet, which only a failed sync leaves behind: still show the bill exists.
  const ended = rule.endsOn !== null && periodOf(rule.endsOn) < period;
  if (lateRecords.length === 0 && !ended) {
    const thisOccurrence = occurrence(period, rule.dayOfMonth);
    const nextDate = thisOccurrence >= today ? thisOccurrence : nextBillDate(rule, period, today);
    rows.push(emptyRow(rule, "scheduled", context, { dueDate: nextDate, nextDate }));
  }
}

function otherMonthRows(data: RuleData, context: Context, rows: FixedRow[]) {
  const { rule, records, skipped } = data;
  const { period, view } = context;

  const record = records.find((item) => recordPeriod(item) === period);
  if (record) {
    rows.push(recordRow(data, record, context));
    return;
  }
  if (skipped.has(period)) {
    rows.push(skippedRow(rule, context));
    return;
  }
  const started = period >= periodOf(rule.startsOn);
  const notEnded = rule.endsOn === null || period <= periodOf(rule.endsOn);
  if (view === "future" && rule.isActive && started && notEnded) {
    rows.push(emptyRow(rule, "scheduled", context, { dueDate: occurrence(period, rule.dayOfMonth) }));
  }
}

function computeTotals(rows: FixedRow[], history: EntryWithCategory[], context: Context): FixedTotals {
  const cents = { paid: 0, saved: 0, due: 0, scheduled: 0 };
  const counts = { paid: 0, saved: 0, due: 0, scheduled: 0 };
  const add = (bucket: keyof typeof cents, amount: number) => {
    cents[bucket] += toCents(amount);
    counts[bucket] += 1;
  };

  for (const row of rows) {
    const { instance } = row;
    if (!instance) {
      if (row.state === "scheduled" && context.view === "future") add("scheduled", row.rule.amount);
      continue;
    }
    // An open bill counts wherever it started: it is still owed. A paid one only counts in its own month.
    if (instance.status === "pending") add("due", instance.amount);
    else if (instance.status === "saved") add("saved", instance.amount);
    else if (instance.status === "settled" && row.instancePeriod === context.period) add("paid", instance.amount);
  }
  for (const entry of history) {
    if (entry.status === "settled") add("paid", entry.amount);
    else if (entry.status === "pending") add("due", entry.amount);
  }

  return {
    total: fromCents(cents.paid + cents.saved + cents.due + cents.scheduled),
    paid: fromCents(cents.paid),
    saved: fromCents(cents.saved),
    due: fromCents(cents.due),
    count: counts.paid + counts.saved + counts.due + counts.scheduled,
    paidCount: counts.paid,
    savedCount: counts.saved,
    dueCount: counts.due,
  };
}

function latestUnseenAutoPaid(records: Entry[]): FixedRow["unseenAutoPaid"] {
  let latest: Entry | null = null;
  for (const record of records) {
    if (record.status !== "settled" || !record.autoPaid || record.autoPaidSeen) continue;
    if (!latest || recordPeriod(record) > recordPeriod(latest)) latest = record;
  }
  if (!latest) return null;
  return {
    entryId: latest.id,
    period: recordPeriod(latest),
    settledOn: latest.settledAt ? isoDay(latest.settledAt) : latest.date,
  };
}

/** The Fixed monthly tab for one month: which row each rule shows, and what can be done on it. */
export function buildFixedBoard(
  state: FixedState,
  history: EntryWithCategory[],
  period: string,
  today: string,
): FixedBoard {
  const todayP = periodOf(today);
  const view: View = period === todayP ? "current" : period < todayP ? "past" : "future";
  const dayByRule = new Map(state.rules.map((rule) => [rule.id, rule.dayOfMonth]));

  const saved = state.records.flatMap((record) => {
    const day = record.ruleId ? dayByRule.get(record.ruleId) : undefined;
    if (record.status !== "saved" || day === undefined) return [];
    return [{ id: record.id, amount: record.amount, renewsOn: renewsOn(recordPeriod(record), day) }];
  });

  const context: Context = {
    period,
    today,
    view,
    categories: new Map(state.categories.map((category) => [category.id, category])),
    funded: allocateFunding(state.position.balance, saved),
  };

  const rows: FixedRow[] = [];
  const late: FixedRow[] = [];
  for (const rule of state.rules) {
    const records = state.records
      .filter((record) => record.ruleId === rule.id)
      .sort((a, b) => recordPeriod(a).localeCompare(recordPeriod(b)));
    const data: RuleData = {
      rule,
      records,
      skipped: new Set(state.skips.filter((skip) => skip.ruleId === rule.id).map((skip) => skip.period)),
      hasSaved: records.some((record) => record.status === "saved"),
      unseenAutoPaid: latestUnseenAutoPaid(records),
    };
    if (view === "current") currentMonthRows(data, context, rows, late);
    else otherMonthRows(data, context, rows);
  }
  late.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const picks =
    view === "current"
      ? pickForSavings(
          rows.map((row) => ({
            ruleId: row.rule.id,
            period: row.instancePeriod,
            canSave: row.canSave,
            amount: row.instance?.amount ?? 0,
          })),
        )
      : [];
  const moveTotal = fromCents(picks.reduce((total, pick) => total + toCents(pick.amount), 0));

  return {
    rows,
    late,
    history,
    isCurrent: view === "current",
    totals: computeTotals([...rows, ...late], history, context),
    adopted: state.rules
      .filter((rule) => rule.source === "adoption")
      .map((rule) => ({ ruleId: rule.id, title: rule.title, amount: rule.amount, dayOfMonth: rule.dayOfMonth })),
    moveAll: {
      count: picks.length,
      total: moveTotal,
      shortBy: picks.length > 0 ? savingsShortBy(state.position, moveTotal) : 0,
    },
    position: state.position,
  };
}

/** The projected bills of a future month, for read-only lists. */
export function scheduledBills(rows: FixedRow[]): ScheduledBill[] {
  return rows.flatMap((row) => {
    if (row.state !== "scheduled" || row.dueDate === null) return [];
    const { category } = row;
    return [
      {
        ruleId: row.rule.id,
        title: row.rule.title,
        amount: row.rule.amount,
        date: row.dueDate,
        category: category && { name: category.name, icon: category.icon, color: category.color },
      },
    ];
  });
}
