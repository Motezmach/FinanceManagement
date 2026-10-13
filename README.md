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
3. Run `npm run db:push` once from your machine against the same `DATABASE_URL` (or let a previous local run do it).
4. Deploy. Everything is server-rendered on demand; no extra config needed.

Generate a fresh `AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

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
| Fixed monthly | credit | pending (due) | Recurring bills, driven by monthly rules |
| Optional | credit | planned | Discretionary purchases you can skip |
| Daily | credit | settled | Everyday spending, the default for a credit |

- **Balance** = all settled debits − all settled credits, across every month.
- Pending and planned entries never touch the balance until you mark them settled.
- Debits move along a pipeline: potential → pending → wallet. Settling stamps today's date.
- **Monthly rules** (Credits → Fixed monthly) create one due entry per month, idempotently. Pay it, pause the rule, or delete it; paid history stays.
- Every entry has a category. Categories have their own analytics page.

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

## Project layout

```
src/
  app/            routes: (auth)/login, (auth)/register, (app)/dashboard, debits, credits,
                  calendar, categories, categories/[id], analytics, settings
  components/     ui primitives, layout shell, entry wizard, charts, calendar, categories, dashboard
  lib/
    actions/      server actions (auth: register/login/profile/password, entries, categories, rules, settings)
    queries/      read models (dashboard, analytics, calendar, categories, entries, rules), all scoped by user id
    auth/         session cookie (jose), password hashing (bcryptjs), onboarding (default categories)
    config/       buckets, palette, icons, default categories, settings
    db/           drizzle schema + client
  proxy.ts        route guard (anonymous → /login, signed in → away from auth pages)
```
