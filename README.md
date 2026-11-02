# Ledger

A calm, personal debit & credit dashboard. Next.js 16 · React 19 · Tailwind v4 · Drizzle · Neon Postgres.

**Debit = money in** (current wallet, pending work, potential work).
**Credit = money out** (fixed monthly, optional, daily).
Both words, and the six section names, can be renamed in Settings.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL and AUTH_SECRET
npm run db:push              # creates the tables in Neon
npm run dev                  # http://localhost:3000
```

Open `/register`, create an account (name, email, password) and you land on your own dashboard with a starter set of
categories. Every account has its own categories, entries and rules. Set `DISABLE_REGISTRATION=true` once everyone
who needs an account has one.

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel.
2. Add the environment variables from `.env.example`: `DATABASE_URL` and `AUTH_SECRET` are required; `PASSWORD_PEPPER`, `DATA_ENCRYPTION_KEY` and `DISABLE_REGISTRATION` are optional but recommended (see the Security section).
3. Run `npm run db:push` once from your machine against the same `DATABASE_URL` (or let a previous local run do it). A database that already has users is upgraded differently; see [Upgrading and rolling back](#upgrading-and-rolling-back).
4. Deploy. Everything is server-rendered on demand; no extra config needed.

Generate a fresh `AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Languages and typography

The interface ships in **English** (default), **French** and **Arabic**, with Arabic laid out right-to-left. Visitors pick a
language on the sign-in pages (remembered in a cookie); signed-in users choose it in Settings and it follows their account
across devices. Message catalogs live in `src/messages/{en,fr,ar}.json` with identical keys. To add a language, add a
catalog, register the code in `src/lib/i18n/locales.ts`, and map its date-fns locale in `src/lib/format.ts`.

Text is set in IBM Plex Sans, with IBM Plex Sans Arabic for Arabic glyphs; both load through `next/font` so nothing is
fetched from third parties at runtime.

## Security

