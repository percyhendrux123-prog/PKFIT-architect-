# Deploy runbook — Cowork agent edition

Step-by-step script for a human or Cowork agent operating dashboards on PK's behalf. Each step has a clear completion signal. Do the steps in order. Do not skip.

Repo: `percyhendrux123-prog/PKFIT-architect-`
Branch to deploy: `claude/pkfit-app-build-v1-6PvBo`
Target: a **new** Netlify site, separate from the existing `superb-bublanina-f12222` site. The old site stays untouched.

---

## 0 — What you need in hand before you start

A browser logged into:

- GitHub (account with write access to `percyhendrux123-prog/PKFIT-architect-`)
- Netlify (same account that owns `superb-bublanina-f12222`, or a new one)
- Supabase (create an account if none exists — https://supabase.com)
- Stripe (Dashboard → make sure it's in the intended mode: Test first, Live later)
- Anthropic Console (https://console.anthropic.com)

Keep a scratch notes doc open. You will copy values between dashboards.

---

## 1 — Create the Supabase project

1. https://supabase.com/dashboard → **New project**.
2. Name: `pkfit-app`.
3. Database password: generate a strong one, paste into scratch notes as `SUPABASE_DB_PASSWORD`.
4. Region: the one closest to PK's audience (e.g. `us-east-1`).
5. Plan: Free tier is fine for testing. Click **Create new project**. Wait ~2 minutes for provisioning.
6. Once ready, in the left sidebar:
   - **Project Settings → API** → copy:
     - `Project URL` → scratch notes as `VITE_SUPABASE_URL`
     - `anon public` key → scratch notes as `VITE_SUPABASE_ANON_KEY`
     - `service_role secret` key → scratch notes as `SUPABASE_SERVICE_ROLE_KEY`
   - **Project Settings → Database → Connection string → URI (session mode)** → copy and replace `[YOUR-PASSWORD]` with `SUPABASE_DB_PASSWORD` from step 3 → scratch notes as `SUPABASE_DB_URL`.

**Completion signal:** you have five values in scratch notes: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`.

## 2 — Run the Supabase migration

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Open the file `supabase/migrations/0001_init.sql` in the repo (raw GitHub URL or local checkout). Copy the entire contents.
3. Paste into the Supabase SQL Editor. Click **Run**.
4. Expected output: `Success. No rows returned.` (you may see notices about dropping non-existent policies — those are fine).
5. Repeat for `supabase/migrations/0002_exercise_library.sql` (seeds the canonical exercise list).
6. Left sidebar → **Table Editor** → verify these tables exist: `profiles`, `programs`, `meals`, `habits`, `check_ins`, `community_posts`, `community_reactions`, `community_comments`, `payments`, `exercises`. Each should have a shield icon next to the name indicating RLS is enabled.

**Completion signal:** ten tables visible, all with RLS enabled.

## 3 — Enable email auth

1. Supabase → **Authentication → Providers → Email** → Enable. Keep "Confirm email" on.
2. **Authentication → URL Configuration** → set **Site URL** to the placeholder `https://pkfit-app.netlify.app` (you will update this in step 7 once the real Netlify URL exists). Add redirect URL `https://pkfit-app.netlify.app/**`.

**Completion signal:** Email provider toggle is green.

## 4 — Create the Anthropic API key

1. https://console.anthropic.com → **API Keys → Create Key**.
2. Name: `pkfit-app`. Scope: default.
3. Copy the key (starts with `sk-ant-`) → scratch notes as `ANTHROPIC_API_KEY`. It is only shown once.

**Completion signal:** `ANTHROPIC_API_KEY` in scratch notes.

## 5 — Create the Stripe products and prices

Do this in **Test mode first**. Toggle the "Test mode" switch in the Stripe dashboard top-right.

For each of these four tiers, create one product with two recurring prices:

| Product name           | Monthly (USD) | Annual (USD) |
|------------------------|---------------:|-------------:|
| Performance Standard   | $250.00        | $2,490.00     |
| Identity Architecture  | $350.00        | $3,486.00     |
| Full Integration       | $450.00        | $4,482.00     |
| Premium                | $750.00        | $7,470.00     |

Steps per product:

1. Stripe → **Products → + Add product**.
2. Name: exactly as in the table. Description: optional.
3. Pricing → Recurring → Monthly → set the monthly amount. Save product.
4. Back on the product page → **+ Add another price** → Recurring → Yearly → set the annual amount. Save.
5. Copy both `price_...` IDs into scratch notes:

   ```
   STRIPE_PRICE_PERFORMANCE_MONTHLY=price_...
   STRIPE_PRICE_PERFORMANCE_ANNUAL=price_...
   STRIPE_PRICE_IDENTITY_MONTHLY=price_...
   STRIPE_PRICE_IDENTITY_ANNUAL=price_...
   STRIPE_PRICE_FULL_MONTHLY=price_...
   STRIPE_PRICE_FULL_ANNUAL=price_...
   STRIPE_PRICE_PREMIUM_MONTHLY=price_...
   STRIPE_PRICE_PREMIUM_ANNUAL=price_...
   ```

Then grab the Stripe keys:

6. Stripe → **Developers → API keys** → copy:
   - `Publishable key` (`pk_test_...`) → scratch notes as `VITE_STRIPE_PUBLISHABLE_KEY`
   - `Secret key` (`sk_test_...`) → scratch notes as `STRIPE_SECRET_KEY`

Do **not** create the webhook yet — the endpoint URL only exists after step 7.

**Completion signal:** eight `STRIPE_PRICE_*` values, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` in scratch notes.

> Do not create a product called "The Construct". It is intentionally absent from the pricing surface.

## 6 — Create the new Netlify site

Critical: this is a **brand-new** site. Do not reuse `superb-bublanina-f12222` or any existing site.

1. Netlify → **Add new site → Import from Git**.
2. Git provider: GitHub → authorize if needed → pick `percyhendrux123-prog/PKFIT-architect-`.
3. **Branch to deploy:** `claude/pkfit-app-build-v1-6PvBo` (NOT `main`). This isolates the app from anything ever reaching `main`.
4. Build settings (should be auto-detected from `netlify.toml`):
   - Build command: `npm ci && npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Click **Deploy**. Netlify will attempt the first build with no env vars — it will likely fail at runtime (not at build time) on any server-function call. That is fine.
6. Once the site exists, go to **Site configuration → Site details → Change site name** → set it to something clean like `pkfit-app` so the URL becomes `https://pkfit-app.netlify.app`. If that name is taken, pick the next shortest available.

**Completion signal:** Netlify site URL is in hand. Paste into scratch notes as `VITE_SITE_URL = https://<the-chosen-name>.netlify.app`.

## 7 — Update Supabase redirect URLs to match the Netlify URL

1. Supabase → **Authentication → URL Configuration** → set **Site URL** to the real `VITE_SITE_URL` from step 6.
2. Add `VITE_SITE_URL/**` to **Redirect URLs**.
3. Save.

**Completion signal:** Site URL in Supabase matches the Netlify site URL.

## 8 — Set all env vars in Netlify

Netlify → the new site → **Site configuration → Environment variables → Add a variable → bulk edit mode** → paste the following block, substituting every `<...>` with the value from scratch notes:

```
VITE_SUPABASE_URL=<from step 1>
VITE_SUPABASE_ANON_KEY=<from step 1>
VITE_STRIPE_PUBLISHABLE_KEY=<from step 5>
VITE_SITE_URL=<from step 6>
ANTHROPIC_API_KEY=<from step 4>
STRIPE_SECRET_KEY=<from step 5>
SUPABASE_SERVICE_ROLE_KEY=<from step 1>
STRIPE_PRICE_PERFORMANCE_MONTHLY=<from step 5>
STRIPE_PRICE_PERFORMANCE_ANNUAL=<from step 5>
STRIPE_PRICE_IDENTITY_MONTHLY=<from step 5>
STRIPE_PRICE_IDENTITY_ANNUAL=<from step 5>
STRIPE_PRICE_FULL_MONTHLY=<from step 5>
STRIPE_PRICE_FULL_ANNUAL=<from step 5>
STRIPE_PRICE_PREMIUM_MONTHLY=<from step 5>
STRIPE_PRICE_PREMIUM_ANNUAL=<from step 5>
```

(Leave `STRIPE_WEBHOOK_SECRET` blank for now — step 9 produces it.)

Save. Netlify prompts "Redeploy?" → click **Redeploy**.

**Completion signal:** 15 env vars set, site redeployed, build succeeds (green check on the deploy).

## 9 — Create the Stripe webhook

1. Stripe → **Developers → Webhooks → + Add endpoint**.
2. Endpoint URL: `<VITE_SITE_URL>/.netlify/functions/stripe-webhook`
3. Description: `pkfit-app production` (or `test` if you started in Test mode).
4. Events to send — click **+ Select events**, search for and enable:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click **Add endpoint**.
6. On the new endpoint page → **Signing secret → Reveal** → copy (`whsec_...`).
7. Back in Netlify env vars → add `STRIPE_WEBHOOK_SECRET=<the whsec value>` → Save → Redeploy.

**Completion signal:** webhook endpoint shows status "Enabled" in Stripe and a `STRIPE_WEBHOOK_SECRET` entry exists in Netlify env vars.

## 10 — Disconnect the old Netlify site from this repo

1. Netlify → site `superb-bublanina-f12222` → **Site configuration → Build & deploy → Continuous deployment**.
2. Either:
   - **Unlink site from repository**, OR
   - **Branch deploys** → restrict to a single specific branch that is not `claude/**` (e.g. `main` only, if that old site still needs it).
3. Verify the old site is no longer listed as a webhook destination on the GitHub repo: GitHub → repo → **Settings → Webhooks** → delete any Netlify webhook pointing at `superb-bublanina-f12222`.

**Completion signal:** pushing a new commit to `claude/pkfit-app-build-v1-6PvBo` triggers only the new Netlify site, not the old one.

## 11 — Promote PK to coach

1. Open `VITE_SITE_URL/signup` → create an account with PK's real email. Use a temporary password.
2. Check the email inbox → click the confirmation link.
3. Supabase → **SQL Editor** → run:

   ```sql
   update public.profiles
     set role = 'coach'
     where email = '<PK real email>';
   ```

4. Back in the app → sign out, sign in again → should land on `/coach`.

**Completion signal:** `/coach` dashboard loads for PK's account; `/dashboard` (client route) redirects to `/coach`.

## 12 — Smoke test the full stack

Walk through each route once. Expected behaviour:

| Route | Expected |
|-------|----------|
| `/` | Landing page renders, Gumroad CTA works, **Enter the App** goes to `/signup` |
| `/signup` → create account | Email confirmation sent; after confirm, redirects to `/onboarding` |
| `/onboarding` → Next ×4 → Enter | Writes to `profiles`, lands on `/dashboard` |
| `/workouts/generator` → Generate | Returns a program within ~15s, new row in `programs` table |
| `/meals/generator` → Generate | Returns a 7-day plan, rows appear in `meals` |
| `/habits` → add "10,000 steps" → toggle | New row in `habits`, streak updates |
| `/profile` → log a check-in | New row in `check_ins` |
| `/calendar` | Shows dots on days with check-ins / programs |
| `/assistant` → "write a hype caption with emoji" | Response contains **no** emoji and **no** `!` (enforced by both system prompt and server-side sanitizer) |
| `/community` → post | Appears in a second browser tab within 2s (realtime) |
| `/billing` → choose Performance Monthly → Stripe checkout (use test card `4242 4242 4242 4242`, any future expiry, any CVC) → complete | Webhook fires → `payments` row with status=active → `/billing` shows active plan |
| `/billing` → Manage/Cancel | Opens Stripe customer portal |
| `/coach` (as coach) | Tiles populate with client count, MRR, recent check-ins |

**Completion signal:** every row above behaves as expected, no errors in browser console, no 5xx in Netlify function logs.

## 13 — Flip PR #6 out of draft (only after step 12 is green)

Once everything in step 12 works, tell Claude: "deploy preview is green on the new site, flip PR #6 to ready." Claude will flip the PR status.

---

## Rollback

If anything goes wrong mid-setup:

- **Supabase migration errors** — run `drop schema public cascade; create schema public;` in the SQL Editor, then re-run `0001_init.sql`. This wipes the database; only do it on a fresh project.
- **Bad env var on Netlify** — edit it in Site configuration → redeploy.
- **Bad Stripe webhook secret** — delete the endpoint in Stripe, delete `STRIPE_WEBHOOK_SECRET` in Netlify, repeat step 9.
- **Stuck deploy on old site** — if the old site accidentally deploys this branch, click **Stop build** immediately. The old site's production URL is a separate deploy context and will not be overwritten unless `main` is changed, which this branch does not touch.

## Values that must stay server-side (never client)

If any of these ever appear in `dist/` after a build, something is wrong — stop and escalate:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Grep the repo after any change:

```
grep -r "sk-ant-\|sk_live_\|sk_test_\|whsec_\|service_role" dist/ src/
```

Expected result: no matches.
