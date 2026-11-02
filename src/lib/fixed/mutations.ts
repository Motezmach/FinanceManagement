import "server-only";
import { and, eq, exists, gt, inArray, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { alias } from "drizzle-orm/pg-core";
import type { RunnableQuery } from "drizzle-orm/runnable-query";
import { getTranslations } from "next-intl/server";
import { fail, type ActionResult } from "@/lib/actions/types";
import { BUCKET_META, debitBucketForStatus, type Bucket, type Kind, type Status } from "@/lib/config/buckets";
import { shiftPeriod } from "@/lib/dates";
import { db } from "@/lib/db";
import { categories, entries, recurringRules, ruleSkips, users, type Entry } from "@/lib/db/schema";
import { getPosition, listObligationSources } from "@/lib/queries/savings";
import { fromCents, toCents } from "@/lib/utils";
import type { EntryInput, RuleInput } from "@/lib/validation";
import {
  dayEditPatch,
  dayOfDate,
  firstRecordDate,
  isOpen,
  nextPeriod,
  normalizeTitle,
  occurrence,
  periodOf,
  reachedPeriod,
  renewsOn,
  statusPatch,
} from "./cycle";
import { buildObligations, pickForSavings, savingsShortBy } from "./position";

/**
 * Every multi-statement write of the fixed-monthly lifecycle. Each one is a single
 * `db.batch`, which runs atomically on neon-http, with ids generated here. Any change
 * to a rule record resets the sync gate in the same batch, so the next render syncs.
 */

export type Statement = BatchItem<"pg">;

const MAX_ACTIVE_RULES = 200;
const MAX_MONTHS_AHEAD = 24;
const OPEN_STATUSES: ("pending" | "saved")[] = ["pending", "saved"];

/** `errorKey` is a full message key, resolved with the root translator. */
export type MutationFailure = { ok: false; errorKey: string; field?: string };
export type MutationResult<T = undefined> = { ok: true; data: T } | MutationFailure;

const refuse = (errorKey: string, field?: string): MutationFailure => ({ ok: false, errorKey, field });
const done = <T>(data: T) => ({ ok: true as const, data });
const doneEmpty = { ok: true as const, data: undefined };

export async function toActionFailure(failure: MutationFailure): Promise<ActionResult<never>> {
  const t = await getTranslations();
  const message = t(failure.errorKey);
  return fail(message, failure.field ? { [failure.field]: message } : undefined);
}

export async function runBatch(statements: Statement[]): Promise<unknown[]> {
  const [first, ...rest] = statements;
  return first ? db.batch([first, ...rest]) : [];
}

/** Runs `main` in order inside one batch and returns its own result. */
async function batchAround<T>(before: Statement[], main: RunnableQuery<T, "pg">, after: Statement[]) {
  const results = await runBatch([...before, main, ...after]);
  return results[before.length] as T;
}

function resetSyncGate(userId: string) {
  return db.update(users).set({ fixedSyncedOn: null }).where(eq(users.id, userId));
}

/**
 * Copies the rule into a new record for one month. Guarded by the rule still being
 * active and owned and the month not being skipped, so a stale plan inserts nothing.
 * Both timestamps default to now(), which is how "untouched" is recognised later.
 */
export function placeRecord(
  userId: string,
  record: {
    ruleId: string;
    period: string;
    date: string;
    status: "pending" | "settled";
    autoPaid: boolean;
    settledOn: string | null;
    hold: boolean;
  },
) {
  const settledAt = record.settledOn ? `${record.settledOn}T00:00:00Z` : null;
  return db.execute(sql`
    INSERT INTO ${entries} (id, user_id, category_id, kind, bucket, status, amount, title, note, date, rule_id, period, settled_at, auto_paid, auto_pay_hold)
    SELECT ${crypto.randomUUID()}::uuid, r.user_id, r.category_id, 'credit'::entry_kind, 'fixed'::entry_bucket,
      ${record.status}::entry_status, r.amount, r.title, r.note, ${record.date}::date, r.id, ${record.period}::text,
      ${settledAt}::timestamptz, ${record.autoPaid}::boolean, ${record.hold}::boolean
    FROM ${recurringRules} r
    WHERE r.id = ${record.ruleId}::uuid AND r.user_id = ${userId}::uuid AND r.is_active
      AND NOT EXISTS (SELECT 1 FROM ${ruleSkips} s WHERE s.rule_id = r.id AND s.period = ${record.period}::text)
    ON CONFLICT (rule_id, period) DO NOTHING
  `);
}

/** Guarded by no record holding that month: placed after a delete, it only lands if the delete went through. */
export function insertSkip(userId: string, ruleId: string, period: string) {
  return db.execute(sql`
    INSERT INTO ${ruleSkips} (rule_id, user_id, period)
    SELECT r.id, r.user_id, ${period}::text
    FROM ${recurringRules} r
    WHERE r.id = ${ruleId}::uuid AND r.user_id = ${userId}::uuid
      AND NOT EXISTS (SELECT 1 FROM ${entries} e WHERE e.rule_id = r.id AND e.period = ${period}::text)
    ON CONFLICT (rule_id, period) DO NOTHING
  `);
}

async function findEntry(userId: string, id: string) {
  const [entry] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, userId)))
    .limit(1);
  return entry;
}

