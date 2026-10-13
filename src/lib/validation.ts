import { z } from "zod";
import { BUCKETS, KINDS, STATUSES } from "@/lib/config/buckets";
import { PALETTE_KEYS } from "@/lib/config/palette";
import { ICON_KEYS } from "@/lib/config/icons";
import { CURRENCIES } from "@/lib/config/settings";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

export const amountSchema = z.coerce
  .number({ message: "Enter an amount" })
  .positive("Amount must be greater than zero")
  .max(999_999_999, "That is a very large number");

export const entrySchema = z.object({
  kind: z.enum(KINDS),
  bucket: z.enum(BUCKETS),
  status: z.enum(STATUSES),
  amount: amountSchema,
  title: z.string().trim().min(1, "Give it a short title").max(120),
  categoryId: z.string().uuid("Pick a category"),
  date: isoDate,
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type EntryInput = z.infer<typeof entrySchema>;

export const entryUpdateSchema = entrySchema.partial().extend({ id: z.string().uuid() });

export const categorySchema = z.object({
  kind: z.enum(KINDS),
  name: z.string().trim().min(1, "Name is required").max(40),
  color: z.enum(PALETTE_KEYS as [string, ...string[]]),
  icon: z.enum(ICON_KEYS as [string, ...string[]]),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const ruleSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(120),
  amount: amountSchema,
  categoryId: z.string().uuid("Pick a category"),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});
export type RuleInput = z.infer<typeof ruleSchema>;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email")
  .max(120)
  .email("Enter a valid email address");

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "That is too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Mix letters and numbers");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Tell us your name")
  .max(60, "Keep it under 60 characters");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
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
    message: "Passwords do not match",
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
    .min(1, "Enter the code")
    .max(24)
    .refine((v) => /^\d{3}\s?\d{3}$/.test(v) || /^[A-Za-z0-9]{5}-?[A-Za-z0-9]{5}$/.test(v), "Enter a 6-digit code or a recovery code"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a different password than the current one",
  });

export const settingsSchema = z.object({
  currency: z.enum(CURRENCIES),
  locale: z.string().trim().min(2).max(12),
  debitLabel: z.string().trim().min(1).max(24),
  creditLabel: z.string().trim().min(1).max(24),
  theme: z.enum(["light", "dark", "system"]),
});

export function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Invalid input";
}

export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
