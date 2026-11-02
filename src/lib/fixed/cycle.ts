import { debitBucketForStatus, type Bucket, type Kind, type Status } from "../config/buckets";

/**
 * The fixed-monthly lifecycle as pure functions: no database and no clock, `today`
 * is always an argument, so any sequence of days can be replayed in a test.
 * Dates are "YYYY-MM-DD" and periods "YYYY-MM"; both order correctly as strings.
 */

const DAY_MS = 86_400_000;
const MAX_WALK_PERIODS = 240;

function shiftPeriod(period: string, delta: number) {
  const months = Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1 + delta;
  return `${Math.floor(months / 12)}-${String((months % 12) + 1).padStart(2, "0")}`;
}

function utcDay(iso: string) {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

export function periodOf(iso: string) {
  return iso.slice(0, 7);
}

export function dayOfDate(iso: string) {
  return Number(iso.slice(8, 10));
}

/** The date a rule falls on in a period, clamped to the month length. */
export function occurrence(period: string, day: number) {
  const lastDay = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0)).getUTCDate();
  return `${period}-${String(Math.min(Math.max(1, day), lastDay)).padStart(2, "0")}`;
}

export function nextPeriod(period: string) {
  return shiftPeriod(period, 1);
}

export function prevPeriod(period: string) {
  return shiftPeriod(period, -1);
}

/** The duration of a record is one month from its date. */
/** The next date on which this exact day exists, so moving a bill forward never changes its day. */
export function nextFullOccurrence(period: string, day: number): string {
  let next = nextPeriod(period);
  while (dayOfDate(occurrence(next, day)) !== day) next = nextPeriod(next);
  return occurrence(next, day);
}

export function renewsOn(period: string, day: number) {
  return occurrence(nextPeriod(period), day);
}

/** The latest period whose occurrence is on or before today. */
export function reachedPeriod(today: string, day: number) {
  const todayP = periodOf(today);
  return occurrence(todayP, day) <= today ? todayP : prevPeriod(todayP);
}

export function isOpen(status: Status): status is "pending" | "saved" {
  return status === "pending" || status === "saved";
}

export type BillPhase = "upcoming" | "today" | "open" | "late";

export function billPhase(period: string, day: number, today: string): BillPhase {
  const date = occurrence(period, day);
  if (date > today) return "upcoming";
  if (date === today) return "today";
  return renewsOn(period, day) <= today ? "late" : "open";
}

/** Whole days from `a` to `b`, negative when `b` is earlier. */
export function daysBetween(a: string, b: string) {
  return Math.round((utcDay(b) - utcDay(a)) / DAY_MS);
}

/** How far today is through the record's month, from 0 on its date to 1 on renewal. */
export function cycleProgress(period: string, day: number, today: string) {
  const date = occurrence(period, day);
  const progress = daysBetween(date, today) / daysBetween(date, renewsOn(period, day));
  return Math.min(1, Math.max(0, progress));
}

export function willAutoPay(status: Status, autoPay: boolean, hold: boolean) {
  return !hold && (status === "saved" || (status === "pending" && autoPay));
}

export type SyncRule = {
  id: string;
  dayOfMonth: number;
  isActive: boolean;
  autoPay: boolean;
  startsOn: string;
  endsOn: string | null;
};

export type SyncInstance = {
  id: string;
  period: string | null;
  status: Status;
  autoPayHold: boolean;
};

export type SyncCreate = {
  ruleId: string;
  period: string;
  date: string;
  status: "pending" | "settled";
  autoPaid: boolean;
  settledOn: string | null;
};

export type SyncPlan = {
  create: SyncCreate[];
  autoPay: { entryId: string; settledOn: string }[];
  skip: string[];
  /** Pending records that must stop paying by themselves: set `auto_pay_hold=true`. */
  hold: string[];
};

type RunningRecord = { id: string; period: string; status: "pending" | "saved" };

/**
 * What one rule needs today: bills whose month ended get paid (A), months reached
 * since the last record are placed or skipped (B), the current month appears early
 * when nothing earlier is still waiting (C), and only one running record stays able
 * to pay by itself (D). Applying the plan and planning again on the same day yields
 * an empty plan.
 *
 * A paused rule places nothing, but saved money still settles: the bill promised it
 * would, and nothing else would ever close it. A Due bill whose month ends during the
 * pause stays Due and gets held, so resuming the rule cannot pay it.
 */
