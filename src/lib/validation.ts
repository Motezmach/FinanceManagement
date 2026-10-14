import { z } from "zod";
import { BUCKETS, KINDS, STATUSES } from "@/lib/config/buckets";
import { PALETTE_KEYS } from "@/lib/config/palette";
import { ICON_KEYS } from "@/lib/config/icons";
import { CURRENCIES } from "@/lib/config/settings";
import { LOCALES } from "@/lib/i18n/locales";

// Every message is a translation key under "validation"; the UI resolves it.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validation.date");

export const amountSchema = z.coerce
  .number({ message: "validation.amount" })
  .positive("validation.amountPositive")
  .max(999_999_999, "validation.amountLarge");

export const entrySchema = z.object({
  kind: z.enum(KINDS),
  bucket: z.enum(BUCKETS),
  status: z.enum(STATUSES),
  amount: amountSchema,
  title: z.string().trim().min(1, "validation.title").max(120, "validation.tooLong"),
  categoryId: z.string().uuid("validation.category"),
  date: isoDate,
  note: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
});
export type EntryInput = z.infer<typeof entrySchema>;

export const entryUpdateSchema = entrySchema.partial().extend({ id: z.string().uuid() });

export const categorySchema = z.object({
  kind: z.enum(KINDS),
  name: z.string().trim().min(1, "validation.name").max(40, "validation.tooLong"),
  color: z.enum(PALETTE_KEYS as [string, ...string[]]),
  icon: z.enum(ICON_KEYS as [string, ...string[]]),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const ruleSchema = z.object({
  title: z.string().trim().min(1, "validation.title").max(120, "validation.tooLong"),
  amount: amountSchema,
  categoryId: z.string().uuid("validation.category"),
  dayOfMonth: z.coerce.number().int().min(1, "validation.day").max(31, "validation.day"),
  note: z.string().trim().max(500, "validation.tooLong").optional().or(z.literal("")),
});
export type RuleInput = z.infer<typeof ruleSchema>;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "validation.email")
  .max(120, "validation.tooLong")
  .email("validation.emailFormat");

const passwordSchema = z
  .string()
  .min(8, "validation.passwordLength")
  .max(128, "validation.tooLong")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "validation.passwordMix");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "validation.yourName")
  .max(60, "validation.tooLong");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "validation.password"),
});

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMatch",
  });

export const profileSchema = z.object({
  name: nameSchema,
  email: emailSchema,
});

/** A 6-digit authenticator code or a recovery code like ABCDE-FGHJK. */
export const twoFactorCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "validation.code")
    .max(24, "validation.tooLong")
    .refine((v) => /^\d{3}\s?\d{3}$/.test(v) || /^[A-Za-z0-9]{5}-?[A-Za-z0-9]{5}$/.test(v), "validation.codeFormat"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.currentPassword"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMatch",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "validation.passwordDifferent",
  });

export const settingsSchema = z.object({
  currency: z.enum(CURRENCIES),
  locale: z.string().trim().min(2, "validation.locale").max(12, "validation.locale"),
  language: z.enum(LOCALES),
  debitLabel: z.string().trim().max(24, "validation.tooLong"),
  creditLabel: z.string().trim().max(24, "validation.tooLong"),
  theme: z.enum(["light", "dark", "system"]),
});

export function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "validation.invalid";
}

export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** True when a message is a translation key rather than literal text. */
export function isMessageKey(msg: string | undefined | null): msg is string {
  return !!msg && /^[a-z][a-zA-Z]*(\.[a-zA-Z0-9]+)+$/.test(msg) && !msg.includes(" ");
}
