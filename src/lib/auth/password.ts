import "server-only";
import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";

// 2^12 rounds: ~250ms on a typical serverless CPU, the usual 2025+ recommendation.
const ROUNDS = 12;

/**
 * Optional server-side pepper: with PASSWORD_PEPPER set, a leaked database alone
 * is not enough to crack passwords offline. Changing the pepper invalidates
 * every stored hash, so treat it like a key, not a config value.
 */
function prepare(plain: string) {
  const pepper = process.env.PASSWORD_PEPPER;
  if (!pepper) return plain;
  return createHmac("sha256", pepper).update(plain).digest("base64");
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(prepare(plain), ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(prepare(plain), hash);
}

let dummyHash: Promise<string> | null = null;

/**
 * Verifies against a stored hash, or burns the same amount of time against a
 * throwaway hash when there is no account. Unknown emails and wrong passwords
 * then take equally long, so timing reveals nothing.
 */
export async function verifyPasswordOrBurn(plain: string, hash: string | null | undefined) {
  if (hash) return verifyPassword(plain, hash);
  dummyHash ??= bcrypt.hash("ledger-timing-equalizer", ROUNDS);
  await bcrypt.compare(prepare(plain), await dummyHash);
  return false;
}
