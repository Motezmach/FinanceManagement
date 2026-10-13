import "server-only";
import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, users } from "@/lib/db/schema";
import { DEFAULT_CATEGORIES } from "@/lib/config/default-categories";
import { hashPassword } from "./password";

/**
 * Creates the first account from INITIAL_USERNAME / INITIAL_PASSWORD when the
 * database has no users yet, so a fresh deploy works without a manual seed.
 */
export async function ensureBootstrapped() {
  const [{ value }] = await db.select({ value: count() }).from(users);
  if (Number(value) > 0) return false;

  const username = (process.env.INITIAL_USERNAME || "admin").trim();
  const password = process.env.INITIAL_PASSWORD || "admin1234";

  const [user] = await db
    .insert(users)
    .values({
      username,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      settings: {},
    })
    .returning({ id: users.id });

  await seedDefaultCategories(user.id);
  return true;
}

export async function seedDefaultCategories(userId: string) {
  const rows = (["debit", "credit"] as const).flatMap((kind) =>
    DEFAULT_CATEGORIES[kind].map((c, i) => ({
      userId,
      kind,
      name: c.name,
      icon: c.icon,
      color: c.color,
      sortOrder: i,
    })),
  );
  if (rows.length) await db.insert(categories).values(rows);
}
