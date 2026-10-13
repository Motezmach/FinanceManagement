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
  username: string;
  mustChangePassword: boolean;
  settings: UserSettings;
};

/** Reads the session cookie and loads the user. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await decryptSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const [row] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    mustChangePassword: row.mustChangePassword,
    settings: mergeSettings(row.settings),
  };
});

/** For pages and actions: redirects to the right place when not allowed. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

/** Like requireUser but allows users who still need to change their password. */
export async function requireSession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
