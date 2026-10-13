"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { recoveryCodes, users } from "@/lib/db/schema";
import { seedDefaultCategories } from "@/lib/auth/onboarding";
import { hashPassword, verifyPassword, verifyPasswordOrBurn } from "@/lib/auth/password";
import {
  decryptTwoFactorChallenge,
  encryptSession,
  encryptTwoFactorChallenge,
  SESSION_COOKIE,
  sessionCookieOptions,
  TWO_FACTOR_COOKIE,
  twoFactorCookieOptions,
} from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isRegistrationOpen } from "@/lib/security/policy";
import { getClientInfo } from "@/lib/security/request";
import { hit, POLICIES, rateKey, reset, retryMessage } from "@/lib/security/rate-limit";
import { recordAuthEvent } from "@/lib/security/audit";
import { passwordWeakness } from "@/lib/security/passwords";
import { decryptSecret } from "@/lib/security/crypto";
import { recoveryCodeMatches, verifyTotp } from "@/lib/security/totp";
import {
  changePasswordSchema,
  fieldErrors,
  loginSchema,
  profileSchema,
  registerSchema,
  twoFactorCodeSchema,
} from "@/lib/validation";

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

async function issueSession(user: { id: string; name: string; sessionVersion: number }) {
  const token = await encryptSession({ userId: user.id, name: user.name, sv: user.sessionVersion });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  store.delete(TWO_FACTOR_COOKIE);
}

async function pause(ms = 300) {
  await new Promise((r) => setTimeout(r, ms));
}

/* ------------------------------------------------------------------ register */

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isRegistrationOpen()) return { error: "Registration is closed on this instance." };
  const client = await getClientInfo();
  const values = echo(formData, "name", "email");

  // Honeypot: real people never see or fill this field.
  if (String(formData.get("website") ?? "").length > 0) {
    await pause(800);
    return { error: "Could not create the account. Please try again.", values };
  }

  const limit = await hit(rateKey("register:ip", client.ip), POLICIES.registerIp);
  if (!limit.allowed) return { error: retryMessage(limit.retryAfterSec), values };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  const { name, email, password } = parsed.data;

  const weak = passwordWeakness(password, { email, name });
  if (weak) return { fields: { password: weak }, values };

  const taken = { fields: { email: "An account with this email already exists. Try signing in." }, values };
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return taken;

  let created: { id: string; name: string; sessionVersion: number } | undefined;
  try {
    [created] = await db
      .insert(users)
      .values({ name, email, passwordHash: await hashPassword(password), settings: {} })
      .returning({ id: users.id, name: users.name, sessionVersion: users.sessionVersion });
  } catch (err) {
    // Unique violation if two sign-ups race on the same email.
    if (err instanceof Error && /unique|duplicate/i.test(err.message)) return taken;
    throw err;
  }
  if (!created) return { error: "Could not create the account. Please try again.", values };

  await seedDefaultCategories(created.id);
  await recordAuthEvent("register", client, { userId: created.id });
  await issueSession(created);
  redirect("/dashboard?welcome=1");
}

/* --------------------------------------------------------------------- login */

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const client = await getClientInfo();
  const values = echo(formData, "email");

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  const { email, password } = parsed.data;

  // Per-address and per-account throttles. The account key is hashed from the
  // email whether or not it exists, so lockouts reveal nothing about accounts.
  const ipKey = rateKey("login:ip", client.ip);
  const emailKey = rateKey("login:email", email);
  const [ipLimit, emailLimit] = await Promise.all([
    hit(ipKey, POLICIES.loginIp),
    hit(emailKey, POLICIES.loginEmail),
  ]);
  const blocked = !ipLimit.allowed ? ipLimit : !emailLimit.allowed ? emailLimit : null;
  if (blocked && !blocked.allowed) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    await recordAuthEvent("login_locked", client, { userId: u?.id ?? null });
    return { error: retryMessage(blocked.retryAfterSec), values };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = await verifyPasswordOrBurn(password, user?.passwordHash);
  if (!user || !valid) {
    await recordAuthEvent("login_failed", client, { userId: user?.id ?? null });
    return { error: "Wrong email or password.", values };
  }

  if (user.totpEnabled) {
    // Password accepted; park the login until the code is verified.
    const token = await encryptTwoFactorChallenge(user.id);
    (await cookies()).set(TWO_FACTOR_COOKIE, token, twoFactorCookieOptions());
    redirect("/login/verify");
  }

  await Promise.all([reset(emailKey), recordAuthEvent("login_success", client, { userId: user.id })]);
  await issueSession(user);
  redirect("/dashboard");
}

/* ----------------------------------------------------------- 2fa at login */

