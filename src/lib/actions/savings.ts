"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { todayISO } from "@/lib/dates";
import { markAutoPaidSeen, moveBillsToSavings, toActionFailure } from "@/lib/fixed/mutations";
import type { ActionResult } from "./types";

function refresh() {
  revalidatePath("/", "layout");
}

/** `shortBy` is how far the savings exceed the balance afterwards. */
export async function moveAllToSavings(): Promise<ActionResult<{ count: number; total: number; shortBy: number }>> {
  const user = await requireUser();
  const result = await moveBillsToSavings(user.id, todayISO());
  if (!result.ok) return toActionFailure(result);
  refresh();
  return { ok: true, data: result.data };
}

/** [Got it] on the auto-pay banner. */
export async function acknowledgeAutoPaid(): Promise<ActionResult> {
  const user = await requireUser();
  await markAutoPaidSeen(user.id);
  refresh();
  return { ok: true };
}
