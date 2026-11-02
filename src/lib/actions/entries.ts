"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { STATUSES, type Status } from "@/lib/config/buckets";
import { todayISO } from "@/lib/dates";
import {
  changeEntryStatus,
  createEntryRecord,
  editEntryRecord,
  removeEntry,
  toActionFailure,
  type CreatedEntry,
  type MutationFailure,
} from "@/lib/fixed/mutations";
import { entrySchema, entryUpdateSchema, fieldErrors } from "@/lib/validation";
import { fail, type ActionResult } from "./types";

const statusSchema = z.enum(STATUSES);
const statusChangeSchema = z.object({ id: z.string().uuid(), status: statusSchema, expectedStatus: statusSchema });
const entryDeleteSchema = z.object({ id: z.string().uuid(), expectedStatus: statusSchema.optional() });
const entryEditSchema = entryUpdateSchema.extend({ expectedStatus: statusSchema.optional() });

function refresh() {
  revalidatePath("/", "layout");
}

/** A stale tab gets fresh data along with the error. */
function failed(failure: MutationFailure) {
  if (failure.errorKey === "server.billChanged") refresh();
  return toActionFailure(failure);
}

/** A future-dated Due bill returns `id: null`: only its rule exists until that month starts. */
export async function createEntry(raw: unknown): Promise<ActionResult<CreatedEntry>> {
  const user = await requireUser();
  const t = await getTranslations("server");
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) return fail(t("checkFields"), fieldErrors(parsed.error));

  const result = await createEntryRecord(user.id, parsed.data, todayISO());
  if (!result.ok) return toActionFailure(result);

  refresh();
  return { ok: true, data: result.data };
}

export async function updateEntry(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const t = await getTranslations("server");
  const parsed = entryEditSchema.safeParse(raw);
  if (!parsed.success) return fail(t("checkFields"), fieldErrors(parsed.error));

  const result = await editEntryRecord(user.id, parsed.data, todayISO());
  if (!result.ok) return failed(result);

  refresh();
  return { ok: true };
}

/**
 * Moves an entry along its lifecycle, only if it is still in `expectedStatus`, so a
 * stale tab cannot reopen a bill that paid itself. `shortBy` is how far the savings
 * exceed the balance after moving a bill to savings.
 */
export async function setEntryStatus(
  id: string,
  status: Status,
  expectedStatus: Status,
): Promise<ActionResult<{ shortBy: number }>> {
  const user = await requireUser();
  const t = await getTranslations("server");
  const parsed = statusChangeSchema.safeParse({ id, status, expectedStatus });
  if (!parsed.success) return fail(t("checkFields"));

  const result = await changeEntryStatus(
    user.id,
    parsed.data.id,
    parsed.data.status,
    parsed.data.expectedStatus,
    todayISO(),
  );
  if (!result.ok) return failed(result);

  refresh();
  return { ok: true, data: result.data };
}

/** On an open monthly bill this is "Skip {month}": the month is remembered and not placed again. */
export async function deleteEntry(id: string, expectedStatus?: Status): Promise<ActionResult> {
  const user = await requireUser();
  const t = await getTranslations("server");
  const parsed = entryDeleteSchema.safeParse({ id, expectedStatus });
  if (!parsed.success) return fail(t("checkFields"));

  const result = await removeEntry(user.id, parsed.data.id, parsed.data.expectedStatus);
  if (!result.ok) return failed(result);

  refresh();
  return { ok: true };
}