export function planRuleSync(
  rule: SyncRule,
  instances: SyncInstance[],
  skippedPeriods: string[],
  today: string,
): SyncPlan {
  const plan: SyncPlan = { create: [], autoPay: [], skip: [], hold: [] };
  const day = rule.dayOfMonth;
  const todayP = periodOf(today);

  const known = new Set(skippedPeriods);
  const running: RunningRecord[] = [];
  let waitingBeforeToday = false;
  for (const { id, period, status, autoPayHold } of instances) {
    if (period === null) continue;
    known.add(period);
    if (!isOpen(status) || autoPayHold) continue;
    const renewal = renewsOn(period, day);
    if (renewal > today) {
      running.push({ id, period, status });
    } else if (status === "saved" || (rule.autoPay && rule.isActive)) {
      plan.autoPay.push({ entryId: id, settledOn: renewal });
      continue;
    } else if (rule.autoPay) {
      plan.hold.push(id);
    }
    if (period < todayP) waitingBeforeToday = true;
  }

  if (rule.isActive) placeMonths(rule, known, running, waitingBeforeToday, today, plan);
  if (rule.autoPay) {
    const placedOne = plan.create.some((record) => record.status === "pending");
    plan.hold.push(...surplusPayers(running, todayP, placedOne));
  }
  return plan;
}

function placeMonths(
  rule: SyncRule,
  known: Set<string>,
  running: RunningRecord[],
  waitingBeforeToday: boolean,
  today: string,
  plan: SyncPlan,
) {
  const day = rule.dayOfMonth;
  const todayP = periodOf(today);
  const start = periodOf(rule.startsOn);
  const endP = rule.endsOn ? periodOf(rule.endsOn) : null;
  const uncapped = reachedPeriod(today, day);
  const reached = endP && endP < uncapped ? endP : uncapped;

  // Saved records cannot be held, so with autoPay on nothing may be placed beneath one.
  const savedAhead = (period: string) =>
    rule.autoPay && running.some((record) => record.status === "saved" && record.period > period);

  // A record in the current month closes the walk, so a day edit that moves `reached`
  // back behind it cannot refill older months with settled rows.
  let last: string | null = null;
  for (const period of known) {
    if (period <= todayP && (last === null || period > last)) last = period;
  }
  let from = last ? nextPeriod(last) : start;
  if (from < start) from = start;
  // Keeps the newest months when the gap is absurdly long, so the current bill is still placed.
  const oldest = shiftPeriod(reached, 1 - MAX_WALK_PERIODS);
  if (from < oldest) from = oldest;

  for (let period = from; period <= reached; period = nextPeriod(period)) {
    const renewal = renewsOn(period, day);
    const date = occurrence(period, day);
    if (renewal <= today) {
      if (rule.autoPay) {
        plan.create.push({ ruleId: rule.id, period, date, status: "settled", autoPaid: true, settledOn: renewal });
      } else {
        plan.skip.push(period);
      }
    } else if (savedAhead(period)) {
      plan.skip.push(period);
    } else {
      plan.create.push({ ruleId: rule.id, period, date, status: "pending", autoPaid: false, settledOn: null });
    }
  }

  // The current occurrence being ahead of today means B stopped before todayP,
  // so every pending B planned is an earlier month that takes priority.
  if (
    occurrence(todayP, day) > today &&
    todayP >= start &&
    (endP === null || todayP <= endP) &&
    !known.has(todayP) &&
    !waitingBeforeToday &&
    !savedAhead(todayP) &&
    !plan.create.some((record) => record.status === "pending")
  ) {
    plan.create.push({
      ruleId: rule.id,
      period: todayP,
      date: occurrence(todayP, day),
      status: "pending",
      autoPaid: false,
      settledOn: null,
    });
  }
}

/**
 * Bringing back a month, reopening one or editing a day can leave two running records.
 * With autoPay on, the one that keeps paying is a saved record, else the month just
 * placed, else the newest that has started: an older one is what the user took back.
 */
function surplusPayers(running: RunningRecord[], todayP: string, placedOne: boolean) {
  const pending = running.filter((record) => record.status === "pending");
  if (placedOne || pending.length < running.length) return pending.map((record) => record.id);

  const periods = pending.map((record) => record.period).sort();
  const keep = periods.filter((period) => period <= todayP).at(-1) ?? periods[0];
  return pending.filter((record) => record.period !== keep).map((record) => record.id);
}

export type DayEditPatch = {
  date: string;
  status?: "pending";
  savedAt?: null;
  autoPayHold?: true;
};

/**
 * A day change on one open, non-held record. The date moves inside the record's own
 * period. A renewal that has already passed sends the bill back to Due and held,
 * so editing a day can never pay anything.
 */
export function dayEditPatch(period: string, newDay: number, today: string): DayEditPatch {
  const date = occurrence(period, newDay);
  if (renewsOn(period, newDay) > today) return { date };
  return { date, status: "pending", savedAt: null, autoPayHold: true };
}

