# PKFIT App — Apple-tier Quality Audit

**Date:** 2026-04-26 (audit referenced as 04-25 per the work order)
**Scope:** Full pass over `pkfit-app` deployed at <https://pkfit-app.netlify.app/>, plus code review across every page, layout, and shared component.
**Audited HEAD:** `d6b761e` on `claude/musing-hertz-04ba57`.
**Bar:** "as if working at Apple.com" — pixel adherence to brand canon, deliberate microinteractions, confident copy, considered empty/loading/error states, full keyboard + screen-reader support, mobile parity.

---

## Brand-canon note (resolve before redesign)

The work order references **ATLAS canon** (Field `#0F1318`, Cream `#F5F1E8`, Fraunces / Space Grotesk / JetBrains Mono). The shipped codebase is **PKFIT canon** (bg `#080808`, gold `#C9A84C`, ink `#F5F5F5`, Bebas Neue / DM Mono — see `tailwind.config.js`, `src/index.css`, README §Brand rules).

**This audit is against PKFIT canon** because that is the brand the app actually ships under (the Quiet Assassin voice, the DPL frame, the gold/black aesthetic, the "Quiet Work" footer). Switching to ATLAS would be a brand pivot, not a polish pass — surfaced in the front-page section below as a halt-condition decision for Percy.

---

## Headline numbers

| | Result |
|---|---|
| Lighthouse desktop — Accessibility | **96** |
| Lighthouse desktop — Best Practices | **96** |
| Lighthouse desktop — SEO | **92** |
| `npm run lint` | 0 errors, 20 warnings (all pre-existing `react-hooks/exhaustive-deps`) |
| `npm run test` | 58 / 58 passing |
| `npm run build` | green — 371 KB JS / 21 KB CSS / 1.5 KB HTML |
| Console errors on landing | none |

The bones are good. Most findings are polish gaps and brand drift — exactly what stands between v1 ship and Apple-tier.

---

## Front-page screenshot

Captured at desktop and mobile and saved alongside this report:

- `docs/audit-screenshots/landing.png` — full-page desktop (1440 px)
- `docs/audit-screenshots/landing-mobile.png` — full-page iPhone-15 width (390 px)
- `docs/audit-screenshots/login.png`, `signup.png`, `notfound-mobile.png`, `onboarding-redirect.png`, `signup-mobile.png`, `onboarding-mobile.png` — adjacent flows

**Front-page verdict:** the landing is on-brand and well-structured (Quiet-Assassin headline, DPL framing in the 30-day cards, Dele Bakare testimonial, dual CTA). Three real issues:

1. The **testimonial image is broken** in production (see Critical findings).
2. The **two hero CTAs lead to two products** — gold "Get the Blueprint · $37" sends to Gumroad (the e-book), outline "Enter the App" sends to `/signup`. A first-time visitor who came for the app may bounce to Gumroad by accident. Consider primary = Enter the App, secondary = Blueprint.
3. The hero has **no PKFIT wordmark / logo** anywhere above the fold, no nav. Editorial in spirit but a returning user has no anchor to identify the brand at a glance.

A landing v2 is recommended (drafted in Phase 2). Keeping the current copy and structure — primarily reordering the CTA hierarchy, fixing the image, and tightening the testimonial frame.

---

## Findings

Severity key:

- 🔴 **Critical** — broken / blocks a flow / data-loss risk / paywall hole / production-visible bug
- 🟠 **Major** — visible polish gap / weak copy / missing empty/error/loading state / a11y on user-facing route / hover-only affordance
- 🟡 **Minor** — nitpick — focus rings, label tightness, kerning, doc cleanup

### 🔴 Critical (blocking / customer-visible)

