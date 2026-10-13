import "server-only";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { DEFAULT_CATEGORIES } from "@/lib/config/default-categories";

/** Gives a brand-new account its starter set of categories. */
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
  return rows.length;
}
