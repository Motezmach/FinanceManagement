import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { CurrentUser } from "@/lib/auth/current-user";
import { todayISO } from "@/lib/dates";
import { db } from "@/lib/db";
import { entries, recurringRules, ruleSkips, users } from "@/lib/db/schema";
import { planAdoption, planRuleSync, uuidFromHex, type SyncInstance } from "./cycle";
import { insertSkip, placeRecord, runBatch, type Statement } from "./mutations";

/**
 * Brings a user's bills up to today: pays what ended, places what started. It runs
 * during render, so it never touches cookies or revalidates anything. Concurrent runs
 * converge, because every statement is conditional and every plan is deterministic.
 */

/**
 * The one-time move of a user's old fixed entries onto rules. All in one batch ending
 * with the version bump. Nothing settles, so no balance can change.
 */
async function adopt(userId: string, today: string) {
  const [candidates, rules] = await Promise.all([
    db
      .select({
        id: entries.id,
        kind: entries.kind,
        bucket: entries.bucket,
        status: entries.status,
        title: entries.title,
        amount: entries.amount,
        date: entries.date,
        categoryId: entries.categoryId,
        note: entries.note,
        ruleId: entries.ruleId,
        period: entries.period,
        createdAt: entries.createdAt,
        updatedAt: entries.updatedAt,
      })
      .from(entries)
      .where(
        and(
          eq(entries.userId, userId),
          or(
            isNotNull(entries.ruleId),
            and(eq(entries.kind, "credit"), eq(entries.bucket, "fixed"), isNull(entries.period)),
          ),
        ),
      ),
    db
      .select({
        id: recurringRules.id,
        title: recurringRules.title,
        isActive: recurringRules.isActive,
        startsOn: recurringRules.startsOn,
      })
      .from(recurringRules)
      .where(eq(recurringRules.userId, userId)),
  ]);

  const plan = planAdoption(
    {
      entries: candidates,
      rules,
      ruleIdFor: (title) => uuidFromHex(createHash("sha256").update(`adopt:${userId}:${title}`).digest("hex")),
    },
    today,
  );

  const now = new Date();
  const statements: Statement[] = [];
  if (plan.newRules.length > 0) {
    statements.push(
      db
        .insert(recurringRules)
        .values(plan.newRules.map((rule) => ({ ...rule, userId })))
        .onConflictDoNothing({ target: recurringRules.id }),
    );
  }
  if (plan.deleteFuture.length > 0) {
    statements.push(
      db
        .delete(entries)
        .where(
          and(
            inArray(entries.id, plan.deleteFuture),
            eq(entries.userId, userId),
            isNotNull(entries.ruleId),
            eq(entries.status, "pending"),
            eq(entries.updatedAt, entries.createdAt),
          ),
        ),
    );
  }
  for (const link of plan.links) {
    // updatedAt moves so a hand-entered record never reads as untouched, which would make it deletable.
    statements.push(
      db
        .update(entries)
        .set({
          ruleId: link.ruleId,
          period: link.period,
          ...(link.toPending ? { status: "pending" as const } : {}),
          updatedAt: now,
        })
        .where(and(eq(entries.id, link.entryId), eq(entries.userId, userId), isNull(entries.ruleId))),
    );
  }
  if (plan.promote.length > 0) {
    statements.push(
      db
        .update(entries)
        .set({ status: "pending", updatedAt: now })
        .where(and(inArray(entries.id, plan.promote), eq(entries.userId, userId), eq(entries.status, "planned"))),
    );
  }
  statements.push(db.update(users).set({ fixedModelVersion: 1 }).where(eq(users.id, userId)));
  await runBatch(statements);
}

function groupByRule<T extends { ruleId: string | null }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (row.ruleId === null) continue;
    const group = groups.get(row.ruleId);
    if (group) group.push(row);
    else groups.set(row.ruleId, [row]);
  }
  return groups;
}

