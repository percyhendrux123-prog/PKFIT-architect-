---
name: pkfit-stack
description: Current state of the PKFIT business stack - operator, offer ladder with live checkout URLs, properties and repos, and which surface serves which awareness stage. Load whenever a PKFIT task needs to know what exists, what it costs, or where to send someone.
---

# PKFIT STACK — current as of 2026-08-23

## Operator

**Coach PK (Percy Hendrux)** — IFBB Pro, Men's Physique. PKFIT sells a written system,
not a program. The credential is stated once and never leaned on. Site line, verbatim:
`THE CREDENTIAL IS NON-PORTABLE.`

## Offer ladder

Reference **one rung at a time**. Never stack offers. Never sell a higher rung to
someone who has not run the lower one. **Default destination for cold traffic is a free
tool, not the Blueprint.**

| Rung | Asset | Destination |
|------|-------|-------------|
| Free | Peptides dosage calculator (email-gated, research-use, firewalled) | `/peptides` |
| Free | PKFIT-lite | `pkfit-lite.netlify.app` |
| Free | Diagnostic — loop-signature self-assessment | `/diagnostic` |
| Free | Workbook · Field Notes · Proof | `/workbook` `/field-notes` `/proof` |
| **$37** | **The Architect's Blueprint** — 30 days, four phases, lifetime access | `percyhendrux.gumroad.com/l/khcus` |
| Mid | **Performance Standard** — a supervised block, not a subscription | `buy.stripe.com/5kQfZbekE1ge99G9bW5gc0h` |
| High | 1:1 coaching, application-gated, real capacity limits | `/apply` → Trainerize |

## Awareness stages and which asset serves them

| Stage | Asset | Health |
|-------|-------|--------|
| Unaware | X posts, `/field-notes` | Partial gap |
| Problem-aware | Homepage hero + M01–M05 loop diagram | Strong |
| Solution-aware | `/diagnostic`, pkfit-lite, `/peptides` | Weak — no shared capture |
| Product-aware | `blueprint-landing.html` | Gap — no bridge from the free tools |
| Most-aware | Performance Standard, `/apply` | Gap — no post-purchase sequence |

## Properties

| Property | Repo | Stack | Role |
|----------|------|-------|------|
| PKFIT brand site | `PKFIT-architect-` | Static HTML/CSS, Netlify, no build step | Marketing surface, offer ladder, $37 landing page |
| Client share + console | `PK-PERCYKEITH` | Vite + React 18 + Supabase | Scroll-driven client share pages (six acts), coach notes, PR moments |
| Axiom lead runtime | `pkfit-execution` | Netlify Functions + vanilla JS | **Separate business** — Lauren CRM, Axiom Final Expense. Not PKFIT. Never cross-reference |
| Sibling property | — | — | `deployaxiom.com` |

## Standing objections to pre-empt

At $37: prior program failure and self-blame · "$37 means thin" · no clean 30 days ·
peptide content contaminating trust.
At coaching price: subscription fatigue · "is this coach real or just good at graphics" ·
"I'll do it myself once I get consistent" · fear of rejection at the application step.

## Channel policy

X is primary. Instagram is secondary. Email is the terminal, not a channel. TikTok,
YouTube long-form, LinkedIn, Threads, and Pinterest are explicitly out of scope until X
passes 5,000 followers.
