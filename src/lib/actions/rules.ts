"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, entries, recurringRules } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { fieldErrors, ruleSchema } from "@/lib/validation";
import { ensureMaterialized } from "@/lib/queries/rules";
import { currentPeriod } from "@/lib/dates";
import { fail, type ActionResult } from "./types";

function refresh() {
  revalidatePath("/", "layout");
}

async function assertCreditCategory(userId: string, categoryId: string) {
  const [cat] = await db
    .select({ kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  if (!cat) return "Pick a category";
  if (cat.kind !== "credit") return "Fixed payments need a credit category";
  return null;
}

export async function createRule(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = ruleSchema.safeParse(raw);
  if (!parsed.success) return fail("Check the highlighted fields", fieldErrors(parsed.error));
  const input = parsed.data;

  const catError = await assertCreditCategory(user.id, input.categoryId);
  if (catError) return fail(catError, { categoryId: catError });

  const [row] = await db
    .insert(recurringRules)
    .values({
      userId: user.id,
      title: input.title,
      amount: input.amount,
      categoryId: input.categoryId,
      dayOfMonth: input.dayOfMonth,
      note: input.note || null,
    })
    .returning({ id: recurringRules.id });

  await ensureMaterialized(user.id, currentPeriod());
  refresh();
  return { ok: true, data: { id: row.id } };
}

export async function updateRule(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = ruleSchema.safeParse(raw);
  if (!parsed.success) return fail("Check the highlighted fields", fieldErrors(parsed.error));
  const input = parsed.data;

  const catError = await assertCreditCategory(user.id, input.categoryId);
  if (catError) return fail(catError, { categoryId: catError });

  await db
    .update(recurringRules)
    .set({
      title: input.title,
      amount: input.amount,
      categoryId: input.categoryId,
      dayOfMonth: input.dayOfMonth,
      note: input.note || null,
    })
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)));

  // Keep this month's unpaid instance in sync with the rule.
  await db
    .update(entries)
    .set({
      title: input.title,
      amount: input.amount,
      categoryId: input.categoryId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(entries.ruleId, id),
        eq(entries.userId, user.id),
        eq(entries.period, currentPeriod()),
        eq(entries.status, "pending"),
      ),
    );

  refresh();
  return { ok: true };
}

export async function setRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireUser();
  await db
    .update(recurringRules)
    .set({ isActive: active })
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)));

  if (!active) {
    // Drop this month's instance if it has not been paid yet.
    await db
      .delete(entries)
      .where(
        and(
          eq(entries.ruleId, id),
          eq(entries.userId, user.id),
          eq(entries.period, currentPeriod()),
          eq(entries.status, "pending"),
        ),
      );
  } else {
    await ensureMaterialized(user.id, currentPeriod());
  }

  refresh();
  return { ok: true };
}

/** Deletes the rule. Paid history is kept; unpaid instances are removed. */
export async function deleteRule(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await db
    .delete(entries)
    .where(and(eq(entries.ruleId, id), eq(entries.userId, user.id), eq(entries.status, "pending")));
  await db
    .delete(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)));
  refresh();
  return { ok: true };
}
