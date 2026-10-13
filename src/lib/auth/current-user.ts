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
    name: row.name,
    email: row.email,
    settings: mergeSettings(row.settings),
  };
});

/** For pages and actions: sends anonymous visitors to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** First name for greetings ("Seif" from "Seif Karkad"). */
export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}