async function findRule(userId: string, ruleId: string) {
  const [rule] = await db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, userId)))
    .limit(1);
  return rule;
}

type RuleRecord = Pick<Entry, "id" | "period" | "status" | "autoPayHold">;

function listRuleRecords(userId: string, ruleId: string): Promise<RuleRecord[]> {
  return db
    .select({ id: entries.id, period: entries.period, status: entries.status, autoPayHold: entries.autoPayHold })
    .from(entries)
    .where(and(eq(entries.ruleId, ruleId), eq(entries.userId, userId)));
}

/** Refuses a category the user does not own or that sits on the other side of the ledger. */
export async function categoryProblem(userId: string, categoryId: string, kind: Kind) {
  const [category] = await db
    .select({ kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  if (!category) return refuse("server.pickCategory", "categoryId");
  return category.kind === kind ? null : refuse("server.categoryOtherSide", "categoryId");
}

/** Limits on any new rule. The title and day check stops a retried request making a duplicate. */
async function newRuleProblem(userId: string, title: string, day: number, date: string, today: string) {
  if (periodOf(date) > shiftPeriod(periodOf(today), MAX_MONTHS_AHEAD)) return refuse("server.dateTooFar", "date");
  const active = await db
    .select({ title: recurringRules.title, dayOfMonth: recurringRules.dayOfMonth })
    .from(recurringRules)
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)));
  if (active.length >= MAX_ACTIVE_RULES) return refuse("server.tooManyRules");
  const name = normalizeTitle(title);
  const duplicate = active.some((rule) => rule.dayOfMonth === day && normalizeTitle(rule.title) === name);
  return duplicate ? refuse("server.ruleExists", "title") : null;
}

export type CreatedEntry = {
  /** Null when only the rule was created: a Due bill in a future month is placed when that month starts. */
  id: string | null;
  ruleId: string | null;
  /** The date that was stored. An old first date of a monthly bill moves to this month. */
  date: string;
};

async function createFixedBill(userId: string, input: EntryInput, today: string): Promise<MutationResult<CreatedEntry>> {
  const day = dayOfDate(input.date);
  const date = firstRecordDate(input.date, today);
  const period = periodOf(date);
  const problem = await newRuleProblem(userId, input.title, day, date, today);
  if (problem) return problem;

  const ruleId = crypto.randomUUID();
  const result = statusPatch(
    { kind: "credit", bucket: "fixed", status: null, ruleId, period, date },
    input.status,
    { today, ruleDay: day, now: new Date() },
  );
  if (!result.ok) return refuse(result.errorKey);

  const note = input.note || null;
  const rule = db.insert(recurringRules).values({
    id: ruleId,
    userId,
    title: input.title,
    amount: input.amount,
    categoryId: input.categoryId,
    dayOfMonth: day,
    note,
    startsOn: date,
    autoPay: input.autoPay ?? false,
  });

  if (period > periodOf(today) && input.status === "pending") {
    await rule;
    return done({ id: null, ruleId, date });
  }

  const id = crypto.randomUUID();
  await db.batch([
    rule,
    db.insert(entries).values({
      ...result.patch,
      id,
      userId,
      kind: "credit",
      bucket: "fixed",
      amount: input.amount,
      title: input.title,
      note,
      date,
      categoryId: input.categoryId,
      ruleId,
      period,
    }),
    resetSyncGate(userId),
  ]);
  return done({ id, ruleId, date });
}

