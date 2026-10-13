import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Key material for encrypting data at rest (2FA secrets) and for keyed hashes.
 * Prefers DATA_ENCRYPTION_KEY so AUTH_SECRET can be rotated (logging everyone out)
 * without breaking stored secrets. Falls back to AUTH_SECRET.
 */
function masterSecret() {
  const s = process.env.DATA_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET (or DATA_ENCRYPTION_KEY) must be at least 32 characters.");
  }
  return s;
}

function deriveKey(info: string, length = 32) {
  return Buffer.from(hkdfSync("sha256", masterSecret(), "ledger-v1", info, length));
}

/** AES-256-GCM. Output: v1.<iv>.<ciphertext>.<tag>, all base64url. */
export function encryptSecret(plain: string): string {
  const key = deriveKey("secret-encryption");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), enc.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const [v, ivB, dataB, tagB] = payload.split(".");
  if (v !== "v1" || !ivB || !dataB || !tagB) return null;
  try {
    const key = deriveKey("secret-encryption");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** Keyed hash for identifiers (emails, IPs) used as rate-limit keys. Not reversible. */
export function hashIdentifier(value: string): string {
  return createHmac("sha256", deriveKey("identifier-hash")).update(value).digest("base64url");
}

/** Plain SHA-256 for high-entropy tokens such as recovery codes. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
