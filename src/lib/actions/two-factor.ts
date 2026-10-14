"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recoveryCodes, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { verifyPassword } from "@/lib/auth/password";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { getClientInfo } from "@/lib/security/request";
import { hit, POLICIES, rateKey, reset, retryMinutes } from "@/lib/security/rate-limit";
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
  const t = await getTranslations("server");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.totpEnabled) return fail(t("twoFactorAlreadyOn"));

  const secret = generateTotpSecret();
  await db.update(users).set({ totpPendingSecretEnc: encryptSecret(secret) }).where(eq(users.id, user.id));

  const url = otpauthUrl(secret, user.email);
  return { ok: true, data: { qr: await qrDataUrl(url), secret, url } };
}

/** Step 2: prove the app is set up by entering a current code. Returns one-time recovery codes. */
export async function confirmTwoFactorSetup(code: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  const t = await getTranslations("server");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const client = await getClientInfo();

  const limit = await hit(rateKey("2fa:setup", user.id), POLICIES.twoFactor);
  if (!limit.allowed) return fail(t("tooManyAttempts", { minutes: retryMinutes(limit.retryAfterSec) }));

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const secret = decryptSecret(row?.totpPendingSecretEnc);
  if (!secret) return fail(t("startSetupAgain"));

  const result = verifyTotp(secret, String(code ?? ""), null);
  if (!result.ok) return fail(t("codeInvalidCheckTime"), { code: t("invalidCode") });

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

/** Turning 2FA off needs the password and a current code. */
export async function disableTwoFactor(password: string, code: string): Promise<ActionResult> {
  const t = await getTranslations("server");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const client = await getClientInfo();

  const limit = await hit(rateKey("password:user", user.id), POLICIES.password);
  if (!limit.allowed) return fail(t("tooManyAttempts", { minutes: retryMinutes(limit.retryAfterSec) }));

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !row.totpEnabled) return fail(t("twoFactorNotOn"));

  const ok = await verifyPassword(String(password ?? ""), row.passwordHash);
  if (!ok) return fail(t("wrongPassword"), { password: t("wrongPassword") });

  const secret = decryptSecret(row.totpSecretEnc);
  const result = secret ? verifyTotp(secret, String(code ?? ""), row.totpLastStep) : { ok: false as const };
  if (!result.ok) return fail(t("invalidCode"), { code: t("invalidCode") });

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
  const t = await getTranslations("server");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const client = await getClientInfo();

  const limit = await hit(rateKey("password:user", user.id), POLICIES.password);
  if (!limit.allowed) return fail(t("tooManyAttempts", { minutes: retryMinutes(limit.retryAfterSec) }));

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !row.totpEnabled) return fail(t("twoFactorNotOn"));

  const ok = await verifyPassword(String(password ?? ""), row.passwordHash);
  if (!ok) return fail(t("wrongPassword"), { password: t("wrongPassword") });

  const codes = await replaceRecoveryCodes(user.id);
  await Promise.all([reset(rateKey("password:user", user.id)), recordAuthEvent("recovery_codes_regenerated", client, { userId: user.id })]);
  revalidatePath("/settings");
  return { ok: true, data: { recoveryCodes: codes } };
}