export async function createEntryRecord(
  userId: string,
  input: EntryInput,
  today: string,
): Promise<MutationResult<CreatedEntry>> {
  if (BUCKET_META[input.bucket].kind !== input.kind) return refuse("server.bucketMismatch");
  const problem = await categoryProblem(userId, input.categoryId, input.kind);
  if (problem) return problem;
  if (input.bucket === "fixed") return createFixedBill(userId, input, today);

  const result = statusPatch(
    { kind: input.kind, bucket: input.bucket, status: null, ruleId: null, period: null, date: input.date },
    input.status,
    { today, ruleDay: null, now: new Date() },
  );
  if (!result.ok) return refuse(result.errorKey);

  const [row] = await db
    .insert(entries)
    .values({
      ...result.patch,
      userId,
      kind: input.kind,
      bucket: result.patch.bucket ?? input.bucket,
      amount: input.amount,
      title: input.title,
      note: input.note || null,
      date: input.date,
      categoryId: input.categoryId,
    })
    .returning({ id: entries.id });
  return done({ id: row.id, ruleId: null, date: input.date });
}

type ConversionTarget = {
  title: string;
  amount: number;
  categoryId: string | null;
  note: string | null;
  date: string;
  status: Status;
  autoPay: boolean;
};

/**
 * Turns an existing entry into the record of a new rule. It never creates a settled
 * row, and a Due record whose month is already over stays Due, held so autoPay cannot pay it.
 */
async function convertToMonthly(
  userId: string,
  existing: Entry,
  target: ConversionTarget,
  today: string,
): Promise<MutationResult> {
  const { date } = target;
  const day = dayOfDate(date);
  const period = periodOf(date);
  const problem = await newRuleProblem(userId, target.title, day, date, today);
  if (problem) return problem;

  const ruleId = crypto.randomUUID();
  const next = target.status === "planned" ? "pending" : target.status;
  const now = new Date();
  const result = statusPatch({ kind: "credit", bucket: "fixed", status: existing.status, ruleId, period, date }, next, {
    today,
    ruleDay: day,
    now,
  });
  if (!result.ok) return refuse(result.errorKey);

  const startsFromRecord = period >= reachedPeriod(today, day);
  const [, linked] = await db.batch([
    db.insert(recurringRules).values({
      id: ruleId,
      userId,
      title: target.title,
      amount: target.amount,
      categoryId: target.categoryId,
      dayOfMonth: day,
      note: target.note,
      startsOn: startsFromRecord ? occurrence(period, day) : occurrence(periodOf(today), day),
      autoPay: target.autoPay,
    }),
    db
      .update(entries)
      .set({
        ...result.patch,
        autoPayHold: next === "pending" && renewsOn(period, day) <= today,
        kind: "credit",
        bucket: "fixed",
        ruleId,
        period,
        title: target.title,
        amount: target.amount,
        categoryId: target.categoryId,
        note: target.note,
        date,
        updatedAt: now,
      })
      .where(
        and(
          eq(entries.id, existing.id),
          eq(entries.userId, userId),
          eq(entries.status, existing.status),
          isNull(entries.ruleId),
        ),
      )
      .returning({ id: entries.id }),
    resetSyncGate(userId),
  ]);
  return linked.length > 0 ? doneEmpty : refuse("server.billChanged");
}

/** "Make this monthly" on a history row. */
export async function makeEntryMonthly(userId: string, id: string, today: string): Promise<MutationResult> {
  const existing = await findEntry(userId, id);
  if (!existing) return refuse("server.entryNotFound");
  if (existing.ruleId) return refuse("server.alreadyMonthly");
  if (existing.kind !== "credit") return refuse("server.fixedNeedsCredit");
  return convertToMonthly(
    userId,
    existing,
    {
      title: existing.title,
      amount: existing.amount,
      categoryId: existing.categoryId,
      note: existing.note,
      date: existing.date,
      status: existing.status,
      autoPay: false,
    },
    today,
  );
}

