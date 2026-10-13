/** Event vocabulary shared by the server (recording) and the client (display). */
export type AuthEventType =
  | "register"
  | "login_success"
  | "login_failed"
  | "login_locked"
  | "two_factor_failed"
  | "two_factor_enabled"
  | "two_factor_disabled"
  | "recovery_code_used"
  | "recovery_codes_regenerated"
  | "password_changed"
  | "email_changed"
  | "sessions_revoked";

export const EVENT_LABELS: Record<AuthEventType, string> = {
  register: "Account created",
  login_success: "Signed in",
  login_failed: "Failed sign-in attempt",
  login_locked: "Sign-in temporarily locked",
  two_factor_failed: "Wrong two-factor code",
  two_factor_enabled: "Two-factor authentication enabled",
  two_factor_disabled: "Two-factor authentication disabled",
  recovery_code_used: "Signed in with a recovery code",
  recovery_codes_regenerated: "Recovery codes regenerated",
  password_changed: "Password changed",
  email_changed: "Email changed",
  sessions_revoked: "Signed out of other devices",
};

/** Events that deserve attention when the user did not do them. */
export const WARNING_EVENTS = new Set<AuthEventType>([
  "login_failed",
  "login_locked",
  "two_factor_failed",
  "recovery_code_used",
]);
