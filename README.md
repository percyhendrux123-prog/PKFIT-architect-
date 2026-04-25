# PKFIT App

A React + Vite coaching app for the PKFIT system. Client-side auth, Supabase-backed data, Stripe subscriptions, Anthropic-powered generators and a scoped client assistant.

## Stack

- React 18 + Vite 5 (JSX, no TypeScript)
- React Router v6
- Tailwind CSS 3 with PKFIT brand tokens
- Supabase (auth + Postgres + realtime)
- Stripe (subscriptions, Checkout, Billing Portal)
- Anthropic Claude Sonnet 4 (server-side only, via Netlify Functions)
- YouTube embeds (via `youtube-nocookie.com`, no API key)
- Netlify (hosting + serverless functions)

## Repo layout

```
.
├── index.html                # Vite shell
├── netlify.toml              # Build + headers + SPA redirect
├── package.json
├── public/                   # Fonts (Bebas Neue, DM Mono), favicons, OG image, _redirects
├── src/
│   ├── main.jsx
│   ├── App.jsx               # All routes
│   ├── index.css             # Tailwind + @font-face
│   ├── assets/
│   ├── components/           # Layout, ProtectedRoute, ui/*
│   ├── context/AuthContext.jsx
│   ├── hooks/useRealtime.js
│   ├── lib/                  # supabaseClient, stripeClient, claudeClient
│   └── pages/
│       ├── Landing.jsx  Splash.jsx  Onboarding.jsx
│       ├── auth/             # Login, Signup
│       ├── client/           # Dashboard, Workouts, WorkoutBuilder, WorkoutGenerator,
│       │                     # Meals, MealGenerator, Habits, Calendar, Profile,
│       │                     # Community, Assistant, Billing
│       └── coach/            # Dashboard, Clients, ClientDetail, Programs, Revenue, Announcements
├── netlify/functions/
│   ├── _prompts/             # PKFIT system prompts (voice + task-specific)
│   ├── _shared/              # supabase-admin, auth, anthropic, stripe helpers
│   ├── generate-workout.js
│   ├── generate-meal-plan.js
│   ├── client-assistant.js
│   ├── create-checkout-session.js
│   ├── create-portal-session.js
│   └── stripe-webhook.js
└── supabase/migrations/0001_init.sql
```

## Local development

```bash
npm install
cp .env.example .env
# fill in at least VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
# → http://localhost:5173
```

To run the Netlify functions locally, install the Netlify CLI and use:

```bash
npx netlify dev
# → http://localhost:8888 (proxies the Vite dev server and exposes /.netlify/functions/*)
```

## Environment variables

Client-side (exposed in the browser bundle via Vite):

| Name | Purpose |
|------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `VITE_SITE_URL` | Public URL of the deployment (for Stripe success/cancel redirects) |

Server-only (set in the Netlify dashboard, never in client bundle):

| Name | Purpose |
|------|---------|
| `ANTHROPIC_API_KEY` | For `generate-workout`, `generate-meal-plan`, `client-assistant` |
| `STRIPE_SECRET_KEY` | Checkout + portal + webhook |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `SUPABASE_SERVICE_ROLE_KEY` | Writes from server functions (bypasses RLS) |
| `STRIPE_PRICE_PERFORMANCE_MONTHLY` / `_ANNUAL` | Performance tier price IDs |
| `STRIPE_PRICE_IDENTITY_MONTHLY` / `_ANNUAL` | Identity Architecture tier price IDs |
| `STRIPE_PRICE_FULL_MONTHLY` / `_ANNUAL` | Full Integration tier price IDs |
| `STRIPE_PRICE_PREMIUM_MONTHLY` / `_ANNUAL` | Premium tier price IDs |

## Supabase setup