/**
 * Reopening a bill brings back the month it closed, so the next month's record, if it
 * was only placed early and nobody touched it, goes away without a skip and placement
 * redoes it later. Guarded by the reopened record still being in the expected status.
 */
function deleteUntouchedNext(
  userId: string,
  record: { id: string; ruleId: string; period: string; status: Status },
  today: string,
) {
  const self = alias(entries, "self");
  return db.delete(entries).where(
    and(
      eq(entries.ruleId, record.ruleId),
      eq(entries.userId, userId),
      eq(entries.period, nextPeriod(record.period)),
      eq(entries.status, "pending"),
      gt(entries.date, today),
      eq(entries.updatedAt, entries.createdAt),
      exists(
        db
          .select({ id: self.id })
          .from(self)
          .where(and(eq(self.id, record.id), eq(self.status, record.status))),
      ),
    ),
  );
}

export async function changeEntryStatus(
  userId: string,
  id: string,
  next: Status,
  expected: Status,
  today: string,
): Promise<MutationResult<{ shortBy: number }>> {
  const existing = await findEntry(userId, id);
  if (!existing) return refuse("server.entryNotFound");
  if (existing.status !== expected) return refuse("server.billChanged");
  if (next === expected) return done({ shortBy: 0 });

  const rule = existing.ruleId ? await findRule(userId, existing.ruleId) : undefined;
  const otherSaved =
    rule !== undefined &&
    next === "saved" &&
    (await listRuleRecords(userId, rule.id)).some((record) => record.id !== id && record.status === "saved");

  const now = new Date();
  const result = statusPatch(existing, next, { today, ruleDay: rule?.dayOfMonth ?? null, now, otherSaved });
  if (!result.ok) return refuse(result.errorKey);

  const updated = await batchAround(
    existing.ruleId && existing.period && existing.status === "settled" && isOpen(next)
      ? [deleteUntouchedNext(userId, { id, ruleId: existing.ruleId, period: existing.period, status: expected }, today)]
      : [],
    db
      .update(entries)
      .set({ ...result.patch, updatedAt: now })
      .where(and(eq(entries.id, id), eq(entries.userId, userId), eq(entries.status, expected)))
      .returning({ id: entries.id }),
    existing.ruleId ? [resetSyncGate(userId)] : [],
  );
  if (updated.length === 0) return refuse("server.billChanged");

  return done({ shortBy: next === "saved" ? savingsShortBy(await getPosition(userId)) : 0 });
}

type RecordFields = { title: string; amount: number; categoryId: string | null; note: string | null };

/**
 * What a rule edit does to its other records: running ones take the new fields, and a
 * changed day moves every open record inside its own month. A held record was taken
 * back by the user and stays as it is.
 */
function propagateRuleEdit(
  userId: string,
  records: RuleRecord[],
  edit: { fromPeriod: string; fields: Partial<RecordFields>; newDay: number | null; today: string; now: Date; exceptId?: string },
): Statement[] {
  const statements: Statement[] = [];
  for (const record of records) {
    if (record.id === edit.exceptId || record.period === null || !isOpen(record.status) || record.autoPayHold) continue;
    const inScope = record.period >= edit.fromPeriod;
    const dayEdit = edit.newDay === null ? null : dayEditPatch(record.period, edit.newDay, edit.today);
    const changes = { ...(inScope ? edit.fields : {}), ...dayEdit };
    if (Object.keys(changes).length === 0) continue;
    statements.push(
      db
        .update(entries)
        .set({ ...changes, updatedAt: edit.now })
        .where(
          and(
            eq(entries.id, record.id),
            eq(entries.userId, userId),
            eq(entries.status, record.status),
            eq(entries.autoPayHold, false),
          ),
        ),
    );
  }
  return statements;
}