| Threat | What the app does |
| --- | --- |
| Brute force / credential stuffing | Database-backed rate limits with lockouts: 10 attempts per account and 30 per IP every 15 minutes, 5 sign-ups per IP per hour, 6 two-factor tries per 10 minutes. State lives in Postgres, so it survives serverless cold starts and spans instances. |
| Account enumeration | One generic sign-in error. Unknown emails run a bcrypt compare against a throwaway hash, so timing is identical. Lockout keys are HMAC hashes of the email whether or not it exists. |
| Password cracking after a database leak | bcrypt with 2^12 rounds; optional `PASSWORD_PEPPER` HMAC applied before hashing so the database alone is not enough. Common, keyboard-pattern and name/email-based passwords are rejected. |
| Session hijacking | Signed JWT in an `httpOnly`, `Secure`, `SameSite=Lax`, `__Host-` cookie. Sessions carry a version: changing the password, changing the email or "Sign out of other devices" bumps it and every other device is out. Sliding expiry re-signs active sessions; abandoned ones expire after 14 days. |
| Phishing / stolen password | Optional two-factor authentication (TOTP, any authenticator app) with one-period drift, replay protection and eight one-time recovery codes. 2FA secrets are AES-256-GCM encrypted at rest; recovery codes are stored hashed. Turning 2FA off requires the password and a current code. |
| XSS / injection / clickjacking | Nonce-based Content Security Policy with `strict-dynamic`, `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, HSTS, referrer and permissions policies, no `x-powered-by`. All SQL is parameterised through Drizzle; all input is validated with zod; React escapes output. |
| Bots on the sign-up form | Honeypot field plus the per-IP limit. Set `DISABLE_REGISTRATION=true` to close sign-ups entirely. |
| Silent takeover | Settings shows recent activity: sign-ins, failed attempts, lockouts, password and email changes, 2FA changes. Addresses are stored masked (`1.2.x.x`). |
| Leaking internals | Error boundary shows a friendly page and a reference id, never a stack trace. Non-action helpers are kept out of `"use server"` modules so nothing extra is exposed as an endpoint. |

Known limits: there is no "forgot password" flow because the app sends no email. Keep your recovery codes safe, or add an email provider and a reset flow if you need one.

## How the model works

| Section | Side | Default status | Meaning |
| --- | --- | --- | --- |
| Current wallet | debit | settled | Money you already received |
| Pending work | debit | pending | Work delivered, payment awaited |
| Potential work | debit | planned | Opportunities that may become income |
| Fixed monthly | credit | pending (due) | Recurring bills, placed automatically every month |
| Optional | credit | planned | Discretionary purchases you can skip |
| Daily | credit | settled | Everyday spending, the default for a credit |

- **Balance** = all settled debits − all settled credits, across every month.
- **Free to spend** = balance − In savings − Due. It drops when a bill is placed and rises with income or a removed bill. It does not move on Savings, on Paid or on an automatic payment. Planned entries are not subtracted, because they might not happen.
- Pending, planned and In savings entries never touch the balance until they are settled.
- Debits move along a pipeline: potential → pending → wallet. Settling stamps today's date.
- Every entry has a category. Categories have their own analytics page.

## Fixed monthly

A monthly bill is a rule plus at most one record per calendar month. A record is dated on the rule's day, clamped to the length of the month, so the 31st becomes February 28. Its cycle lasts one month from that date and ends on its renewal date.

| On the renewal date, a record that is | Becomes |
| --- | --- |
| In savings | Paid automatically |
| Due, with "Mark as paid by itself" on (off by default) | Paid automatically |
| Due, with that switch off | Still Due, shown as Late. It is never counted as paid unless you say so |
| Due, because you took it back after its cycle ended | Still Due, shown as Late, until you pay it |

An automatic payment keeps the record's date, so each month holds exactly one instance of the bill in analytics; `settled_at` says when it left the balance. Next month's record then comes back as Due.

- **Placement.** A record is placed on its date, or early from the 1st of its month when no earlier open record of that bill remains, so a paid bill reappears ahead of its date and can be saved or paid early.
- **Future months.** Browsing never creates records. They show as read-only Scheduled and stay out of the totals.
- **Time away.** A month missed with the switch off is recorded as skipped, not invented as debt, and Bring back restores it. With the switch on it is recorded as paid automatically.
- **Pausing and deleting.** Pausing removes records whose cycle is still running and leaves late ones Due. Deleting removes open records. Paid history always stays.

The rules live in a pure engine, `src/lib/fixed/cycle.ts`, which never reads the clock. `ensureSynced` applies its plan during render at most once a day per user (`users.fixed_synced_on`), and any change to a bill resets that gate. The first sync of an existing account also moves its recent fixed entries onto rules with the switch off, and the Fixed tab lists them once with Keep and Not monthly. Nothing settles during that move, so no balance changes.

### Savings

Savings means the money is there but the bill is not paid yet. A Due bill can go in savings while its cycle is running; a Late one can only be paid or skipped. It is not a separate account, so the balance stays the same until the bill is paid. `/credits/savings` shows what is in savings with a countdown to each automatic payment, what is not in savings yet, and the history. Money is allocated by renewal date, and a bill the balance cannot reach shows as "Not fully in savings".

## Smart calculator

A small arrow on the bottom-right edge of every page (mirrored in Arabic) opens the calculator; `C` does the same. The panel does not block the page, so you can keep working behind it.

- **Values come from the app.** Click any amount on the page, or pick one from the Ledger chips (overview figures, fixed bills, categories, recent entries, served by `GET /api/calculator` with no notes and no category ids). Digits sit behind the "123" toggle, for constants.
- **Percentages.** `a + 10%` is `a + a × 10%`, and `a × 10%` is `a × 0.10`. Addition and subtraction run in integer cents. The engine is pure and tested, in `src/lib/calculator/engine.ts`, and never uses `eval`.
- **Using the result.** An insight line relates it to your balance and free money. New credit and New debit open the entry wizard with the amount filled in, and Copy copies it.
- **Privacy.** The tape lives in React memory only. Nothing is written to `localStorage` and there is no history.

## Known limits

Dates follow the server clock, which is UTC on Vercel. A bill turns Late or pays automatically at midnight UTC, not at your local midnight.

## Upgrading and rolling back

To upgrade a database that already has users, apply the hand-written script instead of `db:push`, before deploying the new code:

```bash
psql "$DATABASE_URL" -f scripts/sql/2026-11-fixed-monthly.sql
```

It is additive and idempotent, and the previous version of the app keeps working against it. `auto_pay` defaults to false, so existing bills never start paying by themselves.

To roll back, move money in savings back to Due before redeploying older code, because it does not know that status:

```sql
UPDATE entries SET status = 'pending' WHERE status = 'saved';
```

Rows the app settled by itself have `auto_paid = true`, if you need to review them. The added columns and the `rule_skips` table can stay; older code ignores them.

## Customize

| What | Where |
| --- | --- |
| Section behaviours, labels, hints | `src/lib/config/buckets.ts` |
| Default categories for new users | `src/lib/config/default-categories.ts` |
| Color palette | `src/lib/config/palette.ts` |
| Available category icons | `src/lib/config/icons.ts` |
| Currencies in Settings | `src/lib/config/settings.ts` |
| Theme tokens (light/dark) | `src/app/globals.css` |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run db:push` | Sync the Drizzle schema to the database |
| `npm run db:studio` | Browse the database with Drizzle Studio |
| `npm run lint` | ESLint |
| `npm test` | Unit tests for the fixed monthly engine, the calculator and the message catalogs |

## Project layout

```
src/
  app/            routes: (auth)/login, (auth)/register, (app)/dashboard, debits, credits, credits/savings,
                  calendar, categories, categories/[id], analytics, settings, api/calculator
  components/     ui primitives, layout shell, entry wizard, charts, calendar, categories, dashboard
  lib/
    actions/      server actions (auth: register/login/profile/password, entries, categories, rules, savings, settings)
    queries/      read models (dashboard, analytics, calendar, categories, entries, rules, savings, calculator), all scoped by user id
    fixed/        the monthly cycle: pure engine, board model, sync and multi-statement writes
    calculator/   pure calculator engine
    auth/         session cookie (jose), password hashing (bcryptjs), onboarding (default categories)
    config/       buckets, palette, icons, default categories, settings
    db/           drizzle schema + client
  proxy.ts        route guard (anonymous → /login, signed in → away from auth pages)
scripts/sql/      hand-written, idempotent database upgrades
```
