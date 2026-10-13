"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/current-user";
import { fieldErrors, settingsSchema } from "@/lib/validation";
import { BUCKETS, type Bucket } from "@/lib/config/buckets";
import { fail, type ActionResult } from "./types";

export async function updateSettings(raw: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return fail("Check the highlighted fields", fieldErrors(parsed.error));
  const s = parsed.data;

  // Make sure the locale is something Intl understands before saving it.
  try {
    new Intl.NumberFormat(s.locale);
  } catch {
    return fail("Unknown locale", { locale: "Use a code like en-US, fr-FR or ar-MA" });
  }

  await db
    .update(users)
    .set({
      settings: {
        ...user.settings,
        currency: s.currency,
        locale: s.locale,
        theme: s.theme,
        labels: { ...user.settings.labels, debit: s.debitLabel, credit: s.creditLabel },
      },
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setTheme(theme: "light" | "dark" | "system"): Promise<ActionResult> {
  const user = await requireUser();
  if (!["light", "dark", "system"].includes(theme)) return fail("Unknown theme");
  await db
    .update(users)
    .set({ settings: { ...user.settings, theme }, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateBucketLabels(raw: Record<string, string>): Promise<ActionResult> {
  const user = await requireUser();
  const buckets: Partial<Record<Bucket, string>> = {};
  for (const b of BUCKETS) {
    const v = (raw[b] ?? "").trim().slice(0, 32);
    if (v) buckets[b] = v;
  }
  await db
    .update(users)
    .set({
      settings: { ...user.settings, labels: { ...user.settings.labels, buckets } },
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