/** Turning autoPay on must never pay a bill whose month is already over. */
function holdPastCycle(userId: string, records: RuleRecord[], day: number, today: string): Statement[] {
  const ids = records
    .filter((record) => record.status === "pending" && record.period && renewsOn(record.period, day) <= today)
    .map((record) => record.id);
  if (ids.length === 0) return [];
  return [
    db
      .update(entries)
      .set({ autoPayHold: true })
      .where(and(inArray(entries.id, ids), eq(entries.userId, userId), eq(entries.status, "pending"))),
  ];
}

export type EntryEdit = {
  id: string;
  expectedStatus?: Status;
  kind?: Kind;
  bucket?: Bucket;
  status?: Status;
  amount?: number;
  title?: string;
  categoryId?: string;
  date?: string;
  note?: string;
  applyToRule?: boolean;
  autoPay?: boolean;
};

async function editRuleRecord(
  userId: string,
  existing: Entry,
  ruleId: string,
  edit: EntryEdit,
  today: string,
): Promise<MutationResult> {
  if ((edit.kind && edit.kind !== existing.kind) || (edit.bucket && edit.bucket !== existing.bucket)) {
    return refuse("server.ruleLocked");
  }
  const rule = await findRule(userId, ruleId);
  if (!rule) return refuse("server.ruleNotFound");
  const records = await listRuleRecords(userId, ruleId);

  // A legacy date outside its month can still be edited as long as the date itself stays.
  const newDate = edit.date !== undefined && edit.date !== existing.date ? edit.date : null;
  const dateChanged = newDate !== null;
  if (newDate && periodOf(newDate) !== existing.period) return refuse("server.dateOutsideMonth", "date");
  if (dateChanged && edit.applyToRule === false) return refuse("server.dateNeedsApply", "date");

  const period = existing.period ?? periodOf(existing.date);
  const isLatest = records.every((record) => (record.period ?? "") <= period);
  const applied = dateChanged || (edit.applyToRule ?? (isOpen(existing.status) && isLatest));
  const newDay = newDate ? dayOfDate(newDate) : rule.dayOfMonth;
  const dayEdit =
    dateChanged && isOpen(existing.status) && !existing.autoPayHold ? dayEditPatch(period, newDay, today) : null;

  // A day edit that makes a saved bill instantly due sends it back to Due, unless the user chose something else.
  const requested = edit.status ?? existing.status;
  const next = dayEdit?.status && requested === existing.status ? dayEdit.status : requested;
  const now = new Date();
  const result = statusPatch(existing, next, {
    today,
    ruleDay: newDay,
    now,
    otherSaved: records.some((record) => record.id !== existing.id && record.status === "saved"),
  });
  if (!result.ok) return refuse(result.errorKey);

  const fields: RecordFields = {
    title: edit.title ?? existing.title,
    amount: edit.amount ?? existing.amount,
    categoryId: edit.categoryId ?? existing.categoryId,
    note: edit.note === undefined ? existing.note : edit.note || null,
  };
  const turnsAutoPayOn = edit.autoPay === true && !rule.autoPay;

  const statements: Statement[] = [];
  const ruleChanges = {
    ...(applied ? fields : {}),
    ...(dateChanged ? { dayOfMonth: newDay } : {}),
    ...(edit.autoPay !== undefined ? { autoPay: edit.autoPay } : {}),
  };
  if (Object.keys(ruleChanges).length > 0) {
    statements.push(
      db
        .update(recurringRules)
        .set(ruleChanges)
        .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, userId))),
    );
  }
  if (applied) {
    statements.push(
      ...propagateRuleEdit(userId, records, {
        fromPeriod: period,
        fields,
        newDay: dateChanged ? newDay : null,
        today,
        now,
        exceptId: existing.id,
      }),
    );
  }
  statements.push(resetSyncGate(userId));

  // Holding comes after the update, so a record it just settled is not held.
  if (turnsAutoPayOn) statements.push(...holdPastCycle(userId, records, newDay, today));

  const updated = await batchAround(
    existing.period && existing.status === "settled" && isOpen(next)
      ? [deleteUntouchedNext(userId, { id: existing.id, ruleId, period: existing.period, status: existing.status }, today)]
      : [],
    db
      .update(entries)
      .set({
        ...result.patch,
        ...(dayEdit?.autoPayHold && result.patch.status === "pending" ? { autoPayHold: true } : {}),
        ...fields,
        date: newDate ?? existing.date,
        updatedAt: now,
      })
      .where(and(eq(entries.id, existing.id), eq(entries.userId, userId), eq(entries.status, existing.status)))
      .returning({ id: entries.id }),
    statements,
  );
  return updated.length > 0 ? doneEmpty : refuse("server.billChanged");
}