1. Create a Supabase project.
2. Run the migration:

   ```bash
   psql "$SUPABASE_DB_URL" < supabase/migrations/0001_init.sql
   ```

   The first migration creates every table (profiles, programs, meals, habits, check_ins, community_posts, community_reactions, community_comments, payments), enables row-level security on each, installs the per-role policies, and adds a trigger that creates a `profiles` row on every new `auth.users` insert.

   Then run `supabase/migrations/0002_exercise_library.sql` for the seeded exercise catalogue (powers the autocomplete in the workout builder).

3. In Supabase → Authentication → Providers, enable email/password.
4. To promote a user to coach, run:

   ```sql
   update public.profiles set role = 'coach' where email = 'you@example.com';
   ```

## Stripe setup

1. Create four subscription products in Stripe (Performance Standard, Identity Architecture, Full Integration, Premium). Each needs a monthly and an annual price.
2. Copy the eight `price_...` IDs into the `STRIPE_PRICE_*` env vars in Netlify.
3. Add a webhook endpoint in Stripe pointing to `https://<site>/.netlify/functions/stripe-webhook` and subscribe it to `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

Pricing (reference):

| Tier | Monthly | Annual effective / mo |
|------|--------:|----------------------:|
| Performance Standard | $250 | $208 |
| Identity Architecture | $350 | $291 |
| Full Integration | $450 | $374 |
| Premium | $750 | $623 |

Annual billing applies a 17% reduction.

## Netlify deploy

The repo ships with a ready `netlify.toml`:

- Build: `npm ci && npm run build`
- Publish: `dist/`
- Functions: `netlify/functions/` (Node 20, esbuild bundler)
- SPA fallback: `/*  →  /index.html  200`
- Security headers: tight CSP allowing Supabase, Stripe, Anthropic, YouTube-NoCookie; long-immutable cache on fonts and built assets

Set all env vars in the Netlify dashboard, then connect the repo. Any push to `claude/pkfit-app-build-v1-6PvBo` produces a deploy preview.

## Brand rules (AI behaviour)

- **Voice**: Quiet Assassin. No emoji. No exclamation points. No hype adjectives.
- **Frame**: DPL — Diagnose → Program → Lock. Mechanism over motivation.
- **Reserved tier**: the $1,500/mo tier is deliberately not surfaced anywhere in the app.
- The client assistant strips emoji and exclamation points from replies as a belt-and-suspenders guard on top of the system prompt.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server on :5173 (with `/.netlify/functions/*` proxy to :8888) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the build on :4173 |
| `npm run lint` | ESLint over `src/` |

## Auth flow

1. Unauthenticated users land on `/`. They click **Enter the App** to reach `/signup` or `/login`.
2. After signup, Supabase auto-creates a `profiles` row via trigger.
3. The user is redirected to `/onboarding` for intake, then to `/dashboard`.
4. Coach accounts (`profile.role = 'coach'`) are redirected to `/coach` and gated from client routes.

## Routes

Public: `/`, `/login`, `/signup`, `/onboarding`, `/splash`
Client: `/dashboard`, `/workouts`, `/workouts/builder`, `/workouts/generator`, `/meals`, `/meals/generator`, `/habits`, `/calendar`, `/reviews`, `/reviews/:id`, `/inbox`, `/community`, `/assistant`, `/billing`, `/profile`
Coach: `/coach`, `/coach/inbox`, `/coach/clients`, `/coach/clients/:id`, `/coach/programs`, `/coach/revenue`, `/coach/announcements`

## Migrating a client from Trainerize

The importer ingests a Trainerize export (JSON) and writes the client's history into Supabase. Coach-auth only. Idempotent — re-running with the same payload skips already-imported rows.

**Endpoint:** `POST /.netlify/functions/trainerize-import`

**Auth:** Bearer token of a user whose `profiles.role = 'coach'`. The authed coach's UUID is also used as `author_id` for any messages with `direction: "from_coach"` in the export.

**Request body:**

```json
{
  "trainerize_export":   { ... see docs/trainerize-import-contract.md ... },
  "trainerize_client_id": "tz_client_847211",
  "dry_run":              false
}
```

`trainerize_client_id` must equal `trainerize_export.client.trainerize_id` — the importer rejects payload-swap mistakes during a bulk migration.

**Response shape:**

```json
{
  "status":             "ok" | "partial" | "failed",
  "client_id_supabase": "uuid",
  "imported": { "programs": N, "sessions": N, "checkins": N,
                "meals": N, "meal_adherence": N, "photos": N, "messages": N },
  "skipped":  { ...per-section, with reasons },
  "warnings": [ "..." ],
  "dry_run":            false
}
```

`status: "partial"` means at least one row was skipped for a reason other than already-imported (e.g., a meal-adherence tick referenced a meal that doesn't exist in the export). The skipped block tells you exactly what didn't land and why.

**End-to-end example:**

```bash
TOKEN=$(supabase login token)   # or your existing coach JWT

curl -X POST https://<site>/.netlify/functions/trainerize-import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data @tests/fixtures/trainerize-sample.json
```

**Dry-run first.** Set `"dry_run": true` to walk the entire payload through the mappers and dedup logic without writing to Supabase or Storage. The response shows what *would* have happened.

```bash
jq '. + {dry_run: true}' tests/fixtures/trainerize-sample.json \
  | curl -X POST https://<site>/.netlify/functions/trainerize-import \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" --data @-
```

**Local smoke (no Supabase needed):** runs the orchestrator against an in-memory fake admin and asserts idempotency.

```bash
node scripts/smoke-trainerize-import.js
# → "SMOKE OK" if every assertion passes
```

**Companion issue:** the input JSON contract is consumed by Issue #19 (Apify Trainerize scraper). The full schema lives at `docs/trainerize-import-contract.md`; the canonical example is `tests/fixtures/trainerize-sample.json`. When the scraper lands, its output must validate against `_schema_version: "1.0.0"`.

**Idempotency mechanics.** The schema has no `trainerize_*_id` columns, so the importer dedups via:

- `profiles`: email is the natural key (`auth.users.email`).
- `programs`, `workout_sessions`, `meals`: a `_meta.trainerize_id` marker is embedded inside the existing `jsonb` column (`exercises` / `items`) and matched on re-run.
- `check_ins`: natural key `(client_id, date)` — Trainerize allows one weigh-in per day.
- `dm_messages`: content hash on `(thread_id, sent_at, content)`.
- `progress_photos`: deterministic Storage path `<client_id>/checkin-<iso>-<trainerize_id>.<ext>` with upsert.

These markers are non-invasive — no schema migration is required. A future migration could add explicit `external_id text unique` columns for cleaner audit; flagged in the import contract doc.

## How AXIOM Overseer works

AXIOM Overseer is a Netlify scheduled function that posts a daily editor's brief
on the pkfit-app build to Slack. It sits above the bench — it does not ship
code. It reads the GitHub repo, synthesizes what matters (open PRs and their CI
state, issues by priority, 24-hour merge velocity, blockers), and posts a single
markdown block once a day.

- Source: `netlify/functions/axiom-overseer.js`
- Schedule: `0 13 * * *` UTC (08:00 CT during CDT, 07:00 CT during CST). See
  the comment in `netlify.toml` for seasonal handling.
- Required env vars (Netlify dashboard, never committed):
  - `GITHUB_TOKEN` — repo-read scope, no write
  - `GITHUB_OWNER`, `GITHUB_REPO` — defaulted to this repo if unset
  - `SLACK_WEBHOOK_URL_OPS` — dedicated ops webhook; **do not** point at a
    customer-facing channel
  - `DRY_RUN=1` — disables Slack post and returns the rendered markdown in the
    function response (used by `npm run axiom:smoke`)

To smoke-test locally:

```
GITHUB_TOKEN=ghp_xxx DRY_RUN=1 npm run axiom:smoke
```

The output is the exact markdown that would land in Slack. Paste it into a
Slack preview to verify formatting before flipping `DRY_RUN`.

To trigger the deployed function on demand (after deploy):

```
netlify functions:invoke axiom-overseer --no-identity
```

## License

Proprietary. All rights reserved.