async function applyPlans(userId: string, today: string) {
  const [rules, records, skips] = await Promise.all([
    db
      .select({
        id: recurringRules.id,
        dayOfMonth: recurringRules.dayOfMonth,
        isActive: recurringRules.isActive,
        autoPay: recurringRules.autoPay,
        startsOn: recurringRules.startsOn,
        endsOn: recurringRules.endsOn,
      })
      .from(recurringRules)
      .where(eq(recurringRules.userId, userId)),
    db
      .select({
        id: entries.id,
        ruleId: entries.ruleId,
        period: entries.period,
        status: entries.status,
        autoPayHold: entries.autoPayHold,
      })
      .from(entries)
      .where(and(eq(entries.userId, userId), isNotNull(entries.ruleId))),
    db.select({ ruleId: ruleSkips.ruleId, period: ruleSkips.period }).from(ruleSkips).where(eq(ruleSkips.userId, userId)),
  ]);

  const recordsByRule = groupByRule(records);
  const skipsByRule = groupByRule(skips);
  const now = new Date();
  const statements: Statement[] = [];

  for (const rule of rules) {
    const instances: SyncInstance[] = recordsByRule.get(rule.id) ?? [];
    const skipped = (skipsByRule.get(rule.id) ?? []).map((skip) => skip.period);
    const plan = planRuleSync(rule, instances, skipped, today);
    const statusOf = new Map(instances.map((instance) => [instance.id, instance.status]));

    for (const record of plan.create) {
      statements.push(placeRecord(userId, { ...record, hold: false }));
    }
    for (const payment of plan.autoPay) {
      const status = statusOf.get(payment.entryId);
      if (!status) continue;
      // `date` stays, so each month keeps exactly one instance of the bill in analytics.
      // The loaded status guards against paying a bill the user took back since the plan was made.
      statements.push(
        db
          .update(entries)
          .set({
            status: "settled",
            autoPaid: true,
            autoPaidSeen: false,
            settledAt: new Date(`${payment.settledOn}T00:00:00Z`),
            updatedAt: now,
          })
          .where(
            and(
              eq(entries.id, payment.entryId),
              eq(entries.userId, userId),
              eq(entries.status, status),
              eq(entries.autoPayHold, false),
            ),
          ),
      );
    }
    for (const period of plan.skip) {
      statements.push(insertSkip(userId, rule.id, period));
    }
    if (plan.hold.length > 0) {
      // The system set this, not the user, so updatedAt stays and the record still reads as untouched.
      statements.push(
        db
          .update(entries)
          .set({ autoPayHold: true })
          .where(and(inArray(entries.id, plan.hold), eq(entries.userId, userId), eq(entries.status, "pending"))),
      );
    }
  }

  statements.push(db.update(users).set({ fixedSyncedOn: today }).where(eq(users.id, userId)));
  await runBatch(statements);
}

/** Uncached. Adoption runs first when it has not happened yet, then rules load for planning. */
export async function syncNow(
  userId: string,
  { today = todayISO(), force = false }: { today?: string; force?: boolean } = {},
) {
  const [gate] = await db
    .select({ syncedOn: users.fixedSyncedOn, version: users.fixedModelVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!gate) return;
  if (!force && gate.version >= 1 && gate.syncedOn === today) return;

  if (gate.version < 1) await adopt(userId, today);
  await applyPlans(userId, today);
}

/**
 * For renders and the calculator route. `cache` only spares repeat calls inside one
 * render; it is not a lock. A failure logs, leaves the gate unset for the next visit
 * and lets the page render what is there.
 */
export const ensureSynced = cache(async (user: CurrentUser): Promise<void> => {
  const today = todayISO();
  if (user.fixedModelVersion >= 1 && user.fixedSyncedOn === today) return;
  try {
    await syncNow(user.id, { today });
  } catch (error) {
    console.error("Fixed monthly sync failed", error);
  }
});
