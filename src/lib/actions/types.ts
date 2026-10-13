export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fields?: Record<string, string> };

export const fail = (error: string, fields?: Record<string, string>): ActionResult<never> => ({
  ok: false,
  error,
  fields,
});
