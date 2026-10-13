import "server-only";
import { randomInt } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { safeEqual, sha256 } from "./crypto";

export const TOTP_ISSUER = "Ledger";
const PERIOD = 30;
const DIGITS = 6;

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totpFor(secretBase32: string, label: string) {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: "SHA1", // what authenticator apps universally support
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function otpauthUrl(secretBase32: string, label: string) {
  return totpFor(secretBase32, label).toString();
}

export async function qrDataUrl(url: string) {
  return QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: "M" });
}

export function currentStep() {
  return Math.floor(Date.now() / 1000 / PERIOD);
}

/**
 * Validates a 6-digit code with one period of clock drift either way and
 * refuses any code at or before the last accepted step (replay protection).
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  lastStep: number | null | undefined,
): { ok: true; step: number } | { ok: false } {
  const clean = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false };
  const delta = totpFor(secretBase32, "x").validate({ token: clean, window: 1 });
  if (delta === null) return { ok: false };
  const step = currentStep() + delta;
  if (lastStep != null && step <= lastStep) return { ok: false };
  return { ok: true, step };
}

// Unambiguous alphabet (no 0/O, 1/I/L) for codes people have to type.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw = "";
    for (let j = 0; j < 10; j++) raw += ALPHABET[randomInt(ALPHABET.length)];
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Codes are high-entropy (50 bits), so a plain SHA-256 is adequate. */
export function hashRecoveryCode(code: string) {
  return sha256(normalizeRecoveryCode(code));
}

export function recoveryCodeMatches(code: string, hash: string) {
  return safeEqual(hashRecoveryCode(code), hash);
}
