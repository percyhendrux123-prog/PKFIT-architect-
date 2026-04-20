# CLAUDE.md — PKFIT-architect-

> Guide for AI assistants working in this repository.

## Project Overview

**PKFIT-architect-** is the PKFIT coaching app: a React + Vite application deployed on Netlify with Supabase (auth + Postgres + realtime), Stripe subscriptions, and Anthropic-powered generators and client assistant. The public landing page (`/`) is a React component.

**Status:** Active (app v1 on `claude/pkfit-app-build-v1-6PvBo`)

## Repository Structure (summary)

```
PKFIT-architect-/
├── index.html                # Vite shell
├── netlify.toml              # build, functions, security headers, SPA redirect
├── package.json
├── public/                   # fonts, favicon, og image, _redirects
├── src/                      # React app (pages/, components/, lib/, context/, hooks/)
├── netlify/functions/        # server-side only (Anthropic + Stripe)
└── supabase/migrations/      # Postgres schema + RLS
```

See `README.md` for full structure, env vars, and deploy steps.

### Key Tech
- React 18 + Vite 5, Tailwind CSS 3, React Router v6
- Supabase (auth + db + realtime)
- Stripe (subscriptions)
- Anthropic Claude Sonnet 4 (server-side only, via Netlify Functions)
- **Fonts:** Bebas Neue (headings), DM Mono (body) — self-hosted from `/public/fonts/`
- **Theme:** #080808 bg, #C9A84C gold, #F5F5F5 ink

## Common Commands

| Task         | Command             | Notes                                   |
|--------------|---------------------|-----------------------------------------|
| Install deps | `npm install`       | Node 20 required                        |
| Dev server   | `npm run dev`       | Vite on :5173                           |
| Build        | `npm run build`     | Emits `dist/`                           |
| Preview      | `npm run preview`   | Preview build on :4173                  |
| Lint         | `npm run lint`      | ESLint over `src/`                      |
| Test         | TBD                 | No test framework configured yet        |
| Format       | TBD                 | No formatter configured yet             |

## Git Workflow

- **Default branch:** `main`
- **Branch naming:** `claude/<description>-<id>` for Claude-authored branches; use descriptive kebab-case names otherwise
- **Commit messages:** Use concise, imperative-mood messages (e.g., "Add user authentication", "Fix date parsing bug"). Focus on *why* over *what* when the diff is self-explanatory.
- **Do not force-push** to `main`

## Development Guidelines

### General Principles

- Read existing code before modifying it — understand context first
- Prefer editing existing files over creating new ones
- Do not add speculative abstractions, unused utilities, or premature error handling
- Keep changes minimal and focused on the task at hand
- Do not add comments, docstrings, or type annotations to code you did not change

### Security

- Never commit secrets, API keys, or credentials (`.env`, `credentials.json`, etc.)
- Validate at system boundaries (user input, external APIs) but trust internal code
- Be mindful of OWASP top 10 vulnerabilities when writing web-facing code

### Code Style

Conventions will be established as the project adopts a language and framework. When that happens, update this section with:

- Language and framework version
- Import ordering conventions
- Naming conventions (variables, functions, files)
- Preferred patterns and idioms
- Linter and formatter configuration details

### Testing

No test framework is configured yet. When one is added, document:

- Test file location and naming convention (e.g., `*.test.ts` colocated with source)
- How to run the full suite and individual tests
- Minimum coverage expectations
- Mocking and fixture patterns

## CI/CD

No CI/CD pipeline is configured. When one is added, document:

- Pipeline triggers and stages
- Required checks before merging
- Deployment process

## Environment Setup

No environment configuration exists yet. When dependencies are added, document:

- Required runtime versions (Node.js, Python, etc.)
- Environment variable setup (reference `.env.example`)
- Local development prerequisites

## Updating This File

Keep this file current as the project evolves. When adding new tooling, frameworks, or conventions, update the relevant sections above. A stale CLAUDE.md is worse than none — it leads AI assistants to make incorrect assumptions.
