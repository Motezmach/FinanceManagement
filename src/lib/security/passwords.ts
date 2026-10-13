/**
 * Password hygiene checks shared by the client (live feedback) and the server (enforced).
 * Length and variety are enforced by zod; this catches the obvious bad choices.
 */
const COMMON = [
  "password",
  "password1",
  "password123",
  "passw0rd",
  "123456789",
  "12345678",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "iloveyou1",
  "letmein1",
  "welcome1",
  "admin123",
  "admin1234",
  "abc12345",
  "abcd1234",
  "monkey123",
  "dragon123",
  "football1",
  "baseball1",
  "sunshine1",
  "princess1",
  "trustno1",
  "master123",
  "shadow123",
  "superman1",
  "michael1",
  "jennifer1",
  "computer1",
  "internet1",
  "11111111",
  "00000000",
  "88888888",
  "aa123456",
  "a1234567",
  "p@ssw0rd",
  "pa55word",
  "secret123",
  "changeme1",
  "ledger123",
];

const COMMON_SET = new Set(COMMON);

const KEYBOARD_RUNS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", "0987654321"];

/** Returns a human message when the password is weak, otherwise null. */
export function passwordWeakness(
  password: string,
  ctx: { email?: string | null; name?: string | null } = {},
): string | null {
  const pw = password.toLowerCase();
  if (COMMON_SET.has(pw)) return "That password is on every attacker's list. Pick something more personal.";

  if (/^(.)\1+$/.test(pw)) return "Repeating one character is easy to guess.";
  for (const run of KEYBOARD_RUNS) {
    if (pw.length >= 6 && (run.includes(pw) || run.split("").reverse().join("").includes(pw))) {
      return "Keyboard patterns are easy to guess.";
    }
  }

  const local = (ctx.email ?? "").toLowerCase().split("@")[0];
  if (local.length >= 4 && pw.includes(local)) return "Do not use part of your email in your password.";

  for (const part of (ctx.name ?? "").toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && pw.includes(part)) return "Do not use your name in your password.";
  }

  return null;
}
