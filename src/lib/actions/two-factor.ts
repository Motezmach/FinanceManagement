"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recoveryCodes, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { verifyPassword } from "@/lib/auth/password";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { getClientInfo } from "@/lib/security/request";
import { hit, POLICIES, rateKey, reset, retryMessage } from "@/lib/security/rate-limit";
import { recordAuthEvent } from "@/lib/security/audit";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUrl,
  qrDataUrl,
  verifyTotp,
} from "@/lib/security/totp";
import { fail, type ActionResult } from "./types";

async function replaceRecoveryCodes(userId: string) {
  const codes = generateRecoveryCodes(8);
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  await db.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })));
  return codes;
}

/** Step 1: create a pending secret and return what the authenticator app needs. */
export async function beginTwoFactorSetup(): Promise<ActionResult<{ qr: string; secret: string; url: string }>> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.totpEnabled) return fail("Two-factor authentication is already on.");

  const secret = generateTotpSecret();
  await db.update(users).set({ totpPendingSecretEnc: encryptSecret(secret) }).where(eq(users.id, user.id));

  const url = otpauthUrl(secret, user.email);
  return { ok: true, data: { qr: await qrDataUrl(url), secret, url } };
}

/** Step 2: prove the app is set up by entering a current code. Returns one-time recovery codes. */
export async function confirmTwoFactorSetup(code: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const client = await getClientInfo();

  const limit = await hit(rateKey("2fa:setup", user.id), POLICIES.twoFactor);
  if (!limit.allowed) return fail(retryMessage(limit.retryAfterSec));

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const secret = decryptSecret(row?.totpPendingSecretEnc);
  if (!secret) return fail("Start the setup again.");

  const result = verifyTotp(secret, String(code ?? ""), null);
  if (!result.ok) return fail("That code is not valid. Check the time on your phone and try again.", { code: "Invalid code" });

  await db
    .update(users)
    .set({
      totpEnabled: true,
      totpSecretEnc: row!.totpPendingSecretEnc,
      totpPendingSecretEnc: null,
      totpLastStep: result.step,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  const codes = await replaceRecoveryCodes(user.id);
  await Promise.all([reset(rateKey("2fa:setup", user.id)), recordAuthEvent("two_factor_enabled", client, { userId: user.id })]);
  revalidatePath("/settings");
  return { ok: true, data: { recoveryCodes: codes } };
}

/** Turning 2FA off needs the password and a current code (or a recovery code is not accepted here). */
export async function disableTwoFactor(password: string, code: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const client = await getClientInfo();

  const limit = await hit(rateKey("password:user", user.id), POLICIES.password);
  if (!limit.allowed) return fail(retryMessage(limit.retryAfterSec));

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !row.totpEnabled) return fail("Two-factor authentication is not on.");

  const ok = await verifyPassword(String(password ?? ""), row.passwordHash);
  if (!ok) return fail("Wrong password.", { password: "Wrong password" });

  const secret = decryptSecret(row.totpSecretEnc);
  const result = secret ? verifyTotp(secret, String(code ?? ""), row.totpLastStep) : { ok: false as const };
  if (!result.ok) return fail("That code is not valid.", { code: "Invalid code" });

  await db
    .update(users)
    .set({ totpEnabled: false, totpSecretEnc: null, totpPendingSecretEnc: null, totpLastStep: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, user.id));

  await Promise.all([reset(rateKey("password:user", user.id)), recordAuthEvent("two_factor_disabled", client, { userId: user.id })]);
  revalidatePath("/settings");
  return { ok: true };
}

/** Fresh recovery codes; the old ones stop working immediately. */
export async function regenerateRecoveryCodes(password: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const client = await getClientInfo();

  const limit = await hit(rateKey("password:user", user.id), POLICIES.password);
  if (!limit.allowed) return fail(retryMessage(limit.retryAfterSec));

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !row.totpEnabled) return fail("Two-factor authentication is not on.");

  const ok = await verifyPassword(String(password ?? ""), row.passwordHash);
  if (!ok) return fail("Wrong password.", { password: "Wrong password" });

  const codes = await replaceRecoveryCodes(user.id);
  await Promise.all([reset(rateKey("password:user", user.id)), recordAuthEvent("recovery_codes_regenerated", client, { userId: user.id })]);
  revalidatePath("/settings");
  return { ok: true, data: { recoveryCodes: codes } };
}
