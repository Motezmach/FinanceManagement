/** Set DISABLE_REGISTRATION=true in the environment to close sign-ups. */
export function isRegistrationOpen() {
  return process.env.DISABLE_REGISTRATION !== "true";
}
