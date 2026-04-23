# Cloud Agent Starter Skill: Run and Test PKFIT-architect-

Use this skill first when you need to run, inspect, or validate this repository in Cursor Cloud.

## 1) Zero-friction setup (run this first)

1. Confirm workspace root and branch:
   - `pwd`
   - `git status -sb`
2. Confirm this is a static site (no package install needed):
   - `rg "No build step" README.md`
3. Local preview server (primary run path):
   - `python3 -m http.server 8080`
   - Open `http://localhost:8080/blueprint-landing.html`

### Login/auth expectations

- No app login is required for local run/testing.
- No `.env` bootstrap is required.
- Netlify login is only needed for manual deploy debugging outside normal git push flow; if needed, use `netlify login` in an authenticated environment.

### Feature flags and mocks

- There are no runtime feature flags in this codebase today.
- If a task asks for a flag-like experiment, use a temporary local-only mock:
  - Duplicate the target section in `blueprint-landing.html`.
  - Gate variants with a temporary class or HTML comment marker.
  - Validate locally, then remove the mock before commit.

## 2) Codebase-area workflows

### Area A: Page markup and inline styles (`blueprint-landing.html`)

When to use: copy/layout/content edits, CTA edits, visual tweaks in the main page file.

Run/test workflow:
1. Start static server: `python3 -m http.server 8080`
2. Open: `http://localhost:8080/blueprint-landing.html`
3. Verify:
   - Page loads without missing-file errors in browser console.
   - Intended text/structure updates render.
   - Links and CTA target are correct.
4. Fast terminal checks:
   - `rg "href=" blueprint-landing.html`
   - `rg "percyhendrux.gumroad.com/l/khcus" blueprint-landing.html content`

### Area B: Shared assets and styling (`assets/css`, `assets/fonts`, `assets/img`)

When to use: typography, palette, spacing, images, and font/asset path changes.

Run/test workflow:
1. Keep static server running on port 8080.
2. Hard-refresh browser after each change.
3. Verify:
   - Updated styles render at mobile and desktop widths.
   - Fonts load from `/assets/fonts/*` (no CDN dependency expected).
   - Image paths resolve and no 404s appear in network panel.
4. Fast terminal checks:
   - `rg "@font-face|url\\('/assets/fonts" assets/css/main.css`
   - `rg "assets/img|favicon|apple-touch-icon|og.png" blueprint-landing.html`

### Area C: Content playbooks (`content/*.md`)

When to use: campaign copy, script packs, carousel guidance, CTA language edits.

Run/test workflow:
1. Edit target markdown file.
2. Validate required CTA consistency:
   - `rg "percyhendrux.gumroad.com/l/khcus" content`
3. Sanity-check formatting:
   - `rg "^#|^##|^- " content/*.md`
4. If content is referenced in the landing page, cross-check the corresponding section in `blueprint-landing.html`.

### Area D: Utility script (`scripts/generate-brand-placeholders.py`)

When to use: regenerating OG image/favicon placeholders.

Run/test workflow:
1. Install script deps only when needed:
   - `python3 -m pip install Pillow fonttools`
2. Run:
   - `python3 scripts/generate-brand-placeholders.py`
3. Verify outputs:
   - `assets/img/og.png`
   - `assets/img/favicon.png`
   - `assets/img/apple-touch-icon.png`
4. Confirm script reports success in stdout.

## 3) Minimal pre-PR validation checklist

Run the smallest checks that prove your touched area works:

- Markup/CSS work: local static preview + visual/manual verification.
- Content-only work: grep checks for CTA/link consistency.
- Script work: run script and confirm expected output files.

Always include command evidence in your final agent summary.

## 4) Keeping this skill current

Update this file whenever a new reliable runbook trick is discovered:

1. Add the trick under the relevant codebase area.
2. Include exact commands and expected result signals.
3. Prefer the shortest workflow that proves correctness.
4. Remove outdated steps immediately when project tooling changes.

If the repo gains a build system, tests, auth, or real feature flags, update Sections 1-3 first.
