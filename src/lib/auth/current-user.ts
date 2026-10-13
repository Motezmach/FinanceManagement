import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { decryptSession, SESSION_COOKIE } from "./session";
import { mergeSettings, type UserSettings } from "@/lib/config/settings";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  totpEnabled: boolean;
  settings: UserSettings;
};

/**
 * Reads the session cookie and loads the user. Cached per request.
 * A session whose version no longer matches the account is treated as signed out,
 * which is how "change password" and "sign out everywhere" revoke other devices.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const [row] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!row || row.sessionVersion !== session.sv) return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    totpEnabled: row.totpEnabled,
    settings: mergeSettings(row.settings),
  };
});

/**
 * For pages and actions. Anonymous visitors go to the login page; a visitor whose
 * cookie is validly signed but no longer accepted (revoked session, deleted
 * account) is sent through /logout so the stale cookie is cleared first,
 * otherwise the proxy would bounce them straight back here.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const hasCookie = !!(await cookies()).get(SESSION_COOKIE)?.value;
    redirect(hasCookie ? "/logout" : "/login");
  }
  return user;
}

/** First name for greetings ("Seif" from "Seif Karkad"). */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}
