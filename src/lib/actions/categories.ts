"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, entries } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { categorySchema, fieldErrors } from "@/lib/validation";
import { fail, type ActionResult } from "./types";

function refresh() {
  revalidatePath("/", "layout");
}

export async function createCategory(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return fail("Check the highlighted fields", fieldErrors(parsed.error));
  const input = parsed.data;

  const [{ value: last }] = await db
    .select({ value: max(categories.sortOrder) })
    .from(categories)
    .where(and(eq(categories.userId, user.id), eq(categories.kind, input.kind)));

  const [row] = await db
    .insert(categories)
    .values({ ...input, userId: user.id, sortOrder: (last ?? 0) + 1 })
    .returning({ id: categories.id });

  refresh();
  return { ok: true, data: { id: row.id } };
}

export async function updateCategory(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = categorySchema.omit({ kind: true }).safeParse(raw);
  if (!parsed.success) return fail("Check the highlighted fields", fieldErrors(parsed.error));

  await db
    .update(categories)
    .set(parsed.data)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

  refresh();
  return { ok: true };
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<ActionResult> {
  const user = await requireUser();
  await db
    .update(categories)
    .set({ isArchived: archived })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  refresh();
  return { ok: true };
}

/** Deletes a category. Its entries are kept and become "Uncategorized". */
export async function deleteCategory(id: string): Promise<ActionResult<{ orphaned: number }>> {
  const user = await requireUser();
  const [{ value }] = await db
    .select({ value: count() })
    .from(entries)
    .where(and(eq(entries.categoryId, id), eq(entries.userId, user.id)));

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  refresh();
  return { ok: true, data: { orphaned: Number(value) } };
}