export async function editEntryRecord(userId: string, edit: EntryEdit, today: string): Promise<MutationResult> {
  const existing = await findEntry(userId, edit.id);
  if (!existing) return refuse("server.entryNotFound");
  if (edit.expectedStatus && edit.expectedStatus !== existing.status) return refuse("server.billChanged");

  const kind = edit.kind ?? existing.kind;
  if (edit.categoryId) {
    const problem = await categoryProblem(userId, edit.categoryId, kind);
    if (problem) return problem;
  }
  if (existing.ruleId) return editRuleRecord(userId, existing, existing.ruleId, edit, today);

  const status = edit.status ?? existing.status;
  const requestedBucket = edit.bucket ?? existing.bucket;
  const note = edit.note === undefined ? existing.note : edit.note || null;
  const date = edit.date ?? existing.date;

  if (kind === "credit" && requestedBucket === "fixed" && existing.bucket !== "fixed") {
    return convertToMonthly(
      userId,
      existing,
      {
        title: edit.title ?? existing.title,
        amount: edit.amount ?? existing.amount,
        categoryId: edit.categoryId ?? existing.categoryId,
        note,
        date,
        status,
        autoPay: edit.autoPay ?? false,
      },
      today,
    );
  }

  const now = new Date();
  const result = statusPatch(
    { kind, bucket: requestedBucket, status: existing.status, ruleId: null, period: existing.period, date },
    status,
    { today, ruleDay: null, now },
  );
  if (!result.ok) return refuse(result.errorKey);

  const bucket = kind === "debit" && status !== "saved" ? debitBucketForStatus(status) : requestedBucket;
  if (BUCKET_META[bucket].kind !== kind) return refuse("server.bucketMismatch");

  const updated = await db
    .update(entries)
    .set({
      ...result.patch,
      kind,
      bucket,
      amount: edit.amount ?? existing.amount,
      title: edit.title ?? existing.title,
      note,
      // A date the user typed wins over the "stamp today" of settling.
      date: edit.date ?? result.patch.date ?? existing.date,
      categoryId: edit.categoryId ?? existing.categoryId,
      updatedAt: now,
    })
    .where(and(eq(entries.id, existing.id), eq(entries.userId, userId), eq(entries.status, existing.status)))
    .returning({ id: entries.id });
  return updated.length > 0 ? doneEmpty : refuse("server.billChanged");
}

/** An open rule record becomes a skip of its month. A settled one is a plain delete, and so is any non-rule entry. */
export async function removeEntry(userId: string, id: string, expected?: Status): Promise<MutationResult> {
  const existing = await findEntry(userId, id);
  if (!existing) return refuse("server.entryNotFound");
  if (expected && existing.status !== expected) return refuse("server.billChanged");

  const after: Statement[] = [];
  if (existing.ruleId) {
    if (existing.period && isOpen(existing.status)) after.push(insertSkip(userId, existing.ruleId, existing.period));
    after.push(resetSyncGate(userId));
  }

  const deleted = await batchAround(
    [],
    db
      .delete(entries)
      .where(and(eq(entries.id, id), eq(entries.userId, userId), eq(entries.status, existing.status)))
      .returning({ id: entries.id }),
    after,
  );
  return deleted.length > 0 ? doneEmpty : refuse("server.billChanged");
}

