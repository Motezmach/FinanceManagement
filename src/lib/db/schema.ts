import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { UserSettings } from "@/lib/config/settings";

// "debit" = money coming in, "credit" = money going out (the owner's vocabulary;
// labels are customizable in Settings so anyone can rename them).
export const kindEnum = pgEnum("entry_kind", ["debit", "credit"]);

// Sections inside each side of the ledger.
export const bucketEnum = pgEnum("entry_bucket", [
  "wallet", // debit · money already received
  "pending", // debit · work done, payment awaited
  "potential", // debit · possible future work
  "fixed", // credit · recurring monthly obligation
  "optional", // credit · discretionary / planned spend
  "daily", // credit · everyday spending
]);

// Lifecycle of an entry. settled = real money moved.
export const statusEnum = pgEnum("entry_status", ["settled", "pending", "planned"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  settings: jsonb("settings").$type<Partial<UserSettings>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: kindEnum("kind").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("stone"),
    icon: text("icon").notNull().default("circle-dot"),
    sortOrder: integer("sort_order").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categories_user_kind_idx").on(t.userId, t.kind)],
);

export const recurringRules = pgTable(
  "recurring_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    dayOfMonth: integer("day_of_month").notNull().default(1),
    note: text("note"),
    isActive: boolean("is_active").notNull().default(true),
    startsOn: date("starts_on").notNull().default(sql`CURRENT_DATE`),
    endsOn: date("ends_on"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rules_user_idx").on(t.userId)],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    kind: kindEnum("kind").notNull(),
    bucket: bucketEnum("bucket").notNull(),
    status: statusEnum("status").notNull().default("settled"),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    title: text("title").notNull(),
    note: text("note"),
    date: date("date").notNull(),
    // Set when the entry was materialized from a recurring rule for a given month.
    ruleId: uuid("rule_id").references(() => recurringRules.id, { onDelete: "set null" }),
    period: text("period"), // "YYYY-MM"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entries_user_date_idx").on(t.userId, t.date),
    index("entries_user_kind_bucket_idx").on(t.userId, t.kind, t.bucket),
    index("entries_category_idx").on(t.categoryId),
    uniqueIndex("entries_rule_period_unique").on(t.ruleId, t.period),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  categories: many(categories),
  entries: many(entries),
  rules: many(recurringRules),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  user: one(users, { fields: [entries.userId], references: [users.id] }),
  category: one(categories, { fields: [entries.categoryId], references: [categories.id] }),
  rule: one(recurringRules, { fields: [entries.ruleId], references: [recurringRules.id] }),
}));

export const rulesRelations = relations(recurringRules, ({ one, many }) => ({
  user: one(users, { fields: [recurringRules.userId], references: [users.id] }),
  category: one(categories, { fields: [recurringRules.categoryId], references: [categories.id] }),
  entries: many(entries),
}));

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
