/**
 * Manual seed: `npm run db:seed`
 * Creates the first user (from INITIAL_USERNAME / INITIAL_PASSWORD) with the
 * default categories. The app also does this automatically on first login,
 * so running this is optional.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { DEFAULT_CATEGORIES } from "../config/default-categories";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const db = drizzle({ client: neon(url), schema });

  const [{ value }] = await db.select({ value: count() }).from(schema.users);
  if (Number(value) > 0) {
    console.log("Users already exist, nothing to seed.");
    return;
  }

  const username = (process.env.INITIAL_USERNAME || "admin").trim();
  const password = process.env.INITIAL_PASSWORD || "admin1234";

  const [user] = await db
    .insert(schema.users)
    .values({ username, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true })
    .returning({ id: schema.users.id });

  const rows = (["debit", "credit"] as const).flatMap((kind) =>
    DEFAULT_CATEGORIES[kind].map((c, i) => ({ userId: user.id, kind, ...c, sortOrder: i })),
  );
  await db.insert(schema.categories).values(rows);
  console.log(`Seeded user "${username}" with ${rows.length} categories.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