export async function editRule(userId: string, ruleId: string, input: RuleInput, today: string): Promise<MutationResult> {
  const rule = await findRule(userId, ruleId);
  if (!rule) return refuse("server.ruleNotFound");
  const problem = await categoryProblem(userId, input.categoryId, "credit");
  if (problem?.errorKey === "server.categoryOtherSide") return refuse("server.fixedNeedsCredit", "categoryId");
  if (problem) return problem;

  const records = await listRuleRecords(userId, ruleId);
  const fields: RecordFields = {
    title: input.title,
    amount: input.amount,
    categoryId: input.categoryId,
    note: input.note || null,
  };
  const autoPay = input.autoPay ?? rule.autoPay;
  // The dialog sends every field, so what the user left alone must not undo a change made to one month.
  const changed: Partial<RecordFields> = {
    ...(fields.title !== rule.title ? { title: fields.title } : {}),
    ...(fields.amount !== rule.amount ? { amount: fields.amount } : {}),
    ...(fields.categoryId !== rule.categoryId ? { categoryId: fields.categoryId } : {}),
    ...(fields.note !== rule.note ? { note: fields.note } : {}),
  };

  await runBatch([
    db
      .update(recurringRules)
      .set({ ...fields, dayOfMonth: input.dayOfMonth, autoPay })
      .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, userId))),
    // A rule edit has no edited month, so it starts at the running one: what is already late stays as it was billed.
    ...propagateRuleEdit(userId, records, {
      fromPeriod: reachedPeriod(today, rule.dayOfMonth),
      fields: changed,
      newDay: input.dayOfMonth === rule.dayOfMonth ? null : input.dayOfMonth,
      today,
      now: new Date(),
    }),
    ...(autoPay && !rule.autoPay ? holdPastCycle(userId, records, input.dayOfMonth, today) : []),
    resetSyncGate(userId),
  ]);
  return doneEmpty;
}

/** Removes what has not ended yet. Past-cycle and held bills stay Due, since they are still owed. */
export async function pauseRule(userId: string, ruleId: string, today: string): Promise<MutationResult> {
  const rule = await findRule(userId, ruleId);
  if (!rule) return refuse("server.ruleNotFound");

  const records = await listRuleRecords(userId, ruleId);
  const removable = records
    .filter(
      (record) =>
        isOpen(record.status) &&
        !record.autoPayHold &&
        record.period !== null &&
        renewsOn(record.period, rule.dayOfMonth) > today,
    )
    .map((record) => record.id);

  await runBatch([
    db
      .update(recurringRules)
      .set({ isActive: false })
      .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, userId))),
    ...(removable.length > 0
      ? [
          db
            .delete(entries)
            .where(
              and(
                inArray(entries.id, removable),
                eq(entries.userId, userId),
                inArray(entries.status, OPEN_STATUSES),
                eq(entries.autoPayHold, false),
              ),
            ),
        ]
      : []),
    resetSyncGate(userId),
  ]);
  return doneEmpty;
}

/** Restarts from this month, so a pause never comes back as missed months. A rule that had not started keeps its start. */
export async function resumeRule(userId: string, ruleId: string, today: string): Promise<MutationResult> {
  const rule = await findRule(userId, ruleId);
  if (!rule) return refuse("server.ruleNotFound");
  if (rule.isActive) return doneEmpty;

  const active = await db
    .select({ id: recurringRules.id })
    .from(recurringRules)
    .where(and(eq(recurringRules.userId, userId), eq(recurringRules.isActive, true)));
  if (active.length >= MAX_ACTIVE_RULES) return refuse("server.tooManyRules");

  const thisMonth = occurrence(periodOf(today), rule.dayOfMonth);
  await db.batch([
    db
      .update(recurringRules)
      .set({ isActive: true, startsOn: rule.startsOn > thisMonth ? rule.startsOn : thisMonth })
      .where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, userId))),
    resetSyncGate(userId),
  ]);
  return doneEmpty;
}

/**
 * Open records go with the rule and settled history stays, unlinked by the foreign key
 * with its period kept. An adopted rule the user never reviewed is different: its linked
 * records were entered by hand before the rule existed, so "Not monthly" leaves them as
 * one-off entries and removes only what the sync placed.
 */
