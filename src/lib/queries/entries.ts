import "server-only";
import { and, desc, eq, gte, ilike, isNull, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { entries, type Category, type Entry } from "@/lib/db/schema";
import type { Bucket, Kind, Status } from "@/lib/config/buckets";

export type EntryWithCategory = Entry & { category: Category | null; rule?: { dayOfMonth: number } | null };

/** What a row needs next to the entry. The rule's day decides when a bill is late, since short months clamp its date. */
export const ENTRY_RELATIONS = { category: true, rule: { columns: { dayOfMonth: true } } } as const;

export type EntryFilter = {
  kind?: Kind;
  bucket?: Bucket;
  status?: Status;
  categoryId?: string;
  from?: string;
  to?: string;
  search?: string;
  /** Only entries that do not belong to a monthly rule. */
  nonRule?: boolean;
  limit?: number;
};

export async function listEntries(userId: string, f: EntryFilter = {}): Promise<EntryWithCategory[]> {
  const conds: SQL[] = [eq(entries.userId, userId)];
  if (f.kind) conds.push(eq(entries.kind, f.kind));
  if (f.bucket) conds.push(eq(entries.bucket, f.bucket));
  if (f.status) conds.push(eq(entries.status, f.status));
  if (f.categoryId) conds.push(eq(entries.categoryId, f.categoryId));
  if (f.from) conds.push(gte(entries.date, f.from));
  if (f.to) conds.push(lte(entries.date, f.to));
  if (f.nonRule) conds.push(isNull(entries.ruleId));
  if (f.search) {
    const q = `%${f.search.trim()}%`;
    const s = or(ilike(entries.title, q), ilike(entries.note, q));
    if (s) conds.push(s);
  }

  return db.query.entries.findMany({
    where: and(...conds),
    with: ENTRY_RELATIONS,
    orderBy: [desc(entries.date), desc(entries.createdAt)],
    limit: f.limit ?? 200,
  });
}

export async function getEntry(userId: string, id: string): Promise<EntryWithCategory | null> {
  const row = await db.query.entries.findFirst({
    where: and(eq(entries.id, id), eq(entries.userId, userId)),
    with: ENTRY_RELATIONS,
  });
  return row ?? null;
}
