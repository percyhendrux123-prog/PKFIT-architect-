# PKFIT-architect-

**The Architect's Blueprint** — the $37 landing page for the PKFIT 30-day body recomposition system.

## Purpose

A single-page site that sells The Architect's Blueprint. The CTA routes every visitor to the Gumroad checkout:

```
https://percyhendrux.gumroad.com/l/khcus
```

## Stack

Static HTML, CSS, and JS deployed on Netlify. No build step, no framework, no dependencies.

```
PKFIT-architect-/
├── blueprint-landing.html   # Netlify entry point
├── assets/
│   ├── css/main.css         # Extracted styles
│   ├── js/                  # Reserved (no JS yet)
│   ├── img/                 # Brand assets
│   └── fonts/               # Self-hosted woff2
├── netlify.toml             # Publish + headers + cache
├── robots.txt
├── _redirects               # Clean-URL rules
└── README.md
```

## Brand tokens

| Token        | Value      | Use                     |
|--------------|------------|-------------------------|
| Background   | `#080808`  | Page base               |
| Gold accent  | `#C8A96E`  | Headings, CTA, dividers |
| Text         | `#F5F5F5`  | Body copy               |
| Display font | Bebas Neue | Headings, CTA           |
| Body font    | DM Mono    | Paragraphs, UI          |

Fonts are self-hosted via `@font-face` from `/assets/fonts/`. No Google Fonts CDN at runtime.

## Local preview

No build step. Serve the directory with any static server:

```
python3 -m http.server 8080
# then open http://localhost:8080/blueprint-landing.html
```

## Deploy

Netlify publishes the repository root. `netlify.toml` declares no build command, long cache on `/assets/*`, and security headers. Pushing to `main` auto-deploys; branch deploys produce preview URLs.

## Brand rules

- CTA on the site is the Gumroad URL only. No Stripe link. No YouTube embed.
- No emoji, no exclamation points, no hype language in shipped copy.
- Copy changes require explicit sign-off from Coach PK.
