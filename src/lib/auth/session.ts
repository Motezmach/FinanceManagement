import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const PROD = process.env.NODE_ENV === "production";

// The __Host- prefix forces Secure + Path=/ + no Domain, so a cookie set by a
// sibling subdomain can never override ours. Browsers reject it on plain http,
// hence the plain name in development.
export const SESSION_COOKIE = PROD ? "__Host-ledger_session" : "ledger_session";
export const TWO_FACTOR_COOKIE = PROD ? "__Host-ledger_2fa" : "ledger_2fa";

export const SESSION_DAYS = 14;
/** Re-sign the session cookie when it is older than this (sliding expiry). */
export const SESSION_REFRESH_AFTER_SEC = 6 * 60 * 60;
export const TWO_FACTOR_TTL_SEC = 5 * 60;

export type SessionPayload = {
  userId: string;
  name: string;
  /** Must match users.session_version; bumping it signs out every device. */
  sv: number;
};

export type DecodedSession = SessionPayload & { issuedAt: number };

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters. Generate a long random string.");
  }
  return new TextEncoder().encode(secret);
}

async function sign(payload: JWTPayload, ttlSec: number, audience: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer("ledger")
    .setAudience(audience)
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec)
    .sign(secretKey());
}

async function verify(token: string | undefined | null, audience: string): Promise<JWTPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: "ledger",
      audience,
    });
    return payload;
  } catch {
    return null;
  }
}

export async function encryptSession(payload: SessionPayload) {
  return sign(payload, SESSION_DAYS * 24 * 60 * 60, "session");
}

export async function decryptSession(token: string | undefined | null): Promise<DecodedSession | null> {
  const p = await verify(token, "session");
  if (!p || typeof p.userId !== "string" || typeof p.sv !== "number") return null;
  return { userId: p.userId, name: String(p.name ?? ""), sv: p.sv, issuedAt: Number(p.iat ?? 0) };
}

/** Short-lived token proving the password step passed, pending the 2FA code. */
export async function encryptTwoFactorChallenge(userId: string) {
  return sign({ userId }, TWO_FACTOR_TTL_SEC, "two-factor");
}

export async function decryptTwoFactorChallenge(token: string | undefined | null): Promise<{ userId: string } | null> {
  const p = await verify(token, "two-factor");
  if (!p || typeof p.userId !== "string") return null;
  return { userId: p.userId };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: PROD,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function twoFactorCookieOptions() {
  return {
    httpOnly: true,
    secure: PROD,
    sameSite: "lax" as const,
    path: "/",
    maxAge: TWO_FACTOR_TTL_SEC,
  };
}
