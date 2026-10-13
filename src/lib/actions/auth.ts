"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { seedDefaultCategories } from "@/lib/auth/onboarding";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { encryptSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  changePasswordSchema,
  fieldErrors,
  loginSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type AuthState = {
  error?: string;
  fields?: Record<string, string>;
  /** Non-secret values echoed back so the form keeps them after a failed submit. */
  values?: Record<string, string>;
  success?: boolean;
};

function echo(formData: FormData, ...keys: string[]) {
  const values: Record<string, string> = {};
  for (const k of keys) values[k] = String(formData.get(k) ?? "");
  return values;
}

/** Set DISABLE_REGISTRATION=true in the environment to close sign-ups. */
export async function isRegistrationOpen() {
  return process.env.DISABLE_REGISTRATION !== "true";
}

async function issueSession(user: { id: string; name: string }) {
  const token = await encryptSession({ userId: user.id, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}

async function pause(ms = 400) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await isRegistrationOpen())) return { error: "Registration is closed on this instance." };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  const values = echo(formData, "name", "email");
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  const { name, email, password } = parsed.data;

  const taken = { fields: { email: "An account with this email already exists. Try signing in." }, values };
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return taken;

  let created: { id: string; name: string } | undefined;
  try {
    [created] = await db
      .insert(users)
      .values({ name, email, passwordHash: await hashPassword(password), settings: {} })
      .returning({ id: users.id, name: users.name });
  } catch (err) {
    // Unique violation if two sign-ups race on the same email.
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) return taken;
    throw err;
  }
  if (!created) return { error: "Could not create the account. Please try again.", values };

  await seedDefaultCategories(created.id);
  await issueSession(created);
  redirect("/dashboard?welcome=1");
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const values = echo(formData, "email");
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  const valid = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !valid) {
    // Constant small delay softens brute-force attempts and hides whether the email exists.
    await pause();
    return { error: "Wrong email or password.", values };
  }

  await issueSession(user);
  redirect("/dashboard");
}

export async function updateProfile(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const parsed = profileSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { name, email } = parsed.data;

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, current.id)))
    .limit(1);
  if (taken) return { fields: { email: "That email is already used by another account." } };

  await db.update(users).set({ name, email, updatedAt: new Date() }).where(eq(users.id, current.id));
  await issueSession({ id: current.id, name });
  revalidatePath("/", "layout");
  return { success: true };
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
  if (!valid) {
    await pause();
    return { fields: { currentPassword: "Current password is incorrect" } };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: sql`now()` })
    .where(eq(users.id, current.id));

  return { success: true };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