| # | Where | Finding | Fix |
|---|---|---|---|
| C1 | `public/testimonial.png` (2.3 MB, 1080×1080) referenced from `Landing.jsx:99` | Image is 2.3 MB for a 260 px display slot. Production renders an empty gray box (`naturalWidth: 0`) for several seconds. LCP candidate, harms first impression. | Compress + resize to ~520×520 webp at ~60 KB; add `width`/`height` attrs to prevent CLS. Verify the `complete=false` failure is just slow load, not a 0-byte upload. |
| C2 | `src/pages/Onboarding.jsx` (route `/onboarding`) | Onboarding is **public** (App.jsx:48, no `<ProtectedRoute>`). Anonymous visitors fill 5 steps; on **Enter** the code calls `navigate('/signup')` and **all form data is lost**. | Wrap in `<ProtectedRoute role="client">`, or redirect to `/signup` on mount when `!user`, **before** the user invests effort. |
| C3 | `src/pages/client/Billing.jsx` (whole file) | Tier cards have one descriptor sentence each — no feature list, no comparison, no annual savings shown, no "current plan" indicator on the active tier card. The user cannot pick a plan rationally. | Rebuild tier cards: 4–6 bullet checklist per tier (sessions/wk, review cadence, response SLA, Identity Lock access), highlight current plan with a "Current" pill + disabled select, show savings on annual toggle. |
| C4 | `src/components/ProtectedRoute.jsx` and route map | **No subscription gate.** Today, any signed-in user (including unpaid trial / cancelled) hits `/dashboard`, `/workouts`, `/meals`, `/assistant`, etc. Only `/billing` is reachable as a paywall — but it is not enforced. | Either gate at `<ProtectedRoute>` by reading `profile.plan`, or wrap protected routes in `<RequiresActiveSubscription>` that redirects unpaid users to `/billing`. Keep `/billing`, `/profile`, `/settings`, `/inbox` reachable. (Stripe Performance tier is $250/mo — paywall must be tight.) |
| C5 | `src/pages/client/Dashboard.jsx:60-112` | Seven independent Supabase queries fire on mount with no `cancelled` flag. Errors are silently swallowed. State setters can fire on unmounted components. | Refactor into a single `Promise.all` inside one `useEffect` with an `if (cancelled) return` guard; surface a single error state. |
| C6 | `src/pages/client/Profile.jsx:78-198` | Four separate file uploads (avatar, baseline, preview, check-in) with **inconsistent busy flags** — avatar uses its own `avatarBusy`, the other three share `busy`/`err`. Concurrent upload starts cause cross-talk and one upload's error overwrites another's. | Scoped busy/err per upload area. |

### 🟠 Major

#### Brand drift — Tailwind red used as the de-facto error/danger color (≈30 instances)

There is no PKFIT semantic error token. The codebase reaches for `text-red-300`, `text-red-400`, `border-red-500/40`, `hover:text-red-300` — which clashes with gold/ink and reads cheap. Found in:

- `src/components/ui/Badge.jsx:5-6` (red + emerald variants — also off-palette green)
- `src/components/ui/Button.jsx:7` (danger variant)
- `src/components/Layout.jsx`, `NotificationBell.jsx`, `DMThread.jsx`, `LogSessionForm.jsx`, `ContextPinMenu.jsx`
- `src/pages/auth/Login.jsx:40`, `Signup.jsx:48`, `Onboarding.jsx:201`
- `src/pages/client/`: `Dashboard.jsx`, `Workouts.jsx`, `WorkoutBuilder.jsx`, `WorkoutGenerator.jsx`, `Meals.jsx`, `MealGenerator.jsx`, `Habits.jsx`, `Profile.jsx`, `Settings.jsx` (5 instances), `Community.jsx` (5 instances), `Assistant.jsx`, `Reviews.jsx`, `ReviewDetail.jsx`, `Billing.jsx`
- `src/pages/coach/`: `Clients.jsx`, `ClientDetail.jsx`, `Announcements.jsx`

**Fix (one PR):** add `signal` and `success` tokens to `tailwind.config.js`. Use `signal: '#A03A2C'` (PKFIT-rust, not Tailwind red) and `success: '#7A8C5C'` (muted gold-green) so semantic colors live in canon. Replace all instances.

#### Missing skeleton / animated loading state — flat "Loading" caps everywhere

