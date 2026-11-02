"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { isValidPeriod, todayISO } from "@/lib/dates";
import {
  bringBackPeriod,
  editRule,
  keepAdoptedRule,
  makeEntryMonthly,
  pauseRule,
  removeRule,
  resumeRule,
  toActionFailure,
  type MutationResult,
} from "@/lib/fixed/mutations";
import { fieldErrors, ruleSchema } from "@/lib/validation";
import { fail, type ActionResult } from "./types";

const idSchema = z.string().uuid();

function refresh() {
  revalidatePath("/", "layout");
}

async function finish(result: MutationResult): Promise<ActionResult> {
  // A stale tab gets fresh data along with the error.
  if (result.ok || result.errorKey === "server.billChanged") refresh();
  return result.ok ? { ok: true } : toActionFailure(result);
}

async function invalidInput() {
  const t = await getTranslations("server");
  return fail(t("checkFields"));
}

export async function updateRule(id: string, raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalidInput();
  const parsed = ruleSchema.safeParse(raw);
  if (!parsed.success) {
    const t = await getTranslations("server");
    return fail(t("checkFields"), fieldErrors(parsed.error));
  }
  return finish(await editRule(user.id, parsedId.data, parsed.data, todayISO()));
}

/** Pausing removes bills that have not ended and keeps past-cycle ones Due. Resuming restarts from this month. */
export async function setRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalidInput();
  const change = active ? resumeRule : pauseRule;
  return finish(await change(user.id, parsedId.data, todayISO()));
}

/** Open bills go with the rule; paid history stays. */
export async function deleteRule(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalidInput();
  return finish(await removeRule(user.id, parsedId.data));
}

/** "Bring back" a skipped month. */
export async function unskipRulePeriod(ruleId: string, period: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(ruleId);
  if (!parsedId.success || !isValidPeriod(period)) return invalidInput();
  return finish(await bringBackPeriod(user.id, parsedId.data, period, todayISO()));
}

/** "Make this monthly" on a history row. */
export async function makeMonthly(entryId: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(entryId);
  if (!parsedId.success) return invalidInput();
  return finish(await makeEntryMonthly(user.id, parsedId.data, todayISO()));
}

/** [Keep] on the one-time adoption notice. */
export async function acknowledgeAdoption(ruleId: string): Promise<ActionResult> {
  const user = await requireUser();
  const parsedId = idSchema.safeParse(ruleId);
  if (!parsedId.success) return invalidInput();
  await keepAdoptedRule(user.id, parsedId.data);
  refresh();
  return { ok: true };
}
