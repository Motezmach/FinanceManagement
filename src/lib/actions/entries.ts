"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, entries } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { entrySchema, entryUpdateSchema, fieldErrors } from "@/lib/validation";
import { BUCKET_META, debitBucketForStatus, type Status } from "@/lib/config/buckets";
import { todayISO } from "@/lib/dates";
import { fail, type ActionResult } from "./types";

function refresh() {
  revalidatePath("/", "layout");
}

async function assertCategory(userId: string, categoryId: string, kind: "debit" | "credit") {
  const [cat] = await db
    .select({ id: categories.id, kind: categories.kind })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  if (!cat) return "Pick a category";
  if (cat.kind !== kind) return "That category belongs to the other side of the ledger";
  return null;
}

export async function createEntry(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) return fail("Check the highlighted fields", fieldErrors(parsed.error));
  const input = parsed.data;

  if (BUCKET_META[input.bucket].kind !== input.kind) return fail("Bucket does not match the kind");
  const catError = await assertCategory(user.id, input.categoryId, input.kind);
  if (catError) return fail(catError, { categoryId: catError });

  const [row] = await db
    .insert(entries)
    .values({
      userId: user.id,
      kind: input.kind,
      bucket: input.kind === "debit" ? debitBucketForStatus(input.status) : input.bucket,
      status: input.status,
      amount: input.amount,
      title: input.title,
      note: input.note || null,
      date: input.date,
      categoryId: input.categoryId,
    })
    .returning({ id: entries.id });

  refresh();
  return { ok: true, data: { id: row.id } };
}

export async function updateEntry(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = entryUpdateSchema.safeParse(raw);
  if (!parsed.success) return fail("Check the highlighted fields", fieldErrors(parsed.error));
  const { id, ...patch } = parsed.data;

  const [existing] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, user.id)))
    .limit(1);
  if (!existing) return fail("Entry not found");

  const kind = patch.kind ?? existing.kind;
  const status = patch.status ?? existing.status;
  let bucket = patch.bucket ?? existing.bucket;
  if (kind === "debit") bucket = debitBucketForStatus(status);
  if (BUCKET_META[bucket].kind !== kind) return fail("Bucket does not match the kind");

  if (patch.categoryId) {
    const catError = await assertCategory(user.id, patch.categoryId, kind);
    if (catError) return fail(catError, { categoryId: catError });
  }

  await db
    .update(entries)
    .set({
      kind,
      bucket,
      status,
      amount: patch.amount ?? existing.amount,
      title: patch.title ?? existing.title,
      note: patch.note === undefined ? existing.note : patch.note || null,
      date: patch.date ?? existing.date,
      categoryId: patch.categoryId ?? existing.categoryId,
      updatedAt: new Date(),
    })
    .where(eq(entries.id, id));

  refresh();
  return { ok: true };
}

/**
 * Moves an entry along its lifecycle. Settling stamps today's date so the money
 * shows up in the month it actually moved. Debits follow the pipeline
 * potential → pending → wallet.
 */
export async function setEntryStatus(id: string, status: Status): Promise<ActionResult> {
  const user = await requireUser();
  const [existing] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.id, id), eq(entries.userId, user.id)))
    .limit(1);
  if (!existing) return fail("Entry not found");

  const bucket = existing.kind === "debit" ? debitBucketForStatus(status) : existing.bucket;
  const date = status === "settled" && existing.status !== "settled" ? todayISO() : existing.date;

  await db
    .update(entries)
    .set({ status, bucket, date, updatedAt: new Date() })
    .where(eq(entries.id, id));

  refresh();
  return { ok: true };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.delete(entries).where(and(eq(entries.id, id), eq(entries.userId, user.id)));
  refresh();
  return { ok: true };
}
