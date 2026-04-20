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

   The migration creates every table (profiles, programs, meals, habits, check_ins, community_posts, community_reactions, community_comments, payments), enables row-level security on each, installs the per-role policies, and adds a trigger that creates a `profiles` row on every new `auth.users` insert.

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
Client: `/dashboard`, `/workouts`, `/workouts/builder`, `/workouts/generator`, `/meals`, `/meals/generator`, `/habits`, `/calendar`, `/community`, `/assistant`, `/billing`, `/profile`
Coach: `/coach`, `/coach/clients`, `/coach/clients/:id`, `/coach/programs`, `/coach/revenue`, `/coach/announcements`

## License

Proprietary. All rights reserved.