/** `status` is null while the record is being created. */
export type StatusEntry = {
  kind: Kind;
  bucket: Bucket;
  status: Status | null;
  ruleId: string | null;
  period: string | null;
  date: string;
};

export type StatusContext = {
  today: string;
  ruleDay: number | null;
  now: Date;
  /** Another open record of this rule is in savings. Saved records cannot be held, so it must be the only one. */
  otherSaved?: boolean;
};

export type StatusPatch = {
  status: Status;
  savedAt?: Date | null;
  settledAt?: Date | null;
  autoPaid?: boolean;
  autoPayHold?: boolean;
  date?: string;
  bucket?: Bucket;
};

/** Full message keys, so they resolve with the root translator or `tv()`, not `getTranslations("server")`. */
export type StatusErrorKey =
  | "validation.savedNeedsBill"
  | "validation.savedCycleOver"
  | "validation.savedOtherMonth"
  | "validation.plannedNotForBills";

export type StatusPatchResult = { ok: true; patch: StatusPatch } | { ok: false; errorKey: StatusErrorKey };

/**
 * The only way a status changes. Setting the current status again keeps every timestamp,
 * but only after the guards: a row must not keep a status it could not be given.
 */
export function statusPatch(entry: StatusEntry, next: Status, context: StatusContext): StatusPatchResult {
  const { today, ruleDay, now, otherSaved } = context;
  const isRuleRecord = entry.ruleId !== null;
  const renewal = ruleDay === null ? null : renewsOn(entry.period ?? periodOf(entry.date), ruleDay);

  if (next === "saved") {
    if (entry.kind !== "credit" || entry.bucket !== "fixed" || !isRuleRecord || renewal === null) {
      return { ok: false, errorKey: "validation.savedNeedsBill" };
    }
    if (renewal <= today) return { ok: false, errorKey: "validation.savedCycleOver" };
  }
  if (next === "planned" && isRuleRecord) return { ok: false, errorKey: "validation.plannedNotForBills" };
  if (entry.status === next) return { ok: true, patch: { status: next } };

  switch (next) {
    case "saved":
      if (otherSaved) return { ok: false, errorKey: "validation.savedOtherMonth" };
      return {
        ok: true,
        patch: { status: next, savedAt: now, settledAt: null, autoPaid: false, autoPayHold: false },
      };
    case "settled":
      return {
        ok: true,
        patch: {
          status: next,
          settledAt: now,
          autoPaid: false,
          autoPayHold: false,
          ...debitPipeline(entry.kind, next),
          // Non-rule money shows up the day it moved; a bill stays in the month it belongs to.
          ...(!isRuleRecord && entry.status !== null ? { date: today } : {}),
        },
      };
    case "pending":
      return {
        ok: true,
        patch: {
          status: next,
          savedAt: null,
          settledAt: null,
          autoPaid: false,
          autoPayHold: renewal !== null && renewal <= today,
          ...debitPipeline(entry.kind, next),
        },
      };
    case "planned":
      return {
        ok: true,
        patch: {
          status: next,
          savedAt: null,
          settledAt: null,
          autoPaid: false,
          autoPayHold: false,
          ...debitPipeline(entry.kind, next),
        },
      };
  }
}

function debitPipeline(kind: Kind, status: Exclude<Status, "saved">) {
  return kind === "debit" ? { bucket: debitBucketForStatus(status) } : {};
}

/** A first date older than the running cycle would be an invented debt, so it moves to this month. */
export function firstRecordDate(enteredDate: string, today: string) {
  const day = dayOfDate(enteredDate);
  return enteredDate < occurrence(reachedPeriod(today, day), day)
    ? occurrence(periodOf(today), day)
    : enteredDate;
}

export function normalizeTitle(title: string) {
  return title.trim().toLowerCase();
}

/**
 * Formats a hex digest as an RFC 9562 version 8 UUID. The version and variant bits
 * matter: zod's uuid() rejects ids without them, which would lock the user out of
 * every action on the rule.
 */
