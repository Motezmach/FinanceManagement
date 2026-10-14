import "server-only";
import { and, eq, lt, or, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { hashIdentifier } from "./crypto";

export type Policy = { max: number; windowSec: number; lockSec: number };

/** Attempts allowed per fixed window, and how long to lock once exceeded. */
export const POLICIES = {
  loginEmail: { max: 10, windowSec: 15 * 60, lockSec: 15 * 60 },
  loginIp: { max: 30, windowSec: 15 * 60, lockSec: 15 * 60 },
  registerIp: { max: 5, windowSec: 60 * 60, lockSec: 60 * 60 },
  twoFactor: { max: 6, windowSec: 10 * 60, lockSec: 10 * 60 },
  password: { max: 5, windowSec: 15 * 60, lockSec: 15 * 60 },
} satisfies Record<string, Policy>;

export type RateResult = { allowed: true } | { allowed: false; retryAfterSec: number };

/** Builds a key that never stores the raw identifier. */
export function rateKey(scope: string, identifier: string) {
  return `${scope}:${hashIdentifier(identifier.toLowerCase())}`;
}

/**
 * Registers one attempt against the key and says whether it may proceed.
 * Survives serverless cold starts because the state lives in Postgres.
 */
export async function hit(key: string, policy: Policy): Promise<RateResult> {
  const windowSec = Math.max(1, Math.floor(policy.windowSec));
  const res = await db.execute(sql`
    INSERT INTO rate_limits (key, count, window_start, locked_until)
    VALUES (${key}, 1, now(), NULL)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.locked_until IS NOT NULL AND rate_limits.locked_until > now() THEN rate_limits.count
        WHEN rate_limits.window_start < now() - (${sql.raw(String(windowSec))} * interval '1 second') THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.locked_until IS NOT NULL AND rate_limits.locked_until > now() THEN rate_limits.window_start
        WHEN rate_limits.window_start < now() - (${sql.raw(String(windowSec))} * interval '1 second') THEN now()
        ELSE rate_limits.window_start
      END,
      locked_until = CASE
        WHEN rate_limits.locked_until IS NOT NULL AND rate_limits.locked_until > now() THEN rate_limits.locked_until
        ELSE NULL
      END
    RETURNING count, locked_until, now() AS server_now
  `);

  const rows = (res as unknown as { rows?: Record<string, unknown>[] }).rows ?? (res as unknown as Record<string, unknown>[]);
  const row = rows[0] ?? {};
  const count = Number(row.count ?? 0);
  const serverNow = row.server_now ? new Date(String(row.server_now)).getTime() : Date.now();
  const lockedUntil = row.locked_until ? new Date(String(row.locked_until)).getTime() : null;

  if (lockedUntil && lockedUntil > serverNow) {
    return { allowed: false, retryAfterSec: Math.ceil((lockedUntil - serverNow) / 1000) };
  }
  if (count > policy.max) {
    await db
      .update(rateLimits)
      .set({ lockedUntil: sql`now() + (${sql.raw(String(Math.floor(policy.lockSec)))} * interval '1 second')` })
      .where(eq(rateLimits.key, key));
    return { allowed: false, retryAfterSec: policy.lockSec };
  }

  // Opportunistic cleanup of stale counters.
  if (Math.random() < 0.02) {
    await db
      .delete(rateLimits)
      .where(
        and(
          lt(rateLimits.windowStart, sql`now() - interval '1 day'`),
          or(isNull(rateLimits.lockedUntil), lt(rateLimits.lockedUntil, sql`now()`)),
        ),
      );
  }
  return { allowed: true };
}

/** Clears a counter, e.g. after a successful sign-in. */
export async function reset(key: string) {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Whole minutes to wait, never less than one; the caller translates the sentence. */
export function retryMinutes(retryAfterSec: number) {
  return Math.max(1, Math.ceil(retryAfterSec / 60));
}
