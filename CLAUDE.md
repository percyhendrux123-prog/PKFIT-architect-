# CLAUDE.md — PKFIT-architect-

> Guide for AI assistants working in this repository.

## Project Overview

**PKFIT-architect-** is a newly initialized project. The codebase is in its earliest stage — no source code, build system, or framework has been set up yet.

**Status:** Pre-development (repository scaffolding only)

## Repository Structure

```
PKFIT-architect-/
├── CLAUDE.md          # This file — AI assistant guide
└── README.md          # Project title
```

As the project grows, update this section to reflect the actual directory layout.

## Common Commands

<!-- Update these as the project adds tooling -->

| Task         | Command | Notes                          |
|--------------|---------|--------------------------------|
| Install deps | TBD     | No package manager configured  |
| Build        | TBD     | No build system configured     |
| Test         | TBD     | No test framework configured   |
| Lint         | TBD     | No linter configured           |
| Format       | TBD     | No formatter configured        |

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