export function uuidFromHex(hex: string) {
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export type AdoptionEntry = {
  id: string;
  kind: Kind;
  bucket: Bucket;
  status: Status;
  title: string;
  amount: number;
  date: string;
  categoryId: string | null;
  note: string | null;
  ruleId: string | null;
  period: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdoptionRule = {
  id: string;
  title: string;
  isActive: boolean;
  startsOn: string;
};

export type AdoptionInput = {
  /** Every candidate and rule-linked entry of the user; anything else is ignored. */
  entries: AdoptionEntry[];
  /** Every rule of the user, active or paused. */
  rules: AdoptionRule[];
  /** Deterministic id for a new rule, so concurrent runs converge on one row. */
  ruleIdFor: (normalizedTitle: string) => string;
};

/** Apply in one batch, `newRules` first: `links` point at them. */
export type AdoptionPlan = {
  newRules: {
    id: string;
    title: string;
    amount: number;
    categoryId: string | null;
    note: string | null;
    dayOfMonth: number;
    startsOn: string;
    autoPay: false;
    source: "adoption";
  }[];
  links: { entryId: string; ruleId: string; period: string; toPending: boolean }[];
  /** Rule-linked `planned` records that become `pending`. */
  promote: string[];
  /** Untouched records that old browsing created in future months. */
  deleteFuture: string[];
};

const ADOPTION_RANK: Record<Status, number> = { settled: 3, saved: 2, pending: 1, planned: 0 };

function outranks(a: AdoptionEntry, b: AdoptionEntry) {
  if (a.status !== b.status) return ADOPTION_RANK[a.status] > ADOPTION_RANK[b.status];
  if (a.date !== b.date) return a.date > b.date;
  return a.id < b.id;
}

function isLaterThan(a: AdoptionEntry, b: AdoptionEntry) {
  return a.date !== b.date ? a.date > b.date : outranks(a, b);
}

function pickExistingRule(rules: AdoptionRule[], normalizedTitle: string) {
  let best: AdoptionRule | null = null;
  for (const rule of rules) {
    if (normalizeTitle(rule.title) !== normalizedTitle) continue;
    if (
      best === null ||
      (rule.isActive && !best.isActive) ||
      (rule.isActive === best.isActive && rule.id < best.id)
    ) {
      best = rule;
    }
  }
  return best;
}

/**
 * The one-time move of pre-lifecycle fixed entries onto rules. Nothing settles, so
 * no balance can change. Every choice is deterministic, so reruns and concurrent
 * runs produce the same plan.
 */
export function planAdoption(input: AdoptionInput, today: string): AdoptionPlan {
  const { entries, rules, ruleIdFor } = input;
  const todayP = periodOf(today);
  const plan: AdoptionPlan = { newRules: [], links: [], promote: [], deleteFuture: [] };
  const startsOnByRule = new Map(rules.map((rule) => [rule.id, rule.startsOn]));
  // Slots a to-be-deleted record holds count as taken: the unique index on
  // (rule_id, period) would reject the link if its delete did not go through.
  const takenSlots = new Set<string>();
  const groups = new Map<string, AdoptionEntry[]>();

  for (const entry of entries) {
    if (entry.ruleId === null) {
      if (entry.kind !== "credit" || entry.bucket !== "fixed" || entry.period !== null) continue;
      const title = normalizeTitle(entry.title);
      const group = groups.get(title);
      if (group) group.push(entry);
      else groups.set(title, [entry]);
      continue;
    }
    if (entry.status === "planned") plan.promote.push(entry.id);
    if (entry.period === null) continue;
    takenSlots.add(`${entry.ruleId}:${entry.period}`);
    const startsOn = startsOnByRule.get(entry.ruleId);
    if (
      startsOn !== undefined &&
      entry.status === "pending" &&
      entry.period > todayP &&
      entry.period > periodOf(startsOn) &&
      entry.updatedAt.getTime() === entry.createdAt.getTime()
    ) {
      plan.deleteFuture.push(entry.id);
    }
  }

  const oldestEligible = prevPeriod(todayP);
  for (const [title, group] of groups) {
    const latest = group.reduce((best, entry) => (isLaterThan(entry, best) ? entry : best));
    if (periodOf(latest.date) < oldestEligible) continue;

    let ruleId = pickExistingRule(rules, title)?.id;
    if (ruleId === undefined) {
      ruleId = ruleIdFor(title);
      plan.newRules.push({
        id: ruleId,
        title: latest.title,
        amount: latest.amount,
        categoryId: latest.categoryId,
        note: latest.note,
        dayOfMonth: dayOfDate(latest.date),
        startsOn: latest.date,
        autoPay: false,
        source: "adoption",
      });
    }

    const bestByPeriod = new Map<string, AdoptionEntry>();
    for (const entry of group) {
      const period = periodOf(entry.date);
      const current = bestByPeriod.get(period);
      if (current === undefined || outranks(entry, current)) bestByPeriod.set(period, entry);
    }
    for (const [period, entry] of bestByPeriod) {
      if (takenSlots.has(`${ruleId}:${period}`)) continue;
      plan.links.push({ entryId: entry.id, ruleId, period, toPending: entry.status === "planned" });
    }
  }

  return plan;
}