`Workouts`, `Reviews`, `ReviewDetail`, `SessionDetail`, `ExerciseHistory`, `Inbox`, `Profile`, `Programs`, `Clients`, `Coach Inbox`, `StorageImage`, `Empty/Spinner` all render `<div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>`. After 2 s of latency this looks frozen.

**Fix:** add `animate-pulse` to the existing token, or build a `<Skeleton />` primitive that callers compose.

#### Generators have no progress / explicit success state

`WorkoutGenerator.jsx`, `MealGenerator.jsx`, `Reviews.jsx` (Generate this week) all show a busy button labeled "Generating" with no elapsed-time hint. AI calls take 10–25 s. Result handling is also silent — generated programs route back to a list with no "Saved." confirmation, leaving the user uncertain whether anything happened.

**Fix:** elapsed-time pill or animated dots; success toast / header line ("Saved to your programs.") on resolve.

#### N+1 query patterns hammer Supabase on busy surfaces

- `src/pages/client/Community.jsx:200-209` — one count per post, up to 100 posts per refresh, **and** `useRealtime` re-fires `load()` on every reaction, so any reaction triggers 100 count queries.
- `src/pages/coach/Inbox.jsx:27-45` — two queries per thread; 200 threads = 400 round-trips.
- `src/components/NotificationBell.jsx:81-82` — full reload (4–6 queries) on every realtime DM/post.