export async function verifyTwoFactor(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const client = await getClientInfo();
  const store = await cookies();
  const challenge = await decryptTwoFactorChallenge(store.get(TWO_FACTOR_COOKIE)?.value);
  if (!challenge) return { error: "This sign-in attempt expired. Start again." };

  const limit = await hit(rateKey("2fa:user", challenge.userId), POLICIES.twoFactor);
  if (!limit.allowed) {
    await recordAuthEvent("login_locked", client, { userId: challenge.userId, detail: "two-factor" });
    return { error: retryMessage(limit.retryAfterSec) };
  }

  const parsed = twoFactorCodeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const code = parsed.data.code;

  const [user] = await db.select().from(users).where(eq(users.id, challenge.userId)).limit(1);
  if (!user) return { error: "This sign-in attempt expired. Start again." };

  let accepted = false;
  let usedRecovery = false;

  if (/^\d{6}$/.test(code.replace(/\s+/g, ""))) {
    const secret = user.totpEnabled ? decryptSecret(user.totpSecretEnc) : null;
    if (secret) {
      const result = verifyTotp(secret, code, user.totpLastStep);
      if (result.ok) {
        accepted = true;
        await db.update(users).set({ totpLastStep: result.step }).where(eq(users.id, user.id));
      }
    }
  } else {
    const codes = await db
      .select()
      .from(recoveryCodes)
      .where(and(eq(recoveryCodes.userId, user.id), isNull(recoveryCodes.usedAt)));
    const match = codes.find((c) => recoveryCodeMatches(code, c.codeHash));
    if (match) {
      accepted = true;
      usedRecovery = true;
      await db.update(recoveryCodes).set({ usedAt: new Date() }).where(eq(recoveryCodes.id, match.id));
    }
  }

  if (!accepted) {
    await recordAuthEvent("two_factor_failed", client, { userId: user.id });
    return { fields: { code: "That code is not valid." } };
  }

  await Promise.all([
    reset(rateKey("2fa:user", user.id)),
    reset(rateKey("login:email", user.email)),
    recordAuthEvent(usedRecovery ? "recovery_code_used" : "login_success", client, { userId: user.id }),
  ]);
  await issueSession(user);
  redirect(usedRecovery ? "/settings?recovery=1" : "/dashboard");
}

/* ------------------------------------------------------------------ profile */

export async function updateProfile(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const client = await getClientInfo();

  const parsed = profileSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { name, email } = parsed.data;
  const emailChanged = email !== current.email;

  if (emailChanged) {
    // Changing the sign-in identity needs the password, so a hijacked tab cannot lock you out.
    const limit = await hit(rateKey("password:user", current.id), POLICIES.password);
    if (!limit.allowed) return { error: retryMessage(limit.retryAfterSec) };

    const [row] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
    const ok = row ? await verifyPassword(String(formData.get("currentPassword") ?? ""), row.passwordHash) : false;
    if (!ok) return { fields: { currentPassword: "Enter your current password to change the email." } };

    const [takenRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, current.id)))
      .limit(1);
    if (takenRow) return { fields: { email: "That email is already used by another account." } };
  }

  const [updated] = await db
    .update(users)
    .set({
      name,
      email,
      // New identity = new session version, so other devices must sign in again.
      sessionVersion: emailChanged ? sql`${users.sessionVersion} + 1` : undefined,
      updatedAt: new Date(),
    })
    .where(eq(users.id, current.id))
    .returning({ id: users.id, name: users.name, sessionVersion: users.sessionVersion });

  if (emailChanged) await recordAuthEvent("email_changed", client, { userId: current.id });
  await issueSession(updated);
  revalidatePath("/", "layout");
  return { success: true };
}

/* ----------------------------------------------------------------- password */

export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const client = await getClientInfo();

  const limit = await hit(rateKey("password:user", current.id), POLICIES.password);
  if (!limit.allowed) return { error: retryMessage(limit.retryAfterSec) };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const weak = passwordWeakness(parsed.data.newPassword, { email: current.email, name: current.name });
  if (weak) return { fields: { newPassword: weak } };

  const [row] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  if (!row) redirect("/login");

  const valid = await verifyPassword(parsed.data.currentPassword, row.passwordHash);
  if (!valid) return { fields: { currentPassword: "Current password is incorrect" } };

  const [updated] = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.newPassword),
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, current.id))
    .returning({ id: users.id, name: users.name, sessionVersion: users.sessionVersion });

  await Promise.all([
    reset(rateKey("password:user", current.id)),
    recordAuthEvent("password_changed", client, { userId: current.id }),
  ]);
  // Keep this device signed in; every other session is now invalid.
  await issueSession(updated);
  return { success: true };
}

/* ------------------------------------------------------------------ sessions */

export async function revokeOtherSessions(): Promise<AuthState> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const client = await getClientInfo();

  const [updated] = await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() })
    .where(eq(users.id, current.id))
    .returning({ id: users.id, name: users.name, sessionVersion: users.sessionVersion });

  await recordAuthEvent("sessions_revoked", client, { userId: current.id });
  await issueSession(updated);
  revalidatePath("/settings");
  return { success: true };
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(TWO_FACTOR_COOKIE);
  redirect("/login");
}

export async function cancelTwoFactorLogin() {
  (await cookies()).delete(TWO_FACTOR_COOKIE);
  redirect("/login");
}
