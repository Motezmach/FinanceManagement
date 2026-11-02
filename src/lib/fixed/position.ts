import type { Bucket, Kind, Status } from "../config/buckets";
import { clamp, fromCents, toCents } from "../utils";
import { billPhase, daysBetween, periodOf, renewsOn, willAutoPay, type BillPhase } from "./cycle";

/**
 * What the user's money means right now, in pure functions. Saved money is still in
 * the balance, so Free to spend subtracts it: it drops when a bill is placed and rises
 * with income, and neither [Savings], [Paid] nor an auto-pay moves it.
 */

export type StatusTotal = { kind: Kind; status: Status; total: number };

export type Position = {
  balance: number;
  billsSaved: number;
  dueOut: number;
  plannedOut: number;
  pendingIn: number;
  potentialIn: number;
  freeToSpend: number;
  shortfall: number;
};

export function computePosition(rows: StatusTotal[]): Position {
  const cents = (kind: Kind, status: Status) =>
    toCents(Number(rows.find((row) => row.kind === kind && row.status === status)?.total ?? 0));

  const balance = cents("debit", "settled") - cents("credit", "settled");
  const billsSaved = cents("credit", "saved");
  const dueOut = cents("credit", "pending");
  const free = balance - billsSaved - dueOut;

  return {
    balance: fromCents(balance),
    billsSaved: fromCents(billsSaved),
    dueOut: fromCents(dueOut),
    plannedOut: fromCents(cents("credit", "planned")),
    pendingIn: fromCents(cents("debit", "pending")),
    potentialIn: fromCents(cents("debit", "planned")),
    freeToSpend: fromCents(free),
    shortfall: fromCents(Math.max(0, -free)),
  };
}

/**
 * Pours the balance into saved bills in renewal order and returns the ids it fully
 * covers. The first bill it cannot cover takes whatever is left, so nothing after it
 * is funded, even a smaller one.
 */
export function allocateFunding(balance: number, records: { id: string; amount: number; renewsOn: string }[]) {
  const ordered = [...records].sort((a, b) => a.renewsOn.localeCompare(b.renewsOn) || a.id.localeCompare(b.id));
  const funded = new Set<string>();
  let left = toCents(balance);
  for (const record of ordered) {
    left -= toCents(record.amount);
    if (left < 0) break;
    funded.add(record.id);
  }
  return funded;
}

/** How much the saved bills exceed the balance by, after `extra` more goes in savings. */
export function savingsShortBy(position: Pick<Position, "balance" | "billsSaved">, extra = 0) {
  return fromCents(Math.max(0, toCents(position.billsSaved) + toCents(extra) - toCents(position.balance)));
}

/** Countdown from the day money went in savings to the day it pays, from 0 to 1. */
export function savingsProgress(savedOn: string | null, renewal: string, today: string) {
  if (savedOn === null) return 0;
  const span = daysBetween(savedOn, renewal);
  return span <= 0 ? 1 : clamp(daysBetween(savedOn, today) / span, 0, 1);
}

/** The UTC calendar day of a timestamp, so a stored midnight never shows as the day before. */
export function isoDay(moment: Date) {
  return moment.toISOString().slice(0, 10);
}

export type CategoryLook = { name: string; icon: string; color: string };

export type ObligationSource = {
  id: string;
  title: string;
  amount: number;
  date: string;
  status: Status;
  bucket: Bucket;
  ruleId: string | null;
  period: string | null;
  autoPayHold: boolean;
  category: CategoryLook | null;
  rule: { dayOfMonth: number; autoPay: boolean; isActive: boolean } | null;
};

export type Obligation = {
  id: string;
  title: string;
  amount: number;
  date: string;
  status: "pending" | "saved" | "planned";
  bucket: Bucket;
  ruleId: string | null;
  period: string | null;
  category: CategoryLook | null;
  renewsOn: string | null;
  phase: BillPhase | null;
  willAutoPay: boolean;
  canSave: boolean;
};

/** Every unpaid money-out record, late first, then by date. */
export function buildObligations(sources: ObligationSource[], today: string): Obligation[] {
  const rulesWithSaved = new Set(sources.filter((source) => source.status === "saved").map((source) => source.ruleId));
  const obligations: Obligation[] = [];

  for (const source of sources) {
    if (source.status === "settled") continue;
    const { rule } = source;
    const period = source.period ?? periodOf(source.date);
    const renewal = rule ? renewsOn(period, rule.dayOfMonth) : null;
    const phase = rule ? billPhase(period, rule.dayOfMonth, today) : null;
    obligations.push({
      id: source.id,
      title: source.title,
      amount: source.amount,
      date: source.date,
      status: source.status,
      bucket: source.bucket,
      ruleId: source.ruleId,
      period: source.period,
      category: source.category,
      renewsOn: renewal,
      phase,
      willAutoPay: rule !== null && willAutoPay(source.status, rule.autoPay && rule.isActive, source.autoPayHold),
      canSave: rule !== null && source.status === "pending" && phase !== "late" && !rulesWithSaved.has(source.ruleId),
    });
  }

  return obligations.sort(
    (a, b) =>
      Number(b.phase === "late") - Number(a.phase === "late") ||
      a.date.localeCompare(b.date) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * What "Move all to savings" moves. A rule can only have one record in savings, so with
 * two running Due records only the oldest goes.
 */
export function pickForSavings<T extends { ruleId: string | null; period: string | null; canSave: boolean }>(items: T[]) {
  const oldestByRule = new Map<string, T>();
  for (const item of items) {
    if (!item.canSave || item.ruleId === null) continue;
    const current = oldestByRule.get(item.ruleId);
    if (!current || (item.period ?? "") < (current.period ?? "")) oldestByRule.set(item.ruleId, item);
  }
  return [...oldestByRule.values()];
}

/** The next day something pays by itself, and everything that pays on that day. */
export function nextAutoPayment(obligations: Obligation[]) {
  const paying = obligations.filter((item) => item.willAutoPay && item.renewsOn !== null);
  if (paying.length === 0) return null;
  const date = paying.reduce((earliest, item) => {
    const renewal = item.renewsOn as string;
    return renewal < earliest ? renewal : earliest;
  }, paying[0].renewsOn as string);
  const due = paying.filter((item) => item.renewsOn === date);
  return {
    date,
    amount: fromCents(due.reduce((total, item) => total + toCents(item.amount), 0)),
    count: due.length,
  };
}
