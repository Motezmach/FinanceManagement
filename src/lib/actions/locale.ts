"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/locales";
import { fail, type ActionResult } from "./types";

/**
 * Switches the UI language. Always remembered in a cookie (so the sign-in
 * pages follow it); also saved on the account when signed in.
 */
export async function setLanguage(raw: string): Promise<ActionResult> {
  if (!isLocale(raw)) return fail("Unknown language");

  (await cookies()).set(LOCALE_COOKIE, raw, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 365 * 24 * 60 * 60,
  });

  const user = await getCurrentUser();
  if (user) {
    await db
      .update(users)
      .set({ settings: { ...user.settings, language: raw }, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
