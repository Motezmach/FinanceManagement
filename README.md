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

Sign in with `INITIAL_USERNAME` / `INITIAL_PASSWORD` from `.env.local`. The first account is created automatically
on the first login and you are forced to pick a new password before seeing the dashboard.

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel.
2. Add the environment variables from `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `INITIAL_USERNAME`, `INITIAL_PASSWORD`).
3. Run `npm run db:push` once from your machine against the same `DATABASE_URL` (or let a previous local run do it).
4. Deploy. Everything is server-rendered on demand; no extra config needed.

Generate a fresh `AUTH_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

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
| `npm run db:seed` | Manually create the first user (optional, login does it too) |
| `npm run lint` | ESLint |

## Project layout

```
src/
  app/            routes: (auth)/login, (auth)/change-password, (app)/dashboard, debits, credits,
                  calendar, categories, categories/[id], analytics, settings
  components/     ui primitives, layout shell, entry wizard, charts, calendar, categories, dashboard
  lib/
    actions/      server actions (auth, entries, categories, rules, settings)
    queries/      read models (dashboard, analytics, calendar, categories, entries, rules)
    auth/         session cookie (jose), password hashing (bcryptjs), bootstrap
    config/       buckets, palette, icons, default categories, settings
    db/           drizzle schema + client
  proxy.ts        route guard (login / forced password change)
```
