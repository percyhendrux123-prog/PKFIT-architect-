# Migration paths — adopting `@pkfit/ui`

This PR introduces `@pkfit/ui` as the canonical React source for the ATLAS
chat-UI pattern. None of the three target surfaces consume it yet.
Below are the migration paths for follow-up PRs.

## 1. `pkfit-intake-deploy` (currently vanilla HTML)

**Today:** `public/index.html` is a single 930-line file. CSS in `<style>`,
ATLAS tokens at the top, JS at the bottom hand-builds DOM (`document.createElement`,
`addTurn()`, `chipsEl()`, `emailCard()`, `nextStepCard()`, `ctaCard()`).

**Migration shape:**
- Convert the project to a Vite + React app (npm init vite@latest, react template).
- Add `@pkfit/ui` as a dependency (workspace link, or publish to npm registry first).
- Move the page shell (header, axiom credit, app grid divs) into `App.jsx`.
- Replace `addTurn(...)` calls with `<Turn>...</Turn>` JSX.
- Replace `chipsEl(...)` / `emailCard(...)` / `nextStepCard(...)` / `ctaCard(...)`
  with the named components from `@pkfit/ui`.
- Move flow logic (askName, askGoal, etc.) into a reducer or hook in the
  intake app — `@pkfit/ui` does not own flow state.
- Delete the inline `<style>` block in favor of `import '@pkfit/ui/tokens.css'`.
- Keep the `/api/chat` Netlify function untouched.

**Estimated diff:** ~1 net file change in app code (index.html → src/main.jsx +
small App.jsx + flow.js), plus the package.json/vite scaffolding.

## 2. `pkfit-checkin-deploy` (currently vanilla HTML)

**Today:** `public/index.html` is a single 1,170-line file. Same architecture
as intake plus `sliderCard()`, `photoCard()`, `streakCard()`, and the
`#streakPill` header element.

**Migration shape:**
- Same Vite + React conversion as intake.
- Replace `sliderCard()` → `<SliderCard>`, `streakCard()` → `<StreakCard>`,
  shared chip/cta builders → `<Chips>` / `<CtaCard>`.
- `photoCard()` is **not** part of `@pkfit/ui` v0.1.0 — it has app-specific
  upload behavior. Keep it local in the check-in app, or propose a `PhotoCard`
  addition to `@pkfit/ui` in a follow-up.
- The `#streakPill` in the header is also app-local — leave it in the
  check-in app's `App.jsx`.
- Persist localStorage logic (`STORAGE_KEY = 'pkfit-checkin-v1'`) untouched.

**Estimated diff:** larger than intake because of the slider, photo, and
streak surfaces; still a single-app rewrite of one file.

## 3. `pkfit-app` — `src/pages/client/Assistant.jsx`

**Today:** 225-line React component using Tailwind + the local
`components/ui/Button` and `components/ContextPinMenu`. **Does not use any
ATLAS classes today** — different visual treatment entirely.

**Migration shape:**
- This is a **redesign**, not a refactor. Adopting `@pkfit/ui` means
  switching the in-app coach surface from the current Tailwind/Card style to
  the ATLAS dark/cream/moon treatment.
- Requires a UX call from Percy first. Visual change is significant.
- If approved: add `import '@pkfit/ui/tokens.css'` to `src/main.jsx`,
  rewrite `Assistant.jsx` to use `<Turn>`, `<Bubble>`, `<ComposerWrap>`
  for the conversation panel. Keep the conversation list sidebar as-is or
  redesign separately.
- The page shell (header + app grid) doesn't exist in pkfit-app yet — those
  ATLAS app-shell elements would need to be added if you want full visual
  parity with intake/checkin.

**Estimated diff:** 1 file rewrite (Assistant.jsx) + tokens.css import +
optional new shell components. Out of scope for this PR.
