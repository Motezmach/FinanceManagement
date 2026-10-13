"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ensureBootstrapped } from "@/lib/auth/bootstrap";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { encryptSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current-user";
import { changePasswordSchema, fieldErrors, loginSchema } from "@/lib/validation";

export type AuthState = { error?: string; fields?: Record<string, string>; success?: boolean };

async function issueSession(user: { id: string; username: string; mustChangePassword: boolean }) {
  const token = await encryptSession({
    userId: user.id,
    username: user.username,
    mustChangePassword: user.mustChangePassword,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  await ensureBootstrapped();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .limit(1);

  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    // Small constant delay softens brute-force attempts on a single-user app.
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Wrong username or password." };
  }

  await issueSession(user);
  redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
}

export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const [row] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  if (!row) redirect("/login");

  const valid = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
  if (!valid) return { fields: { currentPassword: "Current password is incorrect" } };

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.newPassword),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, current.id));

  await issueSession({ id: row.id, username: row.username, mustChangePassword: false });

  if (current.mustChangePassword) redirect("/dashboard?welcome=1");
  return { success: true };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