**Fix:** server-side aggregate / RPC for grouped counts; incremental updates in realtime handlers (don't re-fetch the whole list).

#### Form & validation gaps

| Where | Issue | Fix |
|---|---|---|
| `Onboarding.jsx:134-145` | No `required` on Step 0 fields; user can Next with empty Name and Age | Add `required` + min/max on age |
| `Profile.jsx:285` (weight input) | `type="number" step="0.1"` but no `min`/`max` — accepts negative | `min="0" max="500"` |
| `Settings.jsx:263-286` | Macro floor inputs accept negatives | `min="0"` |
| `MealGenerator.jsx:89` | `kcal_target` accepts any value | `min="1200" max="6000"` |
| `WorkoutBuilder.jsx:146` | Save enabled with empty exercise rows | Validate at least one exercise has a name |
| `Login.jsx`, `Signup.jsx` | Bare `e.message` displayed in red caps | Wrap Supabase errors in human messages |

#### A11y — focus management & forms

- `src/components/Layout.jsx:81` has `<main id="main" tabIndex={-1}>` but **no** `main.focus()` on route change. SR users don't get an anchor on navigation.
- Mobile **More sheet** in `Layout.jsx:224-261` has no focus trap; tabbing escapes the dialog.
- `NotificationBell.jsx:111-115` popover has no focus trap, no Escape-to-close.
- Multiple raw `<input>` elements without `<label>` / `aria-label`:
  - `LogSessionForm.jsx:176-202` (3 inputs per set, only column headers visually associate)
  - `DMThread.jsx:159` (message input, placeholder only)
  - `Assistant.jsx:213-219` (send box, placeholder only)
  - `Community.jsx:138` (comment input)
- `Calendar.jsx:67-84` Prev/Today/Next buttons lack `aria-label`.
- `Assistant.jsx:156` delete-conversation uses `opacity-0 group-hover:opacity-100` — **hover-only**, invisible on touch.
- `ExerciseHistory.jsx:142-146` table rows are `cursor-pointer` divs with `onClick` only — no keyboard handler, no `role="button"`, no `tabIndex`.

#### Empty states gaps

- `Dashboard.jsx` when `activeProgram` exists but `exercises` is empty → renders empty `<ul>`. Add "No exercises on this program — open builder."
- `Reviews.jsx:80-82` empty has no action — should expose "Generate this week".
- `coach/Programs.jsx`, `coach/Clients.jsx`, `coach/Revenue.jsx` — no empty state, table headers render alone.
- `ExercisePicker.jsx` — no "No match" row when filter has zero results (dropdown just hides).

#### Confirms via `window.confirm` (Quiet-Assassin breaker)

Browser-native confirm dialogs in `coach/Dashboard.jsx:92-96` (bulk review), `Community.jsx` (post delete), `Assistant.jsx` (delete conversation). They shatter the brand aesthetic.

**Fix:** small branded modal primitive in `components/ui/Modal.jsx` reused everywhere.

#### Stream cancellation in Assistant

`Assistant.jsx` send path doesn't `AbortController` previous streams. Rapid-fire messages produce two open streams.

#### LogSessionForm "Add note" hack

`LogSessionForm.jsx:205` — opening the per-set note uses `note: ' '` (single space) as the marker. The user then has to delete the space before typing.

**Fix:** separate `noteOpen[i]` boolean state per set.

#### LogSessionForm mobile cramp

`grid-cols-[32px_1fr_1fr_1fr_32px_32px]` (line 168) — six columns inside ~320 px. Weight/reps/RPE inputs compress to ~50 px each. Fix: collapse RPE column on mobile or stack vertically below xs breakpoint.

#### Auth & flow polish

- `Splash.jsx` has a hard-coded **900 ms** delay before redirecting. On a returning auth'd visit it adds latency for nothing.
- `AuthContext.jsx:33-42, 88` — `setLoading(false)` fires before profile loads; ProtectedRoute releases while `profile === null`, causing a flash where pages render with no user data.
- `Signup.jsx:23-24` — `setTimeout(() => navigate('/onboarding'), 1200)` is fragile. If user hits Back, they're stuck on the success screen with no escape.
- `NotFound.jsx:21-25` shows a "Dashboard" link to **anyone** including signed-out users (who get bounced to `/login`). Should branch on auth state.

#### Landing — external link hygiene

`Landing.jsx:34-39` and 121-125 — Gumroad CTA opens in same tab without `rel="noopener"`. Also no `target="_blank"`. External-product purchase outside the app should open a new tab.

### 🟡 Minor

| # | Where | Finding |
|---|---|---|
| m1 | `src/components/ui/Empty.jsx` | Default eyebrow "Empty surface" is generic; let callers pass it. Add `animate-pulse` to spinner box. |
| m2 | `src/components/Layout.jsx:159` | Notification badge `min-w-[16px]` clips "99+" at small zoom. Bump to 20 px. |
| m3 | `src/components/ErrorBoundary.jsx` | Add `role="alert"` so SR announces. |
| m4 | `src/components/Sparkline.jsx` | Hard-coded `#C9A84C` — use a CSS var so palette stays synced. |
| m5 | `src/components/StorageImage.jsx` | Static "Loading" — add `animate-pulse`. |
| m6 | `src/components/HabitHeatmap.jsx` | Cells aren't interactive — fine. No focus state needed. |
| m7 | `src/pages/client/Workouts.jsx:232` | Filter chips lack focus ring. |
| m8 | `src/pages/client/Habits.jsx:146` | Trash button next to toggle has no `aria-label`. |
| m9 | `src/pages/client/Calendar.jsx` | Marker bars `h-1 w-6` may overflow at 52 px cell on iPhone SE. Use `w-full`. |
| m10 | `src/pages/client/Settings.jsx:211-213` | Units select writes on every change with no saved indicator. Add brief "Saved" toast. |
| m11 | `src/pages/coach/ClientDetail.jsx:301` | `msg` doubles as success and error with same gold color. Distinguish. |
| m12 | `src/pages/coach/Announcements.jsx` | No live preview while typing — coach pins blind. |
| m13 | `src/pages/coach/Programs.jsx` | No filter / sort controls; coaches with 50+ clients can't slice. |
| m14 | `src/pages/coach/Revenue.jsx` | Renders `client_id.slice(0,8)…` — useless without name join. (Same on coach Dashboard recent check-ins.) |
| m15 | `src/components/SessionView.jsx` | Null-session case has no back link. |
| m16 | `src/components/ContextPinMenu.jsx` | Disabled state lacks `aria-disabled`. |
| m17 | `src/components/DMThread.jsx:55-64` | Read-receipt fires on `load()` regardless of viewport visibility. |
| m18 | `src/pages/client/ExerciseHistory.jsx:209-214` | Dev-only Epley sanity check ships in source — move to a test. |
| m19 | `tailwind.config.js` | `tracking-wider2` / `tracking-widest2` are non-standard names — document in CLAUDE.md so future devs aren't confused. |
| m20 | `index.html:14-17` | OG image and description are minimal. Add Twitter Card meta + a richer `og:description`. |

---

## Front-page reconsideration

**Status:** keep the current copy/structure (it is on-voice and the DPL frame is intact), with three changes that *are* polish, not redesign:

1. **Reverse CTA hierarchy** — `Enter the App` becomes the primary (gold solid) and `Get the Blueprint · $37` becomes the secondary outline. Reasoning: this is the *app* landing; the e-book is the secondary product. Today the gold weight pulls users to Gumroad first.
2. **Fix and resize testimonial image** — compress to webp, swap with explicit dimensions, add `decoding="async"`.
3. **Add `target="_blank" rel="noopener"`** to the Gumroad links so users don't bounce out of the app context.

A more ambitious **landing-v2** is sketched in the PR description as an optional follow-up — narrower hero, eyebrow + headline + subhead pattern, sticker callout for the $250/mo plan as the lead — but is not in scope for this pass per the halt-condition spec ("if the redesign changes brand direction, STOP"). Two CTAs that go to two products is a content-architecture call for Percy, not a polish call.

---

## Quick wins (≤ 5 lines each)

These can land fast in a single sweep:

1. Add `signal` + `success` tokens to `tailwind.config.js`. (1-line edit)
2. Replace all `text-red-300` etc. with `text-signal`. (find/replace, 30-ish files, no logic change)
3. `Onboarding.jsx` — add `required` to Name + Age inputs.
4. `Profile.jsx`, `Settings.jsx`, `MealGenerator.jsx` — add `min`/`max` to numeric inputs.
5. `Splash.jsx` — drop the artificial 900 ms delay.
6. `Landing.jsx` — swap CTA order, add `target="_blank" rel="noopener"`.
7. `index.html` — add Twitter Card meta.
8. `ErrorBoundary.jsx` — add `role="alert"`.
9. `Layout.jsx` — focus `<main>` on route change.
10. `Calendar.jsx`, `Habits.jsx` — add `aria-label` on icon-only buttons.

## Deeper work (real refactors)

Saved for the Phase 2 PR:

A. **Define a shared `<Spinner />` and `<Skeleton />`** with `animate-pulse`; replace all flat "Loading" caps.
B. **`Modal` primitive** to replace `window.confirm` everywhere.
C. **Subscription gate** (`<RequiresActiveSubscription>`) wrapped around the protected client routes.
D. **Billing tier cards** — bullet feature lists, current-plan highlight, annual savings.
E. **Dashboard data-load** refactor to single `Promise.all` with cancellation.
F. **Onboarding** — protect, persist form to localStorage so refresh doesn't lose state.
G. **AuthContext** — defer `setLoading(false)` until profile resolves.
H. **Layout focus management + mobile sheet focus trap.**
I. **N+1 elimination** on Community, Coach Inbox, NotificationBell (incremental realtime).
J. **`testimonial.png`** compress + resize.
K. **AbortController** in Assistant stream send.

---

## Halt-condition checks

- ✅ No critical security issue surfaced (paywall hole noted; not a data-exposure vector).
- ✅ Tests green on baseline (no pre-existing failures).
- ⚠️ **ATLAS canon vs PKFIT canon** — work-order refers to ATLAS; codebase ships PKFIT. **Auditing against PKFIT.** Brand pivot would be out-of-scope for a polish pass.

---

## Phase 2 plan

A single PR titled `feat(app): Apple-tier quality pass — bug fixes + polish + landing CTA reorder` will land:

1. Critical fixes C1–C6 in atomic commits.
2. Major fixes — brand-token sweep, loading-state primitive, validation gaps, focus management, link hygiene, generator success state, billing tier rebuild, subscription gate.
3. Landing reorder + image fix (no v2 redesign without Percy's sign-off).

Minor 🟡 items not addressed in this pass go in a follow-up backlog item pinned in the PR body.
