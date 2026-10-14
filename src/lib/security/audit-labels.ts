/** Event vocabulary shared by the server (recording) and the client (display). */
export const AUTH_EVENT_TYPES = [
  "register",
  "login_success",
  "login_failed",
  "login_locked",
  "two_factor_failed",
  "two_factor_enabled",
  "two_factor_disabled",
  "recovery_code_used",
  "recovery_codes_regenerated",
  "password_changed",
  "email_changed",
  "sessions_revoked",
] as const;

export type AuthEventType = (typeof AUTH_EVENT_TYPES)[number];

export function isAuthEventType(value: string): value is AuthEventType {
  return (AUTH_EVENT_TYPES as readonly string[]).includes(value);
}

/** Events that deserve attention when the user did not do them. */
export const WARNING_EVENTS = new Set<AuthEventType>([
  "login_failed",
  "login_locked",
  "two_factor_failed",
  "recovery_code_used",
]);
