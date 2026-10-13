import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authEvents } from "@/lib/db/schema";
import type { ClientInfo } from "./request";
import type { AuthEventType } from "./audit-labels";

export type { AuthEventType } from "./audit-labels";
export { EVENT_LABELS, WARNING_EVENTS } from "./audit-labels";

export type AuthEvent = typeof authEvents.$inferSelect;

export async function recordAuthEvent(
  type: AuthEventType,
  client: ClientInfo,
  opts: { userId?: string | null; detail?: string } = {},
) {
  try {
    await db.insert(authEvents).values({
      type,
      userId: opts.userId ?? null,
      ipMasked: client.ipMasked,
      userAgent: client.userAgent || null,
      detail: opts.detail ?? null,
    });
  } catch (err) {
    // Auditing must never break the user flow.
    console.error("auth event not recorded", err);
  }
}

export async function listAuthEvents(userId: string, limit = 12): Promise<AuthEvent[]> {
  return db
    .select()
    .from(authEvents)
    .where(eq(authEvents.userId, userId))
    .orderBy(desc(authEvents.createdAt))
    .limit(limit);
}