export async function removeRule(userId: string, ruleId: string): Promise<MutationResult> {
  const rule = await findRule(userId, ruleId);
  if (!rule) return refuse("server.ruleNotFound");

  const ownRecords = and(eq(entries.ruleId, ruleId), eq(entries.userId, userId));
  const statements: Statement[] =
    rule.source === "adoption"
      ? [
          db
            .delete(entries)
            .where(
              and(ownRecords, inArray(entries.status, OPEN_STATUSES), eq(entries.updatedAt, entries.createdAt)),
            ),
          db
            .update(entries)
            .set({ status: "pending", savedAt: null, updatedAt: new Date() })
            .where(and(ownRecords, eq(entries.status, "saved"))),
        ]
      : [db.delete(entries).where(and(ownRecords, inArray(entries.status, OPEN_STATUSES)))];

  await runBatch([
    ...statements,
    db.delete(recurringRules).where(and(eq(recurringRules.id, ruleId), eq(recurringRules.userId, userId))),
    resetSyncGate(userId),
  ]);
  return doneEmpty;
}

/** Puts a skipped month back. A future month only loses its skip: it is placed when it arrives. */
export async function bringBackPeriod(
  userId: string,
  ruleId: string,
  period: string,
  today: string,
): Promise<MutationResult> {
  const rule = await findRule(userId, ruleId);
  if (!rule) return refuse("server.ruleNotFound");
  if (!rule.isActive) return refuse("server.rulePaused");

  const ownSkip = and(eq(ruleSkips.ruleId, ruleId), eq(ruleSkips.period, period), eq(ruleSkips.userId, userId));
  const [skip] = await db.select({ period: ruleSkips.period }).from(ruleSkips).where(ownSkip).limit(1);
  if (!skip) return refuse("server.billChanged");

  await runBatch([
    db.delete(ruleSkips).where(ownSkip),
    ...(period <= periodOf(today)
      ? [
          placeRecord(userId, {
            ruleId,
            period,
            date: occurrence(period, rule.dayOfMonth),
            status: "pending",
            autoPaid: false,
            settledOn: null,
            hold: renewsOn(period, rule.dayOfMonth) <= today,
          }),
        ]
      : []),
    resetSyncGate(userId),
  ]);
  return doneEmpty;
}

export async function moveBillsToSavings(
  userId: string,
  today: string,
): Promise<MutationResult<{ count: number; total: number; shortBy: number }>> {
  const sources = await listObligationSources(userId);
  const picks = pickForSavings(buildObligations(sources, today));
  if (picks.length === 0) return done({ count: 0, total: 0, shortBy: 0 });

  const dayById = new Map(sources.map((source) => [source.id, source.rule?.dayOfMonth ?? null]));
  const now = new Date();
  const statements: Statement[] = [];
  let totalCents = 0;
  for (const bill of picks) {
    const result = statusPatch(
      { kind: "credit", bucket: bill.bucket, status: bill.status, ruleId: bill.ruleId, period: bill.period, date: bill.date },
      "saved",
      { today, ruleDay: dayById.get(bill.id) ?? null, now },
    );
    if (!result.ok) continue;
    totalCents += toCents(bill.amount);
    statements.push(
      db
        .update(entries)
        .set({ ...result.patch, updatedAt: now })
        .where(and(eq(entries.id, bill.id), eq(entries.userId, userId), eq(entries.status, "pending"))),
    );
  }
  await runBatch([...statements, resetSyncGate(userId)]);

  return done({
    count: statements.length,
    total: fromCents(totalCents),
    shortBy: savingsShortBy(await getPosition(userId)),
  });
}

/** Marks the rule as reviewed so the one-time adoption notice stops listing it. */
export async function keepAdoptedRule(userId: string, ruleId: string) {
  await db
    .update(recurringRules)
    .set({ source: "adoption_ok" })
    .where(
      and(
        eq(recurringRules.id, ruleId),
        eq(recurringRules.userId, userId),
        eq(recurringRules.source, "adoption"),
      ),
    );
}

export async function markAutoPaidSeen(userId: string) {
  await db
    .update(entries)
    .set({ autoPaidSeen: true })
    .where(and(eq(entries.userId, userId), eq(entries.autoPaid, true), eq(entries.autoPaidSeen, false)));
}

